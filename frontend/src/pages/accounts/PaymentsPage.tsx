import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  CreditCard,
  Building2,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface PaymentItem {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  notes: string | null;
  party: {
    id: string;
    code: string;
    name: string;
    phone?: string;
  };
  account: {
    id: string;
    code: string;
    name: string;
  };
  transaction?: {
    id: string;
    invoiceNumber: string;
    netAmount: number;
    paidAmount: number;
    paymentStatus: string;
    store?: { id: string; code: string; name: string };
    purchaseOrder?: { id: string; poNumber: string };
  };
}

interface StoreItem {
  id: string;
  code: string;
  name: string;
}

interface PartyItem {
  id: string;
  code: string;
  name: string;
  type: string;
  storeId?: string | null;
}

interface PayableInvoiceOption {
  id: string;
  invoice: string;
  po: string;
  total: number;
  paid: number;
  outstanding: number;
}

const PAYMENT_METHODS = [
  'Bank',
  'Cash',
  'UPI',
  'Card',
  'Cheque',
  'NEFT',
  'RTGS',
  'IMPS',
  'Other',
];

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  // Metadata dropdowns
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [suppliers, setSuppliers] = useState<PartyItem[]>([]);

  // Create Payment Voucher Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice options for selected party & store
  const [invoiceOptions, setInvoiceOptions] = useState<PayableInvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // View Voucher Details Modal
  const [viewPayment, setViewPayment] = useState<PaymentItem | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (methodFilter !== 'ALL') queryParams.append('paymentMethod', methodFilter);
    if (storeFilter !== 'ALL') queryParams.append('storeId', storeFilter);

    const res = await apiRequest<PaymentItem[]>(`/accounts/payments?${queryParams.toString()}`);
    if (res.success && res.data) {
      setPayments(res.data);
    }
    setLoading(false);
  };

  const fetchMetadata = async () => {
    const [storesRes, partiesRes] = await Promise.all([
      apiRequest<StoreItem[]>('/accounts/stores'),
      apiRequest<PartyItem[]>('/accounts/parties?type=SUPPLIER'),
    ]);

    if (storesRes.success && storesRes.data) setStores(storesRes.data);
    if (partiesRes.success && partiesRes.data) setSuppliers(partiesRes.data);
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [search, methodFilter, storeFilter]);

  // Load unpaid invoices when party or store changes
  useEffect(() => {
    async function loadPartyInvoices() {
      if (!partyId) {
        setInvoiceOptions([]);
        return;
      }
      setLoadingInvoices(true);
      const params = new URLSearchParams({
        supplierId: partyId,
        status: 'ALL',
      });
      if (storeId) params.append('storeId', storeId);

      const res = await apiRequest<any[]>(`/accounts/payables?${params.toString()}`);
      if (res.success && res.data) {
        // filter unpaid/partially paid
        const eligible = res.data
          .filter((inv) => inv.outstanding > 0)
          .map((inv) => ({
            id: inv.id,
            invoice: inv.invoice,
            po: inv.po,
            total: inv.total,
            paid: inv.paid,
            outstanding: inv.outstanding,
          }));
        setInvoiceOptions(eligible);
      }
      setLoadingInvoices(false);
    }
    loadPartyInvoices();
  }, [partyId, storeId]);

  const handleSelectInvoice = (invId: string) => {
    setTransactionId(invId);
    const selected = invoiceOptions.find((i) => i.id === invId);
    if (selected) {
      setAmount(selected.outstanding.toFixed(2));
      setNotes(`Payment against invoice ${selected.invoice}`);
    }
  };

  const handleOpenCreateModal = () => {
    setPartyId(suppliers[0]?.id || '');
    setStoreId(stores[0]?.id || '');
    setTransactionId('');
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank');
    setReferenceNumber('');
    setNotes('');
    setFormError(null);
    setFormSuccess(null);
    setIsCreateModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (transactionId) {
      const selected = invoiceOptions.find((i) => i.id === transactionId);
      if (selected && amountNum > selected.outstanding + 0.01) {
        setFormError(`Amount exceeds invoice remaining outstanding of ₹${selected.outstanding.toFixed(2)}.`);
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const res = await apiRequest('/accounts/payments', {
      method: 'POST',
      body: JSON.stringify({
        partyId,
        storeId,
        transactionId: transactionId || undefined,
        amount: amountNum,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (res.success) {
      setFormSuccess('Payment voucher recorded successfully! Accounts and Ledgers updated.');
      window.dispatchEvent(new CustomEvent('accounts:transaction-posted'));
      setTimeout(() => {
        setIsCreateModalOpen(false);
        fetchPayments();
      }, 1200);
    } else {
      setFormError(res.message || 'Failed to record payment voucher.');
    }
  };

  const handleExportCSV = () => {
    if (!payments.length) return;
    const headers = [
      'Voucher #',
      'Date',
      'Paid To Supplier',
      'Supplier Code',
      'Payment Mode',
      'Account Debited/Credited',
      'Reference / UTR #',
      'Amount (₹)',
      'Invoice #',
      'Notes',
    ];
    const rows = payments.map((p) => [
      `"${p.paymentNumber}"`,
      new Date(p.paymentDate).toLocaleDateString(),
      `"${p.party?.name}"`,
      `"${p.party?.code}"`,
      `"${p.paymentMode}"`,
      `"${p.account?.name}"`,
      `"${p.referenceNo || ''}"`,
      p.amount,
      `"${p.transaction?.invoiceNumber || 'On Account'}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Payment_Vouchers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedSupplierName = suppliers.find((s) => s.id === partyId)?.name || 'Supplier';
  const totalAmountPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PAYMENTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Vouchers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record payments to suppliers, settle invoices, and update Party Ledgers & Cash/Bank books
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchPayments}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export Vouchers
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenCreateModal}
          >
            Record Payment Voucher
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Disbursements</span>
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">
              ₹ {totalAmountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{payments.length} Vouchers recorded</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bank Disbursements</span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-emerald-700">
              ₹{' '}
              {payments
                .filter((p) => p.paymentMode !== 'CASH')
                .reduce((sum, p) => sum + p.amount, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">NEFT, RTGS, Cheque, Transfer</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cash Disbursements</span>
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-amber-700">
              ₹{' '}
              {payments
                .filter((p) => p.paymentMode === 'CASH')
                .reduce((sum, p) => sum + p.amount, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Petty cash settlements</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher #, supplier, invoice..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Method:</span>
              </div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="flex-1 sm:flex-initial text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="flex-1 sm:flex-initial text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[850px]">
            <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Paid To (Supplier)</TableHead>
                  <TableHead>Linked Invoice</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Disbursed From Account</TableHead>
                  <TableHead>Ref / UTR #</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading payment vouchers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                      No payment vouchers recorded yet. Click "Record Payment Voucher" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                        {p.paymentNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                        <div>{p.party?.name}</div>
                        <span className="font-mono text-[10px] text-slate-400">{p.party?.code}</span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {p.transaction?.invoiceNumber ? (
                          <div>
                            <span className="font-mono font-medium text-slate-900">{p.transaction.invoiceNumber}</span>
                            {p.transaction.purchaseOrder?.poNumber && (
                              <span className="block text-[10px] text-blue-600">
                                {p.transaction.purchaseOrder.poNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Advance / On Account</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={p.paymentMode === 'CASH' ? 'warning' : 'blue'}>{p.paymentMode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {p.account?.name || 'Bank Account'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                        {p.referenceNo || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 text-right whitespace-nowrap">
                        ₹ {p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewPayment(p)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                            title="View Voucher Details"
                          >
                            <FileText className="w-3.5 h-3.5" /> View
                          </button>
                          <Link
                            to={`/accounts/ledger?partyId=${p.party?.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                            title="View Supplier Ledger"
                          >
                            <ReceiptIcon className="w-3.5 h-3.5" /> Ledger
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      {/* Record Payment Voucher Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Payment Voucher"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRecordPayment}
              loading={submitting}
              icon={<CreditCard className="w-3.5 h-3.5" />}
            >
              Confirm & Post Payment
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier (Party) <span className="text-rose-500">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setTransactionId('');
                }}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store <span className="text-rose-500">*</span>
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Invoice / PO (Optional)
              </label>
              <select
                value={transactionId}
                onChange={(e) => handleSelectInvoice(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">-- Direct Advance / On Account --</option>
                {invoiceOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Invoice {inv.invoice} | Due: ₹{inv.outstanding.toFixed(2)} | {inv.po}
                  </option>
                ))}
              </select>
              {loadingInvoices && <p className="text-[10px] text-slate-400 mt-1">Loading supplier invoices...</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / UTR / Cheque Number</label>
            <input
              type="text"
              placeholder="e.g. HDFC-NEFT-904123 or Cheque 11452"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Voucher Narration / Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Voucher narration..."
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Double Entry Preview */}
          <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-2">
              <ReceiptIcon className="w-3.5 h-3.5" />
              <span>Double-Entry Journal Voucher Preview</span>
            </div>
            <div className="font-mono text-[11px] space-y-1 text-slate-800">
              <div className="flex justify-between border-b border-blue-200/50 pb-1">
                <span className="text-blue-950 font-medium">
                  Dr 2010 Accounts Payable ({selectedSupplierName})
                </span>
                <span className="font-bold text-blue-900">
                  ₹ {(parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-600">
                  Cr {paymentMethod.toUpperCase() === 'CASH' ? '1010 Cash in Hand' : '1020 Bank Account'}
                </span>
                <span className="font-bold text-slate-900">
                  ₹ {(parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              * Posting will atomically update Supplier Ledger, Payable Balance, Journal, and Cash/Bank Book.
            </p>
          </div>
        </form>
      </Modal>

      {/* View Voucher Detail Modal */}
      {viewPayment && (
        <Modal
          isOpen={!!viewPayment}
          onClose={() => setViewPayment(null)}
          title={`Payment Voucher Details — ${viewPayment.paymentNumber}`}
          size="md"
          footer={
            <Button size="sm" variant="outline" onClick={() => setViewPayment(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">Voucher Number</span>
                <span className="font-mono font-bold text-blue-600">{viewPayment.paymentNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Payment Date</span>
                <span className="text-slate-800 font-medium">
                  {new Date(viewPayment.paymentDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Paid To Supplier</span>
                <span className="font-semibold text-slate-900">{viewPayment.party?.name}</span>
                <span className="block text-[10px] text-slate-400 font-mono">{viewPayment.party?.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Payment Mode</span>
                <div className="mt-0.5">
                  <Badge variant="blue">{viewPayment.paymentMode}</Badge>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Account Credited</span>
                <span className="text-slate-800 font-medium">{viewPayment.account?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Reference / UTR</span>
                <span className="font-mono text-slate-800">{viewPayment.referenceNo || '—'}</span>
              </div>
            </div>

            {viewPayment.transaction && (
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="font-bold text-slate-800 block mb-1">Settled Invoice Information</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Invoice:</span>{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {viewPayment.transaction.invoiceNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">PO:</span>{' '}
                    <span className="font-mono text-slate-800">
                      {viewPayment.transaction.purchaseOrder?.poNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Invoice:</span>{' '}
                    <span className="font-mono">
                      ₹ {viewPayment.transaction.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Status:</span>{' '}
                    <Badge variant={viewPayment.transaction.paymentStatus === 'PAID' ? 'success' : 'blue'}>
                      {viewPayment.transaction.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-emerald-100 bg-emerald-50/40 p-3 rounded-lg flex items-center justify-between">
              <span className="font-bold text-emerald-900">Total Amount Disbursed:</span>
              <span className="font-mono text-base font-bold text-emerald-700">
                ₹ {viewPayment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {viewPayment.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block font-medium mb-0.5">Narration:</span>
                <p className="text-slate-700 italic">{viewPayment.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentsPage;

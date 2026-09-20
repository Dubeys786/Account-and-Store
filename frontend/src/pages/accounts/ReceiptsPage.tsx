import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Receipt as ReceiptIcon,
  Building2,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Store as StoreIcon,
  ArrowDownRight,
  CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  receiptDate: string;
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
}

interface StoreItem {
  id: string;
  code: string;
  name: string;
}

interface CustomerPartyItem {
  id: string;
  code: string;
  name: string;
  type: string;
  storeId?: string | null;
}

interface ReceivableInvoiceOption {
  id: string;
  invoice: string;
  total: number;
  received: number;
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

export const ReceiptsPage: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  // Metadata dropdowns
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [customers, setCustomers] = useState<CustomerPartyItem[]>([]);

  // Create Receipt Voucher Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice options for selected customer & store
  const [invoiceOptions, setInvoiceOptions] = useState<ReceivableInvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // View Voucher Details Modal
  const [viewReceipt, setViewReceipt] = useState<ReceiptItem | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (methodFilter !== 'ALL') queryParams.append('paymentMethod', methodFilter);
    if (storeFilter !== 'ALL') queryParams.append('storeId', storeFilter);

    const res = await apiRequest<ReceiptItem[]>(`/accounts/receipts?${queryParams.toString()}`);
    if (res.success && res.data) {
      setReceipts(res.data);
    }
    setLoading(false);
  };

  const fetchMetadata = async () => {
    const [storesRes, partiesRes] = await Promise.all([
      apiRequest<StoreItem[]>('/accounts/stores'),
      apiRequest<CustomerPartyItem[]>('/accounts/parties?type=CUSTOMER'),
    ]);

    if (storesRes.success && storesRes.data) setStores(storesRes.data);
    if (partiesRes.success && partiesRes.data) setCustomers(partiesRes.data);
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [search, methodFilter, storeFilter]);

  // Load unpaid invoices when customer or store changes
  useEffect(() => {
    async function loadCustomerInvoices() {
      if (!partyId) {
        setInvoiceOptions([]);
        return;
      }
      setLoadingInvoices(true);
      const params = new URLSearchParams({
        customerId: partyId,
        status: 'ALL',
      });
      if (storeId) params.append('storeId', storeId);

      const res = await apiRequest<any[]>(`/accounts/receivables?${params.toString()}`);
      if (res.success && res.data) {
        const eligible = res.data
          .filter((inv) => inv.outstanding > 0)
          .map((inv) => ({
            id: inv.id,
            invoice: inv.invoice,
            total: inv.total,
            received: inv.received,
            outstanding: inv.outstanding,
          }));
        setInvoiceOptions(eligible);
      }
      setLoadingInvoices(false);
    }
    loadCustomerInvoices();
  }, [partyId, storeId]);

  const handleSelectInvoice = (invId: string) => {
    setTransactionId(invId);
    const selected = invoiceOptions.find((i) => i.id === invId);
    if (selected) {
      setAmount(selected.outstanding.toFixed(2));
      setNotes(`Collection against sales invoice ${selected.invoice}`);
    }
  };

  const handleOpenCreateModal = () => {
    setPartyId(customers[0]?.id || '');
    setStoreId(stores[0]?.id || '');
    setTransactionId('');
    setAmount('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank');
    setReferenceNumber('');
    setNotes('');
    setFormError(null);
    setFormSuccess(null);
    setIsCreateModalOpen(true);
  };

  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid receipt collection amount greater than zero.');
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

    const res = await apiRequest('/accounts/receipts', {
      method: 'POST',
      body: JSON.stringify({
        partyId,
        storeId,
        transactionId: transactionId || undefined,
        amount: amountNum,
        receiptDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (res.success) {
      setFormSuccess('Receipt voucher recorded successfully! Customer Ledger and Accounts updated.');
      setTimeout(() => {
        setIsCreateModalOpen(false);
        fetchReceipts();
      }, 1200);
    } else {
      setFormError(res.message || 'Failed to record receipt voucher.');
    }
  };

  const handleExportCSV = () => {
    if (!receipts.length) return;
    const headers = [
      'Voucher #',
      'Date',
      'Received From Customer',
      'Customer Code',
      'Receipt Mode',
      'Account Deposited',
      'Ref / Cheque #',
      'Amount (₹)',
      'Notes',
    ];
    const rows = receipts.map((r) => [
      `"${r.receiptNumber}"`,
      new Date(r.receiptDate).toLocaleDateString(),
      `"${r.party?.name}"`,
      `"${r.party?.code}"`,
      `"${r.paymentMode}"`,
      `"${r.account?.name}"`,
      `"${r.referenceNo || ''}"`,
      r.amount,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Receipt_Vouchers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCustomerName = customers.find((c) => c.id === partyId)?.name || 'Customer';
  const totalAmountReceived = receipts.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">RECEIPTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Receipt Vouchers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer receipts, settle sales invoices, and update Party Ledgers & Cash/Bank books
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchReceipts}
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
            Record Receipt Voucher
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Collections</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">
              ₹ {totalAmountReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{receipts.length} Vouchers recorded</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bank Collections</span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-emerald-700">
              ₹{' '}
              {receipts
                .filter((r) => r.paymentMode !== 'CASH')
                .reduce((sum, r) => sum + r.amount, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">RTGS, NEFT, Cheque, UPI</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cash Collections</span>
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-amber-700">
              ₹{' '}
              {receipts
                .filter((r) => r.paymentMode === 'CASH')
                .reduce((sum, r) => sum + r.amount, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Direct cash desk deposits</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher #, customer, reference..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Method:</span>
              </div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Received From (Customer)</TableHead>
                  <TableHead>Receipt Mode</TableHead>
                  <TableHead>Account Deposited</TableHead>
                  <TableHead>Ref / Cheque #</TableHead>
                  <TableHead className="text-right">Amount Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading receipt vouchers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      No receipt vouchers recorded yet. Click "Record Receipt Voucher" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                        {r.receiptNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {new Date(r.receiptDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                        <div>{r.party?.name}</div>
                        <span className="font-mono text-[10px] text-slate-400">{r.party?.code}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={r.paymentMode === 'CASH' ? 'warning' : 'blue'}>{r.paymentMode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {r.account?.name || 'Bank Account'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                        {r.referenceNo || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                        ₹ {r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewReceipt(r)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                            title="View Voucher Details"
                          >
                            <FileText className="w-3.5 h-3.5" /> View
                          </button>
                          <Link
                            to={`/accounts/ledger?partyId=${r.party?.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                            title="View Customer Ledger"
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
          </div>
        </CardContent>
      </Card>

      {/* Record Receipt Voucher Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Receipt Voucher"
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
              onClick={handleRecordReceipt}
              loading={submitting}
              icon={<ReceiptIcon className="w-3.5 h-3.5" />}
            >
              Confirm & Post Receipt
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRecordReceipt} className="space-y-4">
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
                Customer (Party) <span className="text-rose-500">*</span>
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
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
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
                Link to Invoice / Reference (Optional)
              </label>
              <select
                value={transactionId}
                onChange={(e) => handleSelectInvoice(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">-- Direct Advance / On Account --</option>
                {invoiceOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Invoice {inv.invoice} | Outstanding: ₹{inv.outstanding.toFixed(2)}
                  </option>
                ))}
              </select>
              {loadingInvoices && <p className="text-[10px] text-slate-400 mt-1">Loading customer invoices...</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Amount (₹) <span className="text-rose-500">*</span>
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
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Method <span className="text-rose-500">*</span>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Cheque / UTR #</label>
            <input
              type="text"
              placeholder="e.g. AXIS-RTGS-772911 or Cheque 99120"
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
          <div className="border border-emerald-100 bg-emerald-50/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-2">
              <ReceiptIcon className="w-3.5 h-3.5" />
              <span>Double-Entry Journal Voucher Preview</span>
            </div>
            <div className="font-mono text-[11px] space-y-1 text-slate-800">
              <div className="flex justify-between border-b border-emerald-200/50 pb-1">
                <span className="text-emerald-950 font-medium">
                  Dr {paymentMethod.toUpperCase() === 'CASH' ? '1010 Cash in Hand' : '1020 Bank Account'}
                </span>
                <span className="font-bold text-emerald-900">
                  ₹ {(parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-600">
                  Cr 1030 Accounts Receivable ({selectedCustomerName})
                </span>
                <span className="font-bold text-slate-900">
                  ₹ {(parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              * Posting will atomically update Customer Ledger, Receivable Balance, Journal, and Cash/Bank Book.
            </p>
          </div>
        </form>
      </Modal>

      {/* View Voucher Detail Modal */}
      {viewReceipt && (
        <Modal
          isOpen={!!viewReceipt}
          onClose={() => setViewReceipt(null)}
          title={`Receipt Voucher Details — ${viewReceipt.receiptNumber}`}
          size="md"
          footer={
            <Button size="sm" variant="outline" onClick={() => setViewReceipt(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">Voucher Number</span>
                <span className="font-mono font-bold text-emerald-600">{viewReceipt.receiptNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Receipt Date</span>
                <span className="text-slate-800 font-medium">
                  {new Date(viewReceipt.receiptDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Received From Customer</span>
                <span className="font-semibold text-slate-900">{viewReceipt.party?.name}</span>
                <span className="block text-[10px] text-slate-400 font-mono">{viewReceipt.party?.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Receipt Mode</span>
                <div className="mt-0.5">
                  <Badge variant="blue">{viewReceipt.paymentMode}</Badge>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Account Deposited</span>
                <span className="text-slate-800 font-medium">{viewReceipt.account?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Reference / Cheque #</span>
                <span className="font-mono text-slate-800">{viewReceipt.referenceNo || '—'}</span>
              </div>
            </div>

            <div className="border border-emerald-100 bg-emerald-50/40 p-3 rounded-lg flex items-center justify-between">
              <span className="font-bold text-emerald-900">Total Amount Received:</span>
              <span className="font-mono text-base font-bold text-emerald-700">
                ₹ {viewReceipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {viewReceipt.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block font-medium mb-0.5">Narration:</span>
                <p className="text-slate-700 italic">{viewReceipt.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReceiptsPage;

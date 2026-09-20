import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  CreditCard,
  BookOpen,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Store as StoreIcon,
  ChevronRight,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface PayableItem {
  id: string;
  supplier: string;
  supplierCode: string;
  supplierId: string;
  store: string;
  storeCode: string;
  storeId: string;
  po: string;
  poId: string | null;
  hasPO: boolean;
  invoice: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  notes?: string;
}

interface PayablesSummary {
  totalPayable: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
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

export const PayablesPage: React.FC = () => {
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [summary, setSummary] = useState<PayablesSummary>({
    totalPayable: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [stores, setStores] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Selected Payable for "Pay" Modal
  const [selectedPayable, setSelectedPayable] = useState<PayableItem | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<string>('Bank');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  // Selected Payable for "View Invoice" Modal
  const [viewInvoicePayable, setViewInvoicePayable] = useState<PayableItem | null>(null);

  const fetchStores = async () => {
    const res = await apiRequest<Array<{ id: string; name: string; code: string }>>('/accounts/stores');
    if (res.success && res.data) {
      setStores(res.data);
    }
  };

  const fetchPayables = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
    if (storeFilter !== 'ALL') queryParams.append('storeId', storeFilter);

    const res = await apiRequest<PayableItem[]>(`/accounts/payables?${queryParams.toString()}`);
    if (res.success && res.data) {
      setPayables(res.data);
      if (res.summary) {
        setSummary(res.summary);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchPayables();
  }, [search, statusFilter, storeFilter]);

  const openPayModal = (item: PayableItem) => {
    setSelectedPayable(item);
    setPayAmount(item.outstanding.toFixed(2));
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('Bank');
    setReferenceNumber('');
    setPayNotes(`Payment against invoice ${item.invoice}`);
    setPayError(null);
    setPaySuccess(null);
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (amountNum > selectedPayable.outstanding + 0.01) {
      setPayError(
        `Payment amount (₹${amountNum.toFixed(2)}) exceeds outstanding balance (₹${selectedPayable.outstanding.toFixed(2)}).`
      );
      return;
    }

    setSubmittingPay(true);
    setPayError(null);
    setPaySuccess(null);

    const res = await apiRequest('/accounts/payments', {
      method: 'POST',
      body: JSON.stringify({
        partyId: selectedPayable.supplierId,
        storeId: selectedPayable.storeId,
        transactionId: selectedPayable.id,
        poId: selectedPayable.poId || undefined,
        amount: amountNum,
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: payNotes.trim() || undefined,
      }),
    });

    setSubmittingPay(false);

    if (res.success) {
      setPaySuccess('Payment voucher recorded successfully and accounts updated!');
      setTimeout(() => {
        setIsPayModalOpen(false);
        fetchPayables();
      }, 1200);
    } else {
      setPayError(res.message || 'Failed to record payment voucher.');
    }
  };

  const handleExportCSV = () => {
    if (!payables.length) return;
    const headers = [
      'Supplier',
      'Store',
      'PO Number',
      'Invoice #',
      'Invoice Date',
      'Due Date',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Outstanding (₹)',
      'Days Overdue',
      'Status',
    ];
    const rows = payables.map((p) => [
      `"${p.supplier} (${p.supplierCode})"`,
      `"${p.store}"`,
      `"${p.po}"`,
      `"${p.invoice}"`,
      p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString() : '',
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '',
      p.total,
      p.paid,
      p.outstanding,
      p.daysOverdue,
      p.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Accounts_Payable_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: PayableItem['status'], daysOverdue: number) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">PAID</Badge>;
      case 'OVERDUE':
        return (
          <Badge variant="error" className="animate-pulse">
            OVERDUE ({daysOverdue}d)
          </Badge>
        );
      case 'PARTIALLY_PAID':
        return <Badge variant="blue">PARTIALLY PAID</Badge>;
      case 'UNPAID':
      default:
        return <Badge variant="warning">UNPAID</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PAYABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Payable</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Invoice-level supplier payables, aging schedules, and disbursement settlements
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchPayables}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export Payables
          </Button>
          <Link to="/accounts/payments">
            <Button size="sm" variant="primary" icon={<CreditCard className="w-3.5 h-3.5" />}>
              Payment Vouchers
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoiced</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">
              ₹ {summary.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Gross supplier billings</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Paid</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-emerald-700">
              ₹ {summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Disbursed settlements</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Outstanding</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-amber-700">
              ₹ {summary.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Remaining liability balance</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue Payables</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-rose-700">
              ₹ {summary.overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">
              {summary.overdueCount} {summary.overdueCount === 1 ? 'invoice' : 'invoices'} past credit terms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by supplier, invoice, PO #..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNPAID">Unpaid Only</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PAID">Paid In Full</option>
              </select>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-right">Paid (₹)</TableHead>
                  <TableHead className="text-right">Outstanding (₹)</TableHead>
                  <TableHead className="text-center">Days Overdue</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading payables records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : payables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10 text-slate-400">
                      No payable records match current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  payables.map((p) => {
                    const isOverdue = p.daysOverdue > 0 && p.outstanding > 0;
                    const canPay = p.outstanding > 0;

                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                          <div>{p.supplier}</div>
                          <span className="font-mono text-[10px] text-slate-400">{p.supplierCode}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {p.store}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                          {p.hasPO ? (
                            <span className="text-blue-600 font-medium">{p.po}</span>
                          ) : (
                            <span className="text-slate-400 italic">PO = N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          {p.invoice}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900 text-right whitespace-nowrap">
                          ₹ {p.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-600 text-right whitespace-nowrap">
                          ₹ {p.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-rose-700 text-right whitespace-nowrap">
                          ₹ {p.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap font-mono text-xs">
                          {isOverdue ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              +{p.daysOverdue} d
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 d</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {getStatusBadge(p.status, p.daysOverdue)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {canPay && (
                              <button
                                onClick={() => openPayModal(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
                              >
                                <CreditCard className="w-3 h-3" /> Pay
                              </button>
                            )}
                            <button
                              onClick={() => setViewInvoicePayable(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                              title="View Invoice Details"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              to={`/accounts/ledger?partyId=${p.supplierId}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                              title="View Party Ledger"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pay Modal */}
      {selectedPayable && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title={`Record Payment — Invoice ${selectedPayable.invoice}`}
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPayModalOpen(false)}
                disabled={submittingPay}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleRecordPayment}
                loading={submittingPay}
                icon={<CreditCard className="w-3.5 h-3.5" />}
              >
                Confirm & Post Payment
              </Button>
            </div>
          }
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}
            {paySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{paySuccess}</span>
              </div>
            )}

            {/* Target Invoice Overview banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Supplier</span>
                <span className="font-semibold text-slate-800">{selectedPayable.supplier}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Store</span>
                <span className="font-semibold text-slate-800">{selectedPayable.store}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Invoiced</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹ {selectedPayable.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Remaining Due</span>
                <span className="font-mono font-bold text-rose-600">
                  ₹ {selectedPayable.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    max={selectedPayable.outstanding}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    className="w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Max remaining: ₹{selectedPayable.outstanding.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setPayAmount(selectedPayable.outstanding.toFixed(2))}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Pay Full Due
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / UTR / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC-NEFT-984122 or Cheque 00412"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Narration / Notes</label>
              <textarea
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional voucher notes..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Live Double Entry Accounting Preview */}
            <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-2">
                <ReceiptIcon className="w-3.5 h-3.5" />
                <span>Double-Entry Journal Voucher Preview</span>
              </div>
              <div className="font-mono text-[11px] space-y-1 text-slate-800">
                <div className="flex justify-between border-b border-blue-200/50 pb-1">
                  <span className="text-blue-950 font-medium">
                    Dr 2010 Accounts Payable ({selectedPayable.supplier})
                  </span>
                  <span className="font-bold text-blue-900">
                    ₹ {(parseFloat(payAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-slate-600">
                    Cr {payMethod.toUpperCase() === 'CASH' ? '1010 Cash in Hand' : '1020 Bank Account'}
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹ {(parseFloat(payAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">
                * Posting will atomically update Supplier Ledger, Payable Balance, Journal, and Cash/Bank Book.
              </p>
            </div>
          </form>
        </Modal>
      )}

      {/* View Invoice Modal */}
      {viewInvoicePayable && (
        <Modal
          isOpen={!!viewInvoicePayable}
          onClose={() => setViewInvoicePayable(null)}
          title={`Payable Invoice Details — ${viewInvoicePayable.invoice}`}
          size="md"
          footer={
            <Button size="sm" variant="outline" onClick={() => setViewInvoicePayable(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900">{viewInvoicePayable.invoice}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Status</span>
                <div className="mt-0.5">{getStatusBadge(viewInvoicePayable.status, viewInvoicePayable.daysOverdue)}</div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Supplier</span>
                <span className="font-semibold text-slate-900">{viewInvoicePayable.supplier}</span>
                <span className="block text-[10px] text-slate-500 font-mono">{viewInvoicePayable.supplierCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Store</span>
                <span className="font-semibold text-slate-900">{viewInvoicePayable.store}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">PO Reference</span>
                <span className="font-mono text-slate-700">
                  {viewInvoicePayable.hasPO ? viewInvoicePayable.po : 'Direct Purchase (No PO)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Invoice Date</span>
                <span className="text-slate-800">
                  {viewInvoicePayable.invoiceDate ? new Date(viewInvoicePayable.invoiceDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Due Date</span>
                <span className="text-slate-800">
                  {viewInvoicePayable.dueDate ? new Date(viewInvoicePayable.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Days Overdue</span>
                <span className={`font-bold ${viewInvoicePayable.daysOverdue > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {viewInvoicePayable.daysOverdue} Days
                </span>
              </div>
            </div>

            {/* Financials Breakdown */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <span className="font-bold text-slate-800 block border-b border-slate-100 pb-1">Amount Breakdown</span>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Total Amount:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹ {viewInvoicePayable.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Settled / Paid:</span>
                <span className="font-mono font-semibold text-emerald-600">
                  ₹ {viewInvoicePayable.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                <span className="text-slate-900">Remaining Outstanding:</span>
                <span className="font-mono text-rose-600">
                  ₹ {viewInvoicePayable.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {viewInvoicePayable.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block font-medium mb-0.5">Notes:</span>
                <p className="text-slate-700 italic">{viewInvoicePayable.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PayablesPage;

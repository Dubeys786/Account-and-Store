import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  Receipt as ReceiptIcon,
  BookOpen,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface ReceivableItem {
  id: string;
  customer: string;
  customerCode: string;
  customerId: string;
  store: string;
  storeCode: string;
  storeId: string;
  invoice: string;
  date: string;
  dueDate: string | null;
  total: number;
  received: number;
  outstanding: number;
  daysOverdue: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  notes?: string;
}

interface ReceivablesSummary {
  totalReceivables: number;
  totalReceived: number;
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

export const ReceivablesPage: React.FC = () => {
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [summary, setSummary] = useState<ReceivablesSummary>({
    totalReceivables: 0,
    totalReceived: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [stores, setStores] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Selected Receivable for "Receive Payment" Modal
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableItem | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptMethod, setReceiptMethod] = useState<string>('Bank');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [receiptNotes, setReceiptNotes] = useState<string>('');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  // Selected Receivable for "View Invoice" Modal
  const [viewInvoiceReceivable, setViewInvoiceReceivable] = useState<ReceivableItem | null>(null);

  const fetchStores = async () => {
    const res = await apiRequest<Array<{ id: string; name: string; code: string }>>('/accounts/stores');
    if (res.success && res.data) {
      setStores(res.data);
    }
  };

  const fetchReceivables = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
    if (storeFilter !== 'ALL') queryParams.append('storeId', storeFilter);

    const res = await apiRequest<ReceivableItem[]>(`/accounts/receivables?${queryParams.toString()}`);
    if (res.success && res.data) {
      setReceivables(res.data);
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
    fetchReceivables();
  }, [search, statusFilter, storeFilter]);

  const openReceiveModal = (item: ReceivableItem) => {
    setSelectedReceivable(item);
    setReceiptAmount(item.outstanding.toFixed(2));
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setReceiptMethod('Bank');
    setReferenceNumber('');
    setReceiptNotes(`Collection against invoice ${item.invoice}`);
    setReceiptError(null);
    setReceiptSuccess(null);
    setIsReceiveModalOpen(true);
  };

  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;

    const amountNum = parseFloat(receiptAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setReceiptError('Please enter a valid collection amount greater than zero.');
      return;
    }
    if (amountNum > selectedReceivable.outstanding + 0.01) {
      setReceiptError(
        `Receipt amount (₹${amountNum.toFixed(2)}) exceeds remaining outstanding balance (₹${selectedReceivable.outstanding.toFixed(2)}).`
      );
      return;
    }

    setSubmittingReceipt(true);
    setReceiptError(null);
    setReceiptSuccess(null);

    const res = await apiRequest('/accounts/receipts', {
      method: 'POST',
      body: JSON.stringify({
        partyId: selectedReceivable.customerId,
        storeId: selectedReceivable.storeId,
        transactionId: selectedReceivable.id,
        amount: amountNum,
        receiptDate: receiptDate,
        paymentMethod: receiptMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
      }),
    });

    setSubmittingReceipt(false);

    if (res.success) {
      setReceiptSuccess('Receipt voucher recorded successfully and accounts updated!');
      setTimeout(() => {
        setIsReceiveModalOpen(false);
        fetchReceivables();
      }, 1200);
    } else {
      setReceiptError(res.message || 'Failed to record receipt voucher.');
    }
  };

  const handleExportCSV = () => {
    if (!receivables.length) return;
    const headers = [
      'Customer',
      'Store',
      'Invoice #',
      'Invoice Date',
      'Due Date',
      'Total Amount (₹)',
      'Received Amount (₹)',
      'Outstanding (₹)',
      'Days Overdue',
      'Status',
    ];
    const rows = receivables.map((r) => [
      `"${r.customer} (${r.customerCode})"`,
      `"${r.store}"`,
      `"${r.invoice}"`,
      r.date ? new Date(r.date).toLocaleDateString() : '',
      r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '',
      r.total,
      r.received,
      r.outstanding,
      r.daysOverdue,
      r.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Accounts_Receivable_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: ReceivableItem['status'], daysOverdue: number) => {
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
        return <Badge variant="blue">PARTIALLY RECEIVED</Badge>;
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
            <span className="text-blue-600">RECEIVABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Receivable</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Invoice-level customer debtors, aging schedules, and collection settlements
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchReceivables}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export Receivables
          </Button>
          <Link to="/accounts/receipts">
            <Button size="sm" variant="primary" icon={<ReceiptIcon className="w-3.5 h-3.5" />}>
              Receipt Vouchers
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoiced</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">
              ₹ {summary.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Gross customer invoices</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Received</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-emerald-700">
              ₹ {summary.totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Collected settlements</p>
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
            <p className="text-[11px] text-slate-500 mt-1">Pending debtor collections</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-600 bg-linear-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue Receivables</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-rose-700">
              ₹ {summary.overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">
              {summary.overdueCount} {summary.overdueCount === 1 ? 'invoice' : 'invoices'} past payment terms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer, invoice #..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-initial text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-right">Received (₹)</TableHead>
                  <TableHead className="text-right">Outstanding (₹)</TableHead>
                  <TableHead className="text-center">Days Overdue</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading receivables records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : receivables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-slate-400">
                      No receivable records match current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  receivables.map((r) => {
                    const isOverdue = r.daysOverdue > 0 && r.outstanding > 0;
                    const canReceive = r.outstanding > 0;

                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                          <div>{r.customer}</div>
                          <span className="font-mono text-[10px] text-slate-400">{r.customerCode}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {r.store}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          {r.invoice}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900 text-right whitespace-nowrap">
                          ₹ {r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-600 text-right whitespace-nowrap">
                          ₹ {r.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-amber-700 text-right whitespace-nowrap">
                          ₹ {r.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap font-mono text-xs">
                          {isOverdue ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              +{r.daysOverdue} d
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 d</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {getStatusBadge(r.status, r.daysOverdue)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {canReceive && (
                              <button
                                onClick={() => openReceiveModal(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                              >
                                <ReceiptIcon className="w-3 h-3" /> Receive Payment
                              </button>
                            )}
                            <button
                              onClick={() => setViewInvoiceReceivable(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                              title="View Invoice Details"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              to={`/accounts/ledger?partyId=${r.customerId}`}
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
        </CardContent>
      </Card>

      {/* Receive Payment Modal */}
      {selectedReceivable && (
        <Modal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          title={`Record Receipt — Invoice ${selectedReceivable.invoice}`}
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReceiveModalOpen(false)}
                disabled={submittingReceipt}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleRecordReceipt}
                loading={submittingReceipt}
                icon={<ReceiptIcon className="w-3.5 h-3.5" />}
              >
                Confirm & Post Receipt
              </Button>
            </div>
          }
        >
          <form onSubmit={handleRecordReceipt} className="space-y-4">
            {receiptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{receiptError}</span>
              </div>
            )}
            {receiptSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{receiptSuccess}</span>
              </div>
            )}

            {/* Target Invoice Overview banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-semibold text-slate-800">{selectedReceivable.customer}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Store</span>
                <span className="font-semibold text-slate-800">{selectedReceivable.store}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Invoiced</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹ {selectedReceivable.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Remaining Due</span>
                <span className="font-mono font-bold text-amber-600">
                  ₹ {selectedReceivable.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Collection Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedReceivable.outstanding}
                    value={receiptAmount}
                    onChange={(e) => setReceiptAmount(e.target.value)}
                    required
                    className="w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Max pending: ₹{selectedReceivable.outstanding.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setReceiptAmount(selectedReceivable.outstanding.toFixed(2))}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Receive Full Balance
                  </button>
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
                  value={receiptMethod}
                  onChange={(e) => setReceiptMethod(e.target.value)}
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
                  Reference / Cheque / UTR #
                </label>
                <input
                  type="text"
                  placeholder="e.g. AXIS-RTGS-772911 or Cheque 99120"
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
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="Optional receipt notes..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Live Double Entry Accounting Preview */}
            <div className="border border-emerald-100 bg-emerald-50/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-2">
                <ReceiptIcon className="w-3.5 h-3.5" />
                <span>Double-Entry Journal Voucher Preview</span>
              </div>
              <div className="font-mono text-[11px] space-y-1 text-slate-800">
                <div className="flex justify-between border-b border-emerald-200/50 pb-1">
                  <span className="text-emerald-950 font-medium">
                    Dr {receiptMethod.toUpperCase() === 'CASH' ? '1010 Cash in Hand' : '1020 Bank Account'}
                  </span>
                  <span className="font-bold text-emerald-900">
                    ₹ {(parseFloat(receiptAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-slate-600">
                    Cr 1030 Accounts Receivable ({selectedReceivable.customer})
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹ {(parseFloat(receiptAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">
                * Posting will atomically update Customer Ledger, Receivable Balance, Journal, and Cash/Bank Book.
              </p>
            </div>
          </form>
        </Modal>
      )}

      {/* View Invoice Modal */}
      {viewInvoiceReceivable && (
        <Modal
          isOpen={!!viewInvoiceReceivable}
          onClose={() => setViewInvoiceReceivable(null)}
          title={`Receivable Invoice Details — ${viewInvoiceReceivable.invoice}`}
          size="md"
          footer={
            <Button size="sm" variant="outline" onClick={() => setViewInvoiceReceivable(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900">{viewInvoiceReceivable.invoice}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Status</span>
                <div className="mt-0.5">{getStatusBadge(viewInvoiceReceivable.status, viewInvoiceReceivable.daysOverdue)}</div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Customer</span>
                <span className="font-semibold text-slate-900">{viewInvoiceReceivable.customer}</span>
                <span className="block text-[10px] text-slate-500 font-mono">{viewInvoiceReceivable.customerCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Store</span>
                <span className="font-semibold text-slate-900">{viewInvoiceReceivable.store}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Invoice Date</span>
                <span className="text-slate-800">
                  {viewInvoiceReceivable.date ? new Date(viewInvoiceReceivable.date).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Due Date</span>
                <span className="text-slate-800">
                  {viewInvoiceReceivable.dueDate ? new Date(viewInvoiceReceivable.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Days Overdue</span>
                <span className={`font-bold ${viewInvoiceReceivable.daysOverdue > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {viewInvoiceReceivable.daysOverdue} Days
                </span>
              </div>
            </div>

            {/* Financials Breakdown */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <span className="font-bold text-slate-800 block border-b border-slate-100 pb-1">Amount Breakdown</span>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Total Amount:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹ {viewInvoiceReceivable.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Received / Collected:</span>
                <span className="font-mono font-semibold text-emerald-600">
                  ₹ {viewInvoiceReceivable.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                <span className="text-slate-900">Remaining Outstanding:</span>
                <span className="font-mono text-amber-600">
                  ₹ {viewInvoiceReceivable.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {viewInvoiceReceivable.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block font-medium mb-0.5">Notes:</span>
                <p className="text-slate-700 italic">{viewInvoiceReceivable.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReceivablesPage;

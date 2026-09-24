import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Scale,
  DollarSign,
  TrendingDown,
  TrendingUp,
  BookOpen,
  Mail,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { EmailReportModal } from './components/EmailReportModal';
import { CashBankPositionCard } from './components/CashBankPositionCard';

export type ReportType =
  | 'PARTY_LEDGER'
  | 'PURCHASE_REPORT'
  | 'PURCHASE_WITH_PO'
  | 'PURCHASE_WITHOUT_PO'
  | 'PAYABLE_REPORT'
  | 'RECEIVABLE_REPORT'
  | 'PAYMENT_REPORT'
  | 'RECEIPT_REPORT'
  | 'EXPENSE_REPORT'
  | 'INCOME_REPORT'
  | 'DAY_BOOK'
  | 'CASH_BOOK'
  | 'BANK_BOOK'
  | 'STORE_WISE';

interface ReportMeta {
  id: ReportType;
  title: string;
  category: string;
  desc: string;
}

const REPORT_CATALOG: ReportMeta[] = [
  { id: 'PARTY_LEDGER', title: '1. Party Ledger', category: 'Ledgers & Statements', desc: 'Chronological party statement with running balances' },
  { id: 'PURCHASE_REPORT', title: '2. Purchase Report', category: 'Purchases & Inward', desc: 'Comprehensive record of all purchase transactions' },
  { id: 'PURCHASE_WITH_PO', title: '3. Purchase With PO', category: 'Purchases & Inward', desc: 'Purchases strictly linked to approved purchase orders' },
  { id: 'PURCHASE_WITHOUT_PO', title: '4. Purchase Without PO', category: 'Purchases & Inward', desc: 'Direct purchase bills booked without purchase orders' },
  { id: 'PAYABLE_REPORT', title: '5. Payable Report', category: 'Trade Obligations', desc: 'Outstanding supplier bills and aging schedule' },
  { id: 'RECEIVABLE_REPORT', title: '6. Receivable Report', category: 'Trade Obligations', desc: 'Customer trade receivables and overdue collections' },
  { id: 'PAYMENT_REPORT', title: '7. Payment Report', category: 'Cash & Banking', desc: 'Vendor disbursements, bank transfers, and cheques' },
  { id: 'RECEIPT_REPORT', title: '8. Receipt Report', category: 'Cash & Banking', desc: 'Customer collections, wire transfers, and deposits' },
  { id: 'EXPENSE_REPORT', title: '9. Expense Report', category: 'Operating Accounts', desc: 'Operating expenditure, utilities, payroll, and logistics' },
  { id: 'INCOME_REPORT', title: '10. Income Report', category: 'Operating Accounts', desc: 'Direct sales revenue, auxiliary, and scrap income' },
  { id: 'DAY_BOOK', title: '11. Day Book', category: 'Statutory Books', desc: 'Chronological double-entry journal audit log' },
  { id: 'CASH_BOOK', title: '12. Cash Book', category: 'Statutory Books', desc: 'Physical cash register (1010) with running balance' },
  { id: 'BANK_BOOK', title: '13. Bank Book', category: 'Statutory Books', desc: 'Operating bank register (1020) with running balance' },
  { id: 'STORE_WISE', title: '14. Store-wise Accounting Report', category: 'Management Financials', desc: 'Multi-branch comparative financial performance' },
];

interface ColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge';
  align?: 'left' | 'center' | 'right';
}

interface ReportDataResponse {
  reportType: ReportType;
  reportTitle: string;
  reportDescription: string;
  generatedAt: string;
  columns: ColumnDef[];
  records: any[];
  summary: Record<string, any>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
}

export const AccountsReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('PURCHASE_REPORT');
  const [reportData, setReportData] = useState<ReportDataResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [selectedParty, setSelectedParty] = useState('ALL');
  const [transactionType, setTransactionType] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  // Sorting & Pagination State
  const [sortKey, setSortKey] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Dropdown Metadata
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [parties, setParties] = useState<PartyItem[]>([]);

  // Fetch dropdown data
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [storesRes, partiesRes] = await Promise.all([
          apiRequest<StoreItem[]>('/accounts/stores'),
          apiRequest<PartyItem[]>('/accounts/parties'),
        ]);
        if (storesRes.success && storesRes.data) setStores(storesRes.data);
        if (partiesRes.success && partiesRes.data) setParties(partiesRes.data);
      } catch (err) {
        console.error('Failed to load filter metadata', err);
      }
    }
    loadMetadata();
  }, []);

  // Fetch report data
  const fetchReportData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append('reportType', activeReport);
    params.append('page', String(currentPage));
    params.append('limit', String(pageSize));

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedStore !== 'ALL') params.append('storeId', selectedStore);
    if (selectedParty !== 'ALL') params.append('partyId', selectedParty);
    if (transactionType !== 'ALL') params.append('transactionType', transactionType);
    if (paymentMethod !== 'ALL') params.append('paymentMethod', paymentMethod);
    if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
    if (poNumber.trim()) params.append('poNumber', poNumber.trim());
    if (invoiceNumber.trim()) params.append('invoiceNumber', invoiceNumber.trim());
    if (search.trim()) params.append('search', search.trim());

    const res = await apiRequest<ReportDataResponse>(`/accounts/reports/generate?${params.toString()}`);
    if (res.success && res.data) {
      setReportData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeReport]);

  useEffect(() => {
    fetchReportData();
  }, [activeReport, currentPage, pageSize]);

  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchReportData();
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedStore('ALL');
    setSelectedParty('ALL');
    setTransactionType('ALL');
    setPaymentMethod('ALL');
    setPoNumber('');
    setInvoiceNumber('');
    setSelectedStatus('ALL');
    setSearch('');
    setCurrentPage(1);
  };

  // Sorting
  const sortedRecords = useMemo(() => {
    if (!reportData?.records) return [];
    if (!sortKey) return reportData.records;

    return [...reportData.records].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [reportData?.records, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!sortedRecords.length || !reportData?.columns) return;

    const headers = reportData.columns.map((c) => `"${c.label}"`);
    const rows = sortedRecords.map((row) =>
      reportData.columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return '""';
          if (c.type === 'currency' && typeof val === 'number') {
            return `"${val.toFixed(2)}"`;
          }
          if (c.type === 'date' && val) {
            return `"${new Date(val).toLocaleDateString()}"`;
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (.xls HTML table)
  const handleExportExcel = () => {
    if (!sortedRecords.length || !reportData?.columns) return;

    const headerHtml = `<tr>${reportData.columns.map((c) => `<th style="background-color:#f1f5f9;font-weight:bold;border:1px solid #cbd5e1;padding:8px;">${c.label}</th>`).join('')}</tr>`;
    const rowsHtml = sortedRecords
      .map(
        (row) =>
          `<tr>${reportData.columns
            .map((c) => {
              let val = row[c.key];
              if (val === null || val === undefined) val = '—';
              else if (c.type === 'currency' && typeof val === 'number') val = `₹ ${val.toLocaleString('en-IN')}`;
              else if (c.type === 'date' && val) val = new Date(val).toLocaleDateString();
              return `<td style="border:1px solid #e2e8f0;padding:6px;">${val}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
        <h2 style="font-family:sans-serif;">${reportData.reportTitle}</h2>
        <p style="font-family:sans-serif;font-size:12px;color:#64748b;">Generated: ${new Date().toLocaleString()} | STOCKLEDGER — Store, Inventory & Accounts</p>
        <table border="1" style="font-family:sans-serif;font-size:12px;border-collapse:collapse;">
          ${headerHtml}
          ${rowsHtml}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReport}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const activeMeta = REPORT_CATALOG.find((r) => r.id === activeReport);

  const selectedStoreObj = stores.find((s) => s.id === selectedStore);
  const storeLabel =
    selectedStore === 'ALL'
      ? 'All Authorized Stores'
      : selectedStoreObj
      ? `${selectedStoreObj.name} (${selectedStoreObj.code})`
      : selectedStore;

  const selectedPartyObj = parties.find((p) => p.id === selectedParty);
  const partyLabel =
    selectedParty === 'ALL'
      ? 'All Parties'
      : selectedPartyObj
      ? `${selectedPartyObj.name} (${selectedPartyObj.code})`
      : selectedParty;

  let dateRangeLabel = 'All Dates';
  if (startDate && endDate) {
    dateRangeLabel = `${startDate} to ${endDate}`;
  } else if (startDate) {
    dateRangeLabel = `From ${startDate}`;
  } else if (endDate) {
    dateRangeLabel = `Up to ${endDate}`;
  }

  const currentFiltersObj = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      storeId: selectedStore !== 'ALL' ? selectedStore : undefined,
      partyId: selectedParty !== 'ALL' ? selectedParty : undefined,
      transactionType: transactionType !== 'ALL' ? transactionType : undefined,
      paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      poNumber: poNumber.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      search: search.trim() || undefined,
    }),
    [
      startDate,
      endDate,
      selectedStore,
      selectedParty,
      transactionType,
      paymentMethod,
      selectedStatus,
      poNumber,
      invoiceNumber,
      search,
    ]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">FINANCIAL REPORTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Accounting Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready financial statements, purchase logs, vendor payables, cash/bank books, and multi-store accounting
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />} onClick={fetchReportData}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Printer className="w-3.5 h-3.5" />} onClick={handlePrint}>
            Print / PDF
          </Button>
          <Button size="sm" variant="outline" icon={<FileDown className="w-3.5 h-3.5 text-blue-600" />} onClick={handleExportCSV}>
            CSV
          </Button>
          <Button size="sm" variant="primary" icon={<FileSpreadsheet className="w-3.5 h-3.5" />} onClick={handleExportExcel}>
            Excel
          </Button>
          <Button size="sm" variant="outline" icon={<Mail className="w-3.5 h-3.5 text-indigo-600" />} onClick={() => setIsEmailModalOpen(true)}>
            Email
          </Button>
        </div>
      </div>

      {/* Real-time Live Cash & Bank Position Section */}
      <CashBankPositionCard className="print:hidden" />

      {/* 14 Reports Selector Tabs / Dropdown */}
      <Card className="print:hidden">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Report:</span>
            </div>
            <select
              value={activeReport}
              onChange={(e) => setActiveReport(e.target.value as ReportType)}
              className="w-full sm:w-96 px-3 py-1.5 text-xs font-semibold bg-blue-50/50 text-blue-900 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REPORT_CATALOG.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.category})
                </option>
              ))}
            </select>
          </div>
          {activeMeta && (
            <p className="text-[11px] text-slate-500 mt-2 pl-6">
              <span className="font-semibold text-slate-700">{activeMeta.category}:</span> {activeMeta.desc}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Universal Multi-Parameter Filter Bar */}
      <Card className="print:hidden">
        <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Report Filters & Criteria</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleResetFilters} className="text-xs h-7">
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={handleApplyFilters} className="text-xs h-7">
              Apply Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Universal Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Date From */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 2. Date To */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 3. Store */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Store / Branch</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Authorized Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Party */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Party / Entity</label>
              <select
                value={selectedParty}
                onChange={(e) => setSelectedParty(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Parties</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code} - {p.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Module Specific Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {/* 5. Transaction Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="ALL">All Types</option>
                <option value="PURCHASE">Purchase</option>
                <option value="SALE">Sales</option>
                <option value="PAYMENT">Payment</option>
                <option value="RECEIPT">Receipt</option>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>

            {/* 6. Payment Method */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {/* 7. Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Fully Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>

            {/* 8. PO Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">PO Number</label>
              <input
                type="text"
                placeholder="PO-2026-..."
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            {/* 9. Invoice Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Number</label>
              <input
                type="text"
                placeholder="INV-..."
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Row 3: Live Search */}
          <div className="pt-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Quick search voucher, party name, item description, remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Banner */}
      {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-4">
          {Object.entries(reportData.summary).map(([key, val]) => {
            const formattedLabel = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str) => str.toUpperCase());
            const isCurrency = typeof val === 'number' && (key.includes('total') || key.includes('Net') || key.includes('Balance') || key.includes('Cash') || key.includes('Bank') || key.includes('Outstanding') || key.includes('Gross') || key.includes('Paid'));

            return (
              <div key={key} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block truncate">
                  {formattedLabel}
                </span>
                <p className="text-base font-bold text-slate-900 mt-1 truncate">
                  {isCurrency ? `₹ ${(val as number).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : String(val)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{reportData?.reportTitle || activeMeta?.title}</h2>
            <p className="text-[10px] text-slate-400">
              Generated: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : 'Now'} • Only authorized store records displayed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {reportData?.pagination?.total || sortedRecords.length} Records
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg print:hidden"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                {reportData?.columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`cursor-pointer hover:bg-slate-100 transition-colors select-none text-${col.align || 'left'}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      <span>{col.label}</span>
                      {sortKey === col.key ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={reportData?.columns.length || 8} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Generating report from database records...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !sortedRecords || sortedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={reportData?.columns.length || 8} className="text-center py-10 text-slate-400">
                    No records found matching the specified report filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRecords.map((row, idx) => (
                  <TableRow key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {reportData?.columns.map((col) => {
                      const val = row[col.key];

                      if (col.type === 'currency') {
                        const num = typeof val === 'number' ? val : parseFloat(val || '0');
                        return (
                          <TableCell key={col.key} className="font-mono text-xs font-semibold text-slate-900 text-right whitespace-nowrap">
                            {isNaN(num) ? '—' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                          </TableCell>
                        );
                      }

                      if (col.type === 'date') {
                        return (
                          <TableCell key={col.key} className="text-xs text-slate-600 whitespace-nowrap">
                            {val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </TableCell>
                        );
                      }

                      if (col.type === 'badge') {
                        const str = String(val || '—');
                        const isPaid = str.includes('PAID') && !str.includes('PARTIAL') && !str.includes('UN');
                        const isUnpaid = str.includes('UNPAID');
                        const variant = isPaid ? 'success' : isUnpaid ? 'error' : 'blue';
                        return (
                          <TableCell key={col.key} className="text-center whitespace-nowrap">
                            <Badge variant={variant as any}>{str}</Badge>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={col.key} className={`text-xs text-slate-700 text-${col.align || 'left'}`}>
                          {val !== null && val !== undefined ? String(val) : '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {reportData?.pagination && reportData.pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 print:hidden">
              <span className="text-xs text-slate-500">
                Page {reportData.pagination.page} of {reportData.pagination.totalPages} ({reportData.pagination.total} total rows)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= reportData.pagination.totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-7 px-2"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Report Modal */}
      <EmailReportModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        reportType={activeReport}
        reportTitle={reportData?.reportTitle || activeMeta?.title || 'Financial Report'}
        currentFilters={currentFiltersObj}
        summaryInfo={{
          dateRangeText: dateRangeLabel,
          storeName: storeLabel,
          partyName: partyLabel,
          recordCount: reportData?.records?.length || 0,
        }}
      />
    </div>
  );
};

export default AccountsReportsPage;

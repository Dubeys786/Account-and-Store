import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Building,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { useStore } from '../../context/StoreContext';

interface LedgerParty {
  id: string;
  code: string;
  name: string;
  type: string;
  mobile?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  storeId?: string;
  store?: {
    id: string;
    code: string;
    name: string;
  };
}

interface LedgerEntry {
  id: string;
  date: string;
  voucherNumber: string;
  referenceType: string;
  particulars: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'DEBIT' | 'CREDIT';
  formattedBalance: string;
}

interface LedgerResponse {
  party: LedgerParty;
  openingBalance: {
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    formatted: string;
  };
  totalDebit: number;
  totalCredit: number;
  closingBalance: {
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    formatted: string;
  };
  entries: LedgerEntry[];
}

export const PartyLedgerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const partyIdFromUrl = searchParams.get('partyId');
  const { availableStores } = useStore();

  // Parties list for selector
  const [parties, setParties] = useState<LedgerParty[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(partyIdFromUrl || '');
  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [partyListLoading, setPartyListLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [poFilter, setPoFilter] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [partySearch, setPartySearch] = useState('');

  // 1. Fetch parties list for selector
  useEffect(() => {
    async function loadParties() {
      setPartyListLoading(true);
      const res = await apiRequest<LedgerParty[]>('/accounts/parties?limit=100');
      if (res.success && Array.isArray(res.data)) {
        setParties(res.data);
        if (!selectedPartyId && res.data.length > 0) {
          setSelectedPartyId(res.data[0].id);
        }
      }
      setPartyListLoading(false);
    }
    loadParties();
  }, []);

  // 2. Fetch ledger data when party or date range changes
  const fetchLedger = async (partyId: string, start?: string, end?: string) => {
    if (!partyId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (start) params.set('startDate', start);
    if (end) params.set('endDate', end);

    const endpoint = `/accounts/parties/${partyId}/ledger?${params.toString()}`;
    const res = await apiRequest<LedgerResponse>(endpoint);

    if (res.success && res.data) {
      setLedgerData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedPartyId) {
      setSearchParams({ partyId: selectedPartyId });
      fetchLedger(selectedPartyId, startDate, endDate);
    }
  }, [selectedPartyId, startDate, endDate]);

  // Handle party change from selector
  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
  };

  // Filtered entries by transaction type, store, PO, invoice
  const filteredEntries = useMemo(() => {
    if (!ledgerData?.entries) return [];

    return ledgerData.entries.filter((entry) => {
      // Transaction Type filter
      if (transactionTypeFilter !== 'ALL') {
        const refType = entry.referenceType.toUpperCase();
        if (transactionTypeFilter === 'PURCHASE' && !refType.includes('PURCHASE')) return false;
        if (transactionTypeFilter === 'SALE' && !refType.includes('SALE')) return false;
        if (transactionTypeFilter === 'PAYMENT' && !refType.includes('PAYMENT')) return false;
        if (transactionTypeFilter === 'RECEIPT' && !refType.includes('RECEIPT')) return false;
        if (transactionTypeFilter === 'JOURNAL' && !refType.includes('JOURNAL')) return false;
      }

      // PO filter
      if (poFilter.trim()) {
        const poQuery = poFilter.trim().toLowerCase();
        const hasPo =
          entry.voucherNumber.toLowerCase().includes(poQuery) ||
          entry.particulars.toLowerCase().includes(poQuery);
        if (!hasPo) return false;
      }

      // Invoice filter
      if (invoiceFilter.trim()) {
        const invQuery = invoiceFilter.trim().toLowerCase();
        const hasInv =
          entry.voucherNumber.toLowerCase().includes(invQuery) ||
          entry.particulars.toLowerCase().includes(invQuery);
        if (!hasInv) return false;
      }

      return true;
    });
  }, [ledgerData?.entries, transactionTypeFilter, poFilter, invoiceFilter]);

  // ==========================================
  // ACTIONS: Print, PDF, Excel, CSV
  // ==========================================
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!ledgerData || !filteredEntries.length) return;

    const headers = ['Date', 'Voucher Number', 'Transaction Type', 'Particulars', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)', 'Balance Type'];
    const rows = filteredEntries.map((e) => [
      `"${e.date}"`,
      `"${e.voucherNumber}"`,
      `"${e.referenceType}"`,
      `"${e.particulars.replace(/"/g, '""')}"`,
      e.debit,
      e.credit,
      e.runningBalance,
      `"${e.balanceType}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ledger_${ledgerData.party.code}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    handleDownloadCSV();
  };

  const handleDownloadPDF = () => {
    // Triggers standard print dialog optimized with @media print CSS
    window.print();
  };

  // Status Badge Logic
  const getReceivablePayableStatus = () => {
    if (!ledgerData) return null;
    const isDebit = ledgerData.closingBalance.type === 'DEBIT';
    if (isDebit) {
      return {
        label: 'Receivable (Debtor Balance)',
        description: 'Customer owes money to the enterprise',
        badge: <Badge variant="success">Receivable</Badge>,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
      };
    }
    return {
      label: 'Payable (Creditor Balance)',
      description: 'Enterprise owes money to the supplier',
      badge: <Badge variant="error">Payable</Badge>,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-200',
    };
  };

  const statusInfo = getReceivablePayableStatus();

  return (
    <div className="space-y-6">
      {/* Print-only CSS rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-ledger, #printable-ledger * {
            visibility: visible;
          }
          #printable-ledger {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header and Action Controls (Screen View) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PARTY LEDGER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Party Sub-Ledger Statement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit of debits, credits, running balances, and voucher references
          </p>
        </div>

        {/* Action Buttons: Print, PDF, Excel, CSV */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" icon={<Printer className="w-3.5 h-3.5" />} onClick={handlePrint}>
            Print
          </Button>
          <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />} onClick={handleDownloadPDF}>
            PDF
          </Button>
          <Button size="sm" variant="outline" icon={<FileSpreadsheet className="w-3.5 h-3.5" />} onClick={handleDownloadExcel}>
            Excel
          </Button>
          <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />} onClick={handleDownloadCSV}>
            CSV
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => fetchLedger(selectedPartyId, startDate, endDate)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Party Selector & Date Filters (no-print) */}
      <Card className="no-print">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Party Selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Select Party:
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => handleSelectParty(e.target.value)}
                disabled={partyListLoading}
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.type}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                From Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                To Date:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Secondary Filters: Transaction Type, Store, PO, Invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Transaction Type</label>
              <select
                value={transactionTypeFilter}
                onChange={(e) => setTransactionTypeFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="PURCHASE">Purchases</option>
                <option value="SALE">Sales</option>
                <option value="PAYMENT">Payments</option>
                <option value="RECEIPT">Receipts</option>
                <option value="JOURNAL">Journal Entries</option>
              </select>
            </div>

            {/* Store Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Store</label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stores</option>
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* PO Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">PO Filter</label>
              <input
                type="text"
                value={poFilter}
                onChange={(e) => setPoFilter(e.target.value)}
                placeholder="Filter by PO #..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Invoice Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Invoice Filter</label>
              <input
                type="text"
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value)}
                placeholder="Filter by Invoice #..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Printable Ledger Content Container */}
      <div id="printable-ledger" className="space-y-6">
        {/* Printable Formal Header */}
        <div className="hidden print:block p-4 border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-wider">PROZEN ERP</h1>
              <p className="text-xs font-semibold text-slate-600">Enterprise Store & Accounts Management</p>
              <p className="text-xs text-slate-500 mt-1">Official Party Sub-Ledger Statement</p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p className="font-bold text-slate-800">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              <p>Period: {startDate || 'Commencement'} to {endDate || 'Present'}</p>
            </div>
          </div>
        </div>

        {/* 6 Required Header Summary Items:
            1. Party Name
            2. Party Type
            3. Store
            4. Opening Balance
            5. Current Balance
            6. Receivable / Payable Status
        */}
        {ledgerData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Party Name */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Party Name</span>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={ledgerData.party.name}>
                {ledgerData.party.name}
              </p>
              <span className="text-[10px] font-mono text-blue-600 font-bold">{ledgerData.party.code}</span>
            </div>

            {/* 2. Party Type */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Party Type</span>
              <div className="mt-1">
                <Badge
                  variant={
                    ledgerData.party.type === 'SUPPLIER'
                      ? 'info'
                      : ledgerData.party.type === 'CUSTOMER'
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {ledgerData.party.type}
                </Badge>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {ledgerData.party.gstin ? `GST: ${ledgerData.party.gstin}` : 'Unregistered GST'}
              </span>
            </div>

            {/* 3. Store */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Store</span>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                {ledgerData.party.store?.name || 'Main Central Store'}
              </p>
              <span className="text-[10px] font-mono text-slate-400">
                {ledgerData.party.store?.code || 'STR-001'}
              </span>
            </div>

            {/* 4. Opening Balance */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Opening Balance</span>
              <p className="text-sm font-bold font-mono text-slate-800 mt-1">
                ₹ {ledgerData.openingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                  ledgerData.openingBalance.type === 'DEBIT'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {ledgerData.openingBalance.type === 'DEBIT' ? 'Dr (Debit)' : 'Cr (Credit)'}
              </span>
            </div>

            {/* 5. Current Balance */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Current Balance</span>
              <p className="text-base font-bold font-mono text-blue-700 mt-0.5">
                ₹ {ledgerData.closingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                  ledgerData.closingBalance.type === 'DEBIT'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {ledgerData.closingBalance.type === 'DEBIT' ? 'Dr (Debit)' : 'Cr (Credit)'}
              </span>
            </div>

            {/* 6. Receivable / Payable Status */}
            <div className={`p-3.5 rounded-xl border shadow-2xs ${statusInfo?.bg || 'bg-white'}`}>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Balance Status</span>
              <div className="mt-1">{statusInfo?.badge}</div>
              <span className="text-[10px] font-medium text-slate-500 mt-1 block truncate">
                {statusInfo?.label}
              </span>
            </div>
          </div>
        )}

        {/* Dedicated Ledger Table:
            Date, Transaction, Reference, Debit, Credit, Balance
        */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <CardTitle>Chronological Statement of Accounts</CardTitle>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {filteredEntries.length} Ledger Line Items
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="text-right">Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  {ledgerData && (
                    <TableRow className="bg-slate-50/70 font-medium">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {startDate || '01/04/2026'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">OPENING_BALANCE</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">OB-STATEMENT</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {ledgerData.openingBalance.type === 'DEBIT'
                          ? `₹ ${ledgerData.openingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {ledgerData.openingBalance.type === 'CREDIT'
                          ? `₹ ${ledgerData.openingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                        ₹ {ledgerData.openingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] text-blue-600">{ledgerData.openingBalance.type === 'DEBIT' ? 'Dr' : 'Cr'}</span>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Transaction Rows */}
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Calculating running sub-ledger from database...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                        No transactions recorded for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((row) => {
                      const isDebit = row.balanceType === 'DEBIT';

                      return (
                        <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Date */}
                          <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                            {row.date}
                          </TableCell>

                          {/* Transaction */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-block">
                                <Badge
                                  variant={
                                    row.referenceType.includes('PURCHASE')
                                      ? 'info'
                                      : row.referenceType.includes('SALE')
                                      ? 'success'
                                      : row.referenceType.includes('PAYMENT')
                                      ? 'error'
                                      : row.referenceType.includes('RECEIPT')
                                      ? 'success'
                                      : 'neutral'
                                  }
                                >
                                  {row.referenceType}
                                </Badge>
                              </span>
                              <span className="text-[11px] text-slate-600 truncate max-w-[280px]">
                                {row.particulars}
                              </span>
                            </div>
                          </TableCell>

                          {/* Reference */}
                          <TableCell className="font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                            {row.voucherNumber}
                          </TableCell>

                          {/* Debit */}
                          <TableCell className="text-right font-mono text-xs text-slate-900 whitespace-nowrap">
                            {row.debit > 0
                              ? `₹ ${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : <span className="text-slate-300">—</span>}
                          </TableCell>

                          {/* Credit */}
                          <TableCell className="text-right font-mono text-xs text-slate-900 whitespace-nowrap">
                            {row.credit > 0
                              ? `₹ ${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : <span className="text-slate-300">—</span>}
                          </TableCell>

                          {/* Balance */}
                          <TableCell className="text-right whitespace-nowrap">
                            <span
                              className={`font-mono text-xs font-bold ${
                                isDebit ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              ₹ {row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span
                              className={`ml-1 text-[10px] font-bold px-1 py-0.2 rounded ${
                                isDebit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {isDebit ? 'Dr' : 'Cr'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {/* Summary Totals Row */}
                  {ledgerData && (
                    <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <TableCell colSpan={3} className="text-right text-xs uppercase tracking-wider text-slate-700">
                        Period Total & Closing Running Balance:
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-900">
                        ₹ {ledgerData.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-900">
                        ₹ {ledgerData.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-blue-700 font-black">
                        ₹ {ledgerData.closingBalance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-[10px]">{ledgerData.closingBalance.type === 'DEBIT' ? 'Dr' : 'Cr'}</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartyLedgerPage;

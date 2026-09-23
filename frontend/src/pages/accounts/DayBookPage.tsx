import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Download,
  RefreshCw,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Building2,
  UserCheck,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';

interface DayBookRecord {
  id: string;
  date: string;
  transaction: string;
  reference: string;
  referenceType?: string;
  party: string;
  debit: string;
  credit: string;
  debitLines?: Array<{ accountName: string; accountCode: string; amount: number }>;
  creditLines?: Array<{ accountName: string; accountCode: string; amount: number }>;
  amount: number;
  narration: string;
  store: string;
  storeId?: string | null;
  createdBy: string;
}

interface DayBookSummary {
  totalTransactions: number;
  totalDebit: number;
  totalCredit: number;
}

interface StoreItem {
  id: string;
  code: string;
  name: string;
}

export const DayBookPage: React.FC = () => {
  const [records, setRecords] = useState<DayBookRecord[]>([]);
  const [summary, setSummary] = useState<DayBookSummary>({
    totalTransactions: 0,
    totalDebit: 0,
    totalCredit: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [stores, setStores] = useState<StoreItem[]>([]);

  // Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<DayBookRecord | null>(null);

  const fetchDayBook = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (selectedStore !== 'ALL') queryParams.append('storeId', selectedStore);

    const res = await apiRequest<{ records: DayBookRecord[]; summary: DayBookSummary }>(
      `/accounts/day-book?${queryParams.toString()}`
    );

    if (res.success && res.data) {
      setRecords(res.data.records || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    }
    setLoading(false);
  };

  const fetchStores = async () => {
    try {
      const res = await apiRequest<StoreItem[]>('/accounts/stores');
      if (res.success && res.data) {
        setStores(res.data);
      }
    } catch (err) {
      console.error('Failed to load stores', err);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchDayBook();
  }, [startDate, endDate, selectedStore]);

  const resetFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedStore('ALL');
  };

  const handleExport = () => {
    if (!records.length) return;
    const headers = [
      'Date',
      'Transaction',
      'Reference',
      'Party',
      'Debit',
      'Credit',
      'Amount (INR)',
      'Store',
      'Created By',
    ];
    const rows = records.map((r) => [
      `"${new Date(r.date).toLocaleDateString()}"`,
      `"${r.transaction}"`,
      `"${r.reference}"`,
      `"${r.party}"`,
      `"${r.debit.replace(/"/g, '""')}"`,
      `"${r.credit.replace(/"/g, '""')}"`,
      r.amount,
      `"${r.store}"`,
      `"${r.createdBy}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DayBook_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isBalanced = Math.abs(summary.totalDebit - summary.totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">DAY BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Day Book (Journal)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit log of all financial transactions showing balanced debits, credits, parties, and creators
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchDayBook}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export Day Book
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Transactions</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{summary.totalTransactions}</p>
          <span className="text-[10px] text-slate-400">Chronological journal vouchers</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Debit Volume</span>
          <p className="text-xl font-bold text-blue-600 mt-1">
            ₹ {summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Cumulative debits posted</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Credit Volume</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            ₹ {summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Cumulative credits posted</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Audit Integrity</span>
          <div className="mt-1 flex items-center gap-2">
            {isBalanced ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">Balanced (Dr = Cr)</span>
              </>
            ) : (
              <span className="text-sm font-bold text-rose-600">Discrepancy Detected</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">Double-entry verified</span>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDayBook()}
                placeholder="Search transaction #, party, account, narration..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Store Filter */}
            <div>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
              <span className="text-xs text-slate-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={fetchDayBook}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Day Book Table matching requested columns:
          Date, Transaction, Reference, Party, Debit, Credit, Amount, Store, Created By */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Chronological Transactions Log
          </span>
          <span className="text-xs font-semibold text-slate-500">{records.length} Journal Entries</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-center">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading Day Book transactions from database...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-400">
                    No accounting transactions found for selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Date */}
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>

                    {/* 2. Transaction */}
                    <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {row.transaction}
                      <div className="text-[10px] text-slate-500 font-normal truncate max-w-[140px]">
                        {row.narration}
                      </div>
                    </TableCell>

                    {/* 3. Reference */}
                    <TableCell className="text-xs">
                      <Badge variant="neutral">{row.reference}</Badge>
                    </TableCell>

                    {/* 4. Party */}
                    <TableCell className="text-xs font-medium text-slate-800">
                      {row.party}
                    </TableCell>

                    {/* 5. Debit */}
                    <TableCell className="text-xs text-rose-700 max-w-[200px]">
                      <span className="line-clamp-2">{row.debit}</span>
                    </TableCell>

                    {/* 6. Credit */}
                    <TableCell className="text-xs text-emerald-700 max-w-[200px]">
                      <span className="line-clamp-2">{row.credit}</span>
                    </TableCell>

                    {/* 7. Amount */}
                    <TableCell className="font-mono text-xs font-bold text-slate-900 text-right whitespace-nowrap">
                      ₹ {row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>

                    {/* 8. Store */}
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {row.store}
                    </TableCell>

                    {/* 9. Created By */}
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {row.createdBy}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setSelectedRecord(row)}
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VIEW JOURNAL VOUCHER MODAL */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Journal Voucher Details — ${selectedRecord.transaction}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Transaction #</span>
                <span className="font-mono font-bold text-slate-900">{selectedRecord.transaction}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Posting Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(selectedRecord.date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Reference</span>
                <span className="font-semibold text-slate-800">{selectedRecord.reference}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Store</span>
                <span className="font-medium text-slate-800">{selectedRecord.store}</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase mb-1">Party / Entity</span>
              <span className="font-bold text-slate-900">{selectedRecord.party}</span>
            </div>

            {/* Split Lines Breakdown */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-700 text-xs">
                Double-Entry Ledger Lines
              </div>
              <div className="p-3 space-y-2">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Debited Accounts:</span>
                  <p className="font-mono text-slate-700 mt-0.5">{selectedRecord.debit}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Credited Accounts:</span>
                  <p className="font-mono text-slate-700 mt-0.5">{selectedRecord.credit}</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-blue-600 block text-[10px] uppercase font-semibold">Total Amount</span>
                <span className="font-mono text-lg font-bold text-blue-700">
                  ₹ {selectedRecord.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Audited By</span>
                <span className="text-slate-700 font-medium">{selectedRecord.createdBy}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase mb-1">Narration</span>
              <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {selectedRecord.narration}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DayBookPage;

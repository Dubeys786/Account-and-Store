import React, { useEffect, useState } from 'react';
import {
  Building,
  Download,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

interface BankBookEntry {
  id: string;
  date: string;
  voucherNumber: string;
  referenceType?: string;
  narration: string;
  particulars: string;
  party: string;
  store: string;
  storeId?: string | null;
  receipt: number;
  payment: number;
  runningBalance: number;
}

interface BankBookSummary {
  bankAccountCode: string;
  bankAccountName: string;
  openingBankBalance: number;
  bankReceipts: number;
  bankPayments: number;
  closingBankBalance: number;
}

interface StoreItem {
  id: string;
  code: string;
  name: string;
}

export const BankBookPage: React.FC = () => {
  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [summary, setSummary] = useState<BankBookSummary>({
    bankAccountCode: '1020',
    bankAccountName: 'Operating Bank Account',
    openingBankBalance: 0,
    bankReceipts: 0,
    bankPayments: 0,
    closingBankBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [stores, setStores] = useState<StoreItem[]>([]);

  const fetchBankBook = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (selectedStore !== 'ALL') queryParams.append('storeId', selectedStore);

    const res = await apiRequest<{ summary: BankBookSummary; entries: BankBookEntry[] }>(
      `/accounts/bank-book?${queryParams.toString()}`
    );

    if (res.success && res.data) {
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
      setEntries(res.data.entries || []);
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
    fetchBankBook();
  }, [startDate, endDate, selectedStore]);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedStore('ALL');
  };

  const handleExport = () => {
    if (!entries.length) return;
    const headers = [
      'Date',
      'Voucher #',
      'Type',
      'Particulars',
      'Party',
      'Store',
      'Deposits (Dr)',
      'Withdrawals (Cr)',
      'Running Balance',
      'Narration',
    ];
    const rows = entries.map((e) => [
      `"${new Date(e.date).toLocaleDateString()}"`,
      `"${e.voucherNumber}"`,
      `"${e.referenceType || 'BANK'}"`,
      `"${e.particulars.replace(/"/g, '""')}"`,
      `"${e.party}"`,
      `"${e.store}"`,
      e.receipt,
      e.payment,
      e.runningBalance,
      `"${e.narration.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BankBook_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">BANK BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Book Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating bank account ledger (Account 1020), deposits, NEFT/RTGS, UPI settlements, and withdrawals with running balance
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchBankBook}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export Bank Statement
          </Button>
        </div>
      </div>

      {/* 4 Required KPI Summary Cards:
          Opening Bank Balance, Bank Receipts, Bank Payments, Closing Bank Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Opening Bank Balance */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Opening Bank Balance</span>
          <p className="text-xl font-bold text-slate-900 mt-1">
            ₹ {summary.openingBankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Balance prior to selected period</span>
        </div>

        {/* 2. Bank Receipts */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bank Receipts</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            + ₹ {summary.bankReceipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Deposits, UPI, NEFT inflows</span>
        </div>

        {/* 3. Bank Payments */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bank Payments</span>
          <p className="text-xl font-bold text-rose-600 mt-1">
            - ₹ {summary.bankPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Vendor transfers, cheques & RTGS</span>
        </div>

        {/* 4. Closing Bank Balance */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Closing Bank Balance</span>
          <p className="text-xl font-bold text-blue-600 mt-1">
            ₹ {summary.closingBankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Formula: Opening + Receipts - Payments</span>
        </div>
      </div>

      {/* Filter by Date and Store */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Store Filter */}
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Stores & Locations</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <span className="text-xs text-slate-500 font-medium">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Clear
              </Button>
              <Button size="sm" variant="outline" onClick={fetchBankBook}>
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Book Ledger Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Bank Statement Ledger Entries (1020 - Operating Bank Account)
          </span>
          <span className="text-xs font-semibold text-slate-500">{entries.length} Ledger Entries</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher / Txn #</TableHead>
                  <TableHead>Particulars (Contra)</TableHead>
                  <TableHead>Party Involved</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Deposits (Dr ₹)</TableHead>
                  <TableHead className="text-right">Withdrawals (Cr ₹)</TableHead>
                  <TableHead className="text-right font-bold">Running Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Calculating Bank Book statement from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      No bank transactions recorded for selected date and store.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {entry.voucherNumber}
                        <div className="text-[10px] text-slate-400 font-normal">{entry.referenceType}</div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {entry.particulars}
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px] font-normal">
                          {entry.narration}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {entry.party}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {entry.store}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                        {entry.receipt > 0 ? `₹ ${entry.receipt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                        {entry.payment > 0 ? `₹ ${entry.payment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-700 text-right whitespace-nowrap bg-blue-50/30">
                        ₹ {entry.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankBookPage;

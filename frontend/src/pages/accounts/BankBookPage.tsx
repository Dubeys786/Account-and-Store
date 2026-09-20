import React, { useEffect, useState } from 'react';
import { Building, Download, RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

interface BankBookEntry {
  id: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  journalEntry?: {
    entryNumber: string;
    entryDate: string;
    narration: string;
    referenceType?: string;
  };
  party?: {
    code: string;
    name: string;
  };
}

interface BankBookResponse {
  bankAccountCode: string;
  balance: number;
  entries: BankBookEntry[];
}

export const BankBookPage: React.FC = () => {
  const [data, setData] = useState<BankBookResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBankBook = async () => {
    setLoading(true);
    const res = await apiRequest<BankBookResponse>('/accounts/bank-book');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBankBook();
  }, []);

  const totalIn = data?.entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0) || 0;
  const totalOut = data?.entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0) || 0;

  const handleExport = () => {
    if (!data?.entries.length) return;
    const headers = ['Date', 'Voucher #', 'Particulars', 'Deposit (Debit)', 'Withdrawal (Credit)'];
    const rows = data.entries.map((e) => [
      `"${e.journalEntry?.entryDate || ''}"`,
      `"${e.journalEntry?.entryNumber || ''}"`,
      `"${(e.description || e.journalEntry?.narration || '').replace(/"/g, '""')}"`,
      e.debitAmount,
      e.creditAmount,
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
            Bank account ledger (Account 1020 - HDFC Bank Current A/c), deposits, NEFT/RTGS, and cheque clearances
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Account Name</span>
          <p className="text-sm font-bold text-slate-900 mt-1">HDFC Bank Current A/c</p>
          <p className="text-[10px] text-slate-400">A/c No: 50200012345678 (1020)</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Bank Deposits</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            + ₹ {totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">NEFT / RTGS / Cheque inflows</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Bank Balance</span>
          <p className="text-xl font-bold text-blue-600 mt-1">
            ₹ {(data?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Available bank liquidity</span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Bank Ledger Entries (1020 - HDFC Bank Current A/c)
          </span>
          <span className="text-xs font-semibold text-slate-500">{data?.entries.length || 0} Ledger Entries</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher / Cheque #</TableHead>
                  <TableHead>Particulars</TableHead>
                  <TableHead>Party Involved</TableHead>
                  <TableHead className="text-right">Deposit (Debit)</TableHead>
                  <TableHead className="text-right">Withdrawal (Credit)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading bank statement from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !data?.entries || data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                      No bank transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.entries.map((line) => (
                    <TableRow key={line.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {line.journalEntry?.entryDate
                          ? new Date(line.journalEntry.entryDate).toLocaleDateString('en-IN')
                          : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {line.journalEntry?.entryNumber || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {line.description || line.journalEntry?.narration || 'Bank Transfer'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {line.party?.name ? (
                          <span className="font-medium text-slate-800">{line.party.name}</span>
                        ) : (
                          <span className="text-slate-400">Direct Bank Transfer</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-700 font-bold text-right whitespace-nowrap">
                        {line.debitAmount > 0 ? `₹ ${line.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-rose-700 font-bold text-right whitespace-nowrap">
                        {line.creditAmount > 0 ? `₹ ${line.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
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

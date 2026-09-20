import React, { useEffect, useState } from 'react';
import { Calendar, Download, RefreshCw, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

interface JournalLine {
  id: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  account?: {
    code: string;
    name: string;
  };
  party?: {
    code: string;
    name: string;
  };
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  referenceType?: string;
  narration: string;
  totalAmount: number;
  lines: JournalLine[];
}

export const DayBookPage: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDayBook = async () => {
    setLoading(true);
    const res = await apiRequest<{ date: string; transactions: JournalEntry[] }>('/accounts/day-book');
    if (res.success && res.data?.transactions) {
      setEntries(res.data.transactions);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDayBook();
  }, []);

  const handleExport = () => {
    if (!entries.length) return;
    const headers = ['Entry Number', 'Date', 'Type', 'Narration', 'Account', 'Party', 'Debit (INR)', 'Credit (INR)'];
    const rows: any[] = [];
    entries.forEach((e) => {
      e.lines.forEach((l) => {
        rows.push([
          `"${e.entryNumber}"`,
          `"${e.entryDate}"`,
          `"${e.referenceType || 'JOURNAL'}"`,
          `"${e.narration.replace(/"/g, '""')}"`,
          `"${l.account?.name || ''}"`,
          `"${l.party?.name || ''}"`,
          l.debitAmount,
          l.creditAmount,
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DayBook_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="text-blue-600">DAY BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Day Book (Journal)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit of daily double-entry journal transactions across purchases, sales, payments, and receipts
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>
              Transactions Audit Log (
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              )
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">{entries.length} Journal Vouchers</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher / Inv #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Debit Account (Accounted)</TableHead>
                  <TableHead>Credit Account (Accounted)</TableHead>
                  <TableHead className="text-right">Debit (₹)</TableHead>
                  <TableHead className="text-right">Credit (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading day book journal transactions from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                      No journal entries recorded in database.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const debitLines = entry.lines.filter((l) => l.debitAmount > 0);
                    const creditLines = entry.lines.filter((l) => l.creditAmount > 0);

                    return (
                      <TableRow key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          {entry.entryNumber}
                          <div className="text-[11px] text-slate-500 font-normal truncate max-w-[200px]">
                            {entry.narration}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {new Date(entry.entryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">{entry.referenceType || 'JOURNAL'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {debitLines.map((d, i) => (
                            <div key={i} className="text-slate-800 font-medium">
                              {d.account?.name || 'Debit Account'}
                              {d.party && <span className="text-slate-500 text-[10px]"> ({d.party.name})</span>}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {creditLines.map((c, i) => (
                            <div key={i} className="text-slate-800 font-medium">
                              {c.account?.name || 'Credit Account'}
                              {c.party && <span className="text-slate-500 text-[10px]"> ({c.party.name})</span>}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 text-right whitespace-nowrap">
                          ₹ {entry.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 text-right whitespace-nowrap">
                          ₹ {entry.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
    </div>
  );
};

export default DayBookPage;

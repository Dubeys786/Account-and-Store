import React, { useEffect, useState } from 'react';
import { ArrowDownRight, Download, RefreshCw, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface CustomerReceivable {
  id: string;
  code: string;
  name: string;
  phone?: string;
  mobile?: string;
  creditLimit: number;
  creditDays: number;
  currentBalance?: number;
  balanceType?: string;
  formattedBalance?: string;
  openingBalance: number;
  store?: {
    id: string;
    code: string;
    name: string;
  };
}

export const ReceivablesPage: React.FC = () => {
  const [data, setData] = useState<{ totalReceivables: number; records: CustomerReceivable[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReceivables = async () => {
    setLoading(true);
    const res = await apiRequest<{ totalReceivables: number; records: CustomerReceivable[] }>('/accounts/receivables');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const handleExportCSV = () => {
    if (!data?.records?.length) return;
    const headers = ['Customer Code', 'Customer Name', 'Phone', 'Store', 'Outstanding Balance', 'Balance Type', 'Credit Limit'];
    const rows = data.records.map((c) => [
      `"${c.code}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.mobile || c.phone || ''}"`,
      `"${c.store?.name || 'All Stores'}"`,
      c.currentBalance ?? c.openingBalance ?? 0,
      `"${c.balanceType || 'DEBIT'}"`,
      c.creditLimit,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Receivables_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="text-blue-600">RECEIVABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Receivable (Debtors)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer outstanding invoices, collection tracking, and debtor aging schedules
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchReceivables}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export Aging
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Total Outstanding Receivables: ₹ {data?.totalReceivables?.toLocaleString('en-IN') || '0'}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {data?.records?.length || 0} Customer Accounts with Balances
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Contact Phone</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Total Outstanding</TableHead>
                  <TableHead>Credit Terms</TableHead>
                  <TableHead className="text-center">Credit Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading receivables aging from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !data?.records || data.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      No active receivable records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.records.map((c) => {
                    const balance = c.currentBalance ?? c.openingBalance ?? 0;
                    const isOverCredit = c.creditLimit > 0 && balance > c.creditLimit;

                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                          {c.code}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 text-xs">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono whitespace-nowrap">
                          {c.mobile || c.phone || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {c.store?.name || 'All Stores'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-emerald-700 text-right whitespace-nowrap">
                          ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          ₹ {c.creditLimit?.toLocaleString('en-IN')} ({c.creditDays}d)
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge variant={isOverCredit ? 'error' : 'success'}>
                            {isOverCredit ? 'Exceeded Limit' : 'Within Limit'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Link
                            to={`/accounts/ledger?partyId=${c.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ledger
                          </Link>
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

export default ReceivablesPage;

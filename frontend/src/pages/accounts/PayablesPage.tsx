import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Download, RefreshCw, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

interface SupplierPayable {
  id: string;
  code: string;
  name: string;
  phone?: string;
  mobile?: string;
  creditDays: number;
  paymentTerms?: string;
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

export const PayablesPage: React.FC = () => {
  const [data, setData] = useState<{ totalPayables: number; records: SupplierPayable[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPayables = async () => {
    setLoading(true);
    const res = await apiRequest<{ totalPayables: number; records: SupplierPayable[] }>('/accounts/payables');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const handleExportCSV = () => {
    if (!data?.records?.length) return;
    const headers = ['Supplier Code', 'Supplier Name', 'Contact Phone', 'Store', 'Payable Balance', 'Payment Terms'];
    const rows = data.records.map((s) => [
      `"${s.code}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.mobile || s.phone || ''}"`,
      `"${s.store?.name || 'All Stores'}"`,
      s.currentBalance ?? s.openingBalance ?? 0,
      `"${s.paymentTerms || `${s.creditDays} Days`}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Payables_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="text-blue-600">PAYABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Payable (Creditors)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor trade payables, disbursement tracking, and supplier outstanding liabilities
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
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Total Outstanding Payables: ₹ {data?.totalPayables?.toLocaleString('en-IN') || '0'}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {data?.records?.length || 0} Vendor Accounts with Due Balances
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Code</TableHead>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Contact Phone</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Total Payable</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading vendor payables from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !data?.records || data.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      No active supplier payable records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.records.map((s) => {
                    const balance = s.currentBalance ?? s.openingBalance ?? 0;

                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                          {s.code}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 text-xs">
                          {s.name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono whitespace-nowrap">
                          {s.mobile || s.phone || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {s.store?.name || 'All Stores'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-rose-700 text-right whitespace-nowrap">
                          ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {s.paymentTerms || `${s.creditDays} Days Credit`}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge variant="warning">Liability</Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Link
                            to={`/accounts/ledger?partyId=${s.id}`}
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

export default PayablesPage;

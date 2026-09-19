import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const IncomePage: React.FC = () => {
  const [incomeList, setIncomeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIncome() {
      const res = await apiRequest('/accounts/income');
      if (res.success && res.data) setIncomeList(res.data);
      setLoading(false);
    }
    fetchIncome();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">INCOME</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Direct & Indirect Income</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log other income, commission, interest earned, scrap sales, and auxiliary revenues
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Record New Income
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search income by source, category..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{incomeList.length} Income Records</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Ledger Account</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Receipt Mode</TableHead>
                <TableHead>Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading income records from database...
                  </TableCell>
                </TableRow>
              ) : incomeList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No miscellaneous income records recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                incomeList.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{inc.incomeNumber}</TableCell>
                    <TableCell>{new Date(inc.incomeDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="neutral">{inc.category}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-700">{inc.account?.name}</TableCell>
                    <TableCell>{inc.store?.name}</TableCell>
                    <TableCell><Badge variant="blue">{inc.paymentMode}</Badge></TableCell>
                    <TableCell className="font-mono font-bold text-emerald-600">₹ {inc.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

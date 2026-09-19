import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExpenses() {
      const res = await apiRequest('/accounts/expenses');
      if (res.success && res.data) setExpenses(res.data);
      setLoading(false);
    }
    fetchExpenses();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">EXPENSES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track direct and indirect operating expenditures, petty cash, electricity, rent, and freight
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Record New Expense
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search expenses by category, description..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{expenses.length} Expense Records</span>
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
                <TableHead>Payment Mode</TableHead>
                <TableHead>Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading expenses from database...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No operating expenses recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{exp.expenseNumber}</TableCell>
                    <TableCell>{new Date(exp.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="neutral">{exp.category}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-700">{exp.account?.name}</TableCell>
                    <TableCell>{exp.store?.name}</TableCell>
                    <TableCell><Badge variant="blue">{exp.paymentMode}</Badge></TableCell>
                    <TableCell className="font-mono font-bold text-rose-600">₹ {exp.amount.toLocaleString()}</TableCell>
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

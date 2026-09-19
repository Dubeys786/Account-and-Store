import React, { useEffect, useState } from 'react';
import { Plus, ArrowLeftRight, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const IssueReturnPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      const res = await apiRequest('/store/issue-return');
      if (res.success && res.data) setTransactions(res.data);
      setLoading(false);
    }
    fetchTransactions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>INVENTORY</span>
            <span>/</span>
            <span className="text-blue-600">ISSUE / RETURN</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Issue & Return</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue materials to departments or production lines, validate stock availability, and process returns
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<ArrowLeftRight className="w-3.5 h-3.5" />}>
            Record Return
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Issue Material
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Item or Transaction..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{transactions.length} Transactions</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Reference / Dept</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading issue & return transactions from database...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No issue or return transactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={tx.transactionType === 'ISSUE' ? 'warning' : 'info'}>
                        {tx.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{tx.item?.code}</TableCell>
                    <TableCell className="font-medium">{tx.item?.name}</TableCell>
                    <TableCell className="font-bold">{tx.quantity}</TableCell>
                    <TableCell className="font-mono font-semibold">{tx.balanceAfter}</TableCell>
                    <TableCell className="text-slate-500">{tx.notes || tx.referenceType}</TableCell>
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

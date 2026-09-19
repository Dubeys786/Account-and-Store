import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const ReceiptsPage: React.FC = () => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReceipts() {
      const res = await apiRequest('/accounts/receipts');
      if (res.success && res.data) setReceipts(res.data);
      setLoading(false);
    }
    fetchReceipts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">RECEIPTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Receipt Vouchers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive collections from customers against invoices, track cheques, bank NEFT/RTGS, and cash receipts
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Record Receipt Voucher
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search receipts by voucher #, customer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{receipts.length} Receipts</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Received From (Party)</TableHead>
                <TableHead>Receipt Mode</TableHead>
                <TableHead>Account Deposited</TableHead>
                <TableHead>Ref / Cheque #</TableHead>
                <TableHead>Amount Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading receipts from database...
                  </TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No receipt vouchers recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{r.receiptNumber}</TableCell>
                    <TableCell>{new Date(r.receiptDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-slate-900">{r.party?.name}</TableCell>
                    <TableCell><Badge variant="blue">{r.paymentMode}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-600">{r.account?.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.referenceNo || '—'}</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-600">₹ {r.amount.toLocaleString()}</TableCell>
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

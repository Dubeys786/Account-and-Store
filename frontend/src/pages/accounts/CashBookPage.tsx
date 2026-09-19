import React from 'react';
import { DollarSign, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Button } from '../../components/common/Button';

export const CashBookPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">CASH BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cash Book Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical cash in hand ledger (Account 1010), daily receipts, and petty cash disbursements
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Cash Book
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Opening Cash Balance</p>
          <p className="text-xl font-bold text-slate-900 mt-1">₹ 25,000</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Cash Inflow</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">+ ₹ 44,200</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Closing Cash in Hand</p>
          <p className="text-xl font-bold text-blue-600 mt-1">₹ 54,200</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <span className="text-xs font-bold text-slate-700">Cash Transactions Ledger (1010 - Cash in Hand)</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher #</TableHead>
                <TableHead>Particulars</TableHead>
                <TableHead>Cash In (Debit)</TableHead>
                <TableHead>Cash Out (Credit)</TableHead>
                <TableHead>Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs">01/04/2026</TableCell>
                <TableCell className="font-mono text-xs">OB-001</TableCell>
                <TableCell className="font-medium text-slate-800">Opening Balance Cash on Hand</TableCell>
                <TableCell className="font-mono">₹ 25,000</TableCell>
                <TableCell className="font-mono">—</TableCell>
                <TableCell className="font-mono font-bold">₹ 25,000 Dr</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

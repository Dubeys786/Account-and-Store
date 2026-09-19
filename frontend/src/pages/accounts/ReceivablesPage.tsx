import React from 'react';
import { ArrowDownRight, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const ReceivablesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">RECEIVABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Receivable (Debtors)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer outstanding invoices, aging schedules (0-30, 31-60, 61-90, 90+ days), and collection tracking
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Aging
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <span className="text-xs font-bold text-slate-700">Total Outstanding Receivables: ₹ 4,50,000</span>
          <span className="text-xs text-slate-500">1 Customer Account with Due Balance</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Code</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Contact Phone</TableHead>
                <TableHead>Total Outstanding</TableHead>
                <TableHead>0 - 30 Days</TableHead>
                <TableHead>31 - 60 Days</TableHead>
                <TableHead>Overdue Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs font-bold text-slate-900">PRT-CUS-001</TableCell>
                <TableCell className="font-medium text-slate-900">Metro City Infrastructure Pvt Ltd</TableCell>
                <TableCell className="text-xs text-slate-600">+91 98333 44455</TableCell>
                <TableCell className="font-mono font-bold text-slate-900">₹ 4,50,000</TableCell>
                <TableCell className="font-mono">₹ 3,30,000</TableCell>
                <TableCell className="font-mono">₹ 1,20,000</TableCell>
                <TableCell><Badge variant="warning">Within Credit Limit</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

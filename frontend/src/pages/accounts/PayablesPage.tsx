import React from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const PayablesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PAYABLES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Payable (Creditors)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor trade payables, due dates, payment schedules, and outstanding liabilities
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Payables
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <span className="text-xs font-bold text-slate-700">Total Outstanding Payables: ₹ 2,85,000</span>
          <span className="text-xs text-slate-500">2 Vendor Accounts with Due Balances</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Code</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Total Payable</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Earliest Due Date</TableHead>
                <TableHead>Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs font-bold text-slate-900">PRT-SUP-001</TableCell>
                <TableCell className="font-medium text-slate-900">Bharat Steel & Fasteners Ltd</TableCell>
                <TableCell className="font-mono font-bold text-slate-900">₹ 1,75,000</TableCell>
                <TableCell className="text-xs">30 Days Credit</TableCell>
                <TableCell className="text-xs">28/09/2026</TableCell>
                <TableCell><Badge variant="warning">Due Soon</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs font-bold text-slate-900">PRT-SUP-002</TableCell>
                <TableCell className="font-medium text-slate-900">Apex Industrial Lubricants Corp</TableCell>
                <TableCell className="font-mono font-bold text-slate-900">₹ 1,10,000</TableCell>
                <TableCell className="text-xs">45 Days Credit</TableCell>
                <TableCell className="text-xs">15/10/2026</TableCell>
                <TableCell><Badge variant="info">Upcoming</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

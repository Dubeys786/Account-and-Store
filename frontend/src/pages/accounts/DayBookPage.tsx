import React from 'react';
import { Calendar, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Button } from '../../components/common/Button';

export const DayBookPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">DAY BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Day Book (Journal)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit of daily transactions across cash, bank, purchases, and sales
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Day Book
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Showing transactions for today: {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Voucher / Inv #</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Debit A/c</TableHead>
                <TableHead>Credit A/c</TableHead>
                <TableHead>Debit (₹)</TableHead>
                <TableHead>Credit (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No transactions recorded today yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

import React from 'react';
import { Search, Download, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Button } from '../../components/common/Button';

export const PartyLedgerPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PARTY LEDGER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Party Ledger Statement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual supplier and customer sub-ledger statements with debit, credit, and running balance tracking
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export PDF / Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Select party or type to search..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Date Range:</span>
              <span className="font-semibold text-slate-700">01 Apr 2026 - 31 Mar 2027</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher / Inv #</TableHead>
                <TableHead>Particulars / Narration</TableHead>
                <TableHead>Debit (₹)</TableHead>
                <TableHead>Credit (₹)</TableHead>
                <TableHead>Balance (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs">01/04/2026</TableCell>
                <TableCell className="font-mono text-xs">OB-001</TableCell>
                <TableCell className="font-medium text-slate-700">Opening Balance</TableCell>
                <TableCell className="font-mono">0.00</TableCell>
                <TableCell className="font-mono">0.00</TableCell>
                <TableCell className="font-mono font-bold">0.00 Cr</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

import React from 'react';
import { Building, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Button } from '../../components/common/Button';

export const BankBookPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">BANK BOOK</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Book Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bank account ledger (Account 1020 - HDFC Bank Current A/c), deposits, cheque clearances, and bank reconciliations
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Bank Statement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Account Name</p>
          <p className="text-sm font-bold text-slate-900 mt-1">HDFC Bank Current A/c</p>
          <p className="text-[10px] text-slate-400">A/c No: 50200012345678</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Monthly Deposits</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">+ ₹ 7,95,000</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Current Bank Balance</p>
          <p className="text-xl font-bold text-blue-600 mt-1">₹ 11,90,800</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <span className="text-xs font-bold text-slate-700">Bank Ledger Entries (1020 - HDFC Bank Current A/c)</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Cheque / UTR #</TableHead>
                <TableHead>Particulars</TableHead>
                <TableHead>Deposit (Debit)</TableHead>
                <TableHead>Withdrawal (Credit)</TableHead>
                <TableHead>Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs">01/04/2026</TableCell>
                <TableCell className="font-mono text-xs">RTGS-001</TableCell>
                <TableCell className="font-medium text-slate-800">Opening Balance in Current Account</TableCell>
                <TableCell className="font-mono">₹ 10,00,000</TableCell>
                <TableCell className="font-mono">—</TableCell>
                <TableCell className="font-mono font-bold">₹ 10,00,000 Dr</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

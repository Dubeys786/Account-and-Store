import React from 'react';
import { BarChart3, Download, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

export const AccountsReportsPage: React.FC = () => {
  const reports = [
    { title: 'Trial Balance', desc: 'Summary of all general ledger debit and credit totals verifying double-entry equilibrium' },
    { title: 'Profit & Loss Statement', desc: 'Trading and income statement showing gross margin and net operating profit' },
    { title: 'Balance Sheet', desc: 'Statement of financial position showing total assets, liabilities, and owners equity' },
    { title: 'GST GSTR-2B Reconciliation', desc: 'Reconcile supplier purchase bills with government GST portal input tax credits' },
    { title: 'Party Outstanding Aging', desc: 'Comprehensive customer and supplier aging schedule by credit days elapsed' },
    { title: 'Cash Flow Statement', desc: 'Operational, investing, and financing cash flow movement summary' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">REPORTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial & Accounting Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory financial statements, tax reconciliation reports, and management balance summaries
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reports.map((report) => (
          <Card key={report.title} className="hover:border-slate-300 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-4">{report.desc}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button size="sm" variant="secondary" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                  View Report
                </Button>
                <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

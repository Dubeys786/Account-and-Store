import React, { useEffect, useState } from 'react';
import { BarChart3, Download, ArrowUpRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

interface ReportMeta {
  title: string;
  desc: string;
  category: string;
}

const defaultReportDescriptions: Record<string, { desc: string; category: string }> = {
  'Trial Balance': {
    desc: 'Summary of all general ledger debit and credit totals verifying double-entry equilibrium',
    category: 'Statutory Accounting',
  },
  'Profit & Loss Statement': {
    desc: 'Trading and income statement showing gross margin, operating expenditure, and net profit',
    category: 'Management Financials',
  },
  'Balance Sheet': {
    desc: 'Statement of financial position showing total assets, liabilities, and owners equity',
    category: 'Statutory Accounting',
  },
  'GST GSTR-2B Reconciliation': {
    desc: 'Reconcile supplier purchase bills with government GST portal input tax credits',
    category: 'Tax & Compliance',
  },
  'Party Outstanding Aging': {
    desc: 'Comprehensive customer and supplier aging schedule by credit days elapsed',
    category: 'Audit & Liquidity',
  },
};

export const AccountsReportsPage: React.FC = () => {
  const [reportsList, setReportsList] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    const res = await apiRequest<{ availableReports: string[] }>('/accounts/reports');
    if (res.success && res.data?.availableReports) {
      const items: ReportMeta[] = res.data.availableReports.map((title) => ({
        title,
        desc:
          defaultReportDescriptions[title]?.desc ||
          'Automated real-time financial report generated from double-entry general ledger records',
        category: defaultReportDescriptions[title]?.category || 'Financial Statements',
      }));
      setReportsList(items);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportPDF = (title: string) => {
    window.print();
  };

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
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchReports}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
            <span>Loading available reports catalog from server...</span>
          </div>
        ) : (
          reportsList.map((report) => (
            <Card key={report.title} className="hover:border-slate-300 transition-colors shadow-2xs">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{report.title}</CardTitle>
                    <span className="text-[10px] text-slate-400 font-medium">{report.category}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{report.desc}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> API Connected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download className="w-3.5 h-3.5" />}
                    onClick={() => handleExportPDF(report.title)}
                  >
                    Export Statement
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AccountsReportsPage;

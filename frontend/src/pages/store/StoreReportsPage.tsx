import React from 'react';
import { BarChart3, Download, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

export const StoreReportsPage: React.FC = () => {
  const reports = [
    { title: 'Stock Valuation Summary', desc: 'Comprehensive financial valuation of closing stock across all categories' },
    { title: 'Item Consumption Analysis', desc: 'Historical consumption patterns, slow-moving items, and stock turnover ratio' },
    { title: 'Pending PO Aging Report', desc: 'Overdue purchase order deliveries grouped by vendor' },
    { title: 'Supplier Inward Rejection Rate', desc: 'QC rejection statistics and supplier delivery quality analysis' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>INVENTORY</span>
            <span>/</span>
            <span className="text-blue-600">REPORTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store & Inventory Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analytical reporting, stock movement auditing, and supplier performance summaries
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((report) => (
          <Card key={report.title} className="hover:border-slate-300 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm">{report.title}</CardTitle>
              </div>
              <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
                Export PDF
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-4">{report.desc}</p>
              <Button size="sm" variant="secondary" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                Generate Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

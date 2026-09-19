import React, { useEffect, useState } from 'react';
import { BarChart3, Download, TrendingUp, Clock, AlertOctagon, DollarSign, Package, Layers, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

type ReportTab = 'valuation' | 'consumption' | 'pending-pos' | 'supplier-rejection';

export const StoreReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('valuation');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Fetch report based on active tab
  const fetchReport = async (tab: ReportTab) => {
    setLoading(true);
    setReportData(null);
    const res = await apiRequest(`/store/reports/${tab}`);
    if (res.success && res.data) {
      setReportData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  // Export CSV helper
  const handleExportCSV = () => {
    if (!reportData) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `Store_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'valuation' && reportData.items) {
      headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Current Stock', 'Unit Valuation Rate (₹)', 'Total Valuation (₹)'];
      rows = reportData.items.map((i: any) => [
        i.code,
        `"${i.name}"`,
        i.category,
        i.unit,
        i.currentStock,
        i.valuationRate,
        i.totalValuation,
      ]);
    } else if (activeTab === 'consumption' && reportData.consumption) {
      headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Total Consumed Qty', 'Issue Count', 'Departments'];
      rows = reportData.consumption.map((i: any) => [
        i.code,
        `"${i.name}"`,
        i.category,
        i.unit,
        i.totalConsumedQty,
        i.issueCount,
        `"${i.departments.join('; ')}"`,
      ]);
    } else if (activeTab === 'pending-pos' && reportData.pendingPOs) {
      headers = ['PO Number', 'PO Date', 'Supplier', 'Status', 'Days Pending', 'Ordered Qty', 'Received Qty', 'Pending Qty', 'Pending Value (₹)'];
      rows = reportData.pendingPOs.map((p: any) => [
        p.poNumber,
        new Date(p.poDate).toLocaleDateString(),
        `"${p.supplier?.name || ''}"`,
        p.status,
        p.daysPending,
        p.orderedQty,
        p.receivedQty,
        p.pendingQty,
        p.estimatedPendingValue,
      ]);
    } else if (activeTab === 'supplier-rejection' && reportData.suppliers) {
      headers = ['Supplier Code', 'Supplier Name', 'Total Inwards', 'Total Received Qty', 'Total Rejected Qty', 'Total Accepted Qty', 'Rejection Rate %'];
      rows = reportData.suppliers.map((s: any) => [
        s.partyCode,
        `"${s.partyName}"`,
        s.totalInwards,
        s.totalReceived,
        s.totalRejected,
        s.totalAccepted,
        s.rejectionRatePercent,
      ]);
    }

    if (headers.length === 0) return;

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>STORE MANAGEMENT</span>
            <span>/</span>
            <span className="text-blue-600">ANALYTICS &amp; REPORTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store &amp; Inventory Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time automated valuation, consumption analytics, pending delivery tracking, and supplier QC audits
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />} onClick={() => fetchReport(activeTab)}>
            Refresh
          </Button>
          <Button size="sm" variant="primary" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'valuation'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Stock Valuation Summary
        </button>

        <button
          onClick={() => setActiveTab('consumption')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'consumption'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Material Consumption Analysis
        </button>

        <button
          onClick={() => setActiveTab('pending-pos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'pending-pos'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending PO Aging Report
        </button>

        <button
          onClick={() => setActiveTab('supplier-rejection')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'supplier-rejection'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Supplier QC Rejection Rate
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2" />
          <p className="text-xs">Computing report from live transactions...</p>
        </div>
      )}

      {/* TAB 1: STOCK VALUATION SUMMARY */}
      {!loading && activeTab === 'valuation' && reportData && (
        <div className="space-y-5">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Physical Inventory Value
              </span>
              <span className="text-2xl font-bold font-mono text-blue-600 block mt-1">
                ₹ {Number(reportData.totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Active Catalog SKUs
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 block mt-1">
                {reportData.items?.length || 0} Items
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tracked Categories
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 block mt-1">
                {Object.keys(reportData.categoryBreakdown || {}).length} Categories
              </span>
            </div>
          </div>

          {/* Category breakdown pills */}
          {reportData.categoryBreakdown && (
            <Card>
              <CardHeader>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Valuation by Category
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(reportData.categoryBreakdown).map(([cat, val]: [string, any]) => (
                    <div key={cat} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">{cat}</span>
                      <span className="text-sm font-bold font-mono text-slate-900 block mt-0.5">
                        ₹ {Number(val).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed table */}
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Item Valuation Details</span>
              <span className="text-xs text-slate-500">{reportData.items?.length || 0} items</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Valuation Rate (₹)</TableHead>
                    <TableHead className="text-right font-bold">Total Valuation (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.items?.map((item: any) => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell><Badge variant="neutral">{item.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-semibold">{item.currentStock} {item.unit}</TableCell>
                      <TableCell className="text-right font-mono">₹ {item.valuationRate}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        ₹ {Number(item.totalValuation).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: MATERIAL CONSUMPTION ANALYSIS */}
      {!loading && activeTab === 'consumption' && reportData && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Material Consumption &amp; Departmental Utilization
              </span>
              <span className="text-xs text-slate-500">{reportData.consumption?.length || 0} items analyzed</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Issued / Consumed</TableHead>
                    <TableHead className="text-right">Issue Frequency</TableHead>
                    <TableHead>Consuming Departments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.consumption?.map((item: any) => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell><Badge variant="neutral">{item.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600">
                        {item.totalConsumedQty} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.issueCount} times</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.departments && item.departments.length > 0 ? (
                            item.departments.map((dept: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded font-medium">
                                {dept}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: PENDING PO AGING REPORT */}
      {!loading && activeTab === 'pending-pos' && reportData && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Pending POs
              </span>
              <span className="text-2xl font-bold font-mono text-amber-600 block mt-1">
                {reportData.totalPendingPOs || 0} Orders
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Estimated Pending Delivery Value
              </span>
              <span className="text-2xl font-bold font-mono text-blue-600 block mt-1">
                ₹ {Number(reportData.totalPendingValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Unfulfilled &amp; Partially Received Purchase Orders
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>PO Date</TableHead>
                    <TableHead>Supplier / Vendor</TableHead>
                    <TableHead>Aging (Days)</TableHead>
                    <TableHead className="text-right">Ordered Qty</TableHead>
                    <TableHead className="text-right">Received Qty</TableHead>
                    <TableHead className="text-right font-bold text-amber-600">Pending Qty</TableHead>
                    <TableHead className="text-right font-bold">Pending Value (₹)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.pendingPOs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                        No pending purchase orders! All orders are fully received or closed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.pendingPOs?.map((po: any) => (
                      <TableRow key={po.poId}>
                        <TableCell className="font-mono text-xs font-bold text-blue-600">{po.poNumber}</TableCell>
                        <TableCell>{new Date(po.poDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium text-slate-800">{po.supplier?.name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${
                            po.daysPending > 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {po.daysPending} days
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{po.orderedQty}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">{po.receivedQty}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-amber-600">{po.pendingQty}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          ₹ {Number(po.estimatedPendingValue).toLocaleString()}
                        </TableCell>
                        <TableCell><Badge variant="warning">{po.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: SUPPLIER REJECTION RATE REPORT */}
      {!loading && activeTab === 'supplier-rejection' && reportData && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Supplier Quality Inspection &amp; Material Rejection Analysis
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead className="text-right">Total Deliveries (Inwards)</TableHead>
                    <TableHead className="text-right">Total Received Qty</TableHead>
                    <TableHead className="text-right text-red-600 font-bold">Rejected Qty</TableHead>
                    <TableHead className="text-right text-emerald-600 font-bold">Accepted Qty</TableHead>
                    <TableHead className="text-right font-bold">Rejection Rate (%)</TableHead>
                    <TableHead>Quality Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.suppliers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                        No inward quality records found for suppliers.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.suppliers?.map((sup: any) => {
                      const rate = sup.rejectionRatePercent;
                      return (
                        <TableRow key={sup.partyId}>
                          <TableCell className="font-mono text-xs font-semibold text-blue-600">{sup.partyCode}</TableCell>
                          <TableCell className="font-medium text-slate-800">{sup.partyName}</TableCell>
                          <TableCell className="text-right font-mono">{sup.totalInwards} GRNs</TableCell>
                          <TableCell className="text-right font-mono">{sup.totalReceived}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-red-600">{sup.totalRejected}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">{sup.totalAccepted}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-900">
                            {rate.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            {rate === 0 ? (
                              <Badge variant="success">Excellent (0% Rejection)</Badge>
                            ) : rate <= 5 ? (
                              <Badge variant="info">Acceptable (&le; 5%)</Badge>
                            ) : (
                              <Badge variant="danger">High Rejection (&gt; 5%)</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

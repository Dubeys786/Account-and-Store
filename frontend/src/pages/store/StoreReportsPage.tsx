import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  Clock,
  AlertOctagon,
  DollarSign,
  Package,
  Layers,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { isDamagedCondition } from '../../config/returnRules';

type ReportTab = 'valuation' | 'consumption' | 'pending-pos' | 'supplier-rejection' | 'return-age';

export const StoreReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('valuation');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Return Age Report Filters
  const [returnSearch, setReturnSearch] = useState('');
  const [returnClassificationFilter, setReturnClassificationFilter] = useState('ALL');
  const [returnConditionFilter, setReturnConditionFilter] = useState('ALL');

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

    if (activeTab === 'valuation') {
      const items = reportData.details || reportData.items || [];
      headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Current Stock', 'Valuation Rate (₹)', 'Total Valuation (₹)'];
      rows = items.map((i: any) => [
        i.code,
        `"${i.name}"`,
        i.category,
        i.unit,
        i.currentStock,
        i.estimatedRate || i.valuationRate,
        i.totalValuation,
      ]);
    } else if (activeTab === 'consumption') {
      const consumption = Array.isArray(reportData) ? reportData : reportData.consumption || [];
      headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Total Issued', 'Issue Transactions Count'];
      rows = consumption.map((i: any) => [
        i.itemCode || i.code,
        `"${i.itemName || i.name}"`,
        i.category,
        i.unit,
        i.totalIssued || i.totalConsumedQty,
        i.issueTransactionsCount || i.issueCount,
      ]);
    } else if (activeTab === 'pending-pos') {
      const pendingPOs = Array.isArray(reportData) ? reportData : reportData.pendingPOs || [];
      headers = ['PO Number', 'PO Date', 'Supplier', 'Status', 'Grand Total (₹)'];
      rows = pendingPOs.map((p: any) => [
        p.poNumber,
        new Date(p.poDate).toLocaleDateString(),
        `"${p.party?.name || p.supplier?.name || ''}"`,
        p.status,
        p.grandTotal || p.estimatedPendingValue || 0,
      ]);
    } else if (activeTab === 'supplier-rejection') {
      const suppliers = Array.isArray(reportData) ? reportData : reportData.suppliers || [];
      headers = ['Supplier Code', 'Supplier Name', 'Total Received Qty', 'Total Rejected Qty', 'Total Accepted Qty', 'Rejection Rate %'];
      rows = suppliers.map((s: any) => [
        s.supplierCode || s.partyCode,
        `"${s.supplierName || s.partyName}"`,
        s.totalReceived,
        s.totalRejected,
        s.totalAccepted,
        s.rejectionRatePercent,
      ]);
    } else if (activeTab === 'return-age' && reportData.records) {
      headers = [
        'Return Date',
        'Original Issue Date',
        'Item Code',
        'Item Name',
        'Category',
        'Store Code',
        'Store Name',
        'Issued Qty',
        'Returned Qty',
        'Unit',
        'Days Held',
        'Return Age Classification',
        'Condition',
        'Issued To / Department',
        'Return Reason',
        'Notes',
      ];
      rows = reportData.records.map((r: any) => [
        r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '',
        r.issueDate ? new Date(r.issueDate).toLocaleDateString() : '',
        r.itemCode,
        `"${r.itemName}"`,
        r.category || '',
        r.storeCode || '',
        `"${r.storeName}"`,
        r.issuedQuantity ?? '',
        r.returnedQuantity,
        r.unit,
        r.daysHeld,
        `"${r.classificationLabel}"`,
        `"${r.condition}"`,
        `"${r.issuedTo}"`,
        `"${r.returnReason || ''}"`,
        `"${r.notes || ''}"`,
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

  // Filtered return age records
  const filteredReturnRecords = (reportData?.records || []).filter((r: any) => {
    const term = returnSearch.toLowerCase();
    const matchesSearch =
      !term ||
      r.itemCode?.toLowerCase().includes(term) ||
      r.itemName?.toLowerCase().includes(term) ||
      r.issuedTo?.toLowerCase().includes(term) ||
      r.notes?.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (returnClassificationFilter !== 'ALL' && r.classificationKey !== returnClassificationFilter) {
      return false;
    }

    if (returnConditionFilter !== 'ALL' && r.condition !== returnConditionFilter) {
      return false;
    }

    return true;
  });

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
            Real-time automated valuation, consumption analytics, return age tracking, and supplier QC audits
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => fetchReport(activeTab)}
          >
            Refresh
          </Button>
          <Button size="sm" variant="primary" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 space-x-2 pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
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

        <button
          onClick={() => setActiveTab('return-age')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'return-age'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Return Age Analysis
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Physical Inventory Value
              </span>
              <span className="text-2xl font-bold font-mono text-blue-600 block mt-1">
                ₹ {Number(reportData.summary?.totalStockValuation || reportData.totalValuation || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Active Catalog SKUs
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 block mt-1">
                {reportData.summary?.totalItems || reportData.details?.length || reportData.items?.length || 0} Items
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Item Valuation Details</span>
              <span className="text-xs text-slate-500">
                {(reportData.details || reportData.items || []).length} items
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[650px]">
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
                  {(reportData.details || reportData.items || []).map((item: any) => (
                    <TableRow key={item.id || item.itemId}>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {item.currentStock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono">₹ {item.estimatedRate || item.valuationRate}</TableCell>
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
              <span className="text-xs text-slate-500">
                {(Array.isArray(reportData) ? reportData : reportData.consumption || []).length} items analyzed
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Issued / Consumed</TableHead>
                    <TableHead className="text-right">Issue Frequency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(reportData) ? reportData : reportData.consumption || []).map((item: any, idx: number) => (
                    <TableRow key={item.itemCode || idx}>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{item.itemCode || item.code}</TableCell>
                      <TableCell className="font-medium text-slate-800">{item.itemName || item.name}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600">
                        {item.totalIssued || item.totalConsumedQty} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.issueTransactionsCount || item.issueCount || 1} times
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
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Unfulfilled &amp; Partially Received Purchase Orders
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>PO Date</TableHead>
                    <TableHead>Supplier / Vendor</TableHead>
                    <TableHead className="text-right">Grand Total (₹)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(reportData) ? reportData : reportData.pendingPOs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                        No pending purchase orders! All orders are fully received or closed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (Array.isArray(reportData) ? reportData : reportData.pendingPOs || []).map((po: any) => (
                      <TableRow key={po.id || po.poId}>
                        <TableCell className="font-mono text-xs font-bold text-blue-600">{po.poNumber}</TableCell>
                        <TableCell>{new Date(po.poDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium text-slate-800">{po.party?.name || po.supplier?.name}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          ₹ {Number(po.grandTotal || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning">{po.status}</Badge>
                        </TableCell>
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
              <Table className="min-w-[650px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead className="text-right">Total Received Qty</TableHead>
                    <TableHead className="text-right text-red-600 font-bold">Rejected Qty</TableHead>
                    <TableHead className="text-right text-emerald-600 font-bold">Accepted Qty</TableHead>
                    <TableHead className="text-right font-bold">Rejection Rate (%)</TableHead>
                    <TableHead>Quality Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(reportData) ? reportData : reportData.suppliers || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                        No inward quality records found for suppliers.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (Array.isArray(reportData) ? reportData : reportData.suppliers || []).map((sup: any, idx: number) => {
                      const rate = sup.rejectionRatePercent || 0;
                      return (
                        <TableRow key={sup.supplierCode || idx}>
                          <TableCell className="font-mono text-xs font-semibold text-blue-600">
                            {sup.supplierCode || sup.partyCode}
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{sup.supplierName || sup.partyName}</TableCell>
                          <TableCell className="text-right font-mono">{sup.totalReceived}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-red-600">{sup.totalRejected}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">{sup.totalAccepted}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-900">
                            {Number(rate).toFixed(1)}%
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

      {/* TAB 5: RETURN AGE ANALYSIS REPORT */}
      {!loading && activeTab === 'return-age' && reportData && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>TOTAL RETURNS</span>
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900">
                {reportData.summary?.totalReturns || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                {reportData.summary?.totalReturnedQty || 0} Units Returned
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 mb-1">
                <span>RECENT (0–7d)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700">
                {reportData.summary?.recentCount || 0}
              </div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">
                Returned within 1 week
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 mb-1">
                <span>OLD (8–30d)</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-700">
                {reportData.summary?.oldCount || 0}
              </div>
              <div className="text-[10px] text-amber-600/80 mt-0.5">
                Returned within 1 month
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 mb-1">
                <span>VERY OLD (31+d)</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-700">
                {reportData.summary?.veryOldCount || 0}
              </div>
              <div className="text-[10px] text-rose-600/80 mt-0.5">
                Held longer than 30 days
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-blue-800 mb-1">
                <span>AVG RETURN AGE</span>
                <Clock className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-blue-700">
                {reportData.summary?.avgDaysHeld || 0} <span className="text-xs font-normal">days</span>
              </div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">
                Average days held in field
              </div>
            </div>
          </div>

          {/* Table with search and filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Item, Dept, Notes..."
                      value={returnSearch}
                      onChange={(e) => setReturnSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                      <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={returnClassificationFilter}
                        onChange={(e) => setReturnClassificationFilter(e.target.value)}
                        className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">All Return Ages</option>
                        <option value="RECENT_RETURN">Recent Return (0–7d)</option>
                        <option value="OLD_RETURN">Old Return (8–30d)</option>
                        <option value="VERY_OLD_RETURN">Very Old Return (31+d)</option>
                      </select>
                    </div>

                    <select
                      value={returnConditionFilter}
                      onChange={(e) => setReturnConditionFilter(e.target.value)}
                      className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Conditions</option>
                      <option value="Good">Good (Usable)</option>
                      <option value="Damaged">Damaged (Quarantined)</option>
                      <option value="Partially Damaged">Partially Damaged</option>
                      <option value="Defective">Defective</option>
                    </select>
                  </div>
                </div>

                <span className="text-xs font-semibold text-slate-500 shrink-0 self-end lg:self-auto">
                  {filteredReturnRecords.length} Return Records
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Item Code / Name</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Issued Qty</TableHead>
                    <TableHead className="text-right">Returned Qty</TableHead>
                    <TableHead>Days Held</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Department / Issued To</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturnRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-slate-400">
                        No material returns recorded matching selected criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReturnRecords.map((r: any) => {
                      const isDamaged = isDamagedCondition(r.condition);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {r.issueDate ? new Date(r.issueDate).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs font-bold text-slate-900">{r.itemCode}</div>
                            <div className="text-xs text-slate-600 truncate max-w-[160px]">{r.itemName}</div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{r.storeName}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-500">
                            {r.issuedQuantity !== null ? `${r.issuedQuantity} ${r.unit}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">
                            +{r.returnedQuantity} {r.unit}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-semibold text-slate-900">
                              {r.daysHeld} days
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.classificationKey === 'RECENT_RETURN'
                                  ? 'success'
                                  : r.classificationKey === 'OLD_RETURN'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              {r.classificationLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isDamaged ? 'danger' : 'success'} size="sm">
                              {r.condition}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-[140px] truncate">
                            {r.issuedTo}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[160px] truncate">
                            {r.returnReason ? `${r.returnReason}${r.notes ? ` - ${r.notes}` : ''}` : r.notes || '—'}
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

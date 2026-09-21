import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, AlertTriangle, CheckCircle2, XCircle, Package, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

interface StockRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  minStock: number;
  reorderLevel: number;
  openingStock: number;
  inward: number;
  issue: number;
  return: number;
  currentStock: number;
  isLowStock: boolean;
}

export const StockRegisterPage: React.FC = () => {
  const [stockItems, setStockItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('');
  const [storesList, setStoresList] = useState<any[]>([]);

  // Fetch Stock Register
  const fetchStock = async () => {
    setLoading(true);
    const storeParam = storeFilter ? `?storeId=${storeFilter}` : '';
    const res = await apiRequest(`/store/stock-register${storeParam}`);
    if (res.success && res.data) {
      setStockItems(res.data);
    }
    setLoading(false);
  };

  // Fetch Stores lookup
  const fetchStores = async () => {
    const res = await apiRequest('/store/stores');
    if (res.success && res.data) {
      setStoresList(res.data);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchStock();
  }, [storeFilter]);

  // Extract unique categories
  const categories = Array.from(new Set(stockItems.map((item) => item.category))).filter(Boolean);

  // Filter items
  const filteredItems = stockItems.filter((item) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      item.itemCode.toLowerCase().includes(term) ||
      item.itemName.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;

    let matchesStatus = true;
    if (statusFilter === 'LOW') {
      matchesStatus = item.currentStock > 0 && item.currentStock <= item.reorderLevel;
    } else if (statusFilter === 'OUT') {
      matchesStatus = item.currentStock <= 0;
    } else if (statusFilter === 'NORMAL') {
      matchesStatus = item.currentStock > item.reorderLevel;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPI calculations
  const totalItems = stockItems.length;
  const lowStockCount = stockItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length;
  const outOfStockCount = stockItems.filter((i) => i.currentStock <= 0).length;
  const normalStockCount = stockItems.filter((i) => i.currentStock > i.reorderLevel).length;

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Item Code',
      'Item Name',
      'Category',
      'Unit',
      'Opening Stock',
      'Inward (+)',
      'Issue (-)',
      'Return (+)',
      'Current Stock (=)',
      'Reorder Level',
      'Stock Status',
    ];

    const rows = filteredItems.map((item) => [
      item.itemCode,
      `"${item.itemName}"`,
      item.category,
      item.unit,
      item.openingStock,
      item.inward,
      item.issue,
      item.return,
      item.currentStock,
      item.reorderLevel,
      item.currentStock <= 0
        ? 'Out of Stock'
        : item.currentStock <= item.reorderLevel
        ? 'Reorder Needed'
        : 'Normal',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Register_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="text-blue-600">STOCK REGISTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical inventory valuation, opening balance, receipts, dispatches, returns, and live current stock
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Total Catalog</span>
            <span className="text-xl font-bold text-slate-900">{totalItems} Items</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Healthy Stock</span>
            <span className="text-xl font-bold text-emerald-700">{normalStockCount} Items</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Reorder Needed</span>
            <span className="text-xl font-bold text-amber-700">{lowStockCount} Items</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Out of Stock</span>
            <span className="text-xl font-bold text-red-700">{outOfStockCount} Items</span>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Item Code or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Inventory Status</option>
                  <option value="NORMAL">Normal Stock</option>
                  <option value="LOW">Reorder Level Reached</option>
                  <option value="OUT">Out of Stock</option>
                </select>

                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Warehouses / Stores</option>
                  {storesList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0 self-end sm:self-auto">{filteredItems.length} Records</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right text-emerald-700 bg-emerald-50/30">Inward (+)</TableHead>
                <TableHead className="text-right text-rose-700 bg-rose-50/30">Issue (-)</TableHead>
                <TableHead className="text-right text-blue-700 bg-blue-50/30">Return (+)</TableHead>
                <TableHead className="text-right font-bold">Current Stock (=)</TableHead>
                <TableHead className="text-right">Reorder Lvl</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2" />
                    Calculating transaction balances from stock register...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    No items found matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {item.itemCode}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{item.itemName}</div>
                      <div className="text-[10px] text-slate-400">Unit: {item.unit}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-600">
                      {item.openingStock}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 bg-emerald-50/20 font-medium">
                      +{item.inward}
                    </TableCell>
                    <TableCell className="text-right font-mono text-rose-700 bg-rose-50/20 font-medium">
                      -{item.issue}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-700 bg-blue-50/20 font-medium">
                      +{item.return}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-sm text-slate-900">
                      {item.currentStock} {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-500">
                      {item.reorderLevel}
                    </TableCell>
                    <TableCell>
                      {item.currentStock <= 0 ? (
                        <Badge variant="danger">Out of Stock</Badge>
                      ) : item.currentStock <= item.reorderLevel ? (
                        <Badge variant="warning">Reorder Reached</Badge>
                      ) : (
                        <Badge variant="success">Normal Stock</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

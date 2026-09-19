import React, { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const StockRegisterPage: React.FC = () => {
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStock() {
      const res = await apiRequest('/store/stock-register');
      if (res.success && res.data) setStockItems(res.data);
      setLoading(false);
    }
    fetchStock();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>INVENTORY</span>
            <span>/</span>
            <span className="text-blue-600">STOCK REGISTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical inventory valuation, opening stock, inward receipts, issues, and closing balances
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Item Code or Description..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{stockItems.length} Stock Ledger Items</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Current Physical Stock</TableHead>
                <TableHead>Inventory Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Calculating stock balances from database...
                  </TableCell>
                </TableRow>
              ) : stockItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No items found in stock register.
                  </TableCell>
                </TableRow>
              ) : (
                stockItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{item.code}</TableCell>
                    <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                    <TableCell><Badge variant="neutral">{item.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{item.unit}</TableCell>
                    <TableCell className="text-slate-500">{item.reorderLevel} {item.unit}</TableCell>
                    <TableCell className="font-bold text-slate-900 text-sm">{item.currentStock} {item.unit}</TableCell>
                    <TableCell>
                      {item.currentStock <= item.reorderLevel ? (
                        <Badge variant="warning">Reorder Level Reached</Badge>
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

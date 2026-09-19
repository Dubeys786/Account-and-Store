import React, { useEffect, useState } from 'react';
import { Package, Plus, Search, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const ItemMasterPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      const res = await apiRequest('/store/items');
      if (res.success && res.data) {
        setItems(res.data);
      }
      setLoading(false);
    }
    fetchItems();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>MASTER DATA</span>
            <span>/</span>
            <span className="text-blue-600">ITEM MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Item Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage central product catalog, units of measurement, and stock threshold levels
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Filter className="w-3.5 h-3.5" />}>
            Filter
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Add New Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5 w-full sm:w-80">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search items by code, name, category..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{items.length} Items Listed</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Min / Max Stock</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Loading items catalog from PostgreSQL...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{item.code}</TableCell>
                    <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                    <TableCell className="text-slate-600">{item.brand || '—'}</TableCell>
                    <TableCell><Badge variant="neutral">{item.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{item.unit}</TableCell>
                    <TableCell className="text-xs text-slate-500">{item.minStock} / {item.maxStock}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{item.currentStock} {item.unit}</TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'success' : 'error'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
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

import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const POMasterPage: React.FC = () => {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPOs() {
      const res = await apiRequest('/store/purchase-orders');
      if (res.success && res.data) setPos(res.data);
      setLoading(false);
    }
    fetchPOs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>MASTER DATA</span>
            <span>/</span>
            <span className="text-blue-600">PO MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and track supplier procurement purchase orders and line-item delivery schedules
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Filter className="w-3.5 h-3.5" />}>
            Filter Status
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Create Purchase Order
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PO Number or Supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{pos.length} Orders</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>PO Date</TableHead>
                <TableHead>Supplier / Party</TableHead>
                <TableHead>Store Destination</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading purchase orders from database...
                  </TableCell>
                </TableRow>
              ) : pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No purchase orders recorded yet. Click &apos;Create Purchase Order&apos; to begin.
                  </TableCell>
                </TableRow>
              ) : (
                pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{po.poNumber}</TableCell>
                    <TableCell>{new Date(po.poDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{po.party?.name || '—'}</TableCell>
                    <TableCell>{po.store?.name || '—'}</TableCell>
                    <TableCell className="font-mono font-semibold">₹ {po.totalAmount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="info">{po.status}</Badge></TableCell>
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

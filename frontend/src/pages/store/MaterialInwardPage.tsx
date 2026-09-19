import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const MaterialInwardPage: React.FC = () => {
  const [inwards, setInwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInwards() {
      const res = await apiRequest('/store/material-inwards');
      if (res.success && res.data) setInwards(res.data);
      setLoading(false);
    }
    fetchInwards();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>TRANSACTIONS</span>
            <span>/</span>
            <span className="text-blue-600">MATERIAL INWARD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Inward</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record physical material receipt, quality inspection, and warehouse bin allocation against POs
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Filter className="w-3.5 h-3.5" />}>
            Filter
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            New Material Inward
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Inward #, PO #, Challan..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{inwards.length} Inwards</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inward Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>PO Reference</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Challan / Ref</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading material inward records from database...
                  </TableCell>
                </TableRow>
              ) : inwards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No material inwards recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                inwards.map((inw) => (
                  <TableRow key={inw.id}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{inw.inwardNumber}</TableCell>
                    <TableCell>{new Date(inw.inwardDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{inw.purchaseOrder?.poNumber || 'Direct'}</TableCell>
                    <TableCell className="font-medium">{inw.party?.name}</TableCell>
                    <TableCell className="text-slate-500">{inw.referenceNumber || '—'}</TableCell>
                    <TableCell><Badge variant="success">Completed</Badge></TableCell>
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

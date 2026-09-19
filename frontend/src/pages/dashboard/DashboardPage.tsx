import React, { useState, useEffect } from 'react';
import {
  Package,
  FileText,
  ArrowDownToLine,
  Layers,
  AlertTriangle,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { StatsCard } from '../../components/common/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { activeStore } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      const res = await apiRequest('/store/dashboard-metrics');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadMetrics();
  }, [user, activeStore]);

  const cards = data?.kpiCards || {};
  const recentPOs = data?.recentPOs || [];
  const recentInwards = data?.recentInwards || [];
  const recentTransactions = data?.recentTransactions || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Store & Inventory Operations Hub for{' '}
            <span className="font-semibold text-slate-700">{activeStore?.name || 'All Stores'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/store/items">
            <Button size="sm" variant="outline" icon={<Package className="w-3.5 h-3.5" />}>
              Item Master
            </Button>
          </Link>
          <Link to="/store/purchase-orders">
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
              Create PO
            </Button>
          </Link>
          <Link to="/store/material-inwards">
            <Button size="sm" variant="secondary" icon={<ArrowDownToLine className="w-3.5 h-3.5" />}>
              Receive Inward
            </Button>
          </Link>
        </div>
      </div>

      {/* 6 Required Screenshot-Style Dashboard KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="Total Items"
          value={cards.totalItems ?? 0}
          subtitle="Catalog master"
          icon={<Package className="w-5 h-5 text-blue-600" />}
          iconBgColor="bg-blue-50"
        />
        <StatsCard
          title="Purchase Orders"
          value={cards.purchaseOrders ?? 0}
          subtitle="Active / In-flight"
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
          iconBgColor="bg-indigo-50"
        />
        <StatsCard
          title="Material Inwards"
          value={cards.materialInwards ?? 0}
          subtitle="Physical receipts"
          icon={<ArrowDownToLine className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
        />
        <StatsCard
          title="Available Stock"
          value={`${cards.totalAvailableStock ?? 0} U`}
          subtitle="Current physical units"
          icon={<Layers className="w-5 h-5 text-cyan-600" />}
          iconBgColor="bg-cyan-50"
        />
        <StatsCard
          title="Outstanding Bal"
          value={`₹ ${cards.outstandingBalance ? cards.outstandingBalance.toLocaleString() : '0'}`}
          subtitle="Trade payables"
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
          iconBgColor="bg-amber-50"
        />
        <StatsCard
          title="Low / Out of Stock"
          value={cards.lowStockCount ?? 0}
          subtitle="Below reorder level"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          iconBgColor="bg-rose-50"
          trend={
            cards.lowStockCount > 0
              ? { value: `${cards.lowStockCount} items`, isPositive: false, label: 'need reorder' }
              : { value: 'Optimal', isPositive: true, label: 'all stock fine' }
          }
        />
      </div>

      {/* Live Recent Feeds Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">Recent Purchase Orders</CardTitle>
            </div>
            <Link to="/store/purchase-orders" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-slate-400">
                      No purchase orders recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPOs.map((po: any) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{po.poNumber}</TableCell>
                      <TableCell className="font-medium text-slate-800 truncate max-w-[150px]">{po.party?.name}</TableCell>
                      <TableCell className="font-mono font-semibold">₹ {po.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            po.status === 'RECEIVED'
                              ? 'success'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'warning'
                              : po.status === 'APPROVED'
                              ? 'blue'
                              : 'neutral'
                          }
                        >
                          {po.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Material Inwards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-sm">Recent Material Inwards</CardTitle>
            </div>
            <Link to="/store/material-inwards" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inward #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>PO Ref</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInwards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-slate-400">
                      No material inwards recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentInwards.map((inw: any) => (
                    <TableRow key={inw.id}>
                      <TableCell className="font-mono text-xs font-bold text-emerald-600">{inw.inwardNumber}</TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(inw.inwardDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-xs">{inw.purchaseOrder?.poNumber || '—'}</TableCell>
                      <TableCell className="font-medium text-slate-800 truncate max-w-[150px]">{inw.party?.name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Stock Transactions Audit Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm">Latest Stock Transactions</CardTitle>
          </div>
          <Link to="/store/issue-return" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Issue / Return Hub <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Reference / Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                    No stock transactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tx.transactionType === 'INWARD'
                            ? 'success'
                            : tx.transactionType === 'ISSUE'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {tx.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {tx.item?.name} ({tx.item?.code})
                    </TableCell>
                    <TableCell className="font-bold">
                      {tx.transactionType === 'ISSUE' ? `-${tx.quantity}` : `+${tx.quantity}`} {tx.item?.unit}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-slate-900">{tx.balanceAfter} {tx.item?.unit}</TableCell>
                    <TableCell className="text-xs text-slate-600">{tx.notes || tx.referenceType}</TableCell>
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

import React, { useState, useEffect } from 'react';
import {
  Package,
  FileText,
  ArrowDownToLine,
  Layers,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowRight,
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
  const [storeMetrics, setStoreMetrics] = useState<any>(null);
  const [accountsMetrics, setAccountsMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      if (user?.role === 'ADMIN' || user?.role === 'STORE_USER') {
        const storeRes = await apiRequest('/store/dashboard-metrics');
        if (storeRes.success) setStoreMetrics(storeRes.data);
      }

      if (user?.role === 'ADMIN' || user?.role === 'ACCOUNT_USER') {
        const accRes = await apiRequest('/accounts/dashboard-metrics');
        if (accRes.success) setAccountsMetrics(accRes.data);
      }
      setLoading(false);
    }
    loadMetrics();
  }, [user, activeStore]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Store & Financial Operations Overview for{' '}
            <span className="font-semibold text-slate-700">{activeStore?.name || 'All Stores'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {(user?.role === 'ADMIN' || user?.role === 'STORE_USER') && (
            <Link to="/store/items">
              <Button size="sm" variant="outline" icon={<Package className="w-3.5 h-3.5" />}>
                Item Master
              </Button>
            </Link>
          )}
          {(user?.role === 'ADMIN' || user?.role === 'ACCOUNT_USER') && (
            <Link to="/accounts/purchases">
              <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
                New Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Total Items"
          value={storeMetrics?.totalItems ?? 3}
          subtitle="Registered catalog items"
          icon={<Package className="w-5 h-5 text-blue-600" />}
          iconBgColor="bg-blue-50"
          trend={{ value: '+12%', isPositive: true }}
        />
        <StatsCard
          title="Purchase Orders"
          value={storeMetrics?.totalPOs ?? 0}
          subtitle="Active procurement orders"
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
          iconBgColor="bg-indigo-50"
          trend={{ value: 'Active', isPositive: true, label: 'in pipeline' }}
        />
        <StatsCard
          title="Available Stock"
          value={`${storeMetrics?.availableStockUnits ?? 515} Units`}
          subtitle="Across inventory master"
          icon={<Layers className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
          trend={{ value: 'Healthy', isPositive: true, label: 'stock levels' }}
        />
        <StatsCard
          title="Outstanding Payables"
          value="₹ 2,85,000"
          subtitle="Vendor credit balance"
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
          iconBgColor="bg-amber-50"
          trend={{ value: '3 Due', isPositive: false, label: 'this week' }}
        />
      </div>

      {/* Dual Business Areas Highlight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store & Inventory Domain Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
              <CardTitle>Store & Inventory Domain</CardTitle>
            </div>
            <Link to="/store/stock-register" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Stock Register <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Real-time inventory levels, PO requisition workflows, and material inward quality verification.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">ITM-001</TableCell>
                  <TableCell className="font-medium">Heavy Duty Steel Beam</TableCell>
                  <TableCell>RAW_MATERIALS</TableCell>
                  <TableCell className="font-semibold">120 PCS</TableCell>
                  <TableCell><Badge variant="success">In Stock</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">ITM-002</TableCell>
                  <TableCell className="font-medium">Ball Bearing 6205-2RS</TableCell>
                  <TableCell>HARDWARE</TableCell>
                  <TableCell className="font-semibold">350 PCS</TableCell>
                  <TableCell><Badge variant="success">In Stock</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">ITM-003</TableCell>
                  <TableCell className="font-medium">Synthetic Gear Oil ISO 220</TableCell>
                  <TableCell>CONSUMABLES</TableCell>
                  <TableCell className="font-semibold">45 LTR</TableCell>
                  <TableCell><Badge variant="warning">Reorder Soon</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Accounts & Finance Domain Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
              <CardTitle>Accounts & Finance Domain</CardTitle>
            </div>
            <Link to="/accounts/purchases" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              Purchases <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Double-entry bookkeeping supporting both <span className="font-semibold text-slate-700">WITH PO</span> and <span className="font-semibold text-slate-700">WITHOUT PO</span> direct workflows.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account / Ledger</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>System</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Cash in Hand (1010)</TableCell>
                  <TableCell><Badge variant="blue">ASSET</Badge></TableCell>
                  <TableCell>Debit</TableCell>
                  <TableCell className="font-mono font-semibold">₹ 54,200</TableCell>
                  <TableCell><Badge variant="neutral">System</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">HDFC Bank A/c (1020)</TableCell>
                  <TableCell><Badge variant="blue">ASSET</Badge></TableCell>
                  <TableCell>Debit</TableCell>
                  <TableCell className="font-mono font-semibold">₹ 11,90,800</TableCell>
                  <TableCell><Badge variant="neutral">System</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Accounts Payable (2010)</TableCell>
                  <TableCell><Badge variant="warning">LIABILITY</Badge></TableCell>
                  <TableCell>Credit</TableCell>
                  <TableCell className="font-mono font-semibold">₹ 2,85,000</TableCell>
                  <TableCell><Badge variant="neutral">System</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

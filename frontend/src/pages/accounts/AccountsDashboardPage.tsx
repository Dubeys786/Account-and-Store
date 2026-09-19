import React, { useEffect, useState } from 'react';
import { CreditCard, ArrowDownRight, ArrowUpRight, Building, Plus, Users, Receipt } from 'lucide-react';
import { StatsCard } from '../../components/common/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

export const AccountsDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    async function fetchMetrics() {
      const res = await apiRequest('/accounts/dashboard-metrics');
      if (res.success) setMetrics(res.data);
    }
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">DASHBOARD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts & Finance Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            General ledger balances, receivables, payables, cash-flow liquidity, and tax compliance overview
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/accounts/payments">
            <Button size="sm" variant="outline" icon={<CreditCard className="w-3.5 h-3.5" />}>
              Record Payment
            </Button>
          </Link>
          <Link to="/accounts/receipts">
            <Button size="sm" variant="outline" icon={<Receipt className="w-3.5 h-3.5" />}>
              Record Receipt
            </Button>
          </Link>
          <Link to="/accounts/purchases">
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
              New Purchase Bill
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Total Receivables"
          value="₹ 4,50,000"
          subtitle="Customer trade dues"
          icon={<ArrowDownRight className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
          trend={{ value: '₹ 1.2L Due', isPositive: true, label: 'within 7 days' }}
        />
        <StatsCard
          title="Total Payables"
          value="₹ 2,85,000"
          subtitle="Supplier purchase dues"
          icon={<ArrowUpRight className="w-5 h-5 text-rose-600" />}
          iconBgColor="bg-rose-50"
          trend={{ value: '3 Invoices', isPositive: false, label: 'due this week' }}
        />
        <StatsCard
          title="Liquid Cash & Bank"
          value="₹ 12,45,000"
          subtitle="HDFC Current + Cash in Hand"
          icon={<Building className="w-5 h-5 text-blue-600" />}
          iconBgColor="bg-blue-50"
          trend={{ value: 'Adequate', isPositive: true, label: 'operational liquidity' }}
        />
        <StatsCard
          title="Registered Parties"
          value={metrics?.partyCount ?? 3}
          subtitle="Suppliers & Customers"
          icon={<Users className="w-5 h-5 text-purple-600" />}
          iconBgColor="bg-purple-50"
          trend={{ value: 'GST Active', isPositive: true, label: 'verified entities' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Quick Summary</CardTitle>
            <span className="text-xs font-semibold text-slate-500">Current Financial Year (2026-2027)</span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center py-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase">Cash Inflows</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">₹ 8,40,000</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Collections & Receipts</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase">Cash Outflows</p>
                <p className="text-lg font-bold text-rose-600 mt-1">₹ 5,95,000</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Vendor Payments & Ops</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase">Net Surplus</p>
                <p className="text-lg font-bold text-blue-600 mt-1">+ ₹ 2,45,000</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Net Positive Flow</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounting Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/accounts/purchases" className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors">
              <p className="text-xs font-bold text-slate-800">Purchase Accounts</p>
              <p className="text-[11px] text-slate-500">Enter With PO & Without PO Bills</p>
            </Link>
            <Link to="/accounts/day-book" className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors">
              <p className="text-xs font-bold text-slate-800">Day Book Register</p>
              <p className="text-[11px] text-slate-500">View chronological journal entries</p>
            </Link>
            <Link to="/accounts/ledger" className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors">
              <p className="text-xs font-bold text-slate-800">Party Ledger</p>
              <p className="text-[11px] text-slate-500">Inspect individual party accounts</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Users,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
  DollarSign,
  Scale,
  RefreshCw,
  Clock,
  ArrowRight,
  BarChart3,
  PieChart,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { StatsCard } from '../../components/common/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface DashboardMetrics {
  totalPayables: number;
  totalReceivables: number;
  todayPayments: number;
  todayReceipts: number;
  todayPurchases: number;
  todaySales: number;
  totalExpenses: number;
  totalIncome: number;
  outstandingAmount: number;
  activeParties: number;
  partyCount: number;
  accountCount?: number;
  poCount?: number;
  recentTransactions?: Array<{
    id: string;
    invoiceNumber: string;
    transactionType: string;
    invoiceDate: string;
    grossAmount: number;
    taxAmount: number;
    netAmount: number;
    paidAmount: number;
    paymentStatus: string;
    party?: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
    store?: {
      id: string;
      code: string;
      name: string;
    };
    purchaseOrder?: {
      id: string;
      poNumber: string;
    };
  }>;
}

interface MonthlyDataPoint {
  monthKey: string;
  label: string;
  purchases: number;
  payments: number;
  receipts: number;
  expenses: number;
  income: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
}

interface DashboardAnalytics {
  monthlySeries: MonthlyDataPoint[];
  totals: {
    purchases: number;
    payments: number;
    receipts: number;
    payables: number;
    receivables: number;
    expenses: number;
    income: number;
  };
  expenseBreakdown: CategoryBreakdown[];
  incomeBreakdown: CategoryBreakdown[];
}

export const AccountsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'OPERATIONS' | 'CASH_FLOW'>('OPERATIONS');

  const fetchDashboardData = async () => {
    setLoading(true);
    const [metricsRes, analyticsRes] = await Promise.all([
      apiRequest<DashboardMetrics>('/accounts/dashboard-metrics'),
      apiRequest<DashboardAnalytics>('/accounts/dashboard-analytics'),
    ]);

    if (metricsRes.success && metricsRes.data) {
      setMetrics(metricsRes.data);
    }
    if (analyticsRes.success && analyticsRes.data) {
      setAnalytics(analyticsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '₹ 0.00';
    return `₹ ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'PURCHASE_WITH_PO':
      case 'PURCHASE_WITHOUT_PO':
        return <Badge variant="info">Purchase</Badge>;
      case 'SALE':
      case 'SALES':
        return <Badge variant="success">Sales</Badge>;
      case 'PAYMENT':
        return <Badge variant="error">Payment</Badge>;
      case 'RECEIPT':
        return <Badge variant="success">Receipt</Badge>;
      case 'EXPENSE':
        return <Badge variant="warning">Expense</Badge>;
      case 'INCOME':
        return <Badge variant="blue">Income</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning">Partial</Badge>;
      case 'UNPAID':
        return <Badge variant="error">Unpaid</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Compute maximum value for bar heights
  const maxMonthlyVal = Math.max(
    ...(analytics?.monthlySeries.map((m) =>
      Math.max(m.purchases, m.payments, m.receipts, m.expenses, m.income)
    ) || [10000]),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {user?.jobTitle || 'Account & Store Incharge'}
            </span>
            {user?.name && <span className="text-xs font-medium text-slate-500">• {user.name}</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts & Finance Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial positions, trade liabilities, cash flows, and operating ledger metrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchDashboardData}
          >
            Refresh
          </Button>
          <Link to="/accounts/purchases">
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
              New Purchase
            </Button>
          </Link>
          <Link to="/accounts/reports">
            <Button size="sm" variant="outline" icon={<BarChart3 className="w-3.5 h-3.5 text-blue-600" />}>
              Full Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* 10 Required KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Key Financial Indicators
          </span>
          <span className="text-[11px] text-slate-400">All figures derived live from database</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Total Payables */}
          <StatsCard
            title="Total Payables"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalPayables)}
            subtitle="Supplier liabilities pending"
            icon={<ArrowDownRight className="w-5 h-5 text-rose-600" />}
            iconBgColor="bg-rose-50"
            trend={{ value: 'Accounts Payable', isPositive: false, label: 'creditors' }}
          />

          {/* 2. Total Receivables */}
          <StatsCard
            title="Total Receivables"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalReceivables)}
            subtitle="Customer trade debtors"
            icon={<ArrowUpRight className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            trend={{ value: 'Accounts Receivable', isPositive: true, label: 'debtors' }}
          />

          {/* 3. Today's Payments */}
          <StatsCard
            title="Today's Payments"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayPayments)}
            subtitle="Disbursed today"
            icon={<CreditCard className="w-5 h-5 text-indigo-600" />}
            iconBgColor="bg-indigo-50"
            trend={{ value: 'Cash & Bank', isPositive: false, label: 'outflows' }}
          />

          {/* 4. Today's Receipts */}
          <StatsCard
            title="Today's Receipts"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayReceipts)}
            subtitle="Collected today"
            icon={<Receipt className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            trend={{ value: 'Collections', isPositive: true, label: 'inflows' }}
          />

          {/* 5. Today's Purchases */}
          <StatsCard
            title="Today's Purchases"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayPurchases)}
            subtitle="Billed today"
            icon={<ShoppingBag className="w-5 h-5 text-amber-600" />}
            iconBgColor="bg-amber-50"
            trend={{ value: 'Inward Bills', isPositive: false, label: 'procurement' }}
          />

          {/* 6. Today's Sales */}
          <StatsCard
            title="Today's Sales"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todaySales)}
            subtitle="Invoiced today"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
            trend={{ value: 'Direct Invoices', isPositive: true, label: 'sales' }}
          />

          {/* 7. Total Expenses */}
          <StatsCard
            title="Total Expenses"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalExpenses)}
            subtitle="Operating expenditures"
            icon={<Wallet className="w-5 h-5 text-rose-600" />}
            iconBgColor="bg-rose-50"
            trend={{ value: 'Rent, Payroll, Utilities', isPositive: false, label: 'disbursements' }}
          />

          {/* 8. Total Income */}
          <StatsCard
            title="Total Income"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalIncome)}
            subtitle="Direct & auxiliary revenue"
            icon={<DollarSign className="w-5 h-5 text-teal-600" />}
            iconBgColor="bg-teal-50"
            trend={{ value: 'Sales & Scrap', isPositive: true, label: 'revenue' }}
          />

          {/* 9. Outstanding Amount */}
          <StatsCard
            title="Outstanding Amount"
            value={loading ? 'Loading...' : formatCurrency(metrics?.outstandingAmount)}
            subtitle="Net trade outstanding"
            icon={<Scale className="w-5 h-5 text-purple-600" />}
            iconBgColor="bg-purple-50"
            trend={{ value: 'Payables vs Receivables', isPositive: true, label: 'net balance' }}
          />

          {/* 10. Active Parties */}
          <StatsCard
            title="Active Parties"
            value={loading ? 'Loading...' : `${metrics?.activeParties ?? 0} Parties`}
            subtitle={`of ${metrics?.partyCount ?? 0} registered total`}
            icon={<Users className="w-5 h-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
            trend={{ value: 'Verified GST', isPositive: true, label: 'active entities' }}
          />
        </div>
      </div>

      {/* 7 INTERACTIVE CHARTS: Purchases, Payments, Receipts, Payables, Receivables, Expenses, Income */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Financial Performance Charts (Live Database Data)
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveChartTab('OPERATIONS')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all whitespace-nowrap ${activeChartTab === 'OPERATIONS' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Purchases vs Expenses vs Income
            </button>
            <button
              onClick={() => setActiveChartTab('CASH_FLOW')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all whitespace-nowrap ${activeChartTab === 'CASH_FLOW' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Cash Inflows vs Outflows
            </button>
          </div>
        </div>

        {/* Chart Grid: Main Monthly Bar Chart + Side Distribution Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 6-Month Timeseries Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">
                  {activeChartTab === 'OPERATIONS' ? 'Monthly Operational Volume (Past 6 Months)' : 'Cash Inflows vs Payments (Past 6 Months)'}
                </CardTitle>
                <p className="text-[11px] text-slate-400">
                  {activeChartTab === 'OPERATIONS' ? 'Direct database aggregations of Purchases, Operating Expenses, and Income' : 'Direct database aggregations of Receipts collected vs Payments disbursed'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-semibold">
                {activeChartTab === 'OPERATIONS' ? (
                  <>
                    <span className="flex items-center gap-1 text-blue-600">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" /> Purchases
                    </span>
                    <span className="flex items-center gap-1 text-rose-600">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" /> Expenses
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" /> Income
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" /> Receipts
                    </span>
                    <span className="flex items-center gap-1 text-rose-600">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" /> Payments
                    </span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {!analytics?.monthlySeries.some((m) => m.purchases > 0 || m.expenses > 0 || m.income > 0 || m.receipts > 0 || m.payments > 0) ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No financial data available yet</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    Book purchase vouchers, expenses, or payments to generate live monthly cash flow trends.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0">
                  <div className="h-64 min-w-[360px] flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-2 px-2">
                  {analytics?.monthlySeries.map((month) => {
                    const pHeight = month.purchases > 0 ? Math.max(4, Math.round((month.purchases / maxMonthlyVal) * 200)) : 0;
                    const eHeight = month.expenses > 0 ? Math.max(4, Math.round((month.expenses / maxMonthlyVal) * 200)) : 0;
                    const iHeight = month.income > 0 ? Math.max(4, Math.round((month.income / maxMonthlyVal) * 200)) : 0;
                    const rHeight = month.receipts > 0 ? Math.max(4, Math.round((month.receipts / maxMonthlyVal) * 200)) : 0;
                    const payHeight = month.payments > 0 ? Math.max(4, Math.round((month.payments / maxMonthlyVal) * 200)) : 0;

                    return (
                      <div key={month.monthKey} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg pointer-events-none z-20 whitespace-nowrap">
                          <p className="font-bold">{month.label}</p>
                          {activeChartTab === 'OPERATIONS' ? (
                            <>
                              <p className="text-blue-300">Purchases: ₹ {month.purchases.toLocaleString()}</p>
                              <p className="text-rose-300">Expenses: ₹ {month.expenses.toLocaleString()}</p>
                              <p className="text-emerald-300">Income: ₹ {month.income.toLocaleString()}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-emerald-300">Receipts: ₹ {month.receipts.toLocaleString()}</p>
                              <p className="text-rose-300">Payments: ₹ {month.payments.toLocaleString()}</p>
                            </>
                          )}
                        </div>

                        {/* Bar Group */}
                        <div className="w-full flex items-end justify-center gap-1.5 h-48 border-b border-slate-100">
                          {activeChartTab === 'OPERATIONS' ? (
                            <>
                              <div
                                style={{ height: `${pHeight}px` }}
                                className="w-3 sm:w-4 bg-blue-500 hover:bg-blue-600 rounded-t-sm transition-all"
                                title={`Purchases: ₹ ${month.purchases}`}
                              />
                              <div
                                style={{ height: `${eHeight}px` }}
                                className="w-3 sm:w-4 bg-rose-500 hover:bg-rose-600 rounded-t-sm transition-all"
                                title={`Expenses: ₹ ${month.expenses}`}
                              />
                              <div
                                style={{ height: `${iHeight}px` }}
                                className="w-3 sm:w-4 bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all"
                                title={`Income: ₹ ${month.income}`}
                              />
                            </>
                          ) : (
                            <>
                              <div
                                style={{ height: `${rHeight}px` }}
                                className="w-4 sm:w-6 bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all"
                                title={`Receipts: ₹ ${month.receipts}`}
                              />
                              <div
                                style={{ height: `${payHeight}px` }}
                                className="w-4 sm:w-6 bg-rose-500 hover:bg-rose-600 rounded-t-sm transition-all"
                                title={`Payments: ₹ ${month.payments}`}
                              />
                            </>
                          )}
                        </div>

                        {/* Month Label */}
                        <span className="text-[11px] font-semibold text-slate-600">{month.label}</span>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trade Exposure & Outstanding Comparison (Payables vs Receivables) */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm">Trade Exposure & Net Balance</CardTitle>
              <p className="text-[10px] text-slate-400">Total Outstanding Payables vs Receivables</p>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {(Number(analytics?.totals.payables || metrics?.totalPayables || 0) === 0 &&
                Number(analytics?.totals.receivables || metrics?.totalReceivables || 0) === 0) ? (
                <div className="py-10 flex flex-col items-center justify-center text-center text-slate-400">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                    <Scale className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No outstanding trade liabilities</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Both trade payables and customer receivables are ₹ 0.00.
                  </p>
                </div>
              ) : (
                <>
                  {/* Payables Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Outstanding Payables
                      </span>
                      <span className="font-mono font-bold text-rose-600">
                        ₹ {Number(analytics?.totals.payables || metrics?.totalPayables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(10, Math.round(((analytics?.totals.payables || 1) / ((analytics?.totals.payables || 0) + (analytics?.totals.receivables || 1))) * 100)))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Receivables Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Outstanding Receivables
                      </span>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹ {Number(analytics?.totals.receivables || metrics?.totalReceivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(10, Math.round(((analytics?.totals.receivables || 1) / ((analytics?.totals.payables || 1) + (analytics?.totals.receivables || 0))) * 100)))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Net Working Capital Card */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Net Trade Position</span>
                    <p className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                      ₹ {Math.abs((analytics?.totals.receivables || 0) - (analytics?.totals.payables || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-slate-500 ml-1.5">
                        {(analytics?.totals.receivables || 0) >= (analytics?.totals.payables || 0) ? '(Net Asset / Receivable)' : '(Net Liability / Payable)'}
                      </span>
                    </p>
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <Link to="/accounts/payables" className="text-rose-600 font-semibold hover:underline">
                  View Payables →
                </Link>
                <Link to="/accounts/receivables" className="text-emerald-600 font-semibold hover:underline">
                  View Receivables →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown Charts: Expenses vs Income */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Expenses by Category */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Operating Expenses Breakdown</CardTitle>
                <p className="text-[10px] text-slate-400">Categorical distribution across facilities, rent, utilities, and payroll</p>
              </div>
              <Link to="/accounts/expenses" className="text-[11px] font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {!analytics?.expenseBreakdown || analytics.expenseBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No operating expenses categorized in database yet.
                </div>
              ) : (
                analytics.expenseBreakdown.map((item) => {
                  const total = analytics.totals.expenses || 1;
                  const pct = Math.min(100, Math.round((item.amount / total) * 100));

                  return (
                    <div key={item.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-rose-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Income by Category */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Income & Revenue Distribution</CardTitle>
                <p className="text-[10px] text-slate-400">Revenue generation by sales, scrap, services, and auxiliary streams</p>
              </div>
              <Link to="/accounts/income" className="text-[11px] font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {!analytics?.incomeBreakdown || analytics.incomeBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No income receipts recorded in database yet.
                </div>
              ) : (
                analytics.incomeBreakdown.map((item) => {
                  const total = analytics.totals.income || 1;
                  const pct = Math.min(100, Math.round((item.amount / total) * 100));

                  return (
                    <div key={item.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            + ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <CardTitle>Recent Transactions</CardTitle>
            </div>
            <Link
              to="/accounts/ledger"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View Full Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Invoice / Voucher #</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                  <TableHead className="text-center">Payment Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading live transactions from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !metrics?.recentTransactions || metrics.recentTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                      No recent transactions found. Create a purchase or invoice to populate.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.recentTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                        {new Date(tx.invoiceDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{getTransactionBadge(tx.transactionType)}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {tx.invoiceNumber}
                        {tx.purchaseOrder && (
                          <div className="text-[10px] text-blue-600 font-normal">
                            PO: {tx.purchaseOrder.poNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                          {tx.party?.name || '—'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {tx.party?.code} • {tx.party?.type}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {tx.store?.name || 'Main Store'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 text-right whitespace-nowrap">
                        {formatCurrency(tx.netAmount)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {getPaymentStatusBadge(tx.paymentStatus)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {tx.party?.id ? (
                          <Link
                            to={`/accounts/ledger?partyId=${tx.party.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View Ledger
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
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

export default AccountsDashboardPage;

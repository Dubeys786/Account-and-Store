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
} from 'lucide-react';
import { StatsCard } from '../../components/common/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';
import { Link } from 'react-router-dom';

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

export const AccountsDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    const res = await apiRequest<DashboardMetrics>('/accounts/dashboard-metrics');
    if (res.success && res.data) {
      setMetrics(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '₹ 0';
    return `₹ ${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
        return <Badge variant="info">Income</Badge>;
      default:
        return <Badge variant="neutral">{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning">Partial</Badge>;
      case 'UNPAID':
      default:
        return <Badge variant="error">Unpaid</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">DASHBOARD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts & Finance Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time general ledger, trade dues, vouchers, receipts, and cash flow liquidity overview
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchMetrics}
          >
            Refresh
          </Button>
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

      {/* 10 Required Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial KPI Cards</h2>
          <span className="text-[11px] text-slate-400">All data synchronized from live database APIs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Total Payables */}
          <StatsCard
            title="Total Payables"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalPayables)}
            subtitle="Creditor & vendor dues"
            icon={<ArrowUpRight className="w-5 h-5 text-rose-600" />}
            iconBgColor="bg-rose-50"
            trend={{ value: 'Accounts Payable', isPositive: false, label: 'liability' }}
          />

          {/* 2. Total Receivables */}
          <StatsCard
            title="Total Receivables"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalReceivables)}
            subtitle="Customer trade dues"
            icon={<ArrowDownRight className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            trend={{ value: 'Accounts Receivable', isPositive: true, label: 'asset' }}
          />

          {/* 3. Today's Payments */}
          <StatsCard
            title="Today's Payments"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayPayments)}
            subtitle="Disbursed today"
            icon={<Wallet className="w-5 h-5 text-amber-600" />}
            iconBgColor="bg-amber-50"
            trend={{ value: 'Cash / Bank Out', isPositive: false, label: 'daily flow' }}
          />

          {/* 4. Today's Receipts */}
          <StatsCard
            title="Today's Receipts"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayReceipts)}
            subtitle="Collected today"
            icon={<Receipt className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            trend={{ value: 'Cash / Bank In', isPositive: true, label: 'daily flow' }}
          />

          {/* 5. Today's Purchases */}
          <StatsCard
            title="Today's Purchases"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todayPurchases)}
            subtitle="Procurement bills today"
            icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
            trend={{ value: 'Bills Booked', isPositive: true, label: 'inward bills' }}
          />

          {/* 6. Today's Sales */}
          <StatsCard
            title="Today's Sales"
            value={loading ? 'Loading...' : formatCurrency(metrics?.todaySales)}
            subtitle="Sales invoices today"
            icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
            iconBgColor="bg-indigo-50"
            trend={{ value: 'Revenue Booked', isPositive: true, label: 'outward sales' }}
          />

          {/* 7. Total Expenses */}
          <StatsCard
            title="Total Expenses"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalExpenses)}
            subtitle="Operating expenditure"
            icon={<ArrowUpRight className="w-5 h-5 text-red-600" />}
            iconBgColor="bg-red-50"
            trend={{ value: 'Overheads & Utilities', isPositive: false, label: 'cost' }}
          />

          {/* 8. Total Income */}
          <StatsCard
            title="Total Income"
            value={loading ? 'Loading...' : formatCurrency(metrics?.totalIncome)}
            subtitle="Auxiliary & direct income"
            icon={<DollarSign className="w-5 h-5 text-teal-600" />}
            iconBgColor="bg-teal-50"
            trend={{ value: 'Services & Scrap', isPositive: true, label: 'revenue' }}
          />

          {/* 9. Outstanding Amount */}
          <StatsCard
            title="Outstanding Amount"
            value={loading ? 'Loading...' : formatCurrency(metrics?.outstandingAmount)}
            subtitle="Net trade outstanding"
            icon={<Scale className="w-5 h-5 text-purple-600" />}
            iconBgColor="bg-purple-50"
            trend={{ value: 'Receivable vs Payable', isPositive: true, label: 'net balance' }}
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
          <div className="overflow-x-auto">
            <Table>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsDashboardPage;

import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  Building2,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  User,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';

interface IncomeItem {
  id: string;
  incomeNumber: string;
  incomeDate: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  category: string;
  description: string | null;
  store: {
    id: string;
    code: string;
    name: string;
  };
  account: {
    id: string;
    code: string;
    name: string;
  };
  party?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
  } | null;
}

interface IncomeSummary {
  totalIncome: number;
  cashIncome: number;
  bankIncome: number;
  count: number;
}

interface StoreItem {
  id: string;
  code: string;
  name: string;
}

interface PartyItem {
  id: string;
  code: string;
  name: string;
  type: string;
}

const CATEGORY_OPTIONS = [
  'Direct Sales Revenue',
  'Scrap & Asset Disposal',
  'Consulting & Service Fees',
  'Interest & Investment Income',
  'Commission Received',
  'Rental & Lease Income',
  'Discount Received',
  'Other Operating Income',
];

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'UPI',
  'Cheque',
  'Card',
  'NEFT',
  'RTGS',
  'IMPS',
  'Other',
];

export const IncomePage: React.FC = () => {
  const [incomeList, setIncomeList] = useState<IncomeItem[]>([]);
  const [summary, setSummary] = useState<IncomeSummary>({
    totalIncome: 0,
    cashIncome: 0,
    bankIncome: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown data
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [parties, setParties] = useState<PartyItem[]>([]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View Details Modal
  const [selectedIncome, setSelectedIncome] = useState<IncomeItem | null>(null);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStoreId, setFormStoreId] = useState('');
  const [formCategory, setFormCategory] = useState('Direct Sales Revenue');
  const [customCategory, setCustomCategory] = useState('');
  const [formPartyId, setFormPartyId] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Bank Transfer');
  const [formReference, setFormReference] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const fetchIncome = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (selectedCategory !== 'ALL') queryParams.append('category', selectedCategory);
    if (selectedMethod !== 'ALL') queryParams.append('paymentMethod', selectedMethod);
    if (selectedStore !== 'ALL') queryParams.append('storeId', selectedStore);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const res = await apiRequest<{ records: IncomeItem[]; summary: IncomeSummary }>(
      `/accounts/income?${queryParams.toString()}`
    );

    if (res.success && res.data) {
      setIncomeList(res.data.records || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    }
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    try {
      const [storeRes, partyRes] = await Promise.all([
        apiRequest<StoreItem[]>('/accounts/stores'),
        apiRequest<PartyItem[]>('/accounts/parties'),
      ]);
      if (storeRes.success && storeRes.data) {
        setStores(storeRes.data);
        if (storeRes.data.length > 0 && !formStoreId) {
          setFormStoreId(storeRes.data[0].id);
        }
      }
      if (partyRes.success && partyRes.data) {
        setParties(partyRes.data);
      }
    } catch (err) {
      console.error('Failed to load stores or parties', err);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchIncome();
  }, [selectedCategory, selectedMethod, selectedStore, startDate, endDate]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedMethod('ALL');
    setSelectedStore('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleCreateIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Income amount must be greater than zero.');
      return;
    }

    if (!formStoreId) {
      setErrorMsg('Please select a valid store.');
      return;
    }

    const finalCategory = formCategory === 'Other' ? (customCategory.trim() || 'General Income') : formCategory;

    setSubmitting(true);
    try {
      const payload = {
        incomeDate: formDate,
        storeId: formStoreId,
        category: finalCategory,
        partyId: formPartyId.trim() ? formPartyId : undefined,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
        reference: formReference.trim() || undefined,
        description: formDescription.trim() || undefined,
      };

      const res = await apiRequest<{ income: IncomeItem }>('/accounts/income', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setSuccessMsg(`Income voucher recorded successfully! Voucher #${res.data?.income?.incomeNumber || ''}`);
        window.dispatchEvent(new CustomEvent('accounts:transaction-posted'));
        setIsModalOpen(false);
        // Reset form
        setFormAmount('');
        setFormReference('');
        setFormDescription('');
        setFormPartyId('');
        fetchIncome();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || 'Failed to record income voucher.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving income.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!incomeList.length) return;
    const headers = [
      'Voucher #',
      'Date',
      'Category',
      'Account',
      'Party / Remitter',
      'Store',
      'Receipt Mode',
      'Reference',
      'Amount (INR)',
      'Description',
    ];
    const rows = incomeList.map((inc) => [
      `"${inc.incomeNumber}"`,
      `"${new Date(inc.incomeDate).toLocaleDateString()}"`,
      `"${inc.category}"`,
      `"${inc.account?.name || ''}"`,
      `"${inc.party?.name || 'Direct / N/A'}"`,
      `"${inc.store?.name || ''}"`,
      `"${inc.paymentMode}"`,
      `"${inc.referenceNo || ''}"`,
      inc.amount,
      `"${(inc.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Income_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCash = formPaymentMethod.toUpperCase() === 'CASH';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">INCOME</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Direct & Indirect Income</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log sales revenue, commission, interest earned, scrap sales, and auxiliary revenues with double-entry journal posting
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchIncome}
          >
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
          >
            Record New Income
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Income Recorded</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            + ₹ {summary.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Total revenue credited</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cash Inflows</span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            ₹ {summary.cashIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Deposited into Account 1010 (Cash)</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bank / Online Inflows</span>
          <p className="text-xl font-bold text-blue-600 mt-1">
            ₹ {summary.bankIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Received via Account 1020 (Bank/UPI)</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Vouchers</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{summary.count}</p>
          <span className="text-[10px] text-slate-400">Verified income entries</span>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchIncome()}
                placeholder="Search voucher, party, category, reference..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Store Filter */}
            <div>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Receipt Modes</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Clear Filters
              </Button>
              <Button size="sm" variant="outline" onClick={fetchIncome}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Income Register
          </span>
          <span className="text-xs font-semibold text-slate-500">{incomeList.length} Records Found</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Party / Remitter</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Receipt Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading income records from database...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : incomeList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                    No income records match current criteria.
                  </TableCell>
                </TableRow>
              ) : (
                incomeList.map((inc) => (
                  <TableRow key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {inc.incomeNumber}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {new Date(inc.incomeDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{inc.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {inc.party ? (
                        <div className="font-medium text-slate-800">
                          {inc.party.name}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">({inc.party.code})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Direct / N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {inc.store?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inc.paymentMode === 'CASH' ? 'warning' : 'blue'}>
                        {inc.paymentMode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-mono">
                      {inc.referenceNo || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                      + ₹ {inc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setSelectedIncome(inc)}
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* RECORD NEW INCOME MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record New Income Voucher"
        size="lg"
      >
        <form onSubmit={handleCreateIncome} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Income Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Store */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Location <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formStoreId}
                onChange={(e) => setFormStoreId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Store</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Income Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Other">Other (Specify Custom Category)</option>
              </select>
              {formCategory === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter custom category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full mt-2 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              )}
            </div>

            {/* Party if applicable */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party / Remitter <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={formPartyId}
                onChange={(e) => setFormPartyId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Direct / No Party Linked</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code} - {p.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Challan #
              </label>
              <input
                type="text"
                placeholder="Challan #, UTR, Cheque #..."
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Narration
            </label>
            <textarea
              rows={2}
              placeholder="Income details, customer reference, invoice notes..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Live Double-Entry Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700 block mb-1">
              Double-Entry Accounting Posting Preview:
            </span>
            <div className="font-mono text-[11px] space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>
                  Dr. {isCash ? 'Cash on Hand (1010)' : 'Operating Bank Account (1020)'}
                </span>
                <span className="font-bold text-slate-800">
                  ₹ {parseFloat(formAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Cr. Operating / Other Income (40XX - {formCategory})</span>
                <span className="font-bold text-emerald-600">
                  ₹ {parseFloat(formAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Record Income Voucher
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW DETAILS MODAL */}
      {selectedIncome && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedIncome(null)}
          title={`Income Details — ${selectedIncome.incomeNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Voucher Number</span>
                <span className="font-mono font-bold text-slate-800">{selectedIncome.incomeNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Income Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(selectedIncome.incomeDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                <span className="font-semibold text-slate-800">{selectedIncome.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Store</span>
                <span className="font-medium text-slate-800">{selectedIncome.store?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Receipt Mode</span>
                <Badge variant="blue">{selectedIncome.paymentMode}</Badge>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Reference No</span>
                <span className="font-mono text-slate-800">{selectedIncome.referenceNo || '—'}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-emerald-600 block text-[10px] uppercase font-semibold">Total Amount</span>
              <span className="font-mono text-lg font-bold text-emerald-700">
                + ₹ {selectedIncome.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {selectedIncome.party && (
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Party / Remitter</span>
                <span className="font-bold text-slate-900">{selectedIncome.party.name}</span>
                <span className="text-slate-500 block text-[11px]">Code: {selectedIncome.party.code}</span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[10px] uppercase mb-1">Narration / Description</span>
              <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {selectedIncome.description || 'Operating income receipt voucher.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIncome(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default IncomePage;

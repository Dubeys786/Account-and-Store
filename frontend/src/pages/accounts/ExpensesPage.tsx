import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingDown,
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

interface ExpenseItem {
  id: string;
  expenseNumber: string;
  expenseDate: string;
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

interface ExpenseSummary {
  totalExpenses: number;
  cashExpenses: number;
  bankExpenses: number;
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
  'Rent & Facility',
  'Salaries & Payroll',
  'Electricity & Utilities',
  'Freight & Logistics',
  'Repairs & Maintenance',
  'Office Supplies',
  'Marketing & Advertising',
  'Tea & Refreshments',
  'Legal & Professional',
  'General Operating Expense',
];

const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Card',
  'NEFT',
  'RTGS',
  'IMPS',
  'Other',
];

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    totalExpenses: 0,
    cashExpenses: 0,
    bankExpenses: 0,
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
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStoreId, setFormStoreId] = useState('');
  const [formCategory, setFormCategory] = useState('Rent & Facility');
  const [customCategory, setCustomCategory] = useState('');
  const [formPartyId, setFormPartyId] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Cash');
  const [formReference, setFormReference] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.append('search', search.trim());
    if (selectedCategory !== 'ALL') queryParams.append('category', selectedCategory);
    if (selectedMethod !== 'ALL') queryParams.append('paymentMethod', selectedMethod);
    if (selectedStore !== 'ALL') queryParams.append('storeId', selectedStore);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const res = await apiRequest<{ records: ExpenseItem[]; summary: ExpenseSummary }>(
      `/accounts/expenses?${queryParams.toString()}`
    );

    if (res.success && res.data) {
      setExpenses(res.data.records || []);
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
    fetchExpenses();
  }, [selectedCategory, selectedMethod, selectedStore, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedMethod('ALL');
    setSelectedStore('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Expense amount must be greater than zero.');
      return;
    }

    if (!formStoreId) {
      setErrorMsg('Please select a valid store.');
      return;
    }

    const finalCategory = formCategory === 'Other' ? (customCategory.trim() || 'General Expense') : formCategory;

    setSubmitting(true);
    try {
      const payload = {
        expenseDate: formDate,
        storeId: formStoreId,
        category: finalCategory,
        partyId: formPartyId.trim() ? formPartyId : undefined,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
        reference: formReference.trim() || undefined,
        description: formDescription.trim() || undefined,
      };

      const res = await apiRequest<{ expense: ExpenseItem }>('/accounts/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setSuccessMsg(`Expense voucher recorded successfully! Voucher #${res.data?.expense?.expenseNumber || ''}`);
        setIsModalOpen(false);
        // Reset form
        setFormAmount('');
        setFormReference('');
        setFormDescription('');
        setFormPartyId('');
        fetchExpenses();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || 'Failed to record expense voucher.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!expenses.length) return;
    const headers = [
      'Voucher #',
      'Date',
      'Category',
      'Account',
      'Party',
      'Store',
      'Payment Mode',
      'Reference',
      'Amount (INR)',
      'Description',
    ];
    const rows = expenses.map((exp) => [
      `"${exp.expenseNumber}"`,
      `"${new Date(exp.expenseDate).toLocaleDateString()}"`,
      `"${exp.category}"`,
      `"${exp.account?.name || ''}"`,
      `"${exp.party?.name || 'Direct / N/A'}"`,
      `"${exp.store?.name || ''}"`,
      `"${exp.paymentMode}"`,
      `"${exp.referenceNo || ''}"`,
      exp.amount,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expenses_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="text-blue-600">EXPENSES</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record direct and indirect operating expenditures, petty cash, electricity, rent, and freight with double-entry journal posting
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchExpenses}
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
            Record New Expense
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Operating Expenses</span>
          <p className="text-xl font-bold text-rose-600 mt-1">
            ₹ {summary.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Total debit incurred</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cash Disbursed</span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            ₹ {summary.cashExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Paid from Account 1010 (Cash)</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bank / Online Disbursed</span>
          <p className="text-xl font-bold text-blue-600 mt-1">
            ₹ {summary.bankExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Paid from Account 1020 (Bank/UPI)</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Vouchers</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{summary.count}</p>
          <span className="text-[10px] text-slate-400">Verified expense entries</span>
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
                onKeyDown={(e) => e.key === 'Enter' && fetchExpenses()}
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
                <option value="ALL">All Payment Modes</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
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
              <Button size="sm" variant="outline" onClick={fetchExpenses}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Expenses Register
          </span>
          <span className="text-xs font-semibold text-slate-500">{expenses.length} Records Found</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Party / Beneficiary</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Payment Mode</TableHead>
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
                        <span>Loading operating expenses from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                      No operating expenses match current criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {exp.expenseNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {exp.party ? (
                          <div className="font-medium text-slate-800">
                            {exp.party.name}{' '}
                            <span className="text-[10px] text-slate-500 font-normal">({exp.party.code})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Direct / N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {exp.store?.name || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={exp.paymentMode === 'CASH' ? 'warning' : 'blue'}>
                          {exp.paymentMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-mono">
                        {exp.referenceNo || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                        ₹ {exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedExpense(exp)}
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* RECORD NEW EXPENSE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record New Expense Voucher"
        size="lg"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
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
                Expense Date <span className="text-rose-500">*</span>
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
                Expense Category <span className="text-rose-500">*</span>
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
                Party / Payee <span className="text-slate-400 font-normal">(Optional)</span>
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
                Payment Method <span className="text-rose-500">*</span>
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
                Reference / Bill #
              </label>
              <input
                type="text"
                placeholder="Bill #, UTR, Cheque #..."
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
              placeholder="Expense justification, billing period, contractor notes..."
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
                <span>Dr. Operating Expense (50XX - {formCategory})</span>
                <span className="font-bold text-rose-600">
                  ₹ {parseFloat(formAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pl-4">
                <span>
                  Cr. {isCash ? 'Cash on Hand (1010)' : 'Operating Bank Account (1020)'}
                </span>
                <span className="font-bold text-slate-800">
                  ₹ {parseFloat(formAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              Record Expense Voucher
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW DETAILS MODAL */}
      {selectedExpense && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedExpense(null)}
          title={`Expense Details — ${selectedExpense.expenseNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Voucher Number</span>
                <span className="font-mono font-bold text-slate-800">{selectedExpense.expenseNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Expense Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(selectedExpense.expenseDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                <span className="font-semibold text-slate-800">{selectedExpense.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Store</span>
                <span className="font-medium text-slate-800">{selectedExpense.store?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Payment Mode</span>
                <Badge variant="blue">{selectedExpense.paymentMode}</Badge>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Reference No</span>
                <span className="font-mono text-slate-800">{selectedExpense.referenceNo || '—'}</span>
              </div>
            </div>

            <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-rose-600 block text-[10px] uppercase font-semibold">Total Amount</span>
              <span className="font-mono text-lg font-bold text-rose-700">
                ₹ {selectedExpense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {selectedExpense.party && (
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Payee / Beneficiary</span>
                <span className="font-bold text-slate-900">{selectedExpense.party.name}</span>
                <span className="text-slate-500 block text-[11px]">Code: {selectedExpense.party.code}</span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[10px] uppercase mb-1">Narration / Description</span>
              <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {selectedExpense.description || 'Operating expense disbursement voucher.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedExpense(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExpensesPage;

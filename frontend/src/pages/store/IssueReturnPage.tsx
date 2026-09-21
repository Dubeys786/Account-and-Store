import React, { useEffect, useState } from 'react';
import {
  Plus,
  ArrowLeftRight,
  Search,
  Filter,
  AlertTriangle,
  RotateCcw,
  Clock,
  Calendar,
  CheckCircle2,
  Info,
  Layers,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import {
  RETURN_REASONS,
  ITEM_CONDITIONS,
  isDamagedCondition,
  calculateDaysHeld,
  getReturnClassification,
} from '../../config/returnRules';

export const IssueReturnPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');

  // Return Age Summary KPIs
  const [returnSummary, setReturnSummary] = useState<{
    totalReturns: number;
    totalReturnedQty: number;
    recentCount: number;
    oldCount: number;
    veryOldCount: number;
    avgDaysHeld: number;
  }>({
    totalReturns: 0,
    totalReturnedQty: 0,
    recentCount: 0,
    oldCount: 0,
    veryOldCount: 0,
    avgDaysHeld: 0,
  });

  // Lookups
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);
  const [openIssuesList, setOpenIssuesList] = useState<any[]>([]);

  // Issue Modal State
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueItemId, setIssueItemId] = useState('');
  const [issueStoreId, setIssueStoreId] = useState('');
  const [issueQuantity, setIssueQuantity] = useState<number | ''>('');
  const [issueDepartment, setIssueDepartment] = useState('');
  const [issueReference, setIssueReference] = useState('');
  const [issueNotes, setIssueNotes] = useState('');

  // Return Modal State
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState<number | ''>('');
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnCondition, setReturnCondition] = useState<string>('Good');
  const [returnReason, setReturnReason] = useState<string>('Unused Material');
  const [returnDepartment, setReturnDepartment] = useState('');
  const [returnReference, setReturnReference] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Details Modal State
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<any>(null);

  // Fetch transactions and return summary
  const fetchTransactions = async () => {
    setLoading(true);
    const query = typeFilter !== 'ALL' ? `?type=${typeFilter}` : '';
    const [txRes, summaryRes] = await Promise.all([
      apiRequest(`/store/stock/transactions${query}`),
      apiRequest('/store/stock/return-summary'),
    ]);

    if (txRes.success && txRes.data) {
      setTransactions(txRes.data);
    }
    if (summaryRes.success && summaryRes.data) {
      setReturnSummary(summaryRes.data);
    }
    setLoading(false);
  };

  // Fetch Lookups and Open Issues
  const fetchLookups = async () => {
    const [itemsRes, storesRes, openIssuesRes] = await Promise.all([
      apiRequest('/store/items?limit=100'),
      apiRequest('/store/stores'),
      apiRequest('/store/stock/open-issues'),
    ]);

    if (itemsRes.success && itemsRes.data?.items) setItemsList(itemsRes.data.items);
    if (storesRes.success && storesRes.data) setStoresList(storesRes.data);
    if (openIssuesRes.success && openIssuesRes.data) setOpenIssuesList(openIssuesRes.data);
  };

  useEffect(() => {
    fetchTransactions();
    fetchLookups();
  }, [typeFilter]);

  // Selected item for Issue (to check available stock)
  const selectedIssueItem = itemsList.find((it) => it.id === issueItemId);
  const availableStock = selectedIssueItem ? selectedIssueItem.currentStock : 0;
  const isOverdraft = typeof issueQuantity === 'number' && issueQuantity > availableStock;

  // Selected Open Issue for Return
  const selectedOpenIssue = openIssuesList.find((issue) => issue.id === selectedIssueId);
  const remainingReturnable = selectedOpenIssue ? selectedOpenIssue.remainingReturnable : 0;
  const isReturnOverdraft = typeof returnQuantity === 'number' && returnQuantity > remainingReturnable;

  // Calculate Days Held live in modal
  const liveDaysHeld = selectedOpenIssue && returnDate
    ? calculateDaysHeld(selectedOpenIssue.createdAt, returnDate)
    : 0;
  const liveClassification = getReturnClassification(liveDaysHeld);

  // Open Issue Modal
  const handleOpenIssue = () => {
    setIssueItemId(itemsList[0]?.id || '');
    setIssueStoreId(storesList[0]?.id || '');
    setIssueQuantity(1);
    setIssueDepartment('Production Line 1');
    setIssueReference('');
    setIssueNotes('');
    setIssueError('');
    setIsIssueOpen(true);
  };

  // Open Return Modal
  const handleOpenReturn = async () => {
    const res = await apiRequest('/store/stock/open-issues');
    let currentOpenIssues = openIssuesList;
    if (res.success && res.data) {
      setOpenIssuesList(res.data);
      currentOpenIssues = res.data;
    }

    const firstIssue = currentOpenIssues[0];
    if (firstIssue) {
      setSelectedIssueId(firstIssue.id);
      setReturnQuantity(Math.min(1, firstIssue.remainingReturnable));
      setReturnDepartment(firstIssue.referenceType || 'Production Line 1');
      setReturnReference(firstIssue.referenceId || '');
    } else {
      setSelectedIssueId('');
      setReturnQuantity('');
      setReturnDepartment('');
      setReturnReference('');
    }

    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnCondition('Good');
    setReturnReason('Unused Material');
    setReturnNotes('Surplus material returned to store');
    setReturnError('');
    setIsReturnOpen(true);
  };

  // When selected open issue changes
  const handleIssueSelectChange = (issueId: string) => {
    setSelectedIssueId(issueId);
    const chosen = openIssuesList.find((it) => it.id === issueId);
    if (chosen) {
      setReturnQuantity(Math.min(1, chosen.remainingReturnable));
      setReturnDepartment(chosen.referenceType || '');
      setReturnReference(chosen.referenceId || '');
    }
  };

  // Submit Issue
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError('');

    if (!issueItemId) {
      setIssueError('Please select an item.');
      return;
    }
    if (!issueStoreId) {
      setIssueError('Please select a store.');
      return;
    }
    if (!issueQuantity || issueQuantity <= 0) {
      setIssueError('Quantity must be greater than 0.');
      return;
    }
    if (issueQuantity > availableStock) {
      setIssueError(`Stock overdraft prevented! Available stock is only ${availableStock} ${selectedIssueItem?.unit}.`);
      return;
    }

    setIssueLoading(true);
    const res = await apiRequest('/store/stock/issue', {
      method: 'POST',
      body: JSON.stringify({
        itemId: issueItemId,
        storeId: issueStoreId,
        quantity: Number(issueQuantity),
        department: issueDepartment || undefined,
        referenceId: issueReference || undefined,
        notes: issueNotes || undefined,
      }),
    });
    setIssueLoading(false);

    if (res.success) {
      setIsIssueOpen(false);
      fetchTransactions();
      fetchLookups();
    } else {
      setIssueError(res.message || 'Failed to issue material.');
    }
  };

  // Submit Return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError('');

    if (!selectedIssueId) {
      setReturnError('Please select an original issue transaction to return against.');
      return;
    }
    if (!selectedOpenIssue) {
      setReturnError('Selected issue transaction not found.');
      return;
    }
    if (!returnQuantity || Number(returnQuantity) <= 0) {
      setReturnError('Quantity must be greater than 0.');
      return;
    }
    if (Number(returnQuantity) > remainingReturnable) {
      setReturnError(
        `Cannot return ${returnQuantity}. Remaining returnable is only ${remainingReturnable} ${selectedOpenIssue.item?.unit}.`
      );
      return;
    }

    setReturnLoading(true);
    const res = await apiRequest('/store/stock/return', {
      method: 'POST',
      body: JSON.stringify({
        originalIssueId: selectedIssueId,
        itemId: selectedOpenIssue.itemId,
        storeId: selectedOpenIssue.storeId,
        quantity: Number(returnQuantity),
        returnDate: returnDate || new Date().toISOString(),
        condition: returnCondition,
        returnReason: returnReason,
        department: returnDepartment || undefined,
        referenceId: returnReference || undefined,
        notes: returnNotes || undefined,
      }),
    });
    setReturnLoading(false);

    if (res.success) {
      setIsReturnOpen(false);
      fetchTransactions();
      fetchLookups();
    } else {
      setReturnError(res.message || 'Failed to return material.');
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const term = searchQuery.toLowerCase();
    const itemCode = tx.item?.code?.toLowerCase() || '';
    const itemName = tx.item?.name?.toLowerCase() || '';
    const notes = tx.notes?.toLowerCase() || '';
    const ref = tx.referenceId?.toLowerCase() || '';
    const matchesSearch = itemCode.includes(term) || itemName.includes(term) || notes.includes(term) || ref.includes(term);

    if (!matchesSearch) return false;

    // Classification filter (applies to RETURN transactions)
    if (classificationFilter !== 'ALL') {
      if (tx.transactionType !== 'RETURN') return false;
      const classKey = tx.classification?.key || getReturnClassification(tx.daysHeld || 0).key;
      if (classKey !== classificationFilter) return false;
    }

    // Condition filter (applies to RETURN transactions)
    if (conditionFilter !== 'ALL') {
      if (tx.transactionType !== 'RETURN') return false;
      const cond = tx.condition || 'Good';
      if (cond !== conditionFilter) return false;
    }

    return true;
  });

  // Badge helpers
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ISSUE':
        return <Badge variant="warning">Issue (-)</Badge>;
      case 'RETURN':
        return <Badge variant="info">Return (+)</Badge>;
      case 'INWARD':
        return <Badge variant="success">Inward (+)</Badge>;
      case 'ADJUSTMENT':
        return <Badge variant="neutral">Adjustment</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const getReturnClassificationBadge = (days: number | undefined | null) => {
    const d = days ?? 0;
    const rule = getReturnClassification(d);
    let variant: 'success' | 'warning' | 'danger' = 'success';
    if (rule.key === 'OLD_RETURN') variant = 'warning';
    if (rule.key === 'VERY_OLD_RETURN') variant = 'danger';

    return (
      <Badge variant={variant} size="sm">
        {rule.label}
      </Badge>
    );
  };

  const getConditionBadge = (condition?: string | null) => {
    const isDamaged = isDamagedCondition(condition);
    return (
      <Badge variant={isDamaged ? 'danger' : 'success'} size="sm">
        {condition || 'Good'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>STORE TRANSACTIONS</span>
            <span>/</span>
            <span className="text-blue-600">MATERIAL ISSUE &amp; RETURN</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Issue &amp; Return</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue materials to departments with overdraft protection, and trace returns with exact item age and condition tracking
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            onClick={handleOpenReturn}
          >
            Record Return
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenIssue}
          >
            Issue Material
          </Button>
        </div>
      </div>

      {/* Return Age KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
            <span>TOTAL RETURNS</span>
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {returnSummary.totalReturns}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {returnSummary.totalReturnedQty} Units Returned
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 mb-1">
            <span>RECENT (0–7d)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {returnSummary.recentCount}
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">
            Returned within 1 week
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 mb-1">
            <span>OLD (8–30d)</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700">
            {returnSummary.oldCount}
          </div>
          <div className="text-[10px] text-amber-600/80 mt-0.5">
            Returned within 1 month
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 mb-1">
            <span>VERY OLD (31+d)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-700">
            {returnSummary.veryOldCount}
          </div>
          <div className="text-[10px] text-rose-600/80 mt-0.5">
            Held longer than 30 days
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-800 mb-1">
            <span>AVG RETURN AGE</span>
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-700">
            {returnSummary.avgDaysHeld} <span className="text-xs font-normal">days</span>
          </div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">
            Average days held in field
          </div>
        </div>
      </div>

      {/* Main Transactions Log Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Item, Dept, Notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Type Filter */}
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Types</option>
                    <option value="ISSUE">Issues (-)</option>
                    <option value="RETURN">Returns (+)</option>
                    <option value="INWARD">Inwards (+)</option>
                    <option value="ADJUSTMENT">Adjustments</option>
                  </select>
                </div>

                {/* Classification Filter (for Returns) */}
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Return Ages</option>
                  <option value="RECENT_RETURN">Recent Return (0–7d)</option>
                  <option value="OLD_RETURN">Old Return (8–30d)</option>
                  <option value="VERY_OLD_RETURN">Very Old Return (31+d)</option>
                </select>

                {/* Condition Filter */}
                <select
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Conditions</option>
                  <option value="Good">Good (Usable)</option>
                  <option value="Damaged">Damaged (Quarantined)</option>
                  <option value="Partially Damaged">Partially Damaged</option>
                  <option value="Defective">Defective</option>
                </select>
              </div>
            </div>

            <span className="text-xs font-semibold text-slate-500 shrink-0 self-end lg:self-auto">
              {filteredTransactions.length} Audit Entries
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date / Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Days Held / Return Age</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Department / Issued To</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2" />
                    Loading stock transactions ledger...
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                    No transactions recorded matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => {
                  const isReturn = tx.transactionType === 'RETURN';
                  const returnDays = tx.daysHeld;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString()}{' '}
                        <span className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell>{getTypeBadge(tx.transactionType)}</TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-slate-900">{tx.item?.code}</div>
                        <div className="text-xs text-slate-600 truncate max-w-[180px]">{tx.item?.name}</div>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold ${
                          tx.transactionType === 'ISSUE' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {tx.transactionType === 'ISSUE' ? '-' : '+'}
                        {tx.quantity} <span className="text-[10px] font-normal text-slate-400">{tx.item?.unit}</span>
                      </TableCell>
                      <TableCell>
                        {isReturn ? (
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{returnDays !== undefined && returnDays !== null ? `${returnDays} days held` : 'N/A'}</span>
                            </div>
                            {getReturnClassificationBadge(returnDays)}
                          </div>
                        ) : tx.transactionType === 'ISSUE' && tx.returns?.length > 0 ? (
                          <div className="text-[11px] text-blue-600 font-medium">
                            {tx.returns.reduce((sum: number, r: any) => sum + r.quantity, 0)} {tx.item?.unit} returned
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isReturn ? (
                          getConditionBadge(tx.condition)
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <div className="font-medium truncate max-w-[140px]">
                          {tx.referenceType || tx.originalIssue?.referenceType || 'N/A'}
                        </div>
                        {tx.referenceId && (
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                            {tx.referenceId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs">
                        {tx.store?.name || 'Main Warehouse'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedTxForDetail(tx)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Details
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ISSUE MATERIAL MODAL */}
      <Modal
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
        title="Issue Material to Department"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleIssueSubmit}
              loading={issueLoading}
              disabled={Boolean(isOverdraft) || !issueQuantity}
            >
              Confirm Issue
            </Button>
          </div>
        }
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          {issueError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center justify-between">
              <span>{issueError}</span>
              <button type="button" onClick={() => setIssueError('')} className="font-bold text-red-700">
                ✕
              </button>
            </div>
          )}

          {/* Item Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Item to Issue <span className="text-red-500">*</span>
            </label>
            <select
              value={issueItemId}
              onChange={(e) => setIssueItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {itemsList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name} (Available Stock: {item.currentStock} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Live stock indicator */}
          {selectedIssueItem && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600">Currently Available Physical Stock:</span>
              <span
                className={`font-mono font-bold text-sm ${
                  availableStock > 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {availableStock} {selectedIssueItem.unit}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Store selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Store <span className="text-red-500">*</span>
              </label>
              <select
                value={issueStoreId}
                onChange={(e) => setIssueStoreId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {storesList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                placeholder={`Max ${availableStock}`}
                value={issueQuantity}
                onChange={(e) => setIssueQuantity(parseFloat(e.target.value) || '')}
                className={`w-full px-3 py-2 text-xs font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  isOverdraft
                    ? 'border-red-500 focus:ring-red-400 text-red-600'
                    : 'border-slate-200 focus:ring-blue-500'
                }`}
                required
              />
              {isOverdraft && (
                <span className="text-[11px] text-red-600 mt-1 block font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Stock overdraft prevented! Available is only {availableStock}.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issuing to Department / Person
              </label>
              <input
                type="text"
                placeholder="e.g. Production Line 1 / Ramesh K."
                value={issueDepartment}
                onChange={(e) => setIssueDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reference ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Requisition / Work Order #
              </label>
              <input
                type="text"
                placeholder="e.g. REQ-2026-44"
                value={issueReference}
                onChange={(e) => setIssueReference(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Purpose / Notes</label>
            <input
              type="text"
              placeholder="e.g. Routine maintenance scheduled for line B"
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* RECORD MATERIAL RETURN MODAL (LINKED TO ORIGINAL ISSUE) */}
      <Modal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        title="Record Material Return into Store (Linked to Issue)"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturnSubmit}
              loading={returnLoading}
              disabled={!selectedIssueId || !returnQuantity || returnQuantity <= 0 || Boolean(isReturnOverdraft)}
            >
              Confirm Return
            </Button>
          </div>
        }
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {returnError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center justify-between">
              <span>{returnError}</span>
              <button type="button" onClick={() => setReturnError('')} className="font-bold text-red-700">
                ✕
              </button>
            </div>
          )}

          {/* Original Issue Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Original Issue Transaction <span className="text-red-500">*</span>
            </label>
            {openIssuesList.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>No open material issues available for return. Returns must be linked to an existing issue transaction.</span>
              </div>
            ) : (
              <select
                value={selectedIssueId}
                onChange={(e) => handleIssueSelectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                {openIssuesList.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.item?.code} - {issue.item?.name} | Issued: {new Date(issue.createdAt).toLocaleDateString()} | Qty: {issue.quantity} {issue.item?.unit} (Returnable: {issue.remainingReturnable}) | {issue.store?.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Original Issue Context Card */}
          {selectedOpenIssue && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Original Issue Context
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ID: {selectedOpenIssue.id.slice(0, 8)}...
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Original Issue Date</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {new Date(selectedOpenIssue.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Originally Issued</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {selectedOpenIssue.quantity} {selectedOpenIssue.item?.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Already Returned</span>
                  <span className="font-semibold text-slate-600 font-mono">
                    {selectedOpenIssue.alreadyReturned} {selectedOpenIssue.item?.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Remaining Returnable</span>
                  <span className="font-bold text-blue-700 font-mono">
                    {selectedOpenIssue.remainingReturnable} {selectedOpenIssue.item?.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Return Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.1"
                max={remainingReturnable}
                step="any"
                placeholder={`Max ${remainingReturnable}`}
                value={returnQuantity}
                onChange={(e) => setReturnQuantity(parseFloat(e.target.value) || '')}
                className={`w-full px-3 py-2 text-xs font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  isReturnOverdraft
                    ? 'border-red-500 focus:ring-red-400 text-red-600'
                    : 'border-slate-200 focus:ring-blue-500'
                }`}
                required
              />
              {isReturnOverdraft && (
                <span className="text-[11px] text-red-600 mt-1 block font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cannot exceed remaining returnable ({remainingReturnable}).
                </span>
              )}
            </div>

            {/* Return Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Live Days Held & Age Classification Preview */}
          {selectedOpenIssue && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-slate-700">Days Held in Field (Return Age):</span>
                <span className="font-mono font-bold text-slate-900">{liveDaysHeld} Days</span>
              </div>
              <div>
                <Badge
                  variant={
                    liveClassification.key === 'RECENT_RETURN'
                      ? 'success'
                      : liveClassification.key === 'OLD_RETURN'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                >
                  {liveClassification.label}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Condition */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Condition <span className="text-red-500">*</span>
              </label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {ITEM_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond} {cond === 'Good' ? '(Restores Usable Stock)' : '(Quarantined in Damaged Stock)'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {isDamagedCondition(returnCondition)
                  ? '⚠️ Item will be quarantined in damaged stock and will NOT increase usable inventory.'
                  : '✓ Usable physical stock will be increased.'}
              </p>
            </div>

            {/* Return Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Returning Department / Person */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Returning Department / Person
              </label>
              <input
                type="text"
                placeholder="e.g. Production Line 1 / Suresh M."
                value={returnDepartment}
                onChange={(e) => setReturnDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Reference / Work Order #
              </label>
              <input
                type="text"
                placeholder="e.g. RET-2026-09"
                value={returnReference}
                onChange={(e) => setReturnReference(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Return Remarks / Verification Notes</label>
            <input
              type="text"
              placeholder="e.g. Inspected by store incharge, verified in working condition"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* TRANSACTION DETAILS MODAL */}
      <Modal
        isOpen={Boolean(selectedTxForDetail)}
        onClose={() => setSelectedTxForDetail(null)}
        title="Transaction Audit & Item Age Details"
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSelectedTxForDetail(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedTxForDetail && (
          <div className="space-y-4 text-xs">
            {/* Header pill */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="font-mono text-slate-400 text-[10px] block">TRANSACTION ID</span>
                <span className="font-mono font-bold text-slate-800">{selectedTxForDetail.id}</span>
              </div>
              <div className="flex items-center gap-2">
                {getTypeBadge(selectedTxForDetail.transactionType)}
                {selectedTxForDetail.transactionType === 'RETURN' &&
                  getReturnClassificationBadge(selectedTxForDetail.daysHeld)}
              </div>
            </div>

            {/* Item & Store Details */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div>
                <span className="text-slate-500 block text-[10px]">ITEM DETAILS</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.item?.name}</span>
                <div className="font-mono text-slate-600 text-[11px]">{selectedTxForDetail.item?.code}</div>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">WAREHOUSE / STORE</span>
                <span className="font-semibold text-slate-900">{selectedTxForDetail.store?.name}</span>
                <div className="font-mono text-slate-500 text-[11px]">{selectedTxForDetail.store?.code}</div>
              </div>
            </div>

            {/* Return Specific Audit Link */}
            {selectedTxForDetail.transactionType === 'RETURN' && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Item Return Age Linkage &amp; Tracking
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Original Issue Date</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedTxForDetail.originalIssue?.createdAt
                        ? new Date(selectedTxForDetail.originalIssue.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Return Date</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedTxForDetail.returnDate
                        ? new Date(selectedTxForDetail.returnDate).toLocaleDateString()
                        : new Date(selectedTxForDetail.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Days Held in Field</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">
                      {selectedTxForDetail.daysHeld ?? 'N/A'} Days
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Condition</span>
                    <span className="inline-block mt-0.5">{getConditionBadge(selectedTxForDetail.condition)}</span>
                  </div>
                </div>

                {selectedTxForDetail.returnReason && (
                  <div className="pt-1 border-t border-blue-100 text-[11px]">
                    <span className="text-slate-500 font-semibold">Return Reason: </span>
                    <span className="text-slate-800">{selectedTxForDetail.returnReason}</span>
                  </div>
                )}
              </div>
            )}

            {/* Issue specific return summary */}
            {selectedTxForDetail.transactionType === 'ISSUE' && selectedTxForDetail.returns && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-semibold text-slate-800 block">Linked Returns Against this Issue</span>
                {selectedTxForDetail.returns.length === 0 ? (
                  <span className="text-slate-500 italic">No returns recorded yet against this issue.</span>
                ) : (
                  <div className="space-y-1 mt-1">
                    {selectedTxForDetail.returns.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between font-mono text-[11px] bg-white p-1.5 rounded border border-slate-100">
                        <span>
                          {new Date(r.createdAt).toLocaleDateString()} — +{r.quantity} {selectedTxForDetail.item?.unit}
                        </span>
                        <span className="text-slate-600">
                          {r.daysHeld !== null && r.daysHeld !== undefined ? `${r.daysHeld} days held` : ''} ({r.condition || 'Good'})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes & References */}
            <div className="space-y-1">
              <span className="text-slate-500 block text-[10px]">REMARKS / NOTES</span>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                {selectedTxForDetail.notes || 'No remarks provided.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

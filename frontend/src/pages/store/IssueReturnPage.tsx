import React, { useEffect, useState } from 'react';
import { Plus, ArrowLeftRight, Search, Filter, AlertTriangle, ArrowUpRight, ArrowDownLeft, Building2, Store } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';

export const IssueReturnPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Lookups
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);

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
  const [returnItemId, setReturnItemId] = useState('');
  const [returnStoreId, setReturnStoreId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState<number | ''>('');
  const [returnDepartment, setReturnDepartment] = useState('');
  const [returnReference, setReturnReference] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    const query = typeFilter !== 'ALL' ? `?type=${typeFilter}` : '';
    const res = await apiRequest(`/store/stock/transactions${query}`);
    if (res.success && res.data) {
      setTransactions(res.data);
    }
    setLoading(false);
  };

  // Fetch Lookups
  const fetchLookups = async () => {
    const [itemsRes, storesRes] = await Promise.all([
      apiRequest('/store/items?limit=100'),
      apiRequest('/store/stores'),
    ]);
    if (itemsRes.success && itemsRes.data?.items) setItemsList(itemsRes.data.items);
    if (storesRes.success && storesRes.data) {
      setStoresList(storesRes.data);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchLookups();
  }, [typeFilter]);

  // Selected item for Issue (to check available stock)
  const selectedIssueItem = itemsList.find((it) => it.id === issueItemId);
  const availableStock = selectedIssueItem ? selectedIssueItem.currentStock : 0;
  const isOverdraft = typeof issueQuantity === 'number' && issueQuantity > availableStock;

  // Selected item for Return
  const selectedReturnItem = itemsList.find((it) => it.id === returnItemId);

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
  const handleOpenReturn = () => {
    setReturnItemId(itemsList[0]?.id || '');
    setReturnStoreId(storesList[0]?.id || '');
    setReturnQuantity(1);
    setReturnDepartment('Production Line 1');
    setReturnReference('');
    setReturnNotes('Unused material returned to store');
    setReturnError('');
    setIsReturnOpen(true);
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
      fetchLookups(); // Refresh item stock
    } else {
      setIssueError(res.message || 'Failed to issue material.');
    }
  };

  // Submit Return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError('');

    if (!returnItemId) {
      setReturnError('Please select an item.');
      return;
    }
    if (!returnStoreId) {
      setReturnError('Please select a store.');
      return;
    }
    if (!returnQuantity || returnQuantity <= 0) {
      setReturnError('Quantity must be greater than 0.');
      return;
    }

    setReturnLoading(true);
    const res = await apiRequest('/store/stock/return', {
      method: 'POST',
      body: JSON.stringify({
        itemId: returnItemId,
        storeId: returnStoreId,
        quantity: Number(returnQuantity),
        department: returnDepartment || undefined,
        referenceId: returnReference || undefined,
        notes: returnNotes || undefined,
      }),
    });
    setReturnLoading(false);

    if (res.success) {
      setIsReturnOpen(false);
      fetchTransactions();
      fetchLookups(); // Refresh item stock
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
    return itemCode.includes(term) || itemName.includes(term) || notes.includes(term) || ref.includes(term);
  });

  // Badge helper
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
            Issue materials to production or departments with strict overdraft protection, and process surplus returns
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<ArrowLeftRight className="w-3.5 h-3.5" />} onClick={handleOpenReturn}>
            Record Return
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenIssue}>
            Issue Material
          </Button>
        </div>
      </div>

      {/* Main Transactions Log Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Item, Dept, or Reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Transaction Types</option>
                <option value="ISSUE">Stock Issues (-)</option>
                <option value="RETURN">Stock Returns (+)</option>
                <option value="INWARD">Material Inwards (+)</option>
                <option value="ADJUSTMENT">Adjustments</option>
              </select>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{filteredTransactions.length} Audit Entries</span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Warehouse / Store</TableHead>
                <TableHead>Reference / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2" />
                    Loading stock transactions ledger...
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    No transactions recorded matching the selected filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{getTypeBadge(tx.transactionType)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {tx.item?.code}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-900">{tx.item?.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({tx.item?.unit})</span>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${
                      tx.transactionType === 'ISSUE' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {tx.transactionType === 'ISSUE' ? '-' : '+'}{tx.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-slate-800">
                      {tx.balanceAfter} {tx.item?.unit}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {tx.store?.name || 'Main Warehouse'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs max-w-xs truncate">
                      {tx.notes || tx.referenceType}
                    </TableCell>
                  </TableRow>
                ))
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
              <button type="button" onClick={() => setIssueError('')} className="font-bold text-red-700">✕</button>
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
                  {item.code} - {item.name} (Stock: {item.currentStock} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Live stock indicator */}
          {selectedIssueItem && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600">Currently Available Physical Stock:</span>
              <span className={`font-mono font-bold text-sm ${availableStock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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

      {/* RETURN MATERIAL MODAL */}
      <Modal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        title="Record Material Return into Store"
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
              disabled={!returnQuantity || returnQuantity <= 0}
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
              <button type="button" onClick={() => setReturnError('')} className="font-bold text-red-700">✕</button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Item to Return <span className="text-red-500">*</span>
            </label>
            <select
              value={returnItemId}
              onChange={(e) => setReturnItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {itemsList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Store <span className="text-red-500">*</span>
              </label>
              <select
                value={returnStoreId}
                onChange={(e) => setReturnStoreId(e.target.value)}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                placeholder="Quantity"
                value={returnQuantity}
                onChange={(e) => setReturnQuantity(parseFloat(e.target.value) || '')}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Reference / Reason
              </label>
              <input
                type="text"
                placeholder="e.g. RET-2026-09 or Surplus unneeded"
                value={returnReference}
                onChange={(e) => setReturnReference(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Return Remarks</label>
            <input
              type="text"
              placeholder="e.g. Material verified in original packaging"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, Eye, CheckCircle, XCircle, Trash2, Calendar, Building2, Store } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';

interface POLineItemRow {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  unit?: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxPercent: number;
  total: number;
}

export const POMasterPage: React.FC = () => {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Master lookups for form
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formPartyId, setFormPartyId] = useState('');
  const [formStoreId, setFormStoreId] = useState('');
  const [formExpectedDelivery, setFormExpectedDelivery] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [lineItems, setLineItems] = useState<POLineItemRow[]>([]);

  // View Details Modal State
  const [viewingPO, setViewingPO] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch POs
  const fetchPOs = async () => {
    setLoading(true);
    const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    const res = await apiRequest(`/store/purchase-orders${query}`);
    if (res.success && res.data) {
      setPos(res.data);
    }
    setLoading(false);
  };

  // Fetch Lookups
  const fetchLookups = async () => {
    const [itemsRes, suppliersRes, storesRes] = await Promise.all([
      apiRequest('/store/items?limit=100'),
      apiRequest('/store/suppliers'),
      apiRequest('/store/stores'),
    ]);
    if (itemsRes.success && itemsRes.data?.items) setItemsList(itemsRes.data.items);
    if (suppliersRes.success && suppliersRes.data) setSuppliersList(suppliersRes.data);
    if (storesRes.success && storesRes.data) setStoresList(storesRes.data);
  };

  useEffect(() => {
    fetchPOs();
    fetchLookups();
  }, [statusFilter]);

  // Open Create PO Modal
  const handleOpenCreate = () => {
    setFormPartyId(suppliersList[0]?.id || '');
    setFormStoreId(storesList[0]?.id || '');
    setFormExpectedDelivery('');
    setFormNotes('');
    setCreateError('');

    // Default first line if items available
    if (itemsList.length > 0) {
      const first = itemsList[0];
      setLineItems([
        {
          itemId: first.id,
          itemCode: first.code,
          itemName: first.name,
          unit: first.unit,
          quantity: 10,
          rate: 100,
          discountPercent: 0,
          taxPercent: 18,
          total: 10 * 100 * 1.18,
        },
      ]);
    } else {
      setLineItems([]);
    }
    setIsCreateOpen(true);
  };

  // Recalculate row total
  const computeRowTotal = (qty: number, rate: number, disc: number, tax: number) => {
    const base = (qty || 0) * (rate || 0);
    const afterDiscount = base - base * ((disc || 0) / 100);
    const withTax = afterDiscount + afterDiscount * ((tax || 0) / 100);
    return Math.round(withTax * 100) / 100;
  };

  // Update line item
  const updateLine = (index: number, field: keyof POLineItemRow, value: any) => {
    const updated = [...lineItems];
    const row = { ...updated[index], [field]: value };

    if (field === 'itemId') {
      const itemMatch = itemsList.find((it) => it.id === value);
      if (itemMatch) {
        row.itemCode = itemMatch.code;
        row.itemName = itemMatch.name;
        row.unit = itemMatch.unit;
      }
    }

    row.total = computeRowTotal(
      Number(row.quantity),
      Number(row.rate),
      Number(row.discountPercent),
      Number(row.taxPercent)
    );
    updated[index] = row;
    setLineItems(updated);
  };

  // Add line item
  const addLineItem = () => {
    // Pick first unused item
    const usedIds = new Set(lineItems.map((l) => l.itemId));
    const available = itemsList.find((it) => !usedIds.has(it.id)) || itemsList[0];
    if (!available) return;

    setLineItems([
      ...lineItems,
      {
        itemId: available.id,
        itemCode: available.code,
        itemName: available.name,
        unit: available.unit,
        quantity: 1,
        rate: 50,
        discountPercent: 0,
        taxPercent: 18,
        total: 59,
      },
    ]);
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) {
      setCreateError('A Purchase Order must contain at least one line item.');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
    setCreateError('');
  };

  // Compute PO Totals
  const subtotal = lineItems.reduce((sum, line) => sum + (line.quantity * line.rate), 0);
  const totalDiscount = lineItems.reduce((sum, line) => sum + (line.quantity * line.rate * (line.discountPercent / 100)), 0);
  const grandTotal = lineItems.reduce((sum, line) => sum + line.total, 0);
  const totalTax = grandTotal - (subtotal - totalDiscount);

  // Submit PO
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!formPartyId) {
      setCreateError('Please select a Supplier/Party.');
      return;
    }
    if (!formStoreId) {
      setCreateError('Please select a Store destination.');
      return;
    }
    if (lineItems.length === 0) {
      setCreateError('Add at least one line item.');
      return;
    }

    // Check for duplicates
    const itemIds = lineItems.map((l) => l.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      setCreateError('Duplicate items detected. Each item may only appear once per Purchase Order.');
      return;
    }

    // Check quantities and rates
    for (const item of lineItems) {
      if (!item.quantity || item.quantity <= 0) {
        setCreateError('All item quantities must be greater than 0.');
        return;
      }
      if (item.rate < 0) {
        setCreateError('Rates cannot be negative.');
        return;
      }
    }

    setCreateLoading(true);
    const payload = {
      partyId: formPartyId,
      storeId: formStoreId,
      expectedDelivery: formExpectedDelivery || undefined,
      notes: formNotes || undefined,
      items: lineItems.map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discountPercent: Number(l.discountPercent) || 0,
        taxPercent: Number(l.taxPercent) || 0,
      })),
    };

    const res = await apiRequest('/store/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setCreateLoading(false);
    if (res.success) {
      setIsCreateOpen(false);
      fetchPOs();
    } else {
      setCreateError(res.message || 'Failed to create Purchase Order.');
    }
  };

  // View PO details
  const handleViewDetails = async (poId: string) => {
    const res = await apiRequest(`/store/purchase-orders/${poId}`);
    if (res.success && res.data) {
      setViewingPO(res.data);
    }
  };

  // Update PO Status (Approve / Cancel)
  const handleUpdateStatus = async (poId: string, newStatus: string) => {
    setActionLoading(true);
    const res = await apiRequest(`/store/purchase-orders/${poId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    setActionLoading(false);
    if (res.success) {
      if (viewingPO && viewingPO.id === poId) {
        setViewingPO({ ...viewingPO, status: newStatus });
      }
      fetchPOs();
    }
  };

  // Status Badge Mapper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="info">Partially Received</Badge>;
      case 'RECEIVED':
        return <Badge variant="primary">Received</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Filtered POs
  const filteredPOs = pos.filter((po) => {
    const term = searchQuery.toLowerCase();
    const poNum = po.poNumber?.toLowerCase() || '';
    const partyName = po.party?.name?.toLowerCase() || '';
    const storeName = po.store?.name?.toLowerCase() || '';
    return poNum.includes(term) || partyName.includes(term) || storeName.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>STORE MANAGEMENT</span>
            <span>/</span>
            <span className="text-blue-600">PO MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and track supplier procurement purchase orders, tax calculations, and fulfillment status
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenCreate}>
            Create Purchase Order
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by PO Number or Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="RECEIVED">Received</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{filteredPOs.length} Orders</span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier / Party</TableHead>
                <TableHead>Store Destination</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2" />
                    Loading purchase orders from database...
                  </TableCell>
                </TableRow>
              ) : filteredPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    No purchase orders found matching the filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">
                      {po.poNumber}
                    </TableCell>
                    <TableCell>{new Date(po.poDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-slate-800">
                      <div>{po.party?.name || '—'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{po.party?.code}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">{po.store?.name || '—'}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-600">
                        {po.items?.length || 0} line item{(po.items?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-slate-900">
                      ₹ {Number(po.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(po.id)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
                        {po.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                            onClick={() => handleUpdateStatus(po.id, 'APPROVED')}
                            icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE PURCHASE ORDER MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Purchase Order"
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Total Order Value: <span className="font-bold text-slate-900 font-mono text-sm ml-1">₹ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSubmit}
                loading={createLoading}
              >
                Save &amp; Approve Order
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center justify-between">
              <span>{createError}</span>
              <button type="button" onClick={() => setCreateError('')} className="font-bold text-red-700">✕</button>
            </div>
          )}

          {/* Header Row: Supplier & Store */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier / Vendor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={formPartyId}
                  onChange={(e) => setFormPartyId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Store <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Store</option>
                  {storesList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Delivery Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={formExpectedDelivery}
                  onChange={(e) => setFormExpectedDelivery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase Order Remarks / Terms
            </label>
            <input
              type="text"
              placeholder="e.g., Immediate dispatch required. Payment terms: 30 days net."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Line Items Section */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Line Items</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLineItem}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Item Line
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-48">Item</th>
                    <th className="p-2.5 w-24">Quantity</th>
                    <th className="p-2.5 w-20">Unit</th>
                    <th className="p-2.5 w-28">Unit Rate (₹)</th>
                    <th className="p-2.5 w-20">Disc %</th>
                    <th className="p-2.5 w-24">Tax % (GST)</th>
                    <th className="p-2.5 w-28 text-right">Line Total (₹)</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-2">
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {itemsList.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} - {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        />
                      </td>
                      <td className="p-2 text-slate-500 font-medium">{line.unit || 'PCS'}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.rate}
                          onChange={(e) => updateLine(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={line.discountPercent}
                          onChange={(e) => updateLine(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={line.taxPercent}
                          onChange={(e) => updateLine(idx, 'taxPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-slate-800">
                        ₹ {line.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary Box */}
            <div className="mt-4 flex justify-end">
              <div className="w-72 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹ {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Discount:</span>
                  <span className="font-mono text-emerald-600">- ₹ {totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax Amount:</span>
                  <span className="font-mono">₹ {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-600">₹ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* VIEW PO DETAILS MODAL */}
      <Modal
        isOpen={Boolean(viewingPO)}
        onClose={() => setViewingPO(null)}
        title={viewingPO ? `Purchase Order: ${viewingPO.poNumber}` : 'PO Details'}
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {viewingPO?.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="primary"
                  loading={actionLoading}
                  onClick={() => handleUpdateStatus(viewingPO.id, 'APPROVED')}
                  icon={<CheckCircle className="w-3.5 h-3.5" />}
                >
                  Approve Order
                </Button>
              )}
              {(viewingPO?.status === 'PENDING' || viewingPO?.status === 'APPROVED') && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={actionLoading}
                  onClick={() => handleUpdateStatus(viewingPO.id, 'CANCELLED')}
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  icon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Cancel Order
                </Button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setViewingPO(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewingPO && (
          <div className="space-y-6">
            {/* Header info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Supplier</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{viewingPO.party?.name}</span>
                <span className="text-xs text-slate-500 font-mono block">Code: {viewingPO.party?.code}</span>
                {viewingPO.party?.phone && <span className="text-xs text-slate-500 block">Phone: {viewingPO.party?.phone}</span>}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Destination Store</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{viewingPO.store?.name}</span>
                <span className="text-xs text-slate-500 font-mono block">Code: {viewingPO.store?.code}</span>
                {viewingPO.store?.location && <span className="text-xs text-slate-500 block">Location: {viewingPO.store?.location}</span>}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Order Meta</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Status:</span>
                  {getStatusBadge(viewingPO.status)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  PO Date: <span className="font-semibold text-slate-700">{new Date(viewingPO.poDate).toLocaleDateString()}</span>
                </div>
                {viewingPO.expectedDelivery && (
                  <div className="text-xs text-slate-500">
                    Delivery: <span className="font-semibold text-slate-700">{new Date(viewingPO.expectedDelivery).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {viewingPO.notes && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                <span className="font-semibold">Notes:</span> {viewingPO.notes}
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Ordered Items &amp; Fulfillment</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-right">Ordered</th>
                      <th className="p-2.5 text-right">Unit Rate (₹)</th>
                      <th className="p-2.5 text-right">Disc %</th>
                      <th className="p-2.5 text-right">Tax %</th>
                      <th className="p-2.5 text-right">Total (₹)</th>
                      <th className="p-2.5 text-right">Received</th>
                      <th className="p-2.5 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPO.items?.map((line: any) => {
                      const remaining = Math.max(0, line.quantity - line.receivedQty);
                      return (
                        <tr key={line.id}>
                          <td className="p-2.5 font-mono font-semibold text-blue-600">{line.item?.code}</td>
                          <td className="p-2.5 font-medium text-slate-800">{line.item?.name}</td>
                          <td className="p-2.5 text-right font-mono font-semibold">{line.quantity} {line.item?.unit}</td>
                          <td className="p-2.5 text-right font-mono">₹ {line.rate}</td>
                          <td className="p-2.5 text-right font-mono">{line.discountPercent}%</td>
                          <td className="p-2.5 text-right font-mono">{line.taxPercent}%</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹ {line.total.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-600 font-semibold">{line.receivedQty}</td>
                          <td className="p-2.5 text-right font-mono text-amber-600 font-semibold">{remaining}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total breakdown */}
            <div className="flex justify-end">
              <div className="w-64 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹ {Number(viewingPO.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span className="font-mono text-emerald-600">- ₹ {Number(viewingPO.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax Amount:</span>
                  <span className="font-mono">₹ {Number(viewingPO.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-600">₹ {Number(viewingPO.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Inward history */}
            {viewingPO.materialInwards && viewingPO.materialInwards.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Material Inwards Against This PO</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Inward No</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Challan Reference</th>
                        <th className="p-2.5">Items Inwarded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPO.materialInwards.map((inw: any) => (
                        <tr key={inw.id}>
                          <td className="p-2.5 font-mono font-bold text-emerald-600">{inw.inwardNumber}</td>
                          <td className="p-2.5">{new Date(inw.inwardDate).toLocaleDateString()}</td>
                          <td className="p-2.5 font-mono">{inw.referenceNumber || '—'}</td>
                          <td className="p-2.5">{inw.items?.length || 0} line items</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus, Search, Eye, AlertTriangle, CheckCircle, PackageCheck, FileText, Calendar, Building2, Store } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';

interface InwardItemRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  remainingAllowed: number;
  receivedQty: number;
  rejectedQty: number;
  acceptedQty: number;
  rate: number;
  remarks: string;
}

export const MaterialInwardPage: React.FC = () => {
  const [inwards, setInwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // POs available for inward (APPROVED or PARTIALLY_RECEIVED)
  const [availablePOs, setAvailablePOs] = useState<any[]>([]);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [inwardDate, setInwardDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [inwardItems, setInwardItems] = useState<InwardItemRow[]>([]);

  // View Details Modal state
  const [viewingInward, setViewingInward] = useState<any | null>(null);

  // Fetch Inwards
  const fetchInwards = async () => {
    setLoading(true);
    const res = await apiRequest('/store/material-inwards');
    if (res.success && res.data) {
      setInwards(res.data);
    }
    setLoading(false);
  };

  // Fetch Available POs
  const fetchAvailablePOs = async () => {
    const res = await apiRequest('/store/purchase-orders');
    if (res.success && res.data) {
      // Filter POs that can be inwarded (APPROVED or PARTIALLY_RECEIVED)
      const eligible = res.data.filter(
        (p: any) => p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED'
      );
      setAvailablePOs(eligible);
    }
  };

  useEffect(() => {
    fetchInwards();
    fetchAvailablePOs();
  }, []);

  // Handle PO Selection in Create Inward Modal
  const handleSelectPO = async (poId: string) => {
    setSelectedPoId(poId);
    setCreateError('');
    if (!poId) {
      setSelectedPo(null);
      setInwardItems([]);
      return;
    }

    const res = await apiRequest(`/store/purchase-orders/${poId}`);
    if (res.success && res.data) {
      const po = res.data;
      setSelectedPo(po);

      // Build rows for each PO item with pending quantities
      const rows: InwardItemRow[] = po.items.map((pi: any) => {
        const remaining = Math.max(0, pi.quantity - pi.receivedQty);
        return {
          itemId: pi.itemId,
          itemCode: pi.item?.code || '',
          itemName: pi.item?.name || '',
          unit: pi.item?.unit || 'PCS',
          orderedQty: pi.quantity,
          previouslyReceivedQty: pi.receivedQty,
          remainingAllowed: remaining,
          receivedQty: remaining,
          rejectedQty: 0,
          acceptedQty: remaining,
          rate: pi.rate,
          remarks: 'QC Passed - Inward to Store',
        };
      });

      setInwardItems(rows);
    }
  };

  // Handle Row Quantity Changes
  const updateRowQty = (
    index: number,
    field: 'receivedQty' | 'rejectedQty' | 'acceptedQty' | 'remarks',
    value: any
  ) => {
    const updated = [...inwardItems];
    const row = { ...updated[index] };

    if (field === 'remarks') {
      row.remarks = value;
    } else {
      const numVal = Math.max(0, parseFloat(value) || 0);

      if (field === 'receivedQty') {
        row.receivedQty = numVal;
        // Auto adjust accepted
        row.acceptedQty = Math.max(0, numVal - row.rejectedQty);
      } else if (field === 'rejectedQty') {
        row.rejectedQty = numVal;
        // Auto adjust accepted
        row.acceptedQty = Math.max(0, row.receivedQty - numVal);
      } else if (field === 'acceptedQty') {
        row.acceptedQty = numVal;
      }
    }

    updated[index] = row;
    setInwardItems(updated);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setSelectedPoId('');
    setSelectedPo(null);
    setReferenceNumber('');
    setInwardDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setInwardItems([]);
    setCreateError('');
    setIsCreateOpen(true);
  };

  // Submit Inward
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!selectedPoId) {
      setCreateError('Please select a Purchase Order to receive material against.');
      return;
    }

    if (inwardItems.length === 0) {
      setCreateError('No items found in selected Purchase Order.');
      return;
    }

    // Strict validation
    for (const item of inwardItems) {
      if (item.acceptedQty < 0 || item.receivedQty < 0 || item.rejectedQty < 0) {
        setCreateError(`Quantities cannot be negative for ${item.itemName}.`);
        return;
      }

      if (item.acceptedQty + item.rejectedQty > item.receivedQty) {
        setCreateError(
          `Accepted (${item.acceptedQty}) + Rejected (${item.rejectedQty}) cannot exceed Received (${item.receivedQty}) for ${item.itemName}.`
        );
        return;
      }

      if (item.acceptedQty > item.remainingAllowed) {
        setCreateError(
          `Over-receiving prevented: Accepted quantity (${item.acceptedQty}) exceeds remaining allowed (${item.remainingAllowed}) for ${item.itemName}.`
        );
        return;
      }
    }

    // Ensure at least some items are accepted or received
    const totalAccepted = inwardItems.reduce((sum, it) => sum + it.acceptedQty, 0);
    const totalReceived = inwardItems.reduce((sum, it) => sum + it.receivedQty, 0);

    if (totalReceived === 0) {
      setCreateError('Total received quantity must be greater than 0.');
      return;
    }

    setCreateLoading(true);
    const payload = {
      poId: selectedPoId,
      inwardDate,
      referenceNumber: referenceNumber || undefined,
      remarks: remarks || undefined,
      items: inwardItems
        .filter((it) => it.receivedQty > 0)
        .map((it) => ({
          itemId: it.itemId,
          receivedQty: it.receivedQty,
          rejectedQty: it.rejectedQty,
          acceptedQty: it.acceptedQty,
          rate: it.rate,
          remarks: it.remarks || undefined,
        })),
    };

    const res = await apiRequest('/store/material-inwards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setCreateLoading(false);
    if (res.success) {
      setIsCreateOpen(false);
      fetchInwards();
      fetchAvailablePOs(); // Refresh PO eligibility
    } else {
      setCreateError(res.message || 'Failed to create Material Inward.');
    }
  };

  // View Inward Details
  const handleViewInward = async (inwId: string) => {
    const res = await apiRequest(`/store/material-inwards/${inwId}`);
    if (res.success && res.data) {
      setViewingInward(res.data);
    }
  };

  // Filter inwards
  const filteredInwards = inwards.filter((inw) => {
    const term = searchQuery.toLowerCase();
    const inwNum = inw.inwardNumber?.toLowerCase() || '';
    const poNum = inw.purchaseOrder?.poNumber?.toLowerCase() || '';
    const partyName = inw.party?.name?.toLowerCase() || '';
    const refNum = inw.referenceNumber?.toLowerCase() || '';
    return inwNum.includes(term) || poNum.includes(term) || partyName.includes(term) || refNum.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>STORE MANAGEMENT</span>
            <span>/</span>
            <span className="text-blue-600">MATERIAL INWARD (GRN)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Inward</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record physical material receipt, quality inspection (QC), and warehouse bin allocation against approved POs
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenCreate}>
            New Material Inward (GRN)
          </Button>
        </div>
      </div>

      {/* Main List Table */}
      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Inward #, PO #, Challan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{filteredInwards.length} Inward Records</span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inward Number</TableHead>
                <TableHead>Inward Date</TableHead>
                <TableHead>PO Reference</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Destination Store</TableHead>
                <TableHead>Challan / Ref</TableHead>
                <TableHead>Items Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2" />
                    Loading material inward records from database...
                  </TableCell>
                </TableRow>
              ) : filteredInwards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    No material inward records found. Click &apos;New Material Inward&apos; to record a delivery against an approved PO.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInwards.map((inw) => (
                  <TableRow key={inw.id}>
                    <TableCell className="font-mono text-xs font-bold text-emerald-600">
                      {inw.inwardNumber}
                    </TableCell>
                    <TableCell>{new Date(inw.inwardDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs text-blue-600 font-semibold">
                      {inw.purchaseOrder?.poNumber || 'Direct'}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {inw.party?.name || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">{inw.store?.name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {inw.referenceNumber || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-slate-700">
                        {inw.items?.length || 0} line item{(inw.items?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewInward(inw.id)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE MATERIAL INWARD MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Material Inward (Goods Receipt Note)"
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              {inwardItems.length > 0 && (
                <span>
                  Total Accepted: <strong className="text-emerald-600 font-mono">{inwardItems.reduce((s, r) => s + r.acceptedQty, 0)} items</strong> |
                  Rejected: <strong className="text-red-500 font-mono">{inwardItems.reduce((s, r) => s + r.rejectedQty, 0)} items</strong>
                </span>
              )}
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
                disabled={!selectedPoId || inwardItems.length === 0}
                icon={<PackageCheck className="w-3.5 h-3.5" />}
              >
                Accept &amp; Update Stock
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{createError}</span>
              </div>
              <button type="button" onClick={() => setCreateError('')} className="font-bold text-red-700">✕</button>
            </div>
          )}

          {/* Select Purchase Order */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Purchase Order to Inward Against <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedPoId}
                onChange={(e) => handleSelectPO(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              >
                <option value="">-- Choose an Approved Purchase Order --</option>
                {availablePOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — Supplier: {po.party?.name} ({po.status}) — Store: {po.store?.name}
                  </option>
                ))}
              </select>
            </div>
            {availablePOs.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No approved purchase orders with pending items available. Please create or approve a PO first.
              </p>
            )}
          </div>

          {/* PO Metadata summary & delivery fields */}
          {selectedPo && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Supplier</span>
                  <span className="font-bold text-slate-800">{selectedPo.party?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Destination Store</span>
                  <span className="font-bold text-slate-800">{selectedPo.store?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">PO Total</span>
                  <span className="font-bold font-mono text-slate-800">₹ {Number(selectedPo.totalAmount).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">PO Status</span>
                  <Badge variant="info">{selectedPo.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Date</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={inwardDate}
                      onChange={(e) => setInwardDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Challan / Invoice Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., DC-88219 or INV-2026-99"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">General Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g., Received in good physical condition"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Inward Table */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Quality Inspection &amp; Material Receipt Line Items
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Rule: <strong className="text-emerald-600 font-mono">Accepted = Received - Rejected</strong> (Strict over-receiving prevention active)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-right">Ordered</th>
                        <th className="p-2.5 text-right">Remaining Allowed</th>
                        <th className="p-2.5 text-right w-24">Received Qty</th>
                        <th className="p-2.5 text-right w-24">Rejected Qty</th>
                        <th className="p-2.5 text-right w-24 bg-emerald-50/50 text-emerald-800">Accepted Qty</th>
                        <th className="p-2.5 w-44">QC Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inwardItems.map((item, idx) => {
                        const isOver = item.acceptedQty > item.remainingAllowed;
                        return (
                          <tr key={item.itemId} className={`hover:bg-slate-50/50 ${isOver ? 'bg-red-50/50' : ''}`}>
                            <td className="p-2.5">
                              <div className="font-semibold text-slate-800">{item.itemName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.itemCode}</div>
                            </td>
                            <td className="p-2.5 text-right font-mono">{item.orderedQty} {item.unit}</td>
                            <td className="p-2.5 text-right font-mono font-semibold text-blue-600">
                              {item.remainingAllowed} {item.unit}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingAllowed * 2}
                                step="any"
                                value={item.receivedQty}
                                onChange={(e) => updateRowQty(idx, 'receivedQty', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.rejectedQty}
                                onChange={(e) => updateRowQty(idx, 'rejectedQty', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-right font-mono text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-2.5 bg-emerald-50/50">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingAllowed}
                                step="any"
                                value={item.acceptedQty}
                                onChange={(e) => updateRowQty(idx, 'acceptedQty', e.target.value)}
                                className={`w-full px-2 py-1 text-xs font-bold bg-white border rounded text-right font-mono focus:outline-none focus:ring-1 ${
                                  isOver ? 'border-red-500 text-red-600 ring-1 ring-red-400' : 'border-emerald-300 text-emerald-700'
                                }`}
                              />
                              {isOver && (
                                <span className="text-[10px] text-red-600 font-semibold block text-right mt-0.5">
                                  Exceeds remaining!
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.remarks}
                                onChange={(e) => updateRowQty(idx, 'remarks', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* VIEW INWARD DETAILS MODAL */}
      <Modal
        isOpen={Boolean(viewingInward)}
        onClose={() => setViewingInward(null)}
        title={viewingInward ? `Material Inward: ${viewingInward.inwardNumber}` : 'Inward Details'}
        size="4xl"
        footer={
          <Button size="sm" variant="outline" onClick={() => setViewingInward(null)}>
            Close
          </Button>
        }
      >
        {viewingInward && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">PO Number</span>
                <span className="font-bold font-mono text-blue-600 text-sm">
                  {viewingInward.purchaseOrder?.poNumber || 'Direct Inward'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Supplier</span>
                <span className="font-bold text-slate-800">{viewingInward.party?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Destination Store</span>
                <span className="font-bold text-slate-800">{viewingInward.store?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Challan / Ref</span>
                <span className="font-mono text-slate-700">{viewingInward.referenceNumber || '—'}</span>
              </div>
            </div>

            {viewingInward.remarks && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <strong>Remarks:</strong> {viewingInward.remarks}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Inward Items &amp; QC Breakdown
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-right">Received Qty</th>
                      <th className="p-2.5 text-right text-red-600">Rejected Qty</th>
                      <th className="p-2.5 text-right text-emerald-700 bg-emerald-50/50">Accepted Qty</th>
                      <th className="p-2.5 text-right">Unit Rate (₹)</th>
                      <th className="p-2.5">QC Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingInward.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-mono font-semibold text-blue-600">{item.item?.code}</td>
                        <td className="p-2.5 font-medium text-slate-800">{item.item?.name}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">{item.receivedQty} {item.item?.unit}</td>
                        <td className="p-2.5 text-right font-mono text-red-600 font-semibold">{item.rejectedQty}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600 bg-emerald-50/50">
                          {item.acceptedQty} {item.item?.unit}
                        </td>
                        <td className="p-2.5 text-right font-mono">₹ {item.rate || 0}</td>
                        <td className="p-2.5 text-slate-600">{item.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Inventory stock levels have been automatically updated for all accepted line item quantities.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

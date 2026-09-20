import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  CheckCircle,
  XCircle,
  Building2,
  RefreshCw,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import apiRequest from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { Link } from 'react-router-dom';

interface Party {
  id: string;
  code: string;
  name: string;
  type: string;
  mobile?: string;
  alternateMobile?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openingBalance: number;
  openingBalanceType: string;
  creditLimit: number;
  creditDays: number;
  paymentTerms?: string;
  storeId?: string;
  status: string;
  notes?: string;
  balance?: number;
  balanceType?: string;
  formattedBalance?: string;
  store?: {
    id: string;
    code: string;
    name: string;
  };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const PartyMasterPage: React.FC = () => {
  const { availableStores } = useStore();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 15, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const initialFormData = {
    code: '',
    name: '',
    type: 'SUPPLIER',
    mobile: '',
    alternateMobile: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    openingBalance: 0,
    openingBalanceType: 'CREDIT',
    creditLimit: 0,
    creditDays: 30,
    paymentTerms: '30 Days',
    storeId: '',
    status: 'ACTIVE',
    notes: '',
  };
  const [formData, setFormData] = useState(initialFormData);

  // Fetch Parties
  const fetchParties = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', meta.limit.toString());
    if (search.trim()) params.set('search', search.trim());
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (storeFilter !== 'ALL') params.set('storeId', storeFilter);

    const res = await apiRequest<{ parties?: Party[]; data?: Party[]; meta?: PaginationMeta }>(
      `/accounts/parties?${params.toString()}`
    );

    if (res.success) {
      const items = Array.isArray(res.data) ? res.data : [];
      setParties(items);
      if (res.meta) {
        setMeta(res.meta);
      }
    }
    setLoading(false);
  }, [search, typeFilter, statusFilter, storeFilter, meta.limit]);

  useEffect(() => {
    fetchParties(1);
  }, [fetchParties]);

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData(initialFormData);
    setFormError(null);
    setIsAddOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (party: Party) => {
    setSelectedParty(party);
    setFormData({
      code: party.code || '',
      name: party.name || '',
      type: party.type || 'SUPPLIER',
      mobile: party.mobile || '',
      alternateMobile: party.alternateMobile || '',
      phone: party.phone || '',
      email: party.email || '',
      gstin: party.gstin || '',
      pan: party.pan || '',
      address: party.address || '',
      city: party.city || '',
      state: party.state || '',
      pincode: party.pincode || '',
      openingBalance: party.openingBalance ?? 0,
      openingBalanceType: party.openingBalanceType || 'CREDIT',
      creditLimit: party.creditLimit ?? 0,
      creditDays: party.creditDays ?? 30,
      paymentTerms: party.paymentTerms || '30 Days',
      storeId: party.storeId || '',
      status: party.status || 'ACTIVE',
      notes: party.notes || '',
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  // Open View Modal
  const handleOpenView = (party: Party) => {
    setSelectedParty(party);
    setIsViewOpen(true);
  };

  // Submit Add Party
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Party Name is required.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      ...formData,
      code: formData.code.trim() || undefined,
      storeId: formData.storeId || undefined,
      openingBalance: Number(formData.openingBalance) || 0,
      creditLimit: Number(formData.creditLimit) || 0,
      creditDays: Number(formData.creditDays) || 30,
    };

    const res = await apiRequest('/accounts/parties', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setFormSubmitting(false);
    if (res.success) {
      setIsAddOpen(false);
      fetchParties(meta.page);
    } else {
      setFormError(res.message || 'Failed to create party.');
    }
  };

  // Submit Edit Party
  const handleUpdateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    if (!formData.name.trim()) {
      setFormError('Party Name is required.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      ...formData,
      storeId: formData.storeId || null,
      openingBalance: Number(formData.openingBalance) || 0,
      creditLimit: Number(formData.creditLimit) || 0,
      creditDays: Number(formData.creditDays) || 30,
    };

    const res = await apiRequest(`/accounts/parties/${selectedParty.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    setFormSubmitting(false);
    if (res.success) {
      setIsEditOpen(false);
      fetchParties(meta.page);
    } else {
      setFormError(res.message || 'Failed to update party.');
    }
  };

  // Toggle Status
  const handleToggleStatus = async (party: Party) => {
    const newStatus = party.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = await apiRequest(`/accounts/parties/${party.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.success) {
      fetchParties(meta.page);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PARTY MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Party Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Suppliers, Customers, GSTIN details, credit limits, stores, and running ledger balances
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => fetchParties(meta.page)}
          >
            Refresh
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenAdd}>
            Add Party
          </Button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search code, name, mobile, GSTIN..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">All Party Types</option>
                <option value="SUPPLIER">Suppliers (Creditors)</option>
                <option value="CUSTOMER">Customers (Debtors)</option>
                <option value="DEALER">Dealers</option>
                <option value="DISTRIBUTOR">Distributors</option>
                <option value="BOTH">Both (Dual Role)</option>
              </select>
            </div>

            {/* Store Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Store:</span>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">All Stores</option>
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Party Master Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Party Directory</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {meta.total} Records
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Per page:</span>
            <select
              value={meta.limit}
              onChange={(e) => {
                setMeta((prev) => ({ ...prev, limit: Number(e.target.value) }));
              }}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white font-medium"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party Code</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading party master records from database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : parties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No parties found matching your search and filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  parties.map((party) => {
                    const balanceAmount = party.balance ?? party.openingBalance ?? 0;
                    const balanceType = party.balanceType ?? party.openingBalanceType ?? 'DEBIT';
                    const isDebit = balanceType === 'DEBIT';

                    return (
                      <TableRow key={party.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Party Code */}
                        <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                          {party.code}
                        </TableCell>

                        {/* Party Name */}
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">{party.name}</div>
                          {party.gstin && (
                            <div className="text-[10px] font-mono text-slate-400 tracking-wider">
                              GST: {party.gstin}
                            </div>
                          )}
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          <Badge
                            variant={
                              party.type === 'SUPPLIER'
                                ? 'info'
                                : party.type === 'CUSTOMER'
                                ? 'success'
                                : 'neutral'
                            }
                          >
                            {party.type}
                          </Badge>
                        </TableCell>

                        {/* Mobile */}
                        <TableCell className="text-xs text-slate-600 font-mono whitespace-nowrap">
                          {party.mobile || party.phone || <span className="text-slate-300">—</span>}
                        </TableCell>

                        {/* Store */}
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {party.store?.name ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{party.store.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">All Stores</span>
                          )}
                        </TableCell>

                        {/* Balance */}
                        <TableCell className="text-right whitespace-nowrap">
                          <span
                            className={`font-mono text-xs font-bold ${
                              isDebit ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            ₹ {balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span
                            className={`ml-1 text-[10px] font-bold px-1 py-0.2 rounded ${
                              isDebit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isDebit ? 'Dr' : 'Cr'}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge variant={party.status === 'ACTIVE' ? 'success' : 'error'}>
                            {party.status}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenView(party)}
                              title="View Party Details"
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(party)}
                              title="Edit Party"
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              to={`/accounts/ledger?partyId=${party.id}`}
                              title="View Ledger Statement"
                              className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleToggleStatus(party)}
                              title={party.status === 'ACTIVE' ? 'Deactivate Party' : 'Activate Party'}
                              className={`p-1 rounded transition-colors ${
                                party.status === 'ACTIVE'
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {party.status === 'ACTIVE' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page <span className="font-bold text-slate-700">{meta.page}</span> of{' '}
              <span className="font-bold text-slate-700">{meta.totalPages || 1}</span> ({meta.total} total parties)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page <= 1 || loading}
                onClick={() => fetchParties(meta.page - 1)}
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page >= meta.totalPages || loading}
                onClick={() => fetchParties(meta.page + 1)}
                icon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================
          ADD PARTY MODAL
      ======================================================== */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Party Master Record"
        size="2xl"
      >
        <form onSubmit={handleCreateParty} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Party Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Apex Industrial Supplies Pvt Ltd"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Party Code (Optional)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Auto-generated if blank (e.g. PRT-SUP-0010)"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Party Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SUPPLIER">SUPPLIER (Creditor)</option>
                <option value="CUSTOMER">CUSTOMER (Debtor)</option>
                <option value="DEALER">DEALER</option>
                <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                <option value="BOTH">BOTH (Supplier & Customer)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Associated Store</label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Global / All Stores</option>
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="accounts@vendor.com"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                maxLength={15}
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="07AAAAA0000A1Z5"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
              <input
                type="text"
                maxLength={10}
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                placeholder="AAAAA0000A"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.openingBalanceType}
                  onChange={(e) => setFormData({ ...formData, openingBalanceType: e.target.value })}
                  className="w-24 text-xs px-2 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="CREDIT">Cr (Payable)</option>
                  <option value="DEBIT">Dr (Receivable)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Credit Limit (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                placeholder="500000"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Credit Days</label>
              <input
                type="number"
                min="0"
                value={formData.creditDays}
                onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address & Location</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Plot No., Industrial Area, City, State..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={formSubmitting}>
              {formSubmitting ? 'Saving Party...' : 'Save Party Master'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          EDIT PARTY MODAL
      ======================================================== */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Party: ${selectedParty?.name || ''}`}
        size="2xl"
      >
        <form onSubmit={handleUpdateParty} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Party Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Party Code</label>
              <input
                type="text"
                disabled
                value={formData.code}
                className="w-full text-xs px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg font-mono text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Party Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SUPPLIER">SUPPLIER (Creditor)</option>
                <option value="CUSTOMER">CUSTOMER (Debtor)</option>
                <option value="DEALER">DEALER</option>
                <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                <option value="BOTH">BOTH (Supplier & Customer)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Associated Store</label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Global / All Stores</option>
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                maxLength={15}
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
              <input
                type="text"
                maxLength={10}
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Credit Limit (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Credit Days</label>
              <input
                type="number"
                min="0"
                value={formData.creditDays}
                onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 30 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={formSubmitting}>
              {formSubmitting ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          VIEW PARTY MODAL
      ======================================================== */}
      <Modal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title="Party Profile & Financial Overview"
        size="lg"
      >
        {selectedParty && (
          <div className="space-y-5">
            {/* Header profile banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">{selectedParty.code}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedParty.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedParty.type === 'SUPPLIER' ? 'info' : 'success'}>
                    {selectedParty.type}
                  </Badge>
                  <Badge variant={selectedParty.status === 'ACTIVE' ? 'success' : 'error'}>
                    {selectedParty.status}
                  </Badge>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Balance</span>
                <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  ₹ {(selectedParty.balance ?? selectedParty.openingBalance ?? 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-xs text-blue-600 font-bold">
                    {selectedParty.balanceType || selectedParty.openingBalanceType}
                  </span>
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Contact Details</h4>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mobile: {selectedParty.mobile || selectedParty.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email: {selectedParty.email || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Store: {selectedParty.store?.name || 'All Stores / Global'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Tax & Compliance</h4>
                <div>
                  <span className="text-slate-500">GSTIN:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{selectedParty.gstin || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">PAN:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{selectedParty.pan || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Credit Terms:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    ₹ {selectedParty.creditLimit?.toLocaleString('en-IN')} ({selectedParty.creditDays} Days)
                  </span>
                </div>
              </div>
            </div>

            {/* Address */}
            {selectedParty.address && (
              <div className="p-3.5 rounded-lg border border-slate-100 text-xs">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Address</h4>
                <p className="text-slate-600 leading-relaxed">{selectedParty.address}</p>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100">
              <Link to={`/accounts/ledger?partyId=${selectedParty.id}`} className="w-full sm:w-auto">
                <Button size="sm" variant="primary" icon={<BookOpen className="w-3.5 h-3.5" />}>
                  Open Full Ledger Statement
                </Button>
              </Link>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setIsViewOpen(false);
                    handleOpenEdit(selectedParty);
                  }}
                >
                  Edit Party
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsViewOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PartyMasterPage;

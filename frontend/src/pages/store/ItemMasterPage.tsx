import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Eye,
  Power,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import apiRequest from '../../services/api';

export const ItemMasterPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>({ page: 1, total: 0, totalPages: 1 });

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'currentStock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    brand: '',
    category: 'RAW_MATERIALS',
    unit: 'PCS',
    description: '',
    minStock: 10,
    maxStock: 500,
    reorderLevel: 20,
    currentStock: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search,
      category: categoryFilter,
      status: statusFilter,
      sortBy,
      sortOrder,
      page: page.toString(),
      limit: '10',
    });

    const res = await apiRequest(`/store/items?${params.toString()}`);
    if (res.success && res.data) {
      setItems(res.data);
      if (res.meta) setMeta(res.meta);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [search, categoryFilter, statusFilter, sortBy, sortOrder, page]);

  const handleOpenAdd = () => {
    setFormData({
      code: `ITM-${Date.now().toString().slice(-4)}`,
      name: '',
      brand: '',
      category: 'RAW_MATERIALS',
      unit: 'PCS',
      description: '',
      minStock: 10,
      maxStock: 500,
      reorderLevel: 20,
      currentStock: 0,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      brand: item.brand || '',
      category: item.category,
      unit: item.unit,
      description: item.description || '',
      minStock: item.minStock,
      maxStock: item.maxStock,
      reorderLevel: item.reorderLevel,
      currentStock: item.currentStock,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenView = async (item: any) => {
    const res = await apiRequest(`/store/items/${item.id}`);
    if (res.success && res.data) {
      setSelectedItem(res.data);
      setIsViewModalOpen(true);
    }
  };

  const handleToggleStatus = async (item: any) => {
    const res = await apiRequest(`/store/items/${item.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    if (res.success) {
      fetchItems();
    }
  };

  const handleSaveItem = async (e: React.FormEvent, isEdit = false) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const url = isEdit ? `/store/items/${selectedItem.id}` : '/store/items';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(formData),
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      fetchItems();
    } else {
      setFormError(res.message || 'Error saving item.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>MASTER DATA</span>
            <span>/</span>
            <span className="text-blue-600">ITEM MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Item Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD catalog for parts, raw materials, hardware, and inventory valuation specs
          </p>
        </div>
        <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenAdd}>
          Add New Item
        </Button>
      </div>

      {/* Filter and Control Bar */}
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by code, name, or brand..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="RAW_MATERIALS">Raw Materials</option>
              <option value="HARDWARE">Hardware</option>
              <option value="CONSUMABLES">Consumables</option>
              <option value="FASTENERS">Fasteners</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
            >
              <option value="name">Name</option>
              <option value="code">Code</option>
              <option value="currentStock">Current Stock</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Items Table */}
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Min / Reorder / Max</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    Loading items from PostgreSQL...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    No items found matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{item.code}</TableCell>
                    <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                    <TableCell className="text-slate-600 text-xs">{item.brand || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{item.unit}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {item.minStock} / <span className="font-semibold text-amber-600">{item.reorderLevel}</span> / {item.maxStock}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-900">{item.currentStock}</span>{' '}
                      <span className="text-xs text-slate-500">{item.unit}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'success' : 'error'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <button
                        onClick={() => handleOpenView(item)}
                        title="View Details"
                        className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Item"
                        className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(item)}
                        title={item.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-md ${
                          item.isActive
                            ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <span className="font-semibold text-slate-800">{items.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{meta.total}</span> total items
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-medium text-slate-700 px-2">
              Page {page} of {meta.totalPages || 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Item Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? `Edit Item: ${selectedItem?.code}` : 'Add New Inventory Item'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={isSubmitting}
              onClick={(e) => handleSaveItem(e, isEditModalOpen)}
            >
              {isEditModalOpen ? 'Save Changes' : 'Create Item'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => handleSaveItem(e, isEditModalOpen)} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Item Code *"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <Input
              label="Item Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g. Tata, SKF"
            />
            <Select
              label="Category *"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: 'RAW_MATERIALS', label: 'Raw Materials' },
                { value: 'HARDWARE', label: 'Hardware' },
                { value: 'CONSUMABLES', label: 'Consumables' },
                { value: 'FASTENERS', label: 'Fasteners' },
              ]}
            />
            <Select
              label="Unit of Measure *"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'PCS', label: 'Pieces (PCS)' },
                { value: 'KG', label: 'Kilograms (KG)' },
                { value: 'LTR', label: 'Liters (LTR)' },
                { value: 'MTR', label: 'Meters (MTR)' },
                { value: 'BOX', label: 'Boxes (BOX)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Min Stock"
              type="number"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
            />
            <Input
              label="Reorder Level"
              type="number"
              value={formData.reorderLevel}
              onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
            />
            <Input
              label="Max Stock"
              type="number"
              value={formData.maxStock}
              onChange={(e) => setFormData({ ...formData, maxStock: Number(e.target.value) })}
            />
          </div>

          {!isEditModalOpen && (
            <Input
              label="Initial Current Stock"
              type="number"
              value={formData.currentStock}
              onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description / Specs
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed technical specifications..."
            />
          </div>
        </form>
      </Modal>

      {/* View Item Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Item Specifications: ${selectedItem.code}`}
          footer={
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Product Name</p>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{selectedItem.name}</h4>
                <p className="text-slate-500">{selectedItem.brand || 'Unbranded'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Current Stock</p>
                <p className="text-xl font-black text-blue-600">
                  {selectedItem.currentStock} {selectedItem.unit}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 font-medium">Category:</span>
                <span className="font-semibold text-slate-800 ml-1.5">{selectedItem.category}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 font-medium">Reorder Alert:</span>
                <span className="font-semibold text-amber-600 ml-1.5">{selectedItem.reorderLevel} {selectedItem.unit}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 font-medium">Min Stock:</span>
                <span className="font-semibold text-slate-800 ml-1.5">{selectedItem.minStock} {selectedItem.unit}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 font-medium">Max Stock:</span>
                <span className="font-semibold text-slate-800 ml-1.5">{selectedItem.maxStock} {selectedItem.unit}</span>
              </div>
            </div>

            {selectedItem.description && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Specifications</p>
                <p className="text-slate-700 leading-relaxed">{selectedItem.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

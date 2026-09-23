import React, { useEffect, useState, useMemo } from 'react';
import {
  FileCheck,
  FileX,
  FilePlus,
  ArrowRight,
  Search,
  Filter,
  Calendar,
  Building2,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  Receipt,
  FileText,
  DollarSign,
  Truck,
  ShieldCheck,
  ChevronRight,
  Plus,
  CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Tabs } from '../../components/common/Tabs';
import apiRequest from '../../services/api';

export const PurchaseAccountsPage: React.FC = () => {
  // State: List View
  const [activeTab, setActiveTab] = useState<'all' | 'with-po' | 'without-po'>('all');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Supplier & Store options for filter dropdowns
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);

  // State: PO Selection Modal
  const [isSelectPOOpen, setIsSelectPOOpen] = useState(false);
  const [eligiblePOs, setEligiblePOs] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSearch, setPoSearch] = useState('');

  // State: Purchase Entry Modal (With PO)
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [loadingPODetail, setLoadingPODetail] = useState(false);
  const [selectedPODetail, setSelectedPODetail] = useState<any | null>(null);

  // Permitted Accounting Fields (Only these are editable)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [accountingNotes, setAccountingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

  // State: Direct Purchase Entry Modal (Without PO)
  const [isDirectPurchaseOpen, setIsDirectPurchaseOpen] = useState(false);
  const [directPartyId, setDirectPartyId] = useState('');
  const [directStoreId, setDirectStoreId] = useState('');
  const [directInvoiceNumber, setDirectInvoiceNumber] = useState('');
  const [directInvoiceDate, setDirectInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [directDueDate, setDirectDueDate] = useState('');
  const [directItemName, setDirectItemName] = useState('');
  const [directItemDescription, setDirectItemDescription] = useState('');
  const [directQuantity, setDirectQuantity] = useState<number>(1);
  const [directRate, setDirectRate] = useState<number>(0);
  const [directDiscountPercent, setDirectDiscountPercent] = useState<number>(0);
  const [directTaxPercent, setDirectTaxPercent] = useState<number>(18);
  const [directPaymentStatus, setDirectPaymentStatus] = useState<'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('UNPAID');
  const [directPaymentMethod, setDirectPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'UPI' | 'CHEQUE'>('BANK_TRANSFER');
  const [directPaidAmount, setDirectPaidAmount] = useState<number>(0);
  const [directReferenceNo, setDirectReferenceNo] = useState('');
  const [directNotes, setDirectNotes] = useState('');
  const [directIsSubmitting, setDirectIsSubmitting] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState<string | null>(null);

  // State: View Transaction Detail Modal
  const [viewingTxn, setViewingTxn] = useState<any | null>(null);

  // -------------------------------------------------------------
  // Load Purchases List
  // -------------------------------------------------------------
  const fetchPurchases = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== 'all') params.append('type', activeTab);
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedSupplier) params.append('supplierId', selectedSupplier);
    if (selectedStore) params.append('storeId', selectedStore);
    if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

    const qs = params.toString();
    const res = await apiRequest(`/accounts/purchases${qs ? `?${qs}` : ''}`);
    if (res.success && res.data) {
      setPurchases(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, [activeTab, searchQuery, startDate, endDate, selectedSupplier, selectedStore, selectedStatus]);

  // Load suppliers and stores for dropdown filters
  useEffect(() => {
    async function loadMetadata() {
      const partiesRes = await apiRequest('/accounts/parties?limit=100');
      if (partiesRes.success && partiesRes.data) {
        const sups = partiesRes.data.filter((p: any) => p.type === 'SUPPLIER' || p.type === 'BOTH');
        setSuppliersList(sups);
      }
      const storesRes = await apiRequest('/accounts/stores');
      if (storesRes.success && storesRes.data?.length) {
        setStoresList(storesRes.data);
      } else {
        const dashRes = await apiRequest('/accounts/dashboard-metrics');
        if (dashRes.success && dashRes.data?.recentTransactions) {
          const storesMap: Record<string, string> = {};
          dashRes.data.recentTransactions.forEach((t: any) => {
            if (t.store) storesMap[t.store.id] = t.store.name;
          });
          setStoresList(Object.entries(storesMap).map(([id, name]) => ({ id, name })));
        }
      }
    }
    loadMetadata();
  }, []);

  // -------------------------------------------------------------
  // Load Eligible POs for Selection
  // -------------------------------------------------------------
  const openPOSelectionModal = async () => {
    setIsSelectPOOpen(true);
    setLoadingPOs(true);
    const res = await apiRequest('/accounts/purchases/eligible-pos');
    if (res.success && res.data) {
      setEligiblePOs(res.data);
    }
    setLoadingPOs(false);
  };

  const filteredEligiblePOs = useMemo(() => {
    if (!poSearch.trim()) return eligiblePOs;
    const q = poSearch.toLowerCase();
    return eligiblePOs.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.supplier?.name.toLowerCase().includes(q) ||
        po.store?.name.toLowerCase().includes(q)
    );
  }, [eligiblePOs, poSearch]);

  // -------------------------------------------------------------
  // Select PO and Load Actual PO Data (No manual duplication)
  // -------------------------------------------------------------
  const handleSelectPO = async (poId: string) => {
    setLoadingPODetail(true);
    setIsSelectPOOpen(false);
    setIsEntryOpen(true);
    setEntryError(null);
    setEntrySuccess(null);

    const res = await apiRequest(`/accounts/purchases/eligible-pos/${poId}`);
    if (res.success && res.data) {
      const d = res.data;
      setSelectedPODetail(d);

      // Auto-populate default permitted accounting fields
      const todayStr = new Date().toISOString().split('T')[0];
      setInvoiceDate(todayStr);

      // Calculate default due date based on supplier credit days
      const days = d.supplier.creditDays || 30;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      setDueDate(targetDate.toISOString().split('T')[0]);

      // Generate suggested invoice number prefix if desired
      setInvoiceNumber(`INV-${d.po.poNumber.replace('PO-', '')}`);
      setAccountingNotes(`Billed against ${d.po.poNumber} (${d.supplier.name})`);
    } else {
      setEntryError(res.message || 'Failed to load purchase order details.');
    }
    setLoadingPODetail(false);
  };

  // -------------------------------------------------------------
  // Submit Purchase Entry (Atomic 11-Step Transaction)
  // -------------------------------------------------------------
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPODetail) return;

    if (!invoiceNumber.trim()) {
      setEntryError('Supplier Invoice Number is required.');
      return;
    }

    setIsSubmitting(true);
    setEntryError(null);

    const payload = {
      poId: selectedPODetail.po.id,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      dueDate: dueDate || undefined,
      notes: accountingNotes.trim() || undefined,
    };

    const res = await apiRequest('/accounts/purchases/with-po', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (res.success) {
      setEntrySuccess(
        `Purchase Invoice ${invoiceNumber} created successfully! Accounts payable booked, supplier ledger updated, and journal entry posted.`
      );
      setTimeout(() => {
        setIsEntryOpen(false);
        fetchPurchases();
      }, 1400);
    } else {
      setEntryError(res.message || 'Error occurred while saving purchase accounting entry.');
    }
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // View Transaction Detail
  // -------------------------------------------------------------
  const handleViewTxn = async (txnId: string) => {
    const res = await apiRequest(`/accounts/transactions/${txnId}`);
    if (res.success && res.data) {
      setViewingTxn(res.data);
    }
  };

  // -------------------------------------------------------------
  // Direct Purchase (Without PO) Calculations & Handlers
  // -------------------------------------------------------------
  const directCalculations = useMemo(() => {
    const qty = Number(directQuantity) || 0;
    const rate = Number(directRate) || 0;
    const discPct = Math.max(0, Math.min(100, Number(directDiscountPercent) || 0));
    const taxPct = Math.max(0, Number(directTaxPercent) || 0);

    const base = qty * rate;
    const discAmount = Math.round(base * (discPct / 100) * 100) / 100;
    const taxableGross = Math.round((base - discAmount) * 100) / 100;
    const taxAmount = Math.round(taxableGross * (taxPct / 100) * 100) / 100;
    const netAmount = Math.round((taxableGross + taxAmount) * 100) / 100;

    return {
      base,
      discAmount,
      taxableGross,
      taxAmount,
      netAmount,
    };
  }, [directQuantity, directRate, directDiscountPercent, directTaxPercent]);

  const openDirectPurchaseModal = () => {
    const defaultSupplier = suppliersList[0];
    const defaultStore = storesList[0];
    setDirectPartyId(defaultSupplier?.id || '');
    setDirectStoreId(defaultStore?.id || '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    setDirectInvoiceNumber(`INV-DIR-${rand}`);
    const today = new Date().toISOString().split('T')[0];
    setDirectInvoiceDate(today);

    if (defaultSupplier) {
      const days = defaultSupplier.creditDays || 30;
      const d = new Date();
      d.setDate(d.getDate() + days);
      setDirectDueDate(d.toISOString().split('T')[0]);
    } else {
      setDirectDueDate(today);
    }

    setDirectItemName('');
    setDirectItemDescription('');
    setDirectQuantity(1);
    setDirectRate(0);
    setDirectDiscountPercent(0);
    setDirectTaxPercent(18);
    setDirectPaymentStatus('UNPAID');
    setDirectPaymentMethod('BANK_TRANSFER');
    setDirectPaidAmount(0);
    setDirectReferenceNo('');
    setDirectNotes('');
    setDirectError(null);
    setDirectSuccess(null);
    setIsDirectPurchaseOpen(true);
  };

  const handleDirectPartyChange = (pId: string) => {
    setDirectPartyId(pId);
    const p = suppliersList.find((s) => s.id === pId);
    if (p) {
      const days = p.creditDays || 30;
      const d = new Date(directInvoiceDate || new Date());
      d.setDate(d.getDate() + days);
      setDirectDueDate(d.toISOString().split('T')[0]);
    }
  };

  const handleSaveDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPartyId) {
      setDirectError('Please select a Supplier / Vendor.');
      return;
    }
    if (!directStoreId) {
      setDirectError('Please select a Store.');
      return;
    }
    if (!directInvoiceNumber.trim()) {
      setDirectError('Supplier Invoice Number is required.');
      return;
    }
    if (!directItemName.trim()) {
      setDirectError('Item or Service name is required.');
      return;
    }
    if (directQuantity <= 0) {
      setDirectError('Quantity must be greater than 0.');
      return;
    }
    if (directRate <= 0) {
      setDirectError('Rate must be greater than 0.');
      return;
    }
    if (
      directPaymentStatus === 'PARTIALLY_PAID' &&
      (directPaidAmount <= 0 || directPaidAmount >= directCalculations.netAmount)
    ) {
      setDirectError(
        `For partially paid invoices, paid amount must be between ₹ 0.01 and ₹ ${(directCalculations.netAmount - 0.01).toFixed(2)}.`
      );
      return;
    }

    setDirectIsSubmitting(true);
    setDirectError(null);

    const payload = {
      partyId: directPartyId,
      storeId: directStoreId,
      invoiceNumber: directInvoiceNumber.trim(),
      invoiceDate: directInvoiceDate,
      dueDate: directDueDate || undefined,
      itemName: directItemName.trim(),
      itemDescription: directItemDescription.trim() || undefined,
      quantity: Number(directQuantity),
      rate: Number(directRate),
      discountPercent: Number(directDiscountPercent || 0),
      taxPercent: Number(directTaxPercent || 0),
      paymentStatus: directPaymentStatus,
      paymentMethod: directPaymentMethod,
      paidAmount:
        directPaymentStatus === 'PAID'
          ? directCalculations.netAmount
          : Number(directPaidAmount || 0),
      referenceNo: directReferenceNo.trim() || undefined,
      notes: directNotes.trim() || undefined,
    };

    const res = await apiRequest('/accounts/purchases/without-po', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setDirectIsSubmitting(false);

    if (res.success) {
      setDirectSuccess(
        `Direct Purchase Invoice ${directInvoiceNumber} posted successfully! po_id = NULL (Zero fake POs). Party ledger credited and journal voucher posted.`
      );
      setTimeout(() => {
        setIsDirectPurchaseOpen(false);
        fetchPurchases();
      }, 1400);
    } else {
      setDirectError(res.message || 'Error occurred while saving direct purchase.');
    }
  };

  const tabs = [
    { id: 'all', label: 'All Purchase Invoices', count: purchases.length },
    { id: 'with-po', label: 'With PO Workflow' },
    { id: 'without-po', label: 'Direct Invoices (No PO)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PURCHASE ACCOUNTS</span>
            <span>/</span>
            <span className="text-slate-800 font-bold uppercase">
              {activeTab === 'without-po'
                ? 'WITHOUT PO (DIRECT)'
                : activeTab === 'with-po'
                ? 'WITH PO WORKFLOW'
                : 'ALL INVOICES'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {activeTab === 'without-po'
              ? 'Direct Purchase Accounting (Without PO)'
              : activeTab === 'with-po'
              ? 'Purchase Accounting & Invoices (With PO)'
              : 'Purchase Accounting & Invoices'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'without-po'
              ? 'Record direct vendor purchases and expenses without requiring a Purchase Order. Instant party ledger credit and accounts payable tracking.'
              : activeTab === 'with-po'
              ? 'Process vendor bills against approved purchase orders with live material inward verification and automated supplier ledger posting.'
              : 'Unified enterprise purchase accounting supporting both PO-backed workflows and direct vendor purchases with automated double-entry vouchers.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => fetchPurchases()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            icon={<FileCheck className="w-3.5 h-3.5 text-blue-600" />}
            onClick={openPOSelectionModal}
          >
            Bill Against PO
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            icon={<FilePlus className="w-3.5 h-3.5" />}
            onClick={openDirectPurchaseModal}
          >
            Direct Purchase (No PO)
          </Button>
        </div>
      </div>

      {/* Accounting Flow Banner (Adaptive based on active tab) */}
      {activeTab === 'without-po' ? (
        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-teal-50/60">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-emerald-600 text-white rounded-md">
                <FilePlus className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                WITHOUT PO PURCHASE ACCOUNTING WORKFLOW
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Direct Invoice • po_id = NULL (No Fake PO) • Party Ledger & Payable Posted Atomically
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 overflow-x-auto py-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>Direct Purchase / Invoice</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>Purchase Accounting</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <span>Party Ledger (Credited)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              <span>Payable (Unpaid Balance)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg shrink-0">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                5
              </span>
              <span>Payment Disbursement</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'with-po' ? (
        <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-blue-600 text-white rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                WITH PO COMPLETE ACCOUNTING WORKFLOW
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Strict ACID Transaction • Zero Duplicate Entry • Balanced Journal Posting
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 overflow-x-auto py-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>Purchase Order (Approved)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>Material Inward (QC Received)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-blue-800 text-white flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <span>Purchase Accounting (Invoice)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              <span>Supplier Ledger (Credited)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs shrink-0">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                5
              </span>
              <span>Accounts Payable (Unpaid)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg shrink-0">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                6
              </span>
              <span>Payment Disbursement</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-blue-950 block">WITH PO WORKFLOW</span>
                <span className="text-slate-500 text-[11px]">
                  PO → Inward → Accounting → Ledger → Payable → Payment
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={openPOSelectionModal}>
              Bill PO
            </Button>
          </div>
          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950 block">WITHOUT PO WORKFLOW</span>
                <span className="text-slate-500 text-[11px]">
                  Direct Invoice → Accounting → Party Ledger → Payable → Payment
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={openDirectPurchaseModal}
            >
              Direct Purchase
            </Button>
          </div>
        </div>
      )}

      {/* Main Card with Tabs and Advanced Filters */}
      <Card>
        <div className="px-6 pt-2 border-b border-slate-100">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3">
          {/* Search Box */}
          <div className="relative w-full md:flex-1 md:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice #, PO #, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            {/* Supplier Filter */}
            <div className="w-full sm:w-44">
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suppliers</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Filter */}
            <div className="w-full sm:w-40">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Stores</option>
                {storesList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="w-full sm:w-36">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 sm:flex-initial py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Start Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 sm:flex-initial py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="End Date"
            />
          </div>

          {/* Reset Filters */}
          {(searchQuery || selectedSupplier || selectedStore || selectedStatus !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSupplier('');
                setSelectedStore('');
                setSelectedStatus('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1.5 whitespace-nowrap self-end md:self-auto"
            >
              Clear
            </button>
          )}
        </div>

        {/* Purchase Invoices Table */}
        <CardContent className="p-0">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>PO Reference</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier / Vendor</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
                <TableHead className="text-right">Paid (₹)</TableHead>
                <TableHead className="text-right">Outstanding (₹)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading purchase transactions from database...
                  </TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No purchase records found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      No invoices match the selected filters or workflow type.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {activeTab === 'without-po' ? (
                        <Button
                          size="sm"
                          variant="primary"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          icon={<FilePlus className="w-3.5 h-3.5" />}
                          onClick={openDirectPurchaseModal}
                        >
                          Create Direct Purchase (No PO)
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<FileCheck className="w-3.5 h-3.5" />}
                            onClick={openPOSelectionModal}
                          >
                            Bill an Approved PO Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<FilePlus className="w-3.5 h-3.5" />}
                            onClick={openDirectPurchaseModal}
                          >
                            Direct Purchase
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="text-xs font-medium text-slate-700">
                      {new Date(inv.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {inv.poNumber ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <Badge variant="blue" className="font-mono text-[11px]">
                              {inv.poNumber}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-blue-600 font-semibold tracking-tight">
                            WITH PO
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="neutral"
                              className="font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200"
                            >
                              PO = N/A
                            </Badge>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-semibold tracking-tight">
                            WITHOUT PO (Direct)
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-slate-900">{inv.supplier}</div>
                      {inv.supplierCode && (
                        <div className="text-[10px] text-slate-400 font-mono">{inv.supplierCode}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{inv.store}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">
                      ₹ {inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700">
                      ₹ {(inv.paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-700">
                      ₹ {inv.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          inv.status === 'PAID'
                            ? 'success'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'warning'
                            : 'error'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye className="w-3 h-3 text-slate-500" />}
                        onClick={() => handleViewTxn(inv.id)}
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

      {/* ========================================================= */}
      {/* 1. PO SELECTION MODAL                                     */}
      {/* ========================================================= */}
      <Modal
        isOpen={isSelectPOOpen}
        onClose={() => setIsSelectPOOpen(false)}
        title="Select Approved Purchase Order to Bill"
        size="4xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <div>
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                STEP 1: SELECT EXISTING APPROVED PO
              </h4>
              <p className="text-xs text-blue-900/80 mt-0.5">
                Displaying valid Purchase Orders eligible for accounting. Actual items, QC accepted quantities, and inward references will be loaded automatically.
              </p>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PO # or supplier..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
            <Table className="min-w-[650px]">
              <TableHeader>
                <TableRow className="bg-slate-50 text-[11px]">
                  <TableHead>PO Number</TableHead>
                  <TableHead>PO Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">PO Amount</TableHead>
                  <TableHead className="text-right">Received Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Material Inwards</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPOs ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-500" />
                      Loading eligible purchase orders...
                    </TableCell>
                  </TableRow>
                ) : filteredEligiblePOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                      No approved or receivable POs available.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEligiblePOs.map((po) => (
                    <TableRow key={po.id} className="hover:bg-blue-50/40 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        {po.poNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(po.poDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-slate-900">{po.supplier?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{po.supplier?.gstin}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{po.store?.name}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-800">
                        ₹ {po.poAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-blue-700">
                        ₹ {po.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            po.status === 'RECEIVED'
                              ? 'success'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'warning'
                              : 'blue'
                          }
                        >
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {po.inwardCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Truck className="w-3 h-3" />
                            {po.inwardCount} Inward{po.inwardCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">0 Inwards</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<ChevronRight className="w-3 h-3" />}
                          onClick={() => handleSelectPO(po.id)}
                        >
                          Select & Bill
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* 2. PURCHASE ENTRY FORM MODAL (WITH PO)                    */}
      {/* ========================================================= */}
      <Modal
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        title={
          selectedPODetail
            ? `Purchase Entry Against ${selectedPODetail.po.poNumber}`
            : 'Purchase Entry'
        }
        size="4xl"
      >
        {loadingPODetail ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading actual PO items and material inward receipts...
          </div>
        ) : selectedPODetail ? (
          <form onSubmit={handleSavePurchase} className="space-y-5">
            {/* Notification Messages */}
            {entryError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{entryError}</span>
              </div>
            )}
            {entrySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{entrySuccess}</span>
              </div>
            )}

            {/* Read-Only PO & Supplier Context Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  PURCHASE ORDER
                </span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {selectedPODetail.po.poNumber}
                </span>
                <span className="text-slate-500 block mt-0.5">
                  PO Date: {new Date(selectedPODetail.po.poDate).toLocaleDateString()}
                </span>
                <Badge variant="neutral" className="mt-1">
                  Status: {selectedPODetail.po.status}
                </Badge>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  SUPPLIER DETAILS
                </span>
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedPODetail.supplier.name}
                </span>
                <span className="text-slate-500 font-mono block mt-0.5">
                  GSTIN: {selectedPODetail.supplier.gstin || 'N/A'}
                </span>
                <span className="text-slate-500 block">
                  Terms: {selectedPODetail.supplier.creditDays || 30} Days Credit
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  DELIVERY STORE & INWARDS
                </span>
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedPODetail.store.name}
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Code: {selectedPODetail.store.code}
                </span>
                <div className="mt-1 text-[11px] font-medium text-emerald-700">
                  {selectedPODetail.materialInwards.length > 0
                    ? `Linked to ${selectedPODetail.materialInwards.length} Material Inward(s)`
                    : 'Awaiting first physical inward receipt'}
                </div>
              </div>
            </div>

            {/* Material Inwards Linked Section */}
            {selectedPODetail.materialInwards.length > 0 && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wide mb-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Material Inward Receipts</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {selectedPODetail.materialInwards.map((inw: any) => (
                    <span
                      key={inw.id}
                      className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md font-mono text-emerald-800"
                    >
                      <strong className="text-emerald-950">{inw.inwardNumber}</strong> (Date:{' '}
                      {new Date(inw.inwardDate).toLocaleDateString()}
                      {inw.referenceNumber ? ` • Ref: ${inw.referenceNumber}` : ''})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Loaded PO Line Items (Read-Only to prevent manual tampering/duplication) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  PO Items & Quantity Verification
                </h4>
                <span className="text-[11px] text-slate-400 italic">
                  Loaded directly from PO & Material Inwards (Locked)
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table className="min-w-[650px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[11px]">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Ordered Qty</TableHead>
                      <TableHead className="text-right">Inward Accepted</TableHead>
                      <TableHead className="text-right">Rate (₹)</TableHead>
                      <TableHead className="text-right">Disc %</TableHead>
                      <TableHead className="text-right">Tax (GST)</TableHead>
                      <TableHead className="text-right">Line Total (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPODetail.items.map((it: any) => (
                      <TableRow key={it.id} className="text-xs">
                        <TableCell>
                          <div className="font-semibold text-slate-900">{it.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {it.orderedQty} {it.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">
                          {it.inwardAcceptedQty} {it.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono">₹ {it.rate.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{it.discountPercent}%</TableCell>
                        <TableCell className="text-right font-mono">{it.taxPercent}%</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          ₹ {it.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Editable Permitted Accounting Fields */}
            <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 uppercase tracking-wide">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Permitted Accounting Fields (Vendor Bill Details)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Invoice / Bill # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-BS-2026-904"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accounting Narration / Payment Terms
                </label>
                <input
                  type="text"
                  placeholder="Notes for ledger entry..."
                  value={accountingNotes}
                  onChange={(e) => setAccountingNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Financial Summary & Live Double-Entry Balancing Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amounts Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <h5 className="font-bold text-slate-800 uppercase tracking-wide text-[11px] mb-2">
                  Invoice Financial Summary
                </h5>
                <div className="flex justify-between text-slate-600">
                  <span>Gross Amount:</span>
                  <span className="font-mono">
                    ₹ {selectedPODetail.suggestedAccounting.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedPODetail.suggestedAccounting.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-mono">
                      - ₹ {selectedPODetail.suggestedAccounting.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Input GST Credit (1050):</span>
                  <span className="font-mono">
                    + ₹ {selectedPODetail.suggestedAccounting.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Net Payable Amount:</span>
                  <span className="font-mono text-blue-700">
                    ₹ {selectedPODetail.suggestedAccounting.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Live Journal Double-Entry Voucher Preview */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-indigo-950 uppercase tracking-wide text-[11px]">
                    Double-Entry Journal Voucher Preview
                  </h5>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    BALANCED (Dr = Cr)
                  </span>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-800">
                    <span>[Dr] 5010 Purchase Expense (COGS):</span>
                    <span>
                      ₹ {selectedPODetail.suggestedAccounting.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {selectedPODetail.suggestedAccounting.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-800">
                      <span>[Dr] 1050 Input GST Credit:</span>
                      <span>
                        ₹ {selectedPODetail.suggestedAccounting.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-indigo-900 font-bold pt-1 border-t border-indigo-200">
                    <span>[Cr] 2010 Accounts Payable ({selectedPODetail.supplier.name}):</span>
                    <span>
                      ₹ {selectedPODetail.suggestedAccounting.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEntryOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Posting 11-Step ACID Transaction...' : 'Save & Post Purchase Bill'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* ========================================================= */}
      {/* 2. DIRECT PURCHASE ENTRY MODAL (WITHOUT PO)               */}
      {/* ========================================================= */}
      <Modal
        isOpen={isDirectPurchaseOpen}
        onClose={() => setIsDirectPurchaseOpen(false)}
        title="Direct Purchase Entry (Without PO)"
        size="4xl"
      >
        <form onSubmit={handleSaveDirectPurchase} className="space-y-5">
          {/* Notification Messages */}
          {directError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{directError}</span>
            </div>
          )}
          {directSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{directSuccess}</span>
            </div>
          )}

          {/* Workflow Notice Banner */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <FilePlus className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-emerald-950 uppercase tracking-wide">
                  DIRECT PURCHASE ACCOUNTING • PO NOT REQUIRED
                </span>
                <p className="text-emerald-800/80 text-[11px] mt-0.5">
                  Direct Invoice → Purchase Accounting → Party Ledger → Payable → Payment. Database:{' '}
                  <code className="font-mono bg-white/80 px-1 py-0.5 rounded text-emerald-900 font-bold">
                    po_id = NULL
                  </code>{' '}
                  (Zero fake POs).
                </p>
              </div>
            </div>
            <Badge variant="success" className="shrink-0 font-mono text-[10px]">
              WITHOUT PO
            </Badge>
          </div>

          {/* Section 1: Party, Store & Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Supplier / Party <span className="text-red-500">*</span>
              </label>
              <select
                value={directPartyId}
                onChange={(e) => handleDirectPartyChange(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              >
                <option value="">-- Select Supplier / Vendor --</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.creditDays || 30}d
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Store <span className="text-red-500">*</span>
              </label>
              <select
                value={directStoreId}
                onChange={(e) => setDirectStoreId(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              >
                <option value="">-- Select Store --</option>
                {storesList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code || 'Main'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-DIR-2026-001"
                value={directInvoiceNumber}
                onChange={(e) => setDirectInvoiceNumber(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={directInvoiceDate}
                onChange={(e) => setDirectInvoiceDate(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Due Date (Payment Due)
              </label>
              <input
                type="date"
                value={directDueDate}
                onChange={(e) => setDirectDueDate(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                PO Association
              </label>
              <div className="py-1.5 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-mono flex items-center justify-between">
                <span>po_id = NULL</span>
                <span className="text-[10px] text-emerald-700 font-semibold uppercase">PO Not Required</span>
              </div>
            </div>
          </div>

          {/* Section 2: Item / Service Details & Pricing Math */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
              Direct Item / Service & Accounting Amounts
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Item / Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Facilities Maintenance / Raw Materials / Office Equipment"
                  value={directItemName}
                  onChange={(e) => setDirectItemName(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Description / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Direct purchase for monthly store operations"
                  value={directItemDescription}
                  onChange={(e) => setDirectItemDescription(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={directQuantity}
                  onChange={(e) => setDirectQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={directRate || ''}
                  onChange={(e) => setDirectRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={directDiscountPercent}
                  onChange={(e) =>
                    setDirectDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                  }
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  GST Tax (%)
                </label>
                <select
                  value={directTaxPercent}
                  onChange={(e) => setDirectTaxPercent(parseFloat(e.target.value) || 0)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5% (Essential)</option>
                  <option value="12">12% (Standard 1)</option>
                  <option value="18">18% (Standard 2)</option>
                  <option value="28">28% (Luxury)</option>
                </select>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Subtotal</span>
                <span className="font-semibold text-slate-800">
                  ₹ {directCalculations.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Discount</span>
                <span className="text-amber-700">
                  - ₹ {directCalculations.discAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Taxable Gross</span>
                <span className="font-semibold text-slate-900">
                  ₹ {directCalculations.taxableGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Tax (GST)</span>
                <span className="text-blue-700">
                  + ₹ {directCalculations.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Payable</span>
                <span className="font-bold text-sm text-emerald-700">
                  ₹ {directCalculations.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Payment Status & Settlement */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
              Payment Settlement & Terms
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={directPaymentStatus}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    setDirectPaymentStatus(st);
                    if (st === 'PAID') {
                      setDirectPaidAmount(directCalculations.netAmount);
                    } else if (st === 'UNPAID') {
                      setDirectPaidAmount(0);
                    } else if (st === 'PARTIALLY_PAID' && directPaidAmount === 0) {
                      setDirectPaidAmount(Math.round(directCalculations.netAmount / 2));
                    }
                  }}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="UNPAID">UNPAID (Book as Accounts Payable)</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID (Partial Settlement)</option>
                  <option value="PAID">PAID (Full Instant Settlement)</option>
                </select>
              </div>

              {directPaymentStatus !== 'UNPAID' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={directPaymentMethod}
                      onChange={(e) => setDirectPaymentMethod(e.target.value as any)}
                      className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="CASH">Cash in Hand</option>
                      <option value="UPI">UPI Instant Payment</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Paid Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={directCalculations.netAmount}
                      step="0.01"
                      value={directPaymentStatus === 'PAID' ? directCalculations.netAmount : directPaidAmount}
                      onChange={(e) => setDirectPaidAmount(parseFloat(e.target.value) || 0)}
                      disabled={directPaymentStatus === 'PAID'}
                      className={`w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                        directPaymentStatus === 'PAID' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payment Reference (UTR / Cheque # / UPI ID)
                </label>
                <input
                  type="text"
                  placeholder="Optional reference number"
                  value={directReferenceNo}
                  onChange={(e) => setDirectReferenceNo(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Accounting Notes / Narration
                </label>
                <input
                  type="text"
                  placeholder="Optional notes for journal entry and audit log"
                  value={directNotes}
                  onChange={(e) => setDirectNotes(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Live Double-Entry Journal Voucher Preview */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-emerald-950 uppercase tracking-wide text-[11px]">
                Double-Entry Journal Voucher Preview (Automated Posting)
              </h5>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                BALANCED (Dr = Cr)
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-800">
                <span>[Dr] 5010 Purchase Expense (COGS):</span>
                <span>
                  ₹ {directCalculations.taxableGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {directCalculations.taxAmount > 0 && (
                <div className="flex justify-between text-slate-800">
                  <span>[Dr] 1050 Input GST Credit:</span>
                  <span>
                    ₹ {directCalculations.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-emerald-900 font-bold pt-1 border-t border-emerald-200">
                <span>
                  [Cr] 2010 Accounts Payable (
                  {suppliersList.find((s) => s.id === directPartyId)?.name || 'Selected Supplier'}):
                </span>
                <span>
                  ₹ {directCalculations.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {directPaymentStatus !== 'UNPAID' && (
                <>
                  <div className="flex justify-between text-blue-900 pt-1 border-t border-dashed border-emerald-200">
                    <span>[Dr] 2010 Accounts Payable (Payment Settlement):</span>
                    <span>
                      ₹{' '}
                      {(directPaymentStatus === 'PAID'
                        ? directCalculations.netAmount
                        : directPaidAmount
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-900">
                    <span>
                      [Cr] {directPaymentMethod === 'CASH' ? '1010 Cash in Hand' : '1020 Bank Account'}:
                    </span>
                    <span>
                      ₹{' '}
                      {(directPaymentStatus === 'PAID'
                        ? directCalculations.netAmount
                        : directPaidAmount
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDirectPurchaseOpen(false)}
              disabled={directIsSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              disabled={directIsSubmitting}
            >
              {directIsSubmitting
                ? 'Posting Direct Purchase ACID Transaction...'
                : 'Save & Post Direct Purchase'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* 3. TRANSACTION DETAILS MODAL                              */}
      {/* ========================================================= */}
      <Modal
        isOpen={!!viewingTxn}
        onClose={() => setViewingTxn(null)}
        title={`Purchase Invoice: ${viewingTxn?.invoiceNumber || ''}`}
        size="2xl"
      >
        {viewingTxn && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(viewingTxn.invoiceDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Reference</span>
                {viewingTxn.purchaseOrder?.poNumber ? (
                  <span className="font-mono font-bold text-blue-700">
                    {viewingTxn.purchaseOrder.poNumber}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    PO = N/A (Direct)
                  </span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Supplier</span>
                <span className="font-semibold text-slate-900">{viewingTxn.party?.name}</span>
                {viewingTxn.party?.code && (
                  <span className="text-[10px] text-slate-400 font-mono block">({viewingTxn.party.code})</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                <Badge
                  variant={
                    viewingTxn.paymentStatus === 'PAID'
                      ? 'success'
                      : viewingTxn.paymentStatus === 'PARTIALLY_PAID'
                      ? 'warning'
                      : 'error'
                  }
                >
                  {viewingTxn.paymentStatus}
                </Badge>
              </div>
            </div>

            {/* Financial Amounts Summary */}
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Total Amount</span>
                <span className="font-bold text-slate-900">
                  ₹ {viewingTxn.netAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Paid Amount</span>
                <span className="font-bold text-emerald-700">
                  ₹ {(viewingTxn.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Outstanding</span>
                <span className="font-bold text-rose-700">
                  ₹ {Math.max(0, (viewingTxn.netAmount || 0) - (viewingTxn.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                  Posted Double-Entry Journal Lines
                </h5>
                <span className="text-[10px] font-mono text-slate-500">
                  {viewingTxn.journalEntry?.entryNumber}
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {viewingTxn.journalEntry?.lines?.map((l: any) => (
                  <div
                    key={l.id}
                    className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <span className="font-bold text-slate-700">[{l.account?.code}]</span>{' '}
                      <span className="text-slate-900">{l.account?.name}</span>
                      {l.party && <span className="text-slate-500"> — {l.party.name}</span>}
                    </div>
                    <div>
                      {l.debitAmount > 0 ? (
                        <span className="text-slate-900 font-semibold">
                          Dr ₹ {l.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          Cr ₹ {l.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {viewingTxn.notes && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-bold text-slate-700 block text-[10px] uppercase">Notes:</span>
                {viewingTxn.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setViewingTxn(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseAccountsPage;

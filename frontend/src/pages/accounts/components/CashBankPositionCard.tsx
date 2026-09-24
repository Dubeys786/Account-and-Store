import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Landmark,
  Layers,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiRequest } from '../../../services/api';
import { useStore } from '../../../context/StoreContext';
import { useAuth } from '../../../context/AuthContext';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';

export interface BankAccountBreakdown {
  id: string;
  code: string;
  name: string;
  openingBalance: number;
  todayInflow: number;
  todayOutflow: number;
  closingBalance: number;
  transactionCount: number;
}

export interface CashBankPositionData {
  asOfDate: string;
  formattedDate: string;
  storeId: string | null;
  storeName: string;
  hasPostedTransactions: boolean;
  statusMessage: string;
  cash: {
    accountId: string;
    accountCode: string;
    accountName: string;
    openingBalance: number;
    todayInflow: number;
    todayOutflow: number;
    currentBalance: number;
    transactionCount: number;
  };
  bank: {
    totalOpeningBalance: number;
    todayInflow: number;
    todayOutflow: number;
    currentBalance: number;
    totalTransactionCount: number;
    accounts: BankAccountBreakdown[];
  };
  totalAvailable: number;
  todayMovement: {
    totalInflow: number;
    totalOutflow: number;
    netMovement: number;
  };
}

interface CashBankPositionCardProps {
  className?: string;
}

export const CashBankPositionCard: React.FC<CashBankPositionCardProps> = ({ className = '' }) => {
  const { activeStore, availableStores } = useStore();
  const { user } = useAuth();

  const [positionData, setPositionData] = useState<CashBankPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States: Date & Store
  const [dateFilterMode, setDateFilterMode] = useState<'TODAY' | 'YESTERDAY' | 'CUSTOM'>('TODAY');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('ACTIVE'); // 'ACTIVE', 'ALL', or specific storeId
  const [showBankDetails, setShowBankDetails] = useState(false);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'CASH_TO_BANK' | 'BANK_TO_CASH' | 'BANK_TO_BANK'>(
    'CASH_TO_BANK'
  );
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [transferStoreId, setTransferStoreId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  // Resolve target query parameters
  const computeQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    // Date
    let dateStr = '';
    const now = new Date();
    if (dateFilterMode === 'TODAY') {
      dateStr = now.toISOString().slice(0, 10);
    } else if (dateFilterMode === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      dateStr = yesterday.toISOString().slice(0, 10);
    } else if (dateFilterMode === 'CUSTOM' && customDate) {
      dateStr = customDate;
    }
    if (dateStr) {
      params.append('asOfDate', dateStr);
    }

    // Store
    if (selectedStoreId === 'ACTIVE') {
      if (activeStore?.id) {
        params.append('storeId', activeStore.id);
      }
    } else if (selectedStoreId === 'ALL') {
      params.append('storeId', 'all');
    } else if (selectedStoreId) {
      params.append('storeId', selectedStoreId);
    }

    return params.toString();
  }, [dateFilterMode, customDate, selectedStoreId, activeStore]);

  // Fetch Position Data
  const fetchPositionData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = computeQueryParams();
      const res = await apiRequest<CashBankPositionData>(
        `/accounts/cash-bank-position${queryString ? `?${queryString}` : ''}`
      );
      if (res.success && res.data) {
        setPositionData(res.data);
      } else {
        setError(res.message || 'Failed to load live cash & bank balances.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to accounts server.');
    } finally {
      setLoading(false);
    }
  }, [computeQueryParams]);

  useEffect(() => {
    fetchPositionData();
  }, [fetchPositionData]);

  // Listen for real-time transaction postings across the app
  useEffect(() => {
    const handleTransactionPosted = () => {
      fetchPositionData();
    };

    window.addEventListener('accounts:transaction-posted', handleTransactionPosted);
    return () => {
      window.removeEventListener('accounts:transaction-posted', handleTransactionPosted);
    };
  }, [fetchPositionData]);

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹ 0.00';
    return `₹ ${Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Open Transfer Modal with defaults
  const handleOpenTransferModal = () => {
    setTransferAmount('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setReferenceNumber('');
    setNarration('');
    setTransferError(null);
    setTransferSuccess(null);
    setTransferStoreId(
      selectedStoreId !== 'ALL' && selectedStoreId !== 'ACTIVE'
        ? selectedStoreId
        : activeStore?.id || availableStores[0]?.id || ''
    );
    if (positionData?.bank.accounts && positionData.bank.accounts.length > 0) {
      setToAccountId(positionData.bank.accounts[0].id);
      setFromAccountId(positionData.bank.accounts[0].id);
    }
    setIsTransferModalOpen(true);
  };

  // Submit Contra Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(null);

    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount greater than 0.');
      return;
    }

    setTransferSubmitting(true);
    try {
      const payload: any = {
        transferType,
        amount: amt,
        transferDate,
        storeId: transferStoreId || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        narration: narration.trim() || undefined,
      };

      if (transferType === 'CASH_TO_BANK') {
        payload.toAccountId = toAccountId || undefined;
      } else if (transferType === 'BANK_TO_CASH') {
        payload.fromAccountId = fromAccountId || undefined;
      } else if (transferType === 'BANK_TO_BANK') {
        payload.fromAccountId = fromAccountId;
        payload.toAccountId = toAccountId;
      }

      const res = await apiRequest('/accounts/contra-transfers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setTransferSuccess('Contra transfer posted successfully to ledger!');
        // Trigger live refresh and notify other components
        fetchPositionData();
        window.dispatchEvent(new CustomEvent('accounts:transaction-posted'));
        setTimeout(() => {
          setIsTransferModalOpen(false);
        }, 1200);
      } else {
        setTransferError(res.message || 'Failed to post contra transfer.');
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Error occurred while saving contra transfer.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 transition-all ${className}`}
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Today's Cash &amp; Bank Position
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  Live Real-Time
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Balance as of {positionData?.formattedDate || 'Today'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {positionData?.storeName || 'All Stores'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Date & Store Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector Filter */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setDateFilterMode('TODAY')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                dateFilterMode === 'TODAY'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('YESTERDAY')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                dateFilterMode === 'YESTERDAY'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('CUSTOM');
                if (!customDate) {
                  setCustomDate(new Date().toISOString().slice(0, 10));
                }
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                dateFilterMode === 'CUSTOM'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Date
            </button>
          </div>

          {dateFilterMode === 'CUSTOM' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          )}

          {/* Store Selector */}
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ACTIVE">
              Selected Store: {activeStore ? activeStore.name : 'Central Store'}
            </option>
            <option value="ALL">All Stores (Consolidated Total)</option>
            {availableStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          {/* Contra Transfer Button */}
          <Button
            size="sm"
            variant="outline"
            icon={<ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />}
            onClick={handleOpenTransferModal}
            className="text-xs font-medium"
          >
            Transfer Cash ↔ Bank
          </Button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchPositionData}
            title="Refresh Balances"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Zero Posted Transactions Alert */}
      {positionData && !positionData.hasPostedTransactions && !loading && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-semibold">No posted transactions available: </span>
            Balances are strictly derived from real posted accounting ledgers. As no valid transactions
            exist for this period/store, balances correctly reflect ₹ 0.00 without artificial demo data.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Main Position 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 mt-4">
        {/* CARD 1: CASH IN HAND */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-linear-to-br from-emerald-50/40 via-white to-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Cash in Hand
            </span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              A/c 1010
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(positionData?.cash.currentBalance)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Opening: {formatCurrency(positionData?.cash.openingBalance)}
            </p>
          </div>

          {/* Movement Summary */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50/60 p-1.5 rounded-md">
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] text-slate-500">Today's Inflow</div>
                <div className="font-semibold">{formatCurrency(positionData?.cash.todayInflow)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-rose-700 bg-rose-50/60 p-1.5 rounded-md">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] text-slate-500">Today's Outflow</div>
                <div className="font-semibold">{formatCurrency(positionData?.cash.todayOutflow)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: BANK BALANCE */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-linear-to-br from-blue-50/40 via-white to-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-600" />
              Bank Balance
            </span>
            <button
              type="button"
              onClick={() => setShowBankDetails(!showBankDetails)}
              className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1 transition-colors"
            >
              <span>{positionData?.bank.accounts.length || 0} Account(s)</span>
              {showBankDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(positionData?.bank.currentBalance)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Opening: {formatCurrency(positionData?.bank.totalOpeningBalance)}
            </p>
          </div>

          {/* Movement Summary */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-blue-700 bg-blue-50/60 p-1.5 rounded-md">
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] text-slate-500">Today's Inflow</div>
                <div className="font-semibold">{formatCurrency(positionData?.bank.todayInflow)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-700 bg-amber-50/60 p-1.5 rounded-md">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] text-slate-500">Today's Outflow</div>
                <div className="font-semibold">{formatCurrency(positionData?.bank.todayOutflow)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: TOTAL AVAILABLE LIQUIDITY */}
        <div className="relative overflow-hidden rounded-xl border border-indigo-200/80 bg-linear-to-br from-indigo-50/50 via-white to-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Total Available
            </span>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              Cash + Bank
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-indigo-950 tracking-tight">
              {loading ? '...' : formatCurrency(positionData?.totalAvailable)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Net Day Movement:{' '}
              <span
                className={`font-semibold ${
                  (positionData?.todayMovement.netMovement || 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {(positionData?.todayMovement.netMovement || 0) >= 0 ? '+' : ''}
                {formatCurrency(positionData?.todayMovement.netMovement)}
              </span>
            </p>
          </div>

          {/* Consolidated Inflow / Outflow */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="p-1.5 rounded-md bg-slate-50 text-slate-700">
              <div className="text-[10px] text-slate-500">Total Day Inflow</div>
              <div className="font-semibold text-emerald-700">
                {formatCurrency(positionData?.todayMovement.totalInflow)}
              </div>
            </div>
            <div className="p-1.5 rounded-md bg-slate-50 text-slate-700">
              <div className="text-[10px] text-slate-500">Total Day Outflow</div>
              <div className="font-semibold text-rose-700">
                {formatCurrency(positionData?.todayMovement.totalOutflow)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple Bank Accounts Breakdown (Optional toggle or view) */}
      {showBankDetails && positionData?.bank.accounts && positionData.bank.accounts.length > 0 && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-blue-600" />
              Bank Accounts Breakdown ({positionData.bank.accounts.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              Real accounts registered in Chart of Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="pb-1.5">Account Code</th>
                  <th className="pb-1.5">Bank Name</th>
                  <th className="pb-1.5 text-right">Opening</th>
                  <th className="pb-1.5 text-right text-emerald-700">Today Inflow</th>
                  <th className="pb-1.5 text-right text-rose-700">Today Outflow</th>
                  <th className="pb-1.5 text-right text-slate-900 font-bold">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positionData.bank.accounts.map((ac) => (
                  <tr key={ac.id} className="hover:bg-white transition-colors">
                    <td className="py-2 font-mono text-slate-700 font-semibold">{ac.code}</td>
                    <td className="py-2 font-medium text-slate-900">{ac.name}</td>
                    <td className="py-2 text-right text-slate-600">
                      {formatCurrency(ac.openingBalance)}
                    </td>
                    <td className="py-2 text-right text-emerald-700 font-medium">
                      +{formatCurrency(ac.todayInflow)}
                    </td>
                    <td className="py-2 text-right text-rose-700 font-medium">
                      -{formatCurrency(ac.todayOutflow)}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-900">
                      {formatCurrency(ac.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTRA TRANSFER MODAL */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Cash ↔ Bank Contra Funds Transfer"
        size="lg"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Post an internal cash deposit, bank withdrawal, or inter-bank fund movement. Both debit and
            credit impact liquid balance sheet asset accounts without affecting income or expense ledgers.
          </p>

          {transferError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {transferError}
            </div>
          )}

          {transferSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{transferSuccess}</span>
            </div>
          )}

          {/* Transfer Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Transfer Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTransferType('CASH_TO_BANK')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  transferType === 'CASH_TO_BANK'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" /> Cash to Bank
                </div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Deposit cash into bank account
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTransferType('BANK_TO_CASH')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  transferType === 'BANK_TO_CASH'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> Bank to Cash
                </div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Withdraw cash from bank/ATM
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTransferType('BANK_TO_BANK')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  transferType === 'BANK_TO_BANK'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" /> Bank to Bank
                </div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Inter-bank account transfer
                </div>
              </button>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Date *
              </label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {transferType === 'CASH_TO_BANK' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    From (Credited Account)
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Cash on Hand (1010)"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    To Bank (Debited Account) *
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {positionData?.bank.accounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) - Bal: {formatCurrency(b.closingBalance)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {transferType === 'BANK_TO_CASH' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    From Bank (Credited Account) *
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {positionData?.bank.accounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) - Bal: {formatCurrency(b.closingBalance)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    To (Debited Account)
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Cash on Hand (1010)"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {transferType === 'BANK_TO_BANK' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Bank (Credited) *
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {positionData?.bank.accounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Bank (Debited) *
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {positionData?.bank.accounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Store & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store / Branch *
              </label>
              <select
                value={transferStoreId}
                onChange={(e) => setTransferStoreId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Cheque / UTR #
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. CHQ-8921 / UTR-5542"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Narration / Notes
            </label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Cash deposited into HDFC Operating account from counter receipts"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={transferSubmitting}
            >
              Post Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

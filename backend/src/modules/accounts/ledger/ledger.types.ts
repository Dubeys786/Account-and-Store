import { BalanceType } from '@prisma/client';

export interface LedgerEntryRow {
  id: string;
  date: string;
  voucherNumber: string;
  referenceType: string;
  particulars: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: BalanceType;
  formattedBalance: string;
}

export interface PartyLedgerResult {
  party: {
    id: string;
    code: string;
    name: string;
    type: string;
    gstin?: string | null;
    phone?: string | null;
    creditLimit: number;
  };
  period: {
    startDate?: string;
    endDate?: string;
  };
  openingBalance: {
    amount: number;
    type: BalanceType;
    formatted: string;
  };
  totalDebit: number;
  totalCredit: number;
  closingBalance: {
    amount: number;
    type: BalanceType;
    formatted: string;
  };
  entries: LedgerEntryRow[];
}

export interface PartyBalanceResult {
  partyId: string;
  code: string;
  name: string;
  type: string;
  openingBalance: {
    amount: number;
    type: BalanceType;
  };
  totalDebit: number;
  totalCredit: number;
  currentBalance: {
    amount: number;
    type: BalanceType;
  };
  formattedBalance: string;
  creditLimit: number;
  availableCredit?: number;
  status: string;
}

import { AccountGroup, BalanceType } from '@prisma/client';

export interface JournalLineInput {
  accountId: string;
  partyId?: string | null;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryNumber?: string;
  entryDate?: Date | string;
  referenceType?: string;
  referenceId?: string;
  storeId?: string | null;
  narration: string;
  lines: JournalLineInput[];
}

export interface JournalQueryFilters {
  referenceType?: string;
  referenceId?: string;
  storeId?: string | null;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface LedgerAccountInput {
  code: string;
  name: string;
  group: AccountGroup;
  balanceType?: BalanceType;
  description?: string;
}

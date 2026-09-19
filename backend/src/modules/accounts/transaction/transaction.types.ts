import { TransactionType, PaymentStatus } from '@prisma/client';

export interface CreateTransactionDTO {
  storeId: string;
  partyId: string;
  poId?: string | null;
  transactionType: TransactionType | string;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  dueDate?: Date | string;
  grossAmount: number;
  taxAmount?: number;
  netAmount?: number;
  paidAmount?: number;
  paymentStatus?: PaymentStatus;
  notes?: string;
  bankOrCashCode?: '1010' | '1020';
}

export interface TransactionQueryFilters {
  storeId?: string;
  partyId?: string;
  poId?: string | null;
  type?: 'with-po' | 'without-po' | string;
  transactionType?: TransactionType | string;
  paymentStatus?: PaymentStatus | string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

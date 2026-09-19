import { PartyType, PartyStatus, BalanceType } from '@prisma/client';

export interface CreatePartyDTO {
  code?: string;
  name: string;
  type: PartyType;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openingBalance?: number;
  openingBalanceType?: BalanceType;
  creditLimit?: number;
  creditDays?: number;
  paymentTerms?: string;
  storeId?: string | null;
  status?: PartyStatus;
  notes?: string;
}

export interface UpdatePartyDTO {
  name?: string;
  type?: PartyType;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openingBalance?: number;
  openingBalanceType?: BalanceType;
  creditLimit?: number;
  creditDays?: number;
  paymentTerms?: string;
  storeId?: string | null;
  status?: PartyStatus;
  notes?: string;
}

export interface PartyQueryFilters {
  search?: string;
  type?: PartyType | string;
  status?: PartyStatus | string;
  storeId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPartiesResult {
  parties: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

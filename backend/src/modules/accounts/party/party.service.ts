import prisma from '../../../config/db';
import { PartyStatus, PartyType, BalanceType, Prisma } from '@prisma/client';
import { CreatePartyDTO, UpdatePartyDTO, PartyQueryFilters, PaginatedPartiesResult } from './party.types';
import { LedgerService } from '../ledger/ledger.service';

export class PartyService {
  /**
   * Generates a unique party code if not provided
   */
  private static async generatePartyCode(type: PartyType): Promise<string> {
    const prefix = type.substring(0, 3).toUpperCase();
    const count = await prisma.party.count({
      where: { type },
    });
    const seq = (count + 1).toString().padStart(4, '0');
    return `PRT-${prefix}-${seq}`;
  }

  /**
   * Create a new party master record
   */
  static async createParty(data: CreatePartyDTO) {
    if (!data.name || !data.type) {
      throw new Error('Party name and party type are required fields.');
    }

    let code = data.code?.trim();
    if (!code) {
      code = await this.generatePartyCode(data.type);
    }

    // Verify code uniqueness
    const existing = await prisma.party.findUnique({
      where: { code },
    });
    if (existing) {
      throw new Error(`Party with code '${code}' already exists.`);
    }

    // Verify store exists if storeId provided
    if (data.storeId) {
      const storeExists = await prisma.store.findUnique({
        where: { id: data.storeId },
      });
      if (!storeExists) {
        throw new Error(`Store with ID '${data.storeId}' does not exist.`);
      }
    }

    const mobile = data.mobile || data.phone || null;
    const phone = data.phone || data.mobile || null;

    const party = await prisma.party.create({
      data: {
        code,
        name: data.name.trim(),
        type: data.type,
        mobile,
        alternateMobile: data.alternateMobile || null,
        email: data.email?.trim() || null,
        phone,
        gstin: data.gstin?.trim().toUpperCase() || null,
        pan: data.pan?.trim().toUpperCase() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pincode: data.pincode?.trim() || null,
        openingBalance: data.openingBalance !== undefined ? Number(data.openingBalance) : 0,
        openingBalanceType: data.openingBalanceType || BalanceType.DEBIT,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
        creditDays: data.creditDays !== undefined ? Number(data.creditDays) : 30,
        paymentTerms: data.paymentTerms || '30 Days',
        storeId: data.storeId || null,
        status: data.status || PartyStatus.ACTIVE,
        notes: data.notes?.trim() || null,
      },
      include: {
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return party;
  }

  /**
   * Get parties with search, filtering, and pagination
   */
  static async getParties(
    filters: PartyQueryFilters,
    authorizedStoreIds?: string[],
    isAdmin: boolean = false
  ): Promise<PaginatedPartiesResult> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const andConditions: Prisma.PartyWhereInput[] = [];

    // Search filter
    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim();
      andConditions.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
          { gstin: { contains: s, mode: 'insensitive' } },
          { pan: { contains: s, mode: 'insensitive' } },
          { mobile: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    // Type filter
    if (filters.type && filters.type !== 'ALL') {
      andConditions.push({ type: filters.type as PartyType });
    }

    // Status filter
    if (filters.status && filters.status !== 'ALL') {
      andConditions.push({ status: filters.status as PartyStatus });
    }

    // Store filter & tenancy isolation
    if (filters.storeId) {
      andConditions.push({ storeId: filters.storeId });
    } else if (!isAdmin && authorizedStoreIds && authorizedStoreIds.length > 0) {
      andConditions.push({
        OR: [
          { storeId: null },
          { storeId: { in: authorizedStoreIds } },
        ],
      });
    }

    const where: Prisma.PartyWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    // Sorting
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';
    const orderBy: Prisma.PartyOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [total, parties] = await Promise.all([
      prisma.party.count({ where }),
      prisma.party.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          store: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    const partiesWithBalance = await Promise.all(
      parties.map(async (party) => {
        try {
          const bal = await LedgerService.getPartyBalance(party.id);
          return {
            ...party,
            balance: bal.currentBalance.amount,
            balanceType: bal.currentBalance.type,
            formattedBalance: bal.formattedBalance,
          };
        } catch {
          const bType = party.openingBalanceType || BalanceType.DEBIT;
          return {
            ...party,
            balance: Number(party.openingBalance || 0),
            balanceType: bType,
            formattedBalance: `₹ ${Number(party.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${bType === 'DEBIT' ? 'Dr' : 'Cr'}`,
          };
        }
      })
    );

    return {
      parties: partiesWithBalance,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single party by ID
   */
  static async getPartyById(id: string) {
    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, code: true, name: true } },
      },
    });

    if (!party) {
      throw new Error(`Party with ID '${id}' not found.`);
    }

    try {
      const bal = await LedgerService.getPartyBalance(party.id);
      return {
        ...party,
        balance: bal.currentBalance.amount,
        balanceType: bal.currentBalance.type,
        formattedBalance: bal.formattedBalance,
      };
    } catch {
      const bType = party.openingBalanceType || BalanceType.DEBIT;
      return {
        ...party,
        balance: Number(party.openingBalance || 0),
        balanceType: bType,
        formattedBalance: `₹ ${Number(party.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${bType === 'DEBIT' ? 'Dr' : 'Cr'}`,
      };
    }
  }

  /**
   * Update party master record
   */
  static async updateParty(id: string, data: UpdatePartyDTO) {
    await this.getPartyById(id);

    const updateData: Prisma.PartyUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.mobile !== undefined) {
      updateData.mobile = data.mobile;
      updateData.phone = data.mobile;
    }
    if (data.alternateMobile !== undefined) updateData.alternateMobile = data.alternateMobile;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.phone !== undefined && data.mobile === undefined) {
      updateData.phone = data.phone;
      updateData.mobile = data.phone;
    }
    if (data.gstin !== undefined) updateData.gstin = data.gstin?.trim().toUpperCase() || null;
    if (data.pan !== undefined) updateData.pan = data.pan?.trim().toUpperCase() || null;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;
    if (data.city !== undefined) updateData.city = data.city?.trim() || null;
    if (data.state !== undefined) updateData.state = data.state?.trim() || null;
    if (data.pincode !== undefined) updateData.pincode = data.pincode?.trim() || null;
    if (data.openingBalance !== undefined) updateData.openingBalance = Number(data.openingBalance);
    if (data.openingBalanceType !== undefined) updateData.openingBalanceType = data.openingBalanceType;
    if (data.creditLimit !== undefined) updateData.creditLimit = Number(data.creditLimit);
    if (data.creditDays !== undefined) updateData.creditDays = Number(data.creditDays);
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

    if (data.storeId !== undefined) {
      if (data.storeId) {
        const storeExists = await prisma.store.findUnique({ where: { id: data.storeId } });
        if (!storeExists) throw new Error(`Store with ID '${data.storeId}' does not exist.`);
        updateData.store = { connect: { id: data.storeId } };
      } else {
        updateData.store = { disconnect: true };
      }
    }

    const updated = await prisma.party.update({
      where: { id },
      data: updateData,
      include: {
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return updated;
  }

  /**
   * Deactivate a party (status -> INACTIVE)
   */
  static async deactivateParty(id: string) {
    await this.getPartyById(id);

    const updated = await prisma.party.update({
      where: { id },
      data: { status: PartyStatus.INACTIVE },
      include: {
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return updated;
  }

  /**
   * Toggle party status between ACTIVE and INACTIVE
   */
  static async toggleStatus(id: string, status: PartyStatus) {
    await this.getPartyById(id);

    const updated = await prisma.party.update({
      where: { id },
      data: { status },
      include: {
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return updated;
  }
}

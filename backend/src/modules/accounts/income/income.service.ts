import prisma from '../../../config/db';
import { PaymentMode, UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CreateIncomeDTO {
  incomeDate?: string | Date;
  storeId: string;
  category: string;
  partyId?: string;
  amount: number;
  paymentMethod: string; // Cash, Bank, UPI, Card, Cheque, NEFT, RTGS, IMPS, Other
  reference?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface IncomeListFilters {
  search?: string;
  category?: string;
  storeId?: string;
  partyId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class IncomeService {
  /**
   * Helper to normalize payment method string to PaymentMode enum
   */
  static normalizePaymentMode(methodStr?: string): PaymentMode {
    if (!methodStr) return PaymentMode.CASH;
    const m = methodStr.trim().toUpperCase();
    if (m === 'CASH') return PaymentMode.CASH;
    if (m === 'CHEQUE') return PaymentMode.CHEQUE;
    if (m === 'UPI') return PaymentMode.UPI;
    return PaymentMode.BANK_TRANSFER;
  }

  /**
   * Helper to retrieve or create income ledger accounts
   */
  private static async getIncomeAccounts(category: string, tx?: any) {
    const client = tx || prisma;
    const catUpper = category.trim().toUpperCase();

    // Default chart of accounts: 4010 (Sales Revenue), 4020 (Auxiliary/Other Income)
    let accountCode = '4020';
    let accountName = `Other Operating Income (${category.trim()})`;

    if (catUpper.includes('SALE') || catUpper.includes('REVENUE')) {
      accountCode = '4010';
      accountName = 'Direct Sales Revenue';
    } else if (catUpper.includes('SCRAP') || catUpper.includes('DISPOSAL')) {
      accountCode = '4020';
      accountName = 'Scrap & Asset Disposal Income';
    } else if (catUpper.includes('CONSULT') || catUpper.includes('SERVICE')) {
      accountCode = '4020';
      accountName = 'Consulting & Service Fee Income';
    } else if (catUpper.includes('INTEREST') || catUpper.includes('DIVIDEND')) {
      accountCode = '4020';
      accountName = 'Interest & Investment Income';
    }

    const incomeAccount = await client.ledgerAccount.upsert({
      where: { code: accountCode },
      update: {},
      create: {
        code: accountCode,
        name: accountName,
        group: 'INCOME',
        balanceType: 'CREDIT',
        isSystem: true,
        description: `Ledger account for ${accountName}`,
      },
    });

    const liquidAccounts = await client.ledgerAccount.findMany({
      where: { code: { in: ['1010', '1020'] } },
    });
    const liquidMap: Record<string, string> = {};
    for (const a of liquidAccounts) {
      liquidMap[a.code] = a.id;
    }

    return {
      incomeAccountId: incomeAccount.id,
      cashAccountId: liquidMap['1010'] || liquidMap['1020'],
      bankAccountId: liquidMap['1020'] || liquidMap['1010'],
    };
  }

  /**
   * Record Operating / Auxiliary Income with atomic ACID Transaction & Double-Entry Journal
   */
  static async createIncome(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreateIncomeDTO
  ) {
    // 1. Role & User Validation
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to record income.`,
        403
      );
    }

    // 2. Store Access Validation
    if (!dto.storeId) {
      throw new Error('Store ID is required for income entry.');
    }
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(dto.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to record income for store '${dto.storeId}'.`,
        403
      );
    }
    const store = await prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw new Error(`Store with ID '${dto.storeId}' not found.`);
    }

    // 3. Category Validation
    if (!dto.category || !dto.category.trim()) {
      throw new Error('Income category is required.');
    }

    // 4. Amount Validation
    const amount = Math.round(Number(dto.amount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Income amount must be greater than zero.');
    }

    // 5. Party Validation (if provided)
    let party: any = null;
    if (dto.partyId) {
      party = await prisma.party.findUnique({ where: { id: dto.partyId } });
      if (!party) {
        throw new Error(`Party with ID '${dto.partyId}' not found.`);
      }
      if (party.status !== 'ACTIVE') {
        throw new Error(`Party '${party.name}' is inactive.`);
      }
    }

    const incomeDate = dto.incomeDate ? new Date(dto.incomeDate) : new Date();
    const isCash = dto.paymentMethod?.trim().toUpperCase() === 'CASH';
    const paymentMode = this.normalizePaymentMode(dto.paymentMethod);

    // 6. Execute Atomic Database Transaction (ACID)
    return prisma.$transaction(
      async (tx) => {
        const { incomeAccountId, cashAccountId, bankAccountId } = await this.getIncomeAccounts(
          dto.category,
          tx
        );
        const receiptAccountId = isCash ? cashAccountId : bankAccountId;

        // Generate sequential income number
        const incCount = await tx.income.count();
        const incomeNumber = `INC-${new Date().getFullYear()}-${(incCount + 1).toString().padStart(4, '0')}`;
        const journalNumber = `JV-INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        const narration =
          dto.description?.trim() ||
          `Income (${dto.category}): ${dto.reference ? `[Ref: ${dto.reference}]` : ''}${
            party ? ` Received from ${party.name}` : ''
          } via ${dto.paymentMethod || paymentMode}`;

        // Create Balanced Journal Entry
        // Debit: 1010/1020 Cash / Bank (Asset Increase)
        // Credit: 40XX Operating/Other Income Account (Revenue Increase)
        const journalLines = [
          {
            accountId: receiptAccountId,
            partyId: party ? party.id : null,
            debitAmount: amount,
            creditAmount: 0,
            description: `Receipt (${dto.paymentMethod || paymentMode}) for ${dto.category}`,
          },
          {
            accountId: incomeAccountId,
            partyId: party ? party.id : null,
            debitAmount: 0,
            creditAmount: amount,
            description: narration,
          },
        ];

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: journalNumber,
            entryDate: incomeDate,
            referenceType: 'INCOME',
            narration,
            totalAmount: amount,
            lines: {
              create: journalLines,
            },
          },
          include: {
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        // Insert Income Record
        const income = await tx.income.create({
          data: {
            incomeNumber,
            incomeDate,
            storeId: store.id,
            accountId: incomeAccountId,
            partyId: party ? party.id : null,
            amount,
            paymentMode,
            referenceNo: dto.reference?.trim() || null,
            category: dto.category.trim(),
            description: narration,
          },
          include: {
            store: { select: { id: true, code: true, name: true } },
            account: { select: { id: true, code: true, name: true } },
            party: { select: { id: true, code: true, name: true } },
          },
        });

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entity: 'Income',
            entityId: income.id,
            newValues: JSON.stringify({
              incomeNumber: income.incomeNumber,
              store: store.name,
              category: income.category,
              amount,
              party: party?.name || null,
              paymentMethod: dto.paymentMethod,
              reference: dto.reference || null,
              journalEntryId: journalEntry.id,
            }),
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
          },
        });

        return {
          income,
          journalEntry,
        };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * Get operating & other income with filtering and summary metrics
   */
  static async getIncome(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: IncomeListFilters = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Tenancy
    if (user.role !== UserRole.ADMIN) {
      where.storeId = { in: user.storeIds };
    }

    if (filters.storeId) {
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
        throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
      }
      where.storeId = filters.storeId;
    }

    if (filters.category && filters.category !== 'ALL') {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }

    if (filters.partyId) {
      where.partyId = filters.partyId;
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      const mode = this.normalizePaymentMode(filters.paymentMethod);
      where.paymentMode = mode;
    }

    if (filters.startDate || filters.endDate) {
      where.incomeDate = {};
      if (filters.startDate) where.incomeDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.incomeDate.lte = end;
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { incomeNumber: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, allMatching, incomeRecords] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.findMany({
        where,
        select: { amount: true, paymentMode: true },
      }),
      prisma.income.findMany({
        where,
        skip,
        take: limit,
        orderBy: { incomeDate: 'desc' },
        include: {
          store: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true, phone: true } },
        },
      }),
    ]);

    let totalIncome = 0;
    let cashIncome = 0;
    let bankIncome = 0;

    for (const inc of allMatching) {
      totalIncome += inc.amount;
      if (inc.paymentMode === PaymentMode.CASH) {
        cashIncome += inc.amount;
      } else {
        bankIncome += inc.amount;
      }
    }

    return {
      records: incomeRecords,
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        cashIncome: Math.round(cashIncome * 100) / 100,
        bankIncome: Math.round(bankIncome * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single income record with details
   */
  static async getIncomeById(
    incomeId: string,
    user: { id: string; role: UserRole; storeIds: string[] }
  ) {
    const income = await prisma.income.findUnique({
      where: { id: incomeId },
      include: {
        store: true,
        account: true,
        party: true,
      },
    });

    if (!income) {
      throw new AccountsSecurityError(`Income record with ID '${incomeId}' not found.`, 404);
    }

    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(income.storeId)) {
      throw new AccountsSecurityError(`Forbidden: Access denied to income in store '${income.storeId}'.`, 403);
    }

    return income;
  }
}

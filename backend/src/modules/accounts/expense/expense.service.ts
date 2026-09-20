import prisma from '../../../config/db';
import { PaymentMode, UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CreateExpenseDTO {
  expenseDate?: string | Date;
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

export interface ExpenseListFilters {
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

export class ExpenseService {
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
   * Helper to retrieve or create expense ledger accounts
   */
  private static async getExpenseAccounts(category: string, tx?: any) {
    const client = tx || prisma;
    const catUpper = category.trim().toUpperCase();

    // Default expense accounts in chart of accounts
    let accountCode = '5030';
    let accountName = `Operating Expenses (${category.trim()})`;

    if (catUpper.includes('RENT')) {
      accountCode = '5020';
      accountName = 'Rent & Facility Expense';
    } else if (catUpper.includes('SALARY') || catUpper.includes('WAGE') || catUpper.includes('PAYROLL')) {
      accountCode = '5040';
      accountName = 'Salaries & Staff Welfare Expense';
    } else if (catUpper.includes('ELECTRIC') || catUpper.includes('UTILITY') || catUpper.includes('WATER') || catUpper.includes('POWER')) {
      accountCode = '5050';
      accountName = 'Utilities, Power & Water Expense';
    } else if (catUpper.includes('LOGISTIC') || catUpper.includes('FREIGHT') || catUpper.includes('TRANSPORT')) {
      accountCode = '5060';
      accountName = 'Freight, Shipping & Logistics Expense';
    } else if (catUpper.includes('MAINTENANCE') || catUpper.includes('REPAIR')) {
      accountCode = '5070';
      accountName = 'Repairs & Machinery Maintenance Expense';
    }

    const expenseAccount = await client.ledgerAccount.upsert({
      where: { code: accountCode },
      update: {},
      create: {
        code: accountCode,
        name: accountName,
        group: 'EXPENSE',
        balanceType: 'DEBIT',
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
      expenseAccountId: expenseAccount.id,
      cashAccountId: liquidMap['1010'] || liquidMap['1020'],
      bankAccountId: liquidMap['1020'] || liquidMap['1010'],
    };
  }

  /**
   * Record Operating Expense with atomic ACID Transaction & Double-Entry Journal
   */
  static async createExpense(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreateExpenseDTO
  ) {
    // 1. Role & User Validation
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to record expenses.`,
        403
      );
    }

    // 2. Store Access Validation
    if (!dto.storeId) {
      throw new Error('Store ID is required for expense entry.');
    }
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(dto.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to record expenses for store '${dto.storeId}'.`,
        403
      );
    }
    const store = await prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw new Error(`Store with ID '${dto.storeId}' not found.`);
    }

    // 3. Category Validation
    if (!dto.category || !dto.category.trim()) {
      throw new Error('Expense category is required.');
    }

    // 4. Amount Validation
    const amount = Math.round(Number(dto.amount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
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

    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();
    const isCash = dto.paymentMethod?.trim().toUpperCase() === 'CASH';
    const paymentMode = this.normalizePaymentMode(dto.paymentMethod);

    // 6. Execute Atomic Database Transaction (ACID)
    return prisma.$transaction(
      async (tx) => {
        const { expenseAccountId, cashAccountId, bankAccountId } = await this.getExpenseAccounts(
          dto.category,
          tx
        );
        const disbursementAccountId = isCash ? cashAccountId : bankAccountId;

        // Generate sequential expense number
        const expCount = await tx.expense.count();
        const expenseNumber = `EXP-${new Date().getFullYear()}-${(expCount + 1).toString().padStart(4, '0')}`;
        const journalNumber = `JV-EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        const narration =
          dto.description?.trim() ||
          `Expense (${dto.category}): ${dto.reference ? `[Ref: ${dto.reference}]` : ''}${
            party ? ` Paid to ${party.name}` : ''
          } via ${dto.paymentMethod || paymentMode}`;

        // Create Balanced Journal Entry
        // Debit: 50XX Operating Expense Account
        // Credit: 1010/1020 Cash / Bank
        const journalLines = [
          {
            accountId: expenseAccountId,
            partyId: party ? party.id : null,
            debitAmount: amount,
            creditAmount: 0,
            description: narration,
          },
          {
            accountId: disbursementAccountId,
            partyId: party ? party.id : null,
            debitAmount: 0,
            creditAmount: amount,
            description: `Disbursement (${dto.paymentMethod || paymentMode}) for ${dto.category}`,
          },
        ];

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: journalNumber,
            entryDate: expenseDate,
            referenceType: 'EXPENSE',
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

        // Insert Expense Record
        const expense = await tx.expense.create({
          data: {
            expenseNumber,
            expenseDate,
            storeId: store.id,
            accountId: expenseAccountId,
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
            entity: 'Expense',
            entityId: expense.id,
            newValues: JSON.stringify({
              expenseNumber: expense.expenseNumber,
              store: store.name,
              category: expense.category,
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
          expense,
          journalEntry,
        };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * Get operating expenses with filtering and summary metrics
   */
  static async getExpenses(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: ExpenseListFilters = {}
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
      where.expenseDate = {};
      if (filters.startDate) where.expenseDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { expenseNumber: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, allMatching, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        select: { amount: true, paymentMode: true },
      }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          store: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true, phone: true } },
        },
      }),
    ]);

    let totalExpenses = 0;
    let cashExpenses = 0;
    let bankExpenses = 0;

    for (const e of allMatching) {
      totalExpenses += e.amount;
      if (e.paymentMode === PaymentMode.CASH) {
        cashExpenses += e.amount;
      } else {
        bankExpenses += e.amount;
      }
    }

    return {
      records: expenses,
      summary: {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        cashExpenses: Math.round(cashExpenses * 100) / 100,
        bankExpenses: Math.round(bankExpenses * 100) / 100,
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
   * Get single expense record with details
   */
  static async getExpenseById(
    expenseId: string,
    user: { id: string; role: UserRole; storeIds: string[] }
  ) {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        store: true,
        account: true,
        party: true,
      },
    });

    if (!expense) {
      throw new AccountsSecurityError(`Expense record with ID '${expenseId}' not found.`, 404);
    }

    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(expense.storeId)) {
      throw new AccountsSecurityError(`Forbidden: Access denied to expense in store '${expense.storeId}'.`, 403);
    }

    return expense;
  }
}

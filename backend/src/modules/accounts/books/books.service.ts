import prisma from '../../../config/db';
import { UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface DayBookFilters {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CashBookFilters {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BankBookFilters {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class BooksService {
  /**
   * Helper: ensure standard liquid cash/bank accounts exist
   */
  private static async getLiquidAccount(code: '1010' | '1020') {
    const isCash = code === '1010';
    return prisma.ledgerAccount.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: isCash ? 'Cash on Hand' : 'Operating Bank Account',
        group: 'ASSET',
        balanceType: 'DEBIT',
        isSystem: true,
        description: isCash ? 'Physical Cash in Hand ledger account' : 'Primary Operating Bank Ledger Account',
      },
    });
  }

  /**
   * 1. DAY BOOK: Chronological list of all accounting transactions
   * Columns: Date, Transaction, Reference, Party, Debit, Credit, Amount, Store, Created By
   */
  static async getDayBook(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: DayBookFilters = {}
  ) {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(`Forbidden: Role '${user.role}' is not authorized to view Day Book.`, 403);
    }

    if (filters.storeId && user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
      throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(200, filters.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.entryDate.lte = end;
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { entryNumber: { contains: q, mode: 'insensitive' } },
        { narration: { contains: q, mode: 'insensitive' } },
        { referenceType: { contains: q, mode: 'insensitive' } },
        {
          lines: {
            some: {
              OR: [
                { party: { name: { contains: q, mode: 'insensitive' } } },
                { party: { code: { contains: q, mode: 'insensitive' } } },
                { account: { name: { contains: q, mode: 'insensitive' } } },
                { account: { code: { contains: q, mode: 'insensitive' } } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Fetch journal entries with lines, accounts, parties, and linked accounting transactions
    const [total, entries] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, group: true } },
              party: { select: { id: true, code: true, name: true, storeId: true, store: { select: { id: true, code: true, name: true } } } },
            },
          },
          accountingTransactions: {
            include: {
              store: { select: { id: true, code: true, name: true } },
              party: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    // Gather creator IDs & entity references from AuditLogs for "Created By"
    const journalIds = entries.map((e) => e.id);
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'JournalEntry', entityId: { in: journalIds } },
          { entity: 'Payment', entityId: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
          { entity: 'Receipt', entityId: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
          { entity: 'Expense', entityId: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
          { entity: 'Income', entityId: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
          { entity: 'Purchase', entityId: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const auditMap: Record<string, any> = {};
    for (const log of auditLogs) {
      if (log.entityId) {
        auditMap[log.entityId] = log.user;
      }
    }

    // Fetch related stores for expenses / income / payments if not directly on accountingTransactions
    const expenseNumbers = entries.filter((e) => e.referenceType === 'EXPENSE').map((e) => e.entryNumber.replace('JV-', ''));
    const incomeNumbers = entries.filter((e) => e.referenceType === 'INCOME').map((e) => e.entryNumber.replace('JV-', ''));

    const [matchedExpenses, matchedIncome] = await Promise.all([
      expenseNumbers.length > 0
        ? prisma.expense.findMany({
            where: {
              OR: [
                { expenseNumber: { in: expenseNumbers } },
                { id: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
              ],
            },
            include: { store: { select: { id: true, code: true, name: true } } },
          })
        : [],
      incomeNumbers.length > 0
        ? prisma.income.findMany({
            where: {
              OR: [
                { incomeNumber: { in: incomeNumbers } },
                { id: { in: entries.map((e) => e.referenceId).filter(Boolean) as string[] } },
              ],
            },
            include: { store: { select: { id: true, code: true, name: true } } },
          })
        : [],
    ]);

    const expenseStoreMap: Record<string, any> = {};
    matchedExpenses.forEach((exp) => {
      expenseStoreMap[exp.id] = exp.store;
      expenseStoreMap[exp.expenseNumber] = exp.store;
    });

    const incomeStoreMap: Record<string, any> = {};
    matchedIncome.forEach((inc) => {
      incomeStoreMap[inc.id] = inc.store;
      incomeStoreMap[inc.incomeNumber] = inc.store;
    });

    // Format transactions to match requested Day Book columns:
    // Date, Transaction, Reference, Party, Debit, Credit, Amount, Store, Created By
    const formattedTransactions = entries.map((entry) => {
      // 1. Debit lines & Credit lines
      const debitLines = entry.lines.filter((l) => l.debitAmount > 0);
      const creditLines = entry.lines.filter((l) => l.creditAmount > 0);

      const debitDetails = debitLines.map((l) => `${l.account.name} (${l.account.code}): ₹${l.debitAmount.toLocaleString('en-IN')}`).join('; ') || '—';
      const creditDetails = creditLines.map((l) => `${l.account.name} (${l.account.code}): ₹${l.creditAmount.toLocaleString('en-IN')}`).join('; ') || '—';

      // 2. Party identification
      const partyLine = entry.lines.find((l) => l.party != null);
      const party = partyLine?.party
        ? `${partyLine.party.name} (${partyLine.party.code})`
        : entry.accountingTransactions[0]?.party
        ? `${entry.accountingTransactions[0].party.name} (${entry.accountingTransactions[0].party.code})`
        : '—';

      // 3. Store identification
      let store = entry.accountingTransactions[0]?.store;
      if (!store && entry.referenceId && expenseStoreMap[entry.referenceId]) {
        store = expenseStoreMap[entry.referenceId];
      }
      if (!store && entry.referenceId && incomeStoreMap[entry.referenceId]) {
        store = incomeStoreMap[entry.referenceId];
      }
      if (!store) {
        const expKey = entry.entryNumber.replace('JV-', '');
        if (expenseStoreMap[expKey]) store = expenseStoreMap[expKey];
        if (incomeStoreMap[expKey]) store = incomeStoreMap[expKey];
      }
      if (!store && partyLine?.party?.store) {
        store = partyLine.party.store;
      }

      // 4. Created By identification
      const creator =
        auditMap[entry.id] ||
        (entry.referenceId ? auditMap[entry.referenceId] : null) ||
        { name: 'System / Admin', email: 'admin@prozen.com' };

      // 5. Reference string
      const ref =
        entry.accountingTransactions[0]?.invoiceNumber ||
        entry.referenceType ||
        entry.entryNumber;

      return {
        id: entry.id,
        date: entry.entryDate,
        transaction: entry.entryNumber,
        reference: ref,
        referenceType: entry.referenceType,
        party,
        debit: debitDetails,
        credit: creditDetails,
        debitLines: debitLines.map((l) => ({
          accountName: l.account.name,
          accountCode: l.account.code,
          amount: l.debitAmount,
        })),
        creditLines: creditLines.map((l) => ({
          accountName: l.account.name,
          accountCode: l.account.code,
          amount: l.creditAmount,
        })),
        amount: entry.totalAmount,
        narration: entry.narration,
        store: store ? `${store.name} (${store.code})` : 'All / Central Store',
        storeId: store?.id || null,
        createdBy: creator ? `${creator.name} (${creator.email})` : 'System User',
      };
    });

    // Tenancy filter check if storeId provided or non-admin user
    let filteredList = formattedTransactions;
    if (filters.storeId) {
      filteredList = filteredList.filter(
        (t) => t.storeId === filters.storeId || t.store.includes('Central')
      );
    } else if (user.role !== UserRole.ADMIN) {
      filteredList = filteredList.filter(
        (t) => (t.storeId && user.storeIds.includes(t.storeId)) || t.store.includes('Central')
      );
    }

    // Summary calculation
    let totalDebitSum = 0;
    let totalCreditSum = 0;
    filteredList.forEach((t) => {
      totalDebitSum += t.amount;
      totalCreditSum += t.amount;
    });

    return {
      records: filteredList,
      summary: {
        totalTransactions: filteredList.length,
        totalDebit: Math.round(totalDebitSum * 100) / 100,
        totalCredit: Math.round(totalCreditSum * 100) / 100,
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
   * 2. CASH BOOK: Account 1010
   * Summary: Opening Cash, Cash Receipts, Cash Payments, Closing Cash
   * Filter by Date and Store
   */
  static async getCashBook(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: CashBookFilters = {}
  ) {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(`Forbidden: Role '${user.role}' is not authorized to view Cash Book.`, 403);
    }

    if (filters.storeId && user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
      throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
    }

    const cashAccount = await this.getLiquidAccount('1010');

    // Dates
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    let endDate: Date | null = null;
    if (filters.endDate) {
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // A. Calculate Opening Cash (all cash journal lines strictly prior to startDate)
    let openingCash = 0;
    if (startDate) {
      const priorWhere: any = {
        accountId: cashAccount.id,
        journalEntry: {
          entryDate: { lt: startDate },
        },
      };
      if (filters.storeId) {
        priorWhere.journalEntry.storeId = filters.storeId;
      }
      const priorAgg = await prisma.journalEntryLine.aggregate({
        where: priorWhere,
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });
      openingCash = (priorAgg._sum.debitAmount || 0) - (priorAgg._sum.creditAmount || 0);
    }

    // B. Query transactions in the period
    const lineWhere: any = {
      accountId: cashAccount.id,
      journalEntry: {},
    };

    if (startDate || endDate) {
      lineWhere.journalEntry.entryDate = {};
      if (startDate) lineWhere.journalEntry.entryDate.gte = startDate;
      if (endDate) lineWhere.journalEntry.entryDate.lte = endDate;
    }
    if (filters.storeId) {
      lineWhere.journalEntry.storeId = filters.storeId;
    }

    // Fetch all lines in period to calculate running balance and summary
    const periodLines = await prisma.journalEntryLine.findMany({
      where: lineWhere,
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { id: 'asc' },
      ],
      include: {
        journalEntry: {
          include: {
            store: { select: { id: true, code: true, name: true } },
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true } },
                party: { select: { id: true, code: true, name: true, storeId: true } },
              },
            },
            accountingTransactions: {
              include: {
                store: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        party: { select: { id: true, code: true, name: true } },
      },
    });

    let cashReceipts = 0;
    let cashPayments = 0;
    let currentBalance = openingCash;

    const entries = periodLines.map((line) => {
      const isReceipt = line.debitAmount > 0;
      const receiptAmt = line.debitAmount;
      const paymentAmt = line.creditAmount;

      cashReceipts += receiptAmt;
      cashPayments += paymentAmt;
      currentBalance = currentBalance + receiptAmt - paymentAmt;

      // Find contra lines in the same journal entry (the other side of the entry)
      const contraLines = line.journalEntry.lines.filter((l) => l.id !== line.id);
      const contraAccounts = contraLines.map((c) => `${c.account.name} (${c.account.code})`).join(', ') || 'General Account';

      const party =
        line.party ||
        line.journalEntry.lines.find((l) => l.party != null)?.party ||
        null;

      const store =
        line.journalEntry.store ||
        line.journalEntry.accountingTransactions[0]?.store ||
        null;

      return {
        id: line.id,
        date: line.journalEntry.entryDate,
        voucherNumber: line.journalEntry.entryNumber,
        referenceType: line.journalEntry.referenceType,
        narration: line.journalEntry.narration,
        particulars: contraAccounts,
        party: party ? `${party.name} (${party.code})` : '—',
        store: store ? `${store.name} (${store.code})` : 'Store',
        storeId: store?.id || null,
        receipt: receiptAmt,
        payment: paymentAmt,
        runningBalance: Math.round(currentBalance * 100) / 100,
      };
    });

    // Tenancy filtering if applicable
    let filteredEntries = entries;
    if (filters.storeId) {
      filteredEntries = filteredEntries.filter((e) => !e.storeId || e.storeId === filters.storeId);
    } else if (user.role !== UserRole.ADMIN) {
      filteredEntries = filteredEntries.filter((e) => !e.storeId || user.storeIds.includes(e.storeId));
    }

    const closingCash = openingCash + cashReceipts - cashPayments;

    return {
      summary: {
        cashAccountCode: '1010',
        cashAccountName: cashAccount.name,
        openingCash: Math.round(openingCash * 100) / 100,
        cashReceipts: Math.round(cashReceipts * 100) / 100,
        cashPayments: Math.round(cashPayments * 100) / 100,
        closingCash: Math.round(closingCash * 100) / 100,
      },
      entries: filteredEntries,
    };
  }

  /**
   * 3. BANK BOOK: Account 1020
   * Summary: Opening Bank Balance, Bank Receipts, Bank Payments, Closing Bank Balance
   * Filter by Date and Store
   */
  static async getBankBook(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: BankBookFilters = {}
  ) {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(`Forbidden: Role '${user.role}' is not authorized to view Bank Book.`, 403);
    }

    if (filters.storeId && user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
      throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
    }

    const bankAccount = await this.getLiquidAccount('1020');

    // Dates
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    let endDate: Date | null = null;
    if (filters.endDate) {
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // A. Calculate Opening Bank Balance (all bank journal lines strictly prior to startDate)
    let openingBankBalance = 0;
    if (startDate) {
      const priorWhere: any = {
        accountId: bankAccount.id,
        journalEntry: {
          entryDate: { lt: startDate },
        },
      };
      if (filters.storeId) {
        priorWhere.journalEntry.storeId = filters.storeId;
      }
      const priorAgg = await prisma.journalEntryLine.aggregate({
        where: priorWhere,
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });
      openingBankBalance = (priorAgg._sum.debitAmount || 0) - (priorAgg._sum.creditAmount || 0);
    }

    // B. Query transactions in the period
    const lineWhere: any = {
      accountId: bankAccount.id,
      journalEntry: {},
    };

    if (startDate || endDate) {
      lineWhere.journalEntry.entryDate = {};
      if (startDate) lineWhere.journalEntry.entryDate.gte = startDate;
      if (endDate) lineWhere.journalEntry.entryDate.lte = endDate;
    }
    if (filters.storeId) {
      lineWhere.journalEntry.storeId = filters.storeId;
    }

    const periodLines = await prisma.journalEntryLine.findMany({
      where: lineWhere,
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { id: 'asc' },
      ],
      include: {
        journalEntry: {
          include: {
            store: { select: { id: true, code: true, name: true } },
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true } },
                party: { select: { id: true, code: true, name: true, storeId: true } },
              },
            },
            accountingTransactions: {
              include: {
                store: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        party: { select: { id: true, code: true, name: true } },
      },
    });

    let bankReceipts = 0;
    let bankPayments = 0;
    let currentBalance = openingBankBalance;

    const entries = periodLines.map((line) => {
      const receiptAmt = line.debitAmount;
      const paymentAmt = line.creditAmount;

      bankReceipts += receiptAmt;
      bankPayments += paymentAmt;
      currentBalance = currentBalance + receiptAmt - paymentAmt;

      // Find contra lines
      const contraLines = line.journalEntry.lines.filter((l) => l.id !== line.id);
      const contraAccounts = contraLines.map((c) => `${c.account.name} (${c.account.code})`).join(', ') || 'General Account';

      const party =
        line.party ||
        line.journalEntry.lines.find((l) => l.party != null)?.party ||
        null;

      const store =
        line.journalEntry.store ||
        line.journalEntry.accountingTransactions[0]?.store ||
        null;

      return {
        id: line.id,
        date: line.journalEntry.entryDate,
        voucherNumber: line.journalEntry.entryNumber,
        referenceType: line.journalEntry.referenceType,
        narration: line.journalEntry.narration,
        particulars: contraAccounts,
        party: party ? `${party.name} (${party.code})` : '—',
        store: store ? `${store.name} (${store.code})` : 'Store',
        storeId: store?.id || null,
        receipt: receiptAmt,
        payment: paymentAmt,
        runningBalance: Math.round(currentBalance * 100) / 100,
      };
    });


    // Tenancy filtering if applicable
    let filteredEntries = entries;
    if (filters.storeId) {
      filteredEntries = filteredEntries.filter((e) => !e.storeId || e.storeId === filters.storeId);
    } else if (user.role !== UserRole.ADMIN) {
      filteredEntries = filteredEntries.filter((e) => !e.storeId || user.storeIds.includes(e.storeId));
    }

    const closingBankBalance = openingBankBalance + bankReceipts - bankPayments;

    return {
      summary: {
        bankAccountCode: '1020',
        bankAccountName: bankAccount.name,
        openingBankBalance: Math.round(openingBankBalance * 100) / 100,
        bankReceipts: Math.round(bankReceipts * 100) / 100,
        bankPayments: Math.round(bankPayments * 100) / 100,
        closingBankBalance: Math.round(closingBankBalance * 100) / 100,
      },
      entries: filteredEntries,
    };
  }
}

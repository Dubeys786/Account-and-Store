import prisma from '../../../config/db';
import { UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CashBankPositionQuery {
  asOfDate?: string;
  storeId?: string;
}

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

export interface CashBankPositionResponse {
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

export class CashBankPositionService {
  /**
   * Helper: ensure standard liquid cash/bank accounts exist in DB
   */
  private static async getLiquidAccounts() {
    // 1. Cash on Hand (1010)
    const cashAccount = await prisma.ledgerAccount.upsert({
      where: { code: '1010' },
      update: {},
      create: {
        code: '1010',
        name: 'Cash on Hand',
        group: 'ASSET',
        balanceType: 'DEBIT',
        isSystem: true,
        description: 'Physical Cash in Hand ledger account',
      },
    });

    // 2. Ensure Primary Bank Account exists (1020)
    await prisma.ledgerAccount.upsert({
      where: { code: '1020' },
      update: {},
      create: {
        code: '1020',
        name: 'Operating Bank Account',
        group: 'ASSET',
        balanceType: 'DEBIT',
        isSystem: true,
        description: 'Primary Operating Bank Ledger Account',
      },
    });

    // 3. Find all bank accounts (1020 or ASSET with 102x or 'Bank' in name)
    const bankAccounts = await prisma.ledgerAccount.findMany({
      where: {
        group: 'ASSET',
        OR: [
          { code: { startsWith: '102' } },
          { name: { contains: 'Bank', mode: 'insensitive' } },
        ],
      },
      orderBy: { code: 'asc' },
    });

    return { cashAccount, bankAccounts };
  }

  /**
   * Calculate live real-time Cash & Bank Position from real posted ledger entries
   */
  static async getPosition(
    user: { id: string; role: UserRole; storeIds: string[] },
    query: CashBankPositionQuery = {}
  ): Promise<CashBankPositionResponse> {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to view Cash & Bank Position.`,
        403
      );
    }

    // Tenancy authorization
    const requestedStoreId =
      query.storeId && query.storeId.toLowerCase() !== 'all' && query.storeId.trim() !== ''
        ? query.storeId.trim()
        : null;

    if (
      requestedStoreId &&
      user.role !== UserRole.ADMIN &&
      !user.storeIds.includes(requestedStoreId)
    ) {
      throw new AccountsSecurityError(
        `Forbidden: Store access denied for '${requestedStoreId}'.`,
        403
      );
    }

    // Determine target Date (defaults to Today)
    let targetDate: Date;
    if (query.asOfDate) {
      const parts = query.asOfDate.split('T')[0].split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        targetDate = new Date();
      }
    } else {
      targetDate = new Date();
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const formattedDate = targetDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // Store criteria for Prisma
    const storeFilter: any = {};
    let storeName = 'All Stores (Consolidated)';
    if (requestedStoreId) {
      storeFilter.storeId = requestedStoreId;
      const storeRecord = await prisma.store.findUnique({
        where: { id: requestedStoreId },
        select: { id: true, name: true, code: true },
      });
      if (storeRecord) {
        storeName = `${storeRecord.name} (${storeRecord.code})`;
      }
    } else if (user.role !== UserRole.ADMIN && user.storeIds.length > 0) {
      storeFilter.storeId = { in: user.storeIds };
      storeName = 'Authorized Stores';
    }

    const { cashAccount, bankAccounts } = await this.getLiquidAccounts();

    // ==========================================
    // 1. CASH IN HAND (1010)
    // ==========================================
    // Prior opening balance (strictly before startOfDay)
    const cashPriorAgg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: cashAccount.id,
        journalEntry: {
          entryDate: { lt: startOfDay },
          ...storeFilter,
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const cashOpening =
      Number(cashPriorAgg._sum.debitAmount || 0) - Number(cashPriorAgg._sum.creditAmount || 0);

    // Today's cash movements (between startOfDay and endOfDay)
    const cashTodayAgg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: cashAccount.id,
        journalEntry: {
          entryDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          ...storeFilter,
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const cashInflow = Number(cashTodayAgg._sum.debitAmount || 0);
    const cashOutflow = Number(cashTodayAgg._sum.creditAmount || 0);
    const cashCurrent = cashOpening + cashInflow - cashOutflow;

    const totalCashTxCount = await prisma.journalEntryLine.count({
      where: {
        accountId: cashAccount.id,
        journalEntry: {
          entryDate: { lte: endOfDay },
          ...storeFilter,
        },
      },
    });

    // ==========================================
    // 2. BANK BALANCES (Per Account & Total)
    // ==========================================
    let totalBankOpening = 0;
    let totalBankInflow = 0;
    let totalBankOutflow = 0;
    let totalBankTxCount = 0;

    const accountBreakdowns: BankAccountBreakdown[] = [];

    for (const bank of bankAccounts) {
      // Prior opening balance for this bank account
      const bankPriorAgg = await prisma.journalEntryLine.aggregate({
        where: {
          accountId: bank.id,
          journalEntry: {
            entryDate: { lt: startOfDay },
            ...storeFilter,
          },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      const bankOpening =
        Number(bankPriorAgg._sum.debitAmount || 0) - Number(bankPriorAgg._sum.creditAmount || 0);

      // Today's bank movements
      const bankTodayAgg = await prisma.journalEntryLine.aggregate({
        where: {
          accountId: bank.id,
          journalEntry: {
            entryDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
            ...storeFilter,
          },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const bankInflow = Number(bankTodayAgg._sum.debitAmount || 0);
      const bankOutflow = Number(bankTodayAgg._sum.creditAmount || 0);
      const bankClosing = bankOpening + bankInflow - bankOutflow;

      const bankTxCount = await prisma.journalEntryLine.count({
        where: {
          accountId: bank.id,
          journalEntry: {
            entryDate: { lte: endOfDay },
            ...storeFilter,
          },
        },
      });

      totalBankOpening += bankOpening;
      totalBankInflow += bankInflow;
      totalBankOutflow += bankOutflow;
      totalBankTxCount += bankTxCount;

      accountBreakdowns.push({
        id: bank.id,
        code: bank.code,
        name: bank.name,
        openingBalance: Math.round(bankOpening * 100) / 100,
        todayInflow: Math.round(bankInflow * 100) / 100,
        todayOutflow: Math.round(bankOutflow * 100) / 100,
        closingBalance: Math.round(bankClosing * 100) / 100,
        transactionCount: bankTxCount,
      });
    }

    const totalBankCurrent = totalBankOpening + totalBankInflow - totalBankOutflow;

    // ==========================================
    // 3. CONSOLIDATED TOTALS & STATUS
    // ==========================================
    const totalAvailable = cashCurrent + totalBankCurrent;
    const totalInflow = cashInflow + totalBankInflow;
    const totalOutflow = cashOutflow + totalBankOutflow;
    const netMovement = totalInflow - totalOutflow;

    const totalCount = totalCashTxCount + totalBankTxCount;
    const hasPostedTransactions = totalCount > 0;

    return {
      asOfDate: targetDate.toISOString().slice(0, 10),
      formattedDate,
      storeId: requestedStoreId,
      storeName,
      hasPostedTransactions,
      statusMessage: hasPostedTransactions
        ? 'Live balances from posted transactions'
        : 'No posted transactions available',
      cash: {
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: cashAccount.name,
        openingBalance: Math.round(cashOpening * 100) / 100,
        todayInflow: Math.round(cashInflow * 100) / 100,
        todayOutflow: Math.round(cashOutflow * 100) / 100,
        currentBalance: Math.round(cashCurrent * 100) / 100,
        transactionCount: totalCashTxCount,
      },
      bank: {
        totalOpeningBalance: Math.round(totalBankOpening * 100) / 100,
        todayInflow: Math.round(totalBankInflow * 100) / 100,
        todayOutflow: Math.round(totalBankOutflow * 100) / 100,
        currentBalance: Math.round(totalBankCurrent * 100) / 100,
        totalTransactionCount: totalBankTxCount,
        accounts: accountBreakdowns,
      },
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      todayMovement: {
        totalInflow: Math.round(totalInflow * 100) / 100,
        totalOutflow: Math.round(totalOutflow * 100) / 100,
        netMovement: Math.round(netMovement * 100) / 100,
      },
    };
  }
}

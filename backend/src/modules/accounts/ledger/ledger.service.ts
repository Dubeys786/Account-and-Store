import prisma from '../../../config/db';
import { BalanceType, PartyType } from '@prisma/client';
import { PartyLedgerResult, PartyBalanceResult, LedgerEntryRow } from './ledger.types';

export class LedgerService {
  /**
   * Helper to format currency and balance indicator (₹ 12,500.00 Dr / Cr)
   */
  private static formatBalance(amount: number, type: BalanceType): string {
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${
      type === BalanceType.DEBIT ? 'Dr' : 'Cr'
    }`;
  }

  /**
   * Calculate comprehensive Party Ledger Statement with chronological running balances
   * Source of truth: Database records
   */
  static async getPartyLedger(
    partyId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<PartyLedgerResult> {
    const party = await prisma.party.findUnique({
      where: { id: partyId },
    });
    if (!party) {
      throw new Error(`Party with ID '${partyId}' not found.`);
    }

    const startDate = options.startDate ? new Date(options.startDate) : null;
    const endDate = options.endDate ? new Date(options.endDate) : null;

    const isCustomer = party.type === PartyType.CUSTOMER;
    const normalBalanceType = isCustomer ? BalanceType.DEBIT : BalanceType.CREDIT;

    // 1. Calculate Base Opening Balance
    let baseAmount = Number(party.openingBalance || 0);
    let baseType = party.openingBalanceType || BalanceType.DEBIT;

    // Signed running balance in terms of normal balance (+ is normal, - is contra)
    let currentRunningBalance = 0;
    if (normalBalanceType === BalanceType.DEBIT) {
      currentRunningBalance = baseType === BalanceType.DEBIT ? baseAmount : -baseAmount;
    } else {
      currentRunningBalance = baseType === BalanceType.CREDIT ? baseAmount : -baseAmount;
    }

    // 2. Adjust for transactions prior to startDate (if startDate provided)
    if (startDate) {
      const priorLines = await prisma.journalEntryLine.findMany({
        where: {
          partyId,
          journalEntry: {
            entryDate: { lt: startDate },
          },
        },
        include: {
          journalEntry: true,
        },
      });

      for (const line of priorLines) {
        if (normalBalanceType === BalanceType.DEBIT) {
          currentRunningBalance += line.debitAmount - line.creditAmount;
        } else {
          currentRunningBalance += line.creditAmount - line.debitAmount;
        }
      }

      // Also account for unlinked accounting transactions prior to startDate
      const priorTxns = await prisma.accountingTransaction.findMany({
        where: {
          partyId,
          journalEntryId: null,
          invoiceDate: { lt: startDate },
        },
      });
      for (const txn of priorTxns) {
        const debit = txn.transactionType === 'PURCHASE_RETURN' || txn.transactionType === 'SALE' || txn.transactionType === 'SALES' ? txn.netAmount : 0;
        const credit = txn.transactionType.startsWith('PURCHASE') || txn.transactionType === 'SALE_RETURN' ? txn.netAmount : 0;
        if (normalBalanceType === BalanceType.DEBIT) {
          currentRunningBalance += debit - credit;
        } else {
          currentRunningBalance += credit - debit;
        }
      }

      baseAmount = Math.abs(currentRunningBalance);
      if (normalBalanceType === BalanceType.DEBIT) {
        baseType = currentRunningBalance >= 0 ? BalanceType.DEBIT : BalanceType.CREDIT;
      } else {
        baseType = currentRunningBalance >= 0 ? BalanceType.CREDIT : BalanceType.DEBIT;
      }
    }

    const effectiveOpeningBalance = {
      amount: Math.round(baseAmount * 100) / 100,
      type: baseType,
      formatted: this.formatBalance(baseAmount, baseType),
    };

    // 3. Fetch all entries within the requested period
    const entryDateFilter: any = {};
    if (startDate) entryDateFilter.gte = startDate;
    if (endDate) entryDateFilter.lte = endDate;

    const periodLines = await prisma.journalEntryLine.findMany({
      where: {
        partyId,
        ...(startDate || endDate ? { journalEntry: { entryDate: entryDateFilter } } : {}),
      },
      include: {
        journalEntry: true,
        account: true,
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { journalEntry: { createdAt: 'asc' } },
      ],
    });

    // Also fetch any accounting transactions not linked to journal entries
    const unlinkedTxns = await prisma.accountingTransaction.findMany({
      where: {
        partyId,
        journalEntryId: null,
        ...(startDate || endDate ? { invoiceDate: entryDateFilter } : {}),
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // Merge and sort all records chronologically
    type NormalizedRecord = {
      id: string;
      date: Date;
      voucherNumber: string;
      referenceType: string;
      particulars: string;
      debit: number;
      credit: number;
      createdAt: Date;
    };

    const combined: NormalizedRecord[] = [];

    for (const l of periodLines) {
      combined.push({
        id: l.id,
        date: l.journalEntry.entryDate,
        voucherNumber: l.journalEntry.entryNumber,
        referenceType: l.journalEntry.referenceType || 'JOURNAL',
        particulars: l.description || l.journalEntry.narration,
        debit: l.debitAmount,
        credit: l.creditAmount,
        createdAt: l.journalEntry.createdAt,
      });
    }

    for (const t of unlinkedTxns) {
      const isDebit = t.transactionType === 'PURCHASE_RETURN' || t.transactionType === 'SALE' || t.transactionType === 'SALES';
      combined.push({
        id: t.id,
        date: t.invoiceDate,
        voucherNumber: t.invoiceNumber,
        referenceType: t.transactionType,
        particulars: t.notes || `${t.transactionType} Invoice ${t.invoiceNumber}`,
        debit: isDebit ? t.netAmount : 0,
        credit: !isDebit ? t.netAmount : 0,
        createdAt: t.createdAt,
      });
    }

    combined.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime());

    // 4. Calculate Chronological Running Balances
    const entries: LedgerEntryRow[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const row of combined) {
      totalDebit += row.debit;
      totalCredit += row.credit;

      if (normalBalanceType === BalanceType.DEBIT) {
        currentRunningBalance += row.debit - row.credit;
      } else {
        currentRunningBalance += row.credit - row.debit;
      }

      let rowBalanceType: BalanceType;
      if (normalBalanceType === BalanceType.DEBIT) {
        rowBalanceType = currentRunningBalance >= 0 ? BalanceType.DEBIT : BalanceType.CREDIT;
      } else {
        rowBalanceType = currentRunningBalance >= 0 ? BalanceType.CREDIT : BalanceType.DEBIT;
      }

      const absBalance = Math.round(Math.abs(currentRunningBalance) * 100) / 100;

      entries.push({
        id: row.id,
        date: row.date.toISOString().split('T')[0],
        voucherNumber: row.voucherNumber,
        referenceType: row.referenceType,
        particulars: row.particulars,
        debit: Math.round(row.debit * 100) / 100,
        credit: Math.round(row.credit * 100) / 100,
        runningBalance: absBalance,
        balanceType: rowBalanceType,
        formattedBalance: this.formatBalance(absBalance, rowBalanceType),
      });
    }

    // 5. Final Closing Balance
    const closingAmount = Math.round(Math.abs(currentRunningBalance) * 100) / 100;
    let closingType: BalanceType;
    if (normalBalanceType === BalanceType.DEBIT) {
      closingType = currentRunningBalance >= 0 ? BalanceType.DEBIT : BalanceType.CREDIT;
    } else {
      closingType = currentRunningBalance >= 0 ? BalanceType.CREDIT : BalanceType.DEBIT;
    }

    return {
      party: {
        id: party.id,
        code: party.code,
        name: party.name,
        type: party.type,
        gstin: party.gstin,
        phone: party.mobile || party.phone,
        creditLimit: party.creditLimit,
      },
      period: {
        startDate: options.startDate,
        endDate: options.endDate,
      },
      openingBalance: effectiveOpeningBalance,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      closingBalance: {
        amount: closingAmount,
        type: closingType,
        formatted: this.formatBalance(closingAmount, closingType),
      },
      entries,
    };
  }

  /**
   * Get real-time calculated outstanding balance for a party
   */
  static async getPartyBalance(partyId: string): Promise<PartyBalanceResult> {
    const ledger = await this.getPartyLedger(partyId);
    const party = await prisma.party.findUnique({
      where: { id: partyId },
    });
    if (!party) {
      throw new Error(`Party with ID '${partyId}' not found.`);
    }

    const availableCredit =
      party.type === PartyType.CUSTOMER && party.creditLimit > 0
        ? Math.max(0, party.creditLimit - (ledger.closingBalance.type === BalanceType.DEBIT ? ledger.closingBalance.amount : 0))
        : undefined;

    return {
      partyId: party.id,
      code: party.code,
      name: party.name,
      type: party.type,
      openingBalance: {
        amount: ledger.openingBalance.amount,
        type: ledger.openingBalance.type,
      },
      totalDebit: ledger.totalDebit,
      totalCredit: ledger.totalCredit,
      currentBalance: {
        amount: ledger.closingBalance.amount,
        type: ledger.closingBalance.type,
      },
      formattedBalance: ledger.closingBalance.formatted,
      creditLimit: party.creditLimit,
      availableCredit,
      status: party.status,
    };
  }

  /**
   * Get party transactions history
   */
  static async getPartyTransactions(
    partyId: string,
    options: { page?: number; limit?: number; type?: string } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { partyId };
    if (options.type) {
      where.transactionType = options.type;
    }

    const [total, transactions] = await Promise.all([
      prisma.accountingTransaction.count({ where }),
      prisma.accountingTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          purchaseOrder: { select: { id: true, poNumber: true } },
          journalEntry: { select: { id: true, entryNumber: true, totalAmount: true } },
        },
      }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

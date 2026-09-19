import prisma from '../../../config/db';
import { CreateJournalEntryInput, JournalQueryFilters, LedgerAccountInput } from './accounting.types';
import { Prisma } from '@prisma/client';

export class JournalService {
  /**
   * Generate sequential voucher entry number
   */
  private static generateEntryNumber(prefix: string = 'JV'): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const time = Date.now().toString().slice(-4);
    return `${prefix}-${today}-${time}${rand}`;
  }

  /**
   * Validates line items and double-entry balancing rule:
   * TOTAL DEBIT MUST EQUAL TOTAL CREDIT
   */
  static validateDoubleEntry(lines: CreateJournalEntryInput['lines']): {
    validatedLines: Array<{
      accountId: string;
      partyId: string | null;
      debitAmount: number;
      creditAmount: number;
      description: string | null;
    }>;
    totalAmount: number;
  } {
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      throw new Error(
        'A valid journal entry must contain at least two line items (at least one debit and one credit).'
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    const validatedLines = lines.map((line, idx) => {
      if (!line.accountId) {
        throw new Error(`Line ${idx + 1}: accountId is required.`);
      }

      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);

      if (isNaN(debit) || isNaN(credit)) {
        throw new Error(`Line ${idx + 1}: Debit and credit amounts must be valid numbers.`);
      }

      if (debit < 0 || credit < 0) {
        throw new Error(`Line ${idx + 1}: Negative amounts are not allowed in double-entry bookkeeping.`);
      }

      if (debit === 0 && credit === 0) {
        throw new Error(`Line ${idx + 1}: Line item must have either a debit or credit amount.`);
      }

      if (debit > 0 && credit > 0) {
        throw new Error(
          `Line ${idx + 1}: Line item cannot contain both debit and credit amounts simultaneously.`
        );
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        accountId: line.accountId,
        partyId: line.partyId || null,
        debitAmount: debit,
        creditAmount: credit,
        description: line.description?.trim() || null,
      };
    });

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.001) {
      throw new Error(
        `Unbalanced journal entry rejected! TOTAL DEBIT (₹${roundedDebit.toFixed(
          2
        )}) does not equal TOTAL CREDIT (₹${roundedCredit.toFixed(
          2
        )}). Difference: ₹${Math.abs(roundedDebit - roundedCredit).toFixed(2)}.`
      );
    }

    if (roundedDebit <= 0) {
      throw new Error('Total entry amount must be greater than zero.');
    }

    return {
      validatedLines,
      totalAmount: roundedDebit,
    };
  }

  /**
   * Create a double-entry balanced journal entry inside an ACID database transaction.
   * STRICT ENFORCEMENT: Never allows an unbalanced entry into the database.
   */
  static async createJournalEntry(
    input: CreateJournalEntryInput,
    customTx?: Prisma.TransactionClient
  ) {
    if (!input.narration || !input.narration.trim()) {
      throw new Error('Narration is required for all journal entries.');
    }

    // Strictly validate TOTAL DEBIT = TOTAL CREDIT
    const { validatedLines, totalAmount } = this.validateDoubleEntry(input.lines);

    const executeWithTx = async (tx: Prisma.TransactionClient) => {
      // Validate all accounts exist
      const accountIds = Array.from(new Set(validatedLines.map((l) => l.accountId)));
      const existingAccounts = await tx.ledgerAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, code: true, name: true },
      });

      if (existingAccounts.length !== accountIds.length) {
        const foundIds = new Set(existingAccounts.map((a) => a.id));
        const missingIds = accountIds.filter((id) => !foundIds.has(id));
        throw new Error(`Ledger account(s) not found: ${missingIds.join(', ')}.`);
      }

      // Validate all parties exist if specified
      const partyIds = Array.from(
        new Set(validatedLines.map((l) => l.partyId).filter(Boolean) as string[])
      );
      if (partyIds.length > 0) {
        const existingParties = await tx.party.findMany({
          where: { id: { in: partyIds } },
          select: { id: true },
        });
        if (existingParties.length !== partyIds.length) {
          const foundPartyIds = new Set(existingParties.map((p) => p.id));
          const missingPartyIds = partyIds.filter((id) => !foundPartyIds.has(id));
          throw new Error(`Party record(s) not found: ${missingPartyIds.join(', ')}.`);
        }
      }

      const entryNumber = input.entryNumber || this.generateEntryNumber();

      // Create header and lines atomically
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
          referenceType: input.referenceType || 'MANUAL',
          referenceId: input.referenceId || null,
          narration: input.narration.trim(),
          totalAmount,
          lines: {
            create: validatedLines.map((line) => ({
              accountId: line.accountId,
              partyId: line.partyId,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, group: true } },
              party: { select: { id: true, code: true, name: true, type: true } },
            },
          },
        },
      });

      return entry;
    };

    if (customTx) {
      return executeWithTx(customTx);
    } else {
      return prisma.$transaction(
        async (tx) => {
          return executeWithTx(tx);
        },
        { maxWait: 10000, timeout: 15000 }
      );
    }
  }

  /**
   * Get journal entries with pagination and filters
   */
  static async getJournalEntries(filters: JournalQueryFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {};

    if (filters.referenceType) {
      where.referenceType = filters.referenceType;
    }
    if (filters.referenceId) {
      where.referenceId = filters.referenceId;
    }
    if (filters.startDate || filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.entryDate.lte = new Date(filters.endDate);
    }

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
              party: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single journal entry by ID
   */
  static async getJournalEntryById(id: string) {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, group: true } },
            party: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new Error(`Journal entry with ID '${id}' not found.`);
    }

    return entry;
  }

  /**
   * List chart of accounts (ledger accounts)
   */
  static async getLedgerAccounts() {
    return prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Create a ledger account
   */
  static async createLedgerAccount(data: LedgerAccountInput) {
    if (!data.code || !data.name || !data.group) {
      throw new Error('Account code, name, and group are required.');
    }

    const existing = await prisma.ledgerAccount.findUnique({
      where: { code: data.code.trim() },
    });
    if (existing) {
      throw new Error(`Ledger account with code '${data.code}' already exists.`);
    }

    return prisma.ledgerAccount.create({
      data: {
        code: data.code.trim(),
        name: data.name.trim(),
        group: data.group,
        balanceType: data.balanceType || 'DEBIT',
        description: data.description?.trim() || null,
        isSystem: false,
      },
    });
  }
}

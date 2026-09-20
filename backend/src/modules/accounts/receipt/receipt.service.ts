import prisma from '../../../config/db';
import { PaymentMode, PaymentStatus, UserRole, TransactionType } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CreateReceiptDTO {
  partyId: string;
  storeId: string;
  transactionId?: string;
  amount: number;
  receiptDate?: string | Date;
  paymentMethod: string; // Cash, Bank, UPI, Card, Cheque, NEFT, RTGS, IMPS, Other
  referenceNumber?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ReceiptListFilters {
  partyId?: string;
  storeId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class ReceiptService {
  /**
   * Helper to retrieve system ledger account IDs for standard double-entry lines
   */
  private static async getSystemAccounts(tx?: any) {
    const client = tx || prisma;
    const accounts = await client.ledgerAccount.findMany({
      where: {
        code: { in: ['1010', '1020', '1030'] },
      },
    });

    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.code] = acc.id;
    }

    if (!map['1030']) {
      // Ensure 1030 Accounts Receivable exists
      const created1030 = await client.ledgerAccount.upsert({
        where: { code: '1030' },
        update: {},
        create: {
          code: '1030',
          name: 'Accounts Receivable (Sundry Debtors)',
          group: 'ASSET',
          balanceType: 'DEBIT',
          isSystem: true,
          description: 'Trade debtors and customer receivables',
        },
      });
      map['1030'] = created1030.id;
    }

    if (!map['1020'] && !map['1010']) {
      throw new Error("Neither '1020' (Bank) nor '1010' (Cash) account found in Chart of Accounts.");
    }

    return map;
  }

  /**
   * Map input payment method string to Prisma PaymentMode enum
   */
  static normalizePaymentMode(methodStr?: string): PaymentMode {
    if (!methodStr) return PaymentMode.BANK_TRANSFER;
    const m = methodStr.trim().toUpperCase();
    if (m === 'CASH') return PaymentMode.CASH;
    if (m === 'CHEQUE') return PaymentMode.CHEQUE;
    if (m === 'UPI') return PaymentMode.UPI;
    return PaymentMode.BANK_TRANSFER;
  }

  /**
   * Create Receipt Voucher with atomic Ledger, Receivable, Outstanding, and Journal updates
   */
  static async createReceipt(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreateReceiptDTO
  ) {
    // 1. Role & User Validation
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to create receipt vouchers.`,
        403
      );
    }

    // 2. Store Access Validation
    if (!dto.storeId) {
      throw new Error('Store ID is required for collection receipt.');
    }
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(dto.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to record receipts for store '${dto.storeId}'.`,
        403
      );
    }
    const store = await prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw new Error(`Store with ID '${dto.storeId}' not found.`);
    }

    // 3. Party Validation
    if (!dto.partyId) {
      throw new Error('Party (Customer / Client) is required.');
    }
    const party = await prisma.party.findUnique({ where: { id: dto.partyId } });
    if (!party) {
      throw new Error(`Party with ID '${dto.partyId}' not found.`);
    }
    if (party.status !== 'ACTIVE') {
      throw new Error(`Party '${party.name}' is inactive.`);
    }
    if (party.storeId && party.storeId !== dto.storeId && user.role !== UserRole.ADMIN) {
      throw new AccountsSecurityError(
        `Party '${party.name}' is assigned to another store and cannot be processed in store '${store.name}'.`,
        403
      );
    }

    // 4. Amount Validation
    const amount = Math.round(Number(dto.amount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Receipt amount must be greater than zero.');
    }

    // 5. Invoice & Outstanding Validation (if linked to an invoice)
    let targetInvoice: any = null;
    if (dto.transactionId) {
      targetInvoice = await prisma.accountingTransaction.findUnique({
        where: { id: dto.transactionId },
      });
      if (!targetInvoice) {
        throw new Error(`Receivable transaction with ID '${dto.transactionId}' not found.`);
      }
      if (targetInvoice.partyId !== party.id) {
        throw new Error(`Invoice '${targetInvoice.invoiceNumber}' belongs to a different party.`);
      }
      if (targetInvoice.storeId !== dto.storeId && user.role !== UserRole.ADMIN) {
        throw new AccountsSecurityError(
          `Invoice '${targetInvoice.invoiceNumber}' belongs to store '${targetInvoice.storeId}', not '${dto.storeId}'.`,
          403
        );
      }

      const outstanding = Math.round(Math.max(0, targetInvoice.netAmount - targetInvoice.paidAmount) * 100) / 100;
      if (outstanding <= 0) {
        throw new Error(
          `Invoice '${targetInvoice.invoiceNumber}' is already fully paid (Outstanding: ₹0.00).`
        );
      }
      if (amount > outstanding) {
        throw new Error(
          `Receipt amount (₹${amount.toFixed(2)}) exceeds remaining outstanding balance (₹${outstanding.toFixed(2)}) on Invoice ${targetInvoice.invoiceNumber}.`
        );
      }
    }

    const receiptDate = dto.receiptDate ? new Date(dto.receiptDate) : new Date();
    const paymentMode = this.normalizePaymentMode(dto.paymentMethod);
    const isCash = dto.paymentMethod?.trim().toUpperCase() === 'CASH';

    // 6. Execute Atomic Database Transaction (ACID)
    return prisma.$transaction(
      async (tx) => {
        const systemAccounts = await this.getSystemAccounts(tx);
        const depositAccountId = isCash
          ? systemAccounts['1010'] || systemAccounts['1020']
          : systemAccounts['1020'] || systemAccounts['1010'];

        // Generate sequential receipt voucher number
        const receiptCount = await tx.receipt.count();
        const receiptNumber = `REC-${new Date().getFullYear()}-${(receiptCount + 1).toString().padStart(4, '0')}`;
        const journalNumber = `JV-REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        const narration =
          dto.notes?.trim() ||
          `Collection (${dto.paymentMethod || paymentMode}) from ${party.name}${
            targetInvoice ? ` against Invoice ${targetInvoice.invoiceNumber}` : ''
          }${dto.referenceNumber ? ` [Ref: ${dto.referenceNumber}]` : ''}`;

        // Create Journal Entry & Lines (Double-entry strictly balanced)
        // Debit: 1010/1020 Cash / Bank (Asset increased)
        // Credit: 1030 Accounts Receivable (Party receivable asset reduced)
        const journalLines = [
          {
            accountId: depositAccountId,
            debitAmount: amount,
            creditAmount: 0,
            description: `Deposit to ${isCash ? 'Cash in Hand' : 'Bank Account'} from ${party.name}`,
          },
          {
            accountId: systemAccounts['1030'],
            partyId: party.id,
            debitAmount: 0,
            creditAmount: amount,
            description: `Receivable collection from ${party.name} (${dto.paymentMethod || paymentMode})`,
          },
        ];

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: journalNumber,
            entryDate: receiptDate,
            referenceType: 'RECEIPT',
            referenceId: targetInvoice?.id || null,
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

        // Insert Receipt Record
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber,
            receiptDate,
            partyId: party.id,
            accountId: depositAccountId,
            amount,
            paymentMode,
            referenceNo: dto.referenceNumber?.trim() || null,
            notes: narration,
          },
          include: {
            party: { select: { id: true, code: true, name: true, phone: true } },
            account: { select: { id: true, code: true, name: true } },
          },
        });

        // Update Invoice Paid Amount & Payment Status
        let updatedInvoice = null;
        if (targetInvoice) {
          const newPaidAmount = Math.round((targetInvoice.paidAmount + amount) * 100) / 100;
          const newStatus =
            newPaidAmount >= targetInvoice.netAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

          updatedInvoice = await tx.accountingTransaction.update({
            where: { id: targetInvoice.id },
            data: {
              paidAmount: newPaidAmount,
              paymentStatus: newStatus,
            },
          });
        }

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entity: 'Receipt',
            entityId: receipt.id,
            newValues: JSON.stringify({
              receiptNumber: receipt.receiptNumber,
              party: party.name,
              store: store.name,
              invoiceNumber: targetInvoice?.invoiceNumber || null,
              amount,
              paymentMethod: dto.paymentMethod,
              referenceNumber: dto.referenceNumber,
              newInvoicePaidAmount: updatedInvoice?.paidAmount,
              newInvoiceStatus: updatedInvoice?.paymentStatus,
              journalEntryId: journalEntry.id,
            }),
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
          },
        });

        return {
          receipt,
          journalEntry,
          updatedInvoice,
        };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * Get receipts with search, date range, party, store, and pagination filters
   */
  static async getReceipts(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: ReceiptListFilters = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Store tenancy
    if (user.role !== UserRole.ADMIN) {
      where.party = {
        OR: [{ storeId: { in: user.storeIds } }, { storeId: null }],
      };
    }

    if (filters.storeId) {
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
        throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
      }
      where.party = { storeId: filters.storeId };
    }

    if (filters.partyId) {
      where.partyId = filters.partyId;
    }

    if (filters.startDate || filters.endDate) {
      where.receiptDate = {};
      if (filters.startDate) where.receiptDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.receiptDate.lte = end;
      }
    }

    if (filters.paymentMethod) {
      const mode = this.normalizePaymentMode(filters.paymentMethod);
      where.paymentMode = mode;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receiptDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true, phone: true } },
          account: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    return {
      records: receipts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single receipt voucher by ID
   */
  static async getReceiptById(
    receiptId: string,
    user: { id: string; role: UserRole; storeIds: string[] }
  ) {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        party: true,
        account: true,
      },
    });

    if (!receipt) {
      throw new AccountsSecurityError(`Receipt voucher with ID '${receiptId}' not found.`, 404);
    }

    if (user.role !== UserRole.ADMIN) {
      const receiptStoreId = receipt.party?.storeId;
      if (receiptStoreId && !user.storeIds.includes(receiptStoreId)) {
        throw new AccountsSecurityError(
          'Forbidden: You do not have authorization to access this receipt voucher.',
          403
        );
      }
    }

    return receipt;
  }
}

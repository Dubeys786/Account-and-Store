import prisma from '../../../config/db';
import { PaymentMode, PaymentStatus, UserRole, TransactionType } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CreatePaymentDTO {
  partyId: string;
  storeId: string;
  transactionId?: string;
  poId?: string;
  amount: number;
  paymentDate?: string | Date;
  paymentMethod: string; // Cash, Bank, UPI, Card, Cheque, NEFT, RTGS, IMPS, Other
  referenceNumber?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PaymentListFilters {
  partyId?: string;
  storeId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class PaymentService {
  /**
   * Helper to retrieve system ledger account IDs for standard double-entry lines
   */
  private static async getSystemAccounts(tx?: any) {
    const client = tx || prisma;
    const accounts = await client.ledgerAccount.findMany({
      where: {
        code: { in: ['1010', '1020', '2010'] },
      },
    });

    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.code] = acc.id;
    }

    if (!map['2010']) {
      throw new Error("System account '2010' (Accounts Payable) not found in Chart of Accounts.");
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
    return PaymentMode.BANK_TRANSFER; // Covers Bank, NEFT, RTGS, IMPS, Card, Other
  }

  /**
   * Create Payment Voucher with atomic Ledger, Payable, Outstanding, and Journal updates
   */
  static async createPayment(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreatePaymentDTO
  ) {
    // 1. Role & User Validation
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to create payment vouchers.`,
        403
      );
    }

    // 2. Store Access Validation
    if (!dto.storeId) {
      throw new Error('Store ID is required for payment disbursement.');
    }
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(dto.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to disburse payments for store '${dto.storeId}'.`,
        403
      );
    }
    const store = await prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw new Error(`Store with ID '${dto.storeId}' not found.`);
    }

    // 3. Party Validation
    if (!dto.partyId) {
      throw new Error('Party (Supplier / Vendor) is required.');
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
      throw new Error('Payment amount must be greater than zero.');
    }

    // 5. Invoice & Outstanding Validation (if linked to an invoice)
    let targetInvoice: any = null;
    if (dto.transactionId) {
      targetInvoice = await prisma.accountingTransaction.findUnique({
        where: { id: dto.transactionId },
        include: { purchaseOrder: true },
      });
      if (!targetInvoice) {
        throw new Error(`Payable transaction with ID '${dto.transactionId}' not found.`);
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
          `Payment amount (₹${amount.toFixed(2)}) exceeds remaining outstanding balance (₹${outstanding.toFixed(2)}) on Invoice ${targetInvoice.invoiceNumber}.`
        );
      }
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const paymentMode = this.normalizePaymentMode(dto.paymentMethod);
    const isCash = dto.paymentMethod?.trim().toUpperCase() === 'CASH';

    // 6. Execute Atomic Database Transaction (ACID)
    return prisma.$transaction(
      async (tx) => {
        const systemAccounts = await this.getSystemAccounts(tx);
        const disbursementAccountId = isCash
          ? systemAccounts['1010'] || systemAccounts['1020']
          : systemAccounts['1020'] || systemAccounts['1010'];

        // Generate sequential payment voucher number
        const paymentCount = await tx.payment.count();
        const paymentNumber = `PAY-${new Date().getFullYear()}-${(paymentCount + 1).toString().padStart(4, '0')}`;
        const journalNumber = `JV-PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        const narration =
          dto.notes?.trim() ||
          `Payment (${dto.paymentMethod || paymentMode}) to ${party.name}${
            targetInvoice ? ` against Invoice ${targetInvoice.invoiceNumber}` : ''
          }${dto.referenceNumber ? ` [Ref: ${dto.referenceNumber}]` : ''}`;

        // Create Journal Entry & Lines (Double-entry strictly balanced)
        // Debit: 2010 Accounts Payable (Party liability reduced)
        // Credit: 1010/1020 Cash / Bank (Asset reduced)
        const journalLines = [
          {
            accountId: systemAccounts['2010'],
            partyId: party.id,
            debitAmount: amount,
            creditAmount: 0,
            description: `Payable settlement to ${party.name} (${dto.paymentMethod || paymentMode})`,
          },
          {
            accountId: disbursementAccountId,
            debitAmount: 0,
            creditAmount: amount,
            description: `Disbursement from ${isCash ? 'Cash in Hand' : 'Bank Account'} for ${party.name}`,
          },
        ];

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: journalNumber,
            entryDate: paymentDate,
            referenceType: 'PAYMENT',
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

        // Insert Payment Record
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            paymentDate,
            partyId: party.id,
            accountId: disbursementAccountId,
            transactionId: targetInvoice?.id || null,
            amount,
            paymentMode,
            referenceNo: dto.referenceNumber?.trim() || null,
            notes: narration,
          },
          include: {
            party: { select: { id: true, code: true, name: true, phone: true } },
            account: { select: { id: true, code: true, name: true } },
            transaction: {
              select: {
                id: true,
                invoiceNumber: true,
                netAmount: true,
                paidAmount: true,
                paymentStatus: true,
                purchaseOrder: { select: { id: true, poNumber: true } },
              },
            },
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
            entity: 'Payment',
            entityId: payment.id,
            newValues: JSON.stringify({
              paymentNumber: payment.paymentNumber,
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
          payment,
          journalEntry,
          updatedInvoice,
        };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * Get payments with search, date range, party, store, and pagination filters
   */
  static async getPayments(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: PaymentListFilters = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Store tenancy
    if (user.role !== UserRole.ADMIN) {
      where.OR = [
        { transaction: { storeId: { in: user.storeIds } } },
        { party: { storeId: { in: user.storeIds } } },
        { party: { storeId: null } },
      ];
    }

    if (filters.storeId) {
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
        throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
      }
      where.OR = [
        { transaction: { storeId: filters.storeId } },
        { party: { storeId: filters.storeId } },
      ];
    }

    if (filters.partyId) {
      where.partyId = filters.partyId;
    }

    if (filters.startDate || filters.endDate) {
      where.paymentDate = {};
      if (filters.startDate) where.paymentDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.paymentDate.lte = end;
      }
    }

    if (filters.paymentMethod) {
      const mode = this.normalizePaymentMode(filters.paymentMethod);
      where.paymentMode = mode;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { paymentNumber: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
        { transaction: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true, phone: true } },
          account: { select: { id: true, code: true, name: true } },
          transaction: {
            select: {
              id: true,
              invoiceNumber: true,
              netAmount: true,
              paidAmount: true,
              paymentStatus: true,
              store: { select: { id: true, code: true, name: true } },
              purchaseOrder: { select: { id: true, poNumber: true } },
            },
          },
        },
      }),
    ]);

    return {
      records: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single payment voucher by ID
   */
  static async getPaymentById(
    paymentId: string,
    user: { id: string; role: UserRole; storeIds: string[] }
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        party: true,
        account: true,
        transaction: {
          include: {
            store: true,
            purchaseOrder: true,
            journalEntry: {
              include: {
                lines: {
                  include: {
                    account: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AccountsSecurityError(`Payment voucher with ID '${paymentId}' not found.`, 404);
    }

    if (user.role !== UserRole.ADMIN) {
      const paymentStoreId = payment.transaction?.storeId || payment.party?.storeId;
      if (paymentStoreId && !user.storeIds.includes(paymentStoreId)) {
        throw new AccountsSecurityError(
          'Forbidden: You do not have authorization to access this payment voucher.',
          403
        );
      }
    }

    return payment;
  }
}

import prisma from '../../../config/db';
import { TransactionType, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { CreateTransactionDTO, TransactionQueryFilters } from './transaction.types';
import { JournalService } from '../foundation/journal.service';
import { JournalLineInput } from '../foundation/accounting.types';
import { AccountsSecurityError } from '../accounts.guard';
import { AuditService } from '../../audit/audit.service';

export class TransactionService {
  /**
   * Helper to resolve account IDs from standard system account codes
   */
  private static async getSystemAccounts() {
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        code: {
          in: ['1010', '1020', '1030', '1040', '1050', '2010', '2020', '3010', '4010', '5010', '5020'],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.code] = acc.id;
    }
    return map;
  }

  /**
   * Normalize transaction type string to TransactionType enum
   */
  static normalizeTransactionType(type: string, hasPo: boolean): TransactionType {
    const upper = type.toUpperCase().replace(/[\s-]/g, '_');

    switch (upper) {
      case 'PURCHASE':
        return hasPo ? TransactionType.PURCHASE_WITH_PO : TransactionType.PURCHASE_WITHOUT_PO;
      case 'PURCHASE_WITH_PO':
        return TransactionType.PURCHASE_WITH_PO;
      case 'PURCHASE_WITHOUT_PO':
        return TransactionType.PURCHASE_WITHOUT_PO;
      case 'PURCHASE_RETURN':
        return TransactionType.PURCHASE_RETURN;
      case 'SALE':
      case 'SALES':
        return TransactionType.SALE;
      case 'SALE_RETURN':
      case 'SALES_RETURN':
        return TransactionType.SALE_RETURN;
      case 'PAYMENT':
        return TransactionType.PAYMENT;
      case 'RECEIPT':
        return TransactionType.RECEIPT;
      case 'EXPENSE':
        return TransactionType.EXPENSE;
      case 'INCOME':
        return TransactionType.INCOME;
      case 'OPENING_BALANCE':
        return TransactionType.OPENING_BALANCE;
      case 'ADJUSTMENT':
        return TransactionType.ADJUSTMENT;
      default:
        // Default to PURCHASE
        return hasPo ? TransactionType.PURCHASE_WITH_PO : TransactionType.PURCHASE_WITHOUT_PO;
    }
  }

  /**
   * Generate sequential invoice/transaction number
   */
  private static generateInvoiceNumber(type: TransactionType): string {
    const prefix = type.substring(0, 3).toUpperCase();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const time = Date.now().toString().slice(-4);
    return `TXN-${prefix}-${today}-${time}${rand}`;
  }

  /**
   * Create an accounting transaction with PO relationship and auto-balanced journal entry
   */
  static async createTransaction(data: CreateTransactionDTO) {
    if (!data.storeId) {
      throw new Error('Store ID is required for accounting transactions.');
    }
    if (!data.partyId) {
      throw new Error('Party ID is required for accounting transactions.');
    }
    if (data.grossAmount === undefined || isNaN(Number(data.grossAmount)) || Number(data.grossAmount) < 0) {
      throw new Error('Gross amount must be a positive number.');
    }

    // 1. Verify Store
    const store = await prisma.store.findUnique({
      where: { id: data.storeId },
    });
    if (!store) {
      throw new Error(`Store with ID '${data.storeId}' not found.`);
    }

    // 2. Verify Party
    const party = await prisma.party.findUnique({
      where: { id: data.partyId },
    });
    if (!party) {
      throw new Error(`Party with ID '${data.partyId}' not found.`);
    }

    // Check party store isolation if party is bound to a store
    if (party.storeId && party.storeId !== data.storeId) {
      throw new Error(
        `Party '${party.name}' is assigned to another store and cannot be used in store '${store.name}'.`
      );
    }

    // 3. Handle PO Relationship
    // WITH PO: po_id = actual PO ID
    // WITHOUT PO: po_id = NULL
    // Never create fake PO records!
    let actualPoId: string | null = null;
    const poIdInput = typeof data.poId === 'string' ? data.poId.trim() : null;

    if (poIdInput) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poIdInput },
      });
      if (!po) {
        throw new Error(`Purchase order with ID '${poIdInput}' does not exist.`);
      }
      if (po.partyId !== data.partyId) {
        throw new Error(`Purchase order '${po.poNumber}' belongs to a different party.`);
      }
      if (po.storeId !== data.storeId) {
        throw new Error(`Purchase order '${po.poNumber}' belongs to a different store.`);
      }
      actualPoId = po.id;
    } else {
      actualPoId = null;
    }

    const transactionType = this.normalizeTransactionType(
      data.transactionType as string,
      actualPoId !== null
    );

    const grossAmount = Math.round(Number(data.grossAmount) * 100) / 100;
    const taxAmount = Math.round(Number(data.taxAmount || 0) * 100) / 100;
    const netAmount = data.netAmount !== undefined ? Math.round(Number(data.netAmount) * 100) / 100 : grossAmount + taxAmount;
    const paidAmount = data.paidAmount !== undefined ? Math.round(Number(data.paidAmount) * 100) / 100 : 0;

    let paymentStatus = data.paymentStatus || PaymentStatus.UNPAID;
    if (paidAmount >= netAmount && netAmount > 0) {
      paymentStatus = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    let invoiceNumber = data.invoiceNumber?.trim();
    if (!invoiceNumber) {
      invoiceNumber = this.generateInvoiceNumber(transactionType);
    }

    const existingInv = await prisma.accountingTransaction.findUnique({
      where: { invoiceNumber },
    });
    if (existingInv) {
      throw new Error(`Transaction with invoice/voucher number '${invoiceNumber}' already exists.`);
    }

    const systemAccounts = await this.getSystemAccounts();

    // 4. Build Double-Entry Journal Lines (TOTAL DEBIT = TOTAL CREDIT)
    const journalLines: JournalLineInput[] = [];
    const bankOrCashId = data.bankOrCashCode === '1010' ? systemAccounts['1010'] : systemAccounts['1020'] || systemAccounts['1010'];

    switch (transactionType) {
      case TransactionType.PURCHASE:
      case TransactionType.PURCHASE_WITH_PO:
      case TransactionType.PURCHASE_WITHOUT_PO: {
        // Purchase Invoice:
        // Debit: COGS / Purchase Expense (5010) = grossAmount
        // Debit: Input GST (1050) = taxAmount
        // Credit: Accounts Payable (2010, partyId) = netAmount
        journalLines.push({
          accountId: systemAccounts['5010'],
          debitAmount: grossAmount,
          creditAmount: 0,
          description: `Purchase from ${party.name}`,
        });
        if (taxAmount > 0) {
          journalLines.push({
            accountId: systemAccounts['1050'],
            debitAmount: taxAmount,
            creditAmount: 0,
            description: `Input GST for Inv ${invoiceNumber}`,
          });
        }
        journalLines.push({
          accountId: systemAccounts['2010'],
          partyId: party.id,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Payable to ${party.name} for Inv ${invoiceNumber}`,
        });
        break;
      }

      case TransactionType.PURCHASE_RETURN: {
        // Purchase Return:
        // Debit: Accounts Payable (2010, partyId) = netAmount
        // Credit: COGS / Purchase Expense (5010) = grossAmount
        // Credit: Input GST (1050) = taxAmount
        journalLines.push({
          accountId: systemAccounts['2010'],
          partyId: party.id,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Debit note to ${party.name}`,
        });
        journalLines.push({
          accountId: systemAccounts['5010'],
          debitAmount: 0,
          creditAmount: grossAmount,
          description: `Purchase return to ${party.name}`,
        });
        if (taxAmount > 0) {
          journalLines.push({
            accountId: systemAccounts['1050'],
            debitAmount: 0,
            creditAmount: taxAmount,
            description: `Input GST reversal`,
          });
        }
        break;
      }

      case TransactionType.SALE:
      case TransactionType.SALES: {
        // Sales Invoice:
        // Debit: Accounts Receivable (1030, partyId) = netAmount
        // Credit: Sales Revenue (4010) = grossAmount
        // Credit: Output GST (2020) = taxAmount
        journalLines.push({
          accountId: systemAccounts['1030'],
          partyId: party.id,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Receivable from ${party.name} for Inv ${invoiceNumber}`,
        });
        journalLines.push({
          accountId: systemAccounts['4010'],
          debitAmount: 0,
          creditAmount: grossAmount,
          description: `Sales to ${party.name}`,
        });
        if (taxAmount > 0) {
          journalLines.push({
            accountId: systemAccounts['2020'],
            debitAmount: 0,
            creditAmount: taxAmount,
            description: `Output GST on sales`,
          });
        }
        break;
      }

      case TransactionType.SALE_RETURN: {
        // Sales Return:
        // Debit: Sales Revenue (4010) = grossAmount
        // Debit: Output GST (2020) = taxAmount
        // Credit: Accounts Receivable (1030, partyId) = netAmount
        journalLines.push({
          accountId: systemAccounts['4010'],
          debitAmount: grossAmount,
          creditAmount: 0,
          description: `Sales return from ${party.name}`,
        });
        if (taxAmount > 0) {
          journalLines.push({
            accountId: systemAccounts['2020'],
            debitAmount: taxAmount,
            creditAmount: 0,
            description: `Output GST reversal`,
          });
        }
        journalLines.push({
          accountId: systemAccounts['1030'],
          partyId: party.id,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Credit note to ${party.name}`,
        });
        break;
      }

      case TransactionType.PAYMENT: {
        // Payment to Supplier:
        // Debit: Accounts Payable (2010, partyId) = netAmount
        // Credit: Bank / Cash (1020 / 1010) = netAmount
        journalLines.push({
          accountId: systemAccounts['2010'],
          partyId: party.id,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Payment to ${party.name}`,
        });
        journalLines.push({
          accountId: bankOrCashId,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Bank/Cash disbursement for ${party.name}`,
        });
        break;
      }

      case TransactionType.RECEIPT: {
        // Receipt from Customer:
        // Debit: Bank / Cash (1020 / 1010) = netAmount
        // Credit: Accounts Receivable (1030, partyId) = netAmount
        journalLines.push({
          accountId: bankOrCashId,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Receipt from ${party.name}`,
        });
        journalLines.push({
          accountId: systemAccounts['1030'],
          partyId: party.id,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Collection from ${party.name}`,
        });
        break;
      }

      case TransactionType.EXPENSE: {
        // Expense:
        // Debit: Operating Expense (5020) = netAmount
        // Credit: Bank / Cash (1010) = netAmount
        journalLines.push({
          accountId: systemAccounts['5020'],
          partyId: party.id,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Expense: ${data.notes || party.name}`,
        });
        journalLines.push({
          accountId: bankOrCashId,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Disbursement for expense`,
        });
        break;
      }

      case TransactionType.INCOME: {
        // Income:
        // Debit: Bank / Cash (1020) = netAmount
        // Credit: Income / Revenue (4010) = netAmount
        journalLines.push({
          accountId: bankOrCashId,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Income receipt`,
        });
        journalLines.push({
          accountId: systemAccounts['4010'],
          partyId: party.id,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Income from ${party.name}`,
        });
        break;
      }

      case TransactionType.OPENING_BALANCE: {
        // Opening balance voucher:
        const isCustomer = party.type === 'CUSTOMER' || party.openingBalanceType === 'DEBIT';
        if (isCustomer) {
          journalLines.push({
            accountId: systemAccounts['1030'],
            partyId: party.id,
            debitAmount: netAmount,
            creditAmount: 0,
            description: `Opening balance for ${party.name}`,
          });
          journalLines.push({
            accountId: systemAccounts['3010'],
            debitAmount: 0,
            creditAmount: netAmount,
            description: `Capital / Opening equity offset`,
          });
        } else {
          journalLines.push({
            accountId: systemAccounts['3010'],
            debitAmount: netAmount,
            creditAmount: 0,
            description: `Capital / Opening equity offset`,
          });
          journalLines.push({
            accountId: systemAccounts['2010'],
            partyId: party.id,
            debitAmount: 0,
            creditAmount: netAmount,
            description: `Opening balance for ${party.name}`,
          });
        }
        break;
      }

      case TransactionType.ADJUSTMENT:
      default: {
        // Adjustment:
        journalLines.push({
          accountId: systemAccounts['5010'],
          partyId: party.id,
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Adjustment entry for ${party.name}`,
        });
        journalLines.push({
          accountId: systemAccounts['2010'],
          partyId: party.id,
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Adjustment contra for ${party.name}`,
        });
        break;
      }
    }

    // 5. Execute creation inside ACID database transaction
    return prisma.$transaction(async (tx) => {
      // Create balanced journal entry
      const journalEntry = await JournalService.createJournalEntry(
        {
          referenceType: transactionType,
          narration: data.notes || `${transactionType} transaction: ${invoiceNumber} (${party.name})`,
          entryDate: data.invoiceDate || new Date(),
          lines: journalLines,
        },
        tx
      );

      // Create accounting transaction linked to PO and journal entry
      const transaction = await tx.accountingTransaction.create({
        data: {
          storeId: data.storeId,
          partyId: data.partyId,
          poId: actualPoId,
          transactionType,
          invoiceNumber,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          grossAmount,
          taxAmount,
          netAmount,
          paidAmount,
          paymentStatus,
          notes: data.notes?.trim() || null,
          journalEntryId: journalEntry.id,
        },
        include: {
          store: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true, type: true } },
          purchaseOrder: true,
          journalEntry: {
            include: {
              lines: {
                include: {
                  account: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      });

      return transaction;
    }, { maxWait: 10000, timeout: 15000 });
  }

  /**
   * List accounting transactions with filters
   */
  static async getTransactions(filters: TransactionQueryFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AccountingTransactionWhereInput = {};

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }
    if (filters.partyId) {
      where.partyId = filters.partyId;
    }
    if (filters.type === 'with-po') {
      where.poId = { not: null };
    } else if (filters.type === 'without-po') {
      where.poId = null;
    }
    if (filters.transactionType) {
      where.transactionType = filters.transactionType as TransactionType;
    }
    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus as PaymentStatus;
    }
    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.invoiceDate.lte = new Date(filters.endDate);
    }

    const [total, transactions] = await Promise.all([
      prisma.accountingTransaction.count({ where }),
      prisma.accountingTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          store: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true, type: true } },
          purchaseOrder: true,
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

  /**
   * Get single transaction by ID
   */
  static async getTransactionById(id: string) {
    const transaction = await prisma.accountingTransaction.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, code: true, name: true } },
        party: { select: { id: true, code: true, name: true, type: true } },
        purchaseOrder: true,
        journalEntry: {
          include: {
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true, group: true } },
                party: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new Error(`Accounting transaction with ID '${id}' not found.`);
    }

    return transaction;
  }

  /**
   * Void / Reverse an accounting transaction with an offsetting journal entry.
   * STRICT IMMUTABILITY: Historical records are never physically deleted.
   */
  static async voidTransaction(
    transactionId: string,
    user: { id: string; role: UserRole; storeIds: string[] },
    reason?: string
  ) {
    const transaction = await prisma.accountingTransaction.findUnique({
      where: { id: transactionId },
      include: {
        store: true,
        party: true,
        journalEntry: {
          include: {
            lines: true,
          },
        },
        payments: true,
      },
    });

    if (!transaction) {
      throw new AccountsSecurityError(`Accounting transaction with ID '${transactionId}' not found.`, 404);
    }

    // Store tenancy check
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(transaction.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to void transactions in store '${transaction.store.name}'.`,
        403
      );
    }

    if (transaction.notes?.includes('[VOIDED')) {
      throw new Error(`Transaction '${transaction.invoiceNumber}' has already been voided/reversed.`);
    }

    if (transaction.paidAmount > 0) {
      throw new Error(
        `Cannot void invoice '${transaction.invoiceNumber}' because payments (₹${transaction.paidAmount.toFixed(2)}) have been recorded against it. Reverse the payments first.`
      );
    }

    // Perform non-destructive reversal in a database transaction
    const result = await prisma.$transaction(
      async (tx) => {
        let reversalJournalId: string | null = null;

        if (transaction.journalEntry && transaction.journalEntry.lines.length > 0) {
          // Swap debit and credit amounts for each line to completely offset the ledger
          const reversalLines = transaction.journalEntry.lines.map((l) => ({
            accountId: l.accountId,
            partyId: l.partyId,
            debitAmount: l.creditAmount, // swapped!
            creditAmount: l.debitAmount, // swapped!
            description: `[REVERSAL] ${l.description || ''}`.trim(),
          }));

          const totalReversal = reversalLines.reduce((acc, l) => acc + l.debitAmount, 0);

          const revNumber = `REV-${Date.now().toString().slice(-6)}`;
          const revJournal = await tx.journalEntry.create({
            data: {
              entryNumber: revNumber,
              entryDate: new Date(),
              referenceType: 'VOID',
              referenceId: transaction.id,
              narration: `[VOID REVERSAL] Reversal of ${transaction.invoiceNumber} - ${reason || 'Voided transaction'}`,
              totalAmount: totalReversal,
              lines: {
                create: reversalLines,
              },
            },
          });
          reversalJournalId = revJournal.id;
        }

        const updatedNotes = `[VOIDED on ${new Date().toISOString()}] ${reason || 'Voided by user'}\n${transaction.notes || ''}`.trim();

        // Update transaction status without physical deletion!
        const updatedTx = await tx.accountingTransaction.update({
          where: { id: transaction.id },
          data: {
            notes: updatedNotes,
          },
          include: {
            store: true,
            party: true,
            journalEntry: {
              include: { lines: true },
            },
          },
        });

        return {
          transaction: updatedTx,
          reversalJournalId,
          updatedNotes,
          message: `Transaction ${transaction.invoiceNumber} voided and offsetting journal reversal posted successfully.`,
        };
      },
      { maxWait: 15000, timeout: 25000 }
    );

    // Record AuditLog outside the database transaction
    await AuditService.record({
      userId: user.id,
      action: 'VOID',
      entity: 'AccountingTransaction',
      entityId: transaction.id,
      oldValues: {
        invoiceNumber: transaction.invoiceNumber,
        netAmount: transaction.netAmount,
        notes: transaction.notes,
        journalEntryId: transaction.journalEntryId,
      },
      newValues: {
        voided: true,
        reason,
        reversalJournalId: result.reversalJournalId,
        updatedNotes: result.updatedNotes,
      },
    });

    return result;
  }
}

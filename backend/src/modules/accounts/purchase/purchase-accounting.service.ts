import prisma from '../../../config/db';
import { POStatus, TransactionType, PaymentStatus, UserRole, PaymentMode } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface CreatePurchaseWithPODTO {
  poId: string;
  invoiceNumber: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateDirectPurchaseDTO {
  partyId: string;
  storeId: string;
  invoiceNumber: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  itemName?: string;
  itemDescription?: string;
  quantity: number;
  rate: number;
  discountPercent?: number;
  taxPercent?: number;
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | PaymentStatus;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | PaymentMode;
  paidAmount?: number;
  referenceNo?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PurchaseListFilters {
  search?: string;
  type?: 'all' | 'with-po' | 'without-po';
  supplierId?: string;
  partyId?: string;
  storeId?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class PurchaseAccountingService {
  /**
   * Helper to retrieve system ledger account IDs for standard double-entry lines
   */
  private static async getSystemAccounts(tx?: any) {
    const client = tx || prisma;
    const accounts = await client.ledgerAccount.findMany({
      where: {
        code: {
          in: ['1010', '1020', '1050', '2010', '5010'],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.code] = acc.id;
    }

    if (!map['5010']) {
      throw new Error("System account '5010' (Purchase / COGS Expense) not found in Chart of Accounts.");
    }
    if (!map['2010']) {
      throw new Error("System account '2010' (Accounts Payable) not found in Chart of Accounts.");
    }
    if (!map['1050']) {
      // If 1050 (Input GST) is not present, create or fallback
      const created1050 = await client.ledgerAccount.upsert({
        where: { code: '1050' },
        update: {},
        create: {
          code: '1050',
          name: 'Input GST / Tax Credit',
          group: 'ASSET',
          balanceType: 'DEBIT',
          isSystem: true,
          description: 'Input Tax Credit for GST paid on purchases',
        },
      });
      map['1050'] = created1050.id;
    }

    return map;
  }

  /**
   * Fetch approved and valid POs available for purchase billing.
   * Calculates received amount from Material Inward records.
   */
  static async getEligiblePOs(user: { id: string; role: UserRole; storeIds: string[] }, filters: { storeId?: string; partyId?: string; search?: string } = {}) {
    const where: any = {
      status: {
        in: [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED],
      },
    };

    // Store access validation
    if (user.role !== UserRole.ADMIN) {
      where.storeId = { in: user.storeIds };
    }

    if (filters.storeId) {
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
        throw new AccountsSecurityError(`Forbidden: You do not have access to store '${filters.storeId}'.`, 403);
      }
      where.storeId = filters.storeId;
    }

    if (filters.partyId) {
      where.partyId = filters.partyId;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { poNumber: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        party: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            gstin: true,
            creditDays: true,
            paymentTerms: true,
            phone: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            code: true,
            name: true,
            location: true,
          },
        },
        items: {
          include: {
            item: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
        materialInwards: {
          include: {
            items: {
              include: {
                item: { select: { id: true, code: true, name: true, unit: true } },
              },
            },
          },
          orderBy: { inwardDate: 'desc' },
        },
        accountingTransactions: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            netAmount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute received amount and billing status for each PO
    return pos.map((po) => {
      let receivedAmount = 0;

      // Calculate received value from material inward items
      for (const inward of po.materialInwards) {
        for (const inItem of inward.items) {
          const poItem = po.items.find((pi) => pi.itemId === inItem.itemId);
          const unitRate = inItem.rate ?? poItem?.rate ?? 0;
          const discPct = poItem?.discountPercent ?? 0;
          const taxPct = poItem?.taxPercent ?? 0;

          const base = inItem.acceptedQty * unitRate;
          const disc = base * (discPct / 100);
          const taxable = base - disc;
          const tax = taxable * (taxPct / 100);
          receivedAmount += taxable + tax;
        }
      }

      // If no inwards or receivedAmount is 0 but PO items have receivedQty
      if (receivedAmount === 0) {
        for (const item of po.items) {
          if (item.receivedQty > 0) {
            const base = item.receivedQty * item.rate;
            const disc = base * (item.discountPercent / 100);
            const taxable = base - disc;
            const tax = taxable * (item.taxPercent / 100);
            receivedAmount += taxable + tax;
          }
        }
      }

      const isBilled = po.accountingTransactions.length > 0;
      const billedAmount = po.accountingTransactions.reduce((acc, t) => acc + t.netAmount, 0);

      return {
        id: po.id,
        poNumber: po.poNumber,
        poDate: po.poDate,
        status: po.status,
        subtotal: po.subtotal,
        discount: po.discount,
        taxAmount: po.taxAmount,
        poAmount: po.totalAmount,
        receivedAmount: Math.round(receivedAmount * 100) / 100,
        billedAmount: Math.round(billedAmount * 100) / 100,
        isBilled,
        supplier: po.party,
        store: po.store,
        itemCount: po.items.length,
        inwardCount: po.materialInwards.length,
        inwardSummary: po.materialInwards.map((i) => ({
          inwardNumber: i.inwardNumber,
          inwardDate: i.inwardDate,
          referenceNumber: i.referenceNumber,
          acceptedItemsCount: i.items.reduce((s, it) => s + it.acceptedQty, 0),
        })),
        bills: po.accountingTransactions,
      };
    });
  }

  /**
   * Get single PO by ID with full item details and inward history for Purchase Entry.
   * Validates user's store authorization.
   */
  static async getEligiblePOById(poId: string, user: { id: string; role: UserRole; storeIds: string[] }) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        party: true,
        store: true,
        items: {
          include: {
            item: true,
          },
        },
        materialInwards: {
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
          orderBy: { inwardDate: 'desc' },
        },
        accountingTransactions: true,
      },
    });

    if (!po) {
      throw new AccountsSecurityError(`Purchase Order with ID '${poId}' not found.`, 404);
    }

    // Store access validation
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(po.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to access Purchase Order '${po.poNumber}' in store '${po.store.name}'.`,
        403
      );
    }

    // Calculate received line amounts and suggested invoice amounts
    let calculatedGross = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;

    const itemsDetail = po.items.map((pi) => {
      const baseTotal = pi.quantity * pi.rate;
      const discountVal = baseTotal * (pi.discountPercent / 100);
      const taxable = baseTotal - discountVal;
      const taxVal = taxable * (pi.taxPercent / 100);

      // Inward accepted qty
      const inwardAcceptedQty = po.materialInwards.reduce((sum, inw) => {
        const matching = inw.items.find((item) => item.itemId === pi.itemId);
        return sum + (matching ? matching.acceptedQty : 0);
      }, 0);

      const effectiveQty = inwardAcceptedQty > 0 ? inwardAcceptedQty : (pi.receivedQty > 0 ? pi.receivedQty : pi.quantity);

      const lineGross = effectiveQty * pi.rate;
      const lineDisc = lineGross * (pi.discountPercent / 100);
      const lineTaxable = lineGross - lineDisc;
      const lineTax = lineTaxable * (pi.taxPercent / 100);

      calculatedGross += lineGross;
      calculatedDiscount += lineDisc;
      calculatedTax += lineTax;

      return {
        id: pi.id,
        itemId: pi.itemId,
        itemCode: pi.item.code,
        itemName: pi.item.name,
        unit: pi.item.unit,
        orderedQty: pi.quantity,
        receivedQty: pi.receivedQty,
        inwardAcceptedQty,
        rate: pi.rate,
        discountPercent: pi.discountPercent,
        taxPercent: pi.taxPercent,
        total: pi.total,
        effectiveQty,
        lineGross: Math.round(lineGross * 100) / 100,
        lineTax: Math.round(lineTax * 100) / 100,
        lineTotal: Math.round((lineTaxable + lineTax) * 100) / 100,
      };
    });

    const calculatedNet = calculatedGross - calculatedDiscount + calculatedTax;

    return {
      po: {
        id: po.id,
        poNumber: po.poNumber,
        poDate: po.poDate,
        status: po.status,
        expectedDelivery: po.expectedDelivery,
        notes: po.notes,
        subtotal: po.subtotal,
        discount: po.discount,
        taxAmount: po.taxAmount,
        totalAmount: po.totalAmount,
      },
      supplier: {
        id: po.party.id,
        code: po.party.code,
        name: po.party.name,
        type: po.party.type,
        gstin: po.party.gstin,
        pan: po.party.pan,
        phone: po.party.phone,
        email: po.party.email,
        address: po.party.address,
        city: po.party.city,
        state: po.party.state,
        creditDays: po.party.creditDays,
        paymentTerms: po.party.paymentTerms,
      },
      store: {
        id: po.store.id,
        code: po.store.code,
        name: po.store.name,
        location: po.store.location,
        address: po.store.address,
      },
      items: itemsDetail,
      materialInwards: po.materialInwards.map((inw) => ({
        id: inw.id,
        inwardNumber: inw.inwardNumber,
        inwardDate: inw.inwardDate,
        referenceNumber: inw.referenceNumber,
        remarks: inw.remarks,
        items: inw.items.map((i) => ({
          itemId: i.itemId,
          itemCode: i.item.code,
          itemName: i.item.name,
          receivedQty: i.receivedQty,
          rejectedQty: i.rejectedQty,
          acceptedQty: i.acceptedQty,
          rate: i.rate,
        })),
      })),
      suggestedAccounting: {
        grossAmount: Math.round(calculatedGross * 100) / 100,
        discountAmount: Math.round(calculatedDiscount * 100) / 100,
        taxAmount: Math.round(calculatedTax * 100) / 100,
        netAmount: Math.round(calculatedNet * 100) / 100,
      },
      existingTransactions: po.accountingTransactions,
    };
  }

  /**
   * CREATE PURCHASE ACCOUNTING WITH PO
   * Executes the 11-step process strictly in ONE atomic database transaction.
   * If any step fails, all steps are rolled back.
   *
   * 1. Validate user
   * 2. Validate store access
   * 3. Validate PO access
   * 4. Validate supplier
   * 5. Validate amounts
   * 6. Create accounting transaction
   * 7. Create journal entry
   * 8. Create journal lines
   * 9. Update supplier ledger
   * 10. Create payable
   * 11. Create audit log
   */
  static async createPurchaseWithPO(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreatePurchaseWithPODTO
  ) {
    // -------------------------------------------------------------
    // 1. VALIDATE USER
    // -------------------------------------------------------------
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not permitted to perform purchase accounting.`,
        403
      );
    }

    if (!dto.poId) {
      throw new Error('Purchase Order ID (poId) is required for WITH PO accounting workflow.');
    }

    const invoiceNumber = dto.invoiceNumber?.trim();
    if (!invoiceNumber) {
      throw new Error('Invoice Number is required. Enter the supplier tax invoice or bill number.');
    }

    // Check invoice number uniqueness
    const existingInvoice = await prisma.accountingTransaction.findUnique({
      where: { invoiceNumber },
    });
    if (existingInvoice) {
      throw new Error(`Transaction with invoice number '${invoiceNumber}' already exists.`);
    }

    // -------------------------------------------------------------
    // 3. VALIDATE PO ACCESS & 4. VALIDATE SUPPLIER
    // -------------------------------------------------------------
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: dto.poId },
      include: {
        party: true,
        store: true,
        items: { include: { item: true } },
        materialInwards: { include: { items: true } },
        accountingTransactions: true,
      },
    });

    if (!po) {
      throw new AccountsSecurityError(`Purchase order with ID '${dto.poId}' does not exist.`, 404);
    }

    // Check PO status
    const allowedStatuses: POStatus[] = [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED];
    if (!allowedStatuses.includes(po.status)) {
      throw new Error(
        `Purchase Order '${po.poNumber}' is in '${po.status}' status. Only APPROVED, PARTIALLY_RECEIVED, or RECEIVED POs can be billed.`
      );
    }

    // -------------------------------------------------------------
    // 2. VALIDATE STORE ACCESS
    // -------------------------------------------------------------
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(po.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to access store '${po.store.name}' (PO ${po.poNumber}).`,
        403
      );
    }

    // Validate supplier
    const supplier = po.party;
    if (!supplier || supplier.status !== 'ACTIVE') {
      throw new Error(`Supplier '${supplier?.name || po.partyId}' is inactive or not found.`);
    }

    // Store isolation check on supplier
    if (supplier.storeId && supplier.storeId !== po.storeId) {
      throw new AccountsSecurityError(
        `Supplier '${supplier.name}' is assigned to another store and cannot be processed in store '${po.store.name}'.`,
        403
      );
    }

    // -------------------------------------------------------------
    // 5. VALIDATE AMOUNTS
    // Calculate amounts accurately from PO items and accepted inward quantities
    // -------------------------------------------------------------
    let totalGross = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const pi of po.items) {
      // Find total accepted qty across all material inwards for this PO
      const totalInwardAccepted = po.materialInwards.reduce((acc, inw) => {
        const item = inw.items.find((it) => it.itemId === pi.itemId);
        return acc + (item ? item.acceptedQty : 0);
      }, 0);

      // Use accepted qty if inward exists, otherwise use PO qty
      const qty = totalInwardAccepted > 0 ? totalInwardAccepted : (pi.receivedQty > 0 ? pi.receivedQty : pi.quantity);

      const base = qty * pi.rate;
      const disc = base * (pi.discountPercent / 100);
      const taxable = base - disc;
      const tax = taxable * (pi.taxPercent / 100);

      totalGross += base;
      totalDiscount += disc;
      totalTax += tax;
    }

    // If calculations resulted in 0 (edge case), fall back to PO totals
    if (totalGross === 0) {
      totalGross = po.subtotal;
      totalDiscount = po.discount;
      totalTax = po.taxAmount;
    }

    const grossAmount = Math.round((totalGross - totalDiscount) * 100) / 100;
    const taxAmount = Math.round(totalTax * 100) / 100;
    const netAmount = Math.round((grossAmount + taxAmount) * 100) / 100;

    if (grossAmount <= 0) {
      throw new Error('Calculated gross amount must be greater than zero.');
    }
    if (netAmount <= 0) {
      throw new Error('Calculated net invoice amount must be greater than zero.');
    }

    // Invoice and due dates
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else if (supplier.creditDays) {
      dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + supplier.creditDays);
    }

    // -------------------------------------------------------------
    // EXECUTE STEPS 6-11 IN A SINGLE ACID DATABASE TRANSACTION
    // -------------------------------------------------------------
    return prisma.$transaction(
      async (tx) => {
        const systemAccounts = await this.getSystemAccounts(tx);

        // Step 7 & 8: Build and create Journal Entry with double-entry lines
        // TOTAL DEBIT = TOTAL CREDIT
        // Debit: COGS / Purchase Expense (5010) = grossAmount
        // Debit: Input GST (1050) = taxAmount
        // Credit: Accounts Payable (2010, partyId) = netAmount
        const entryNumber = `JV-PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        const journalLines = [
          {
            accountId: systemAccounts['5010'],
            debitAmount: grossAmount,
            creditAmount: 0,
            description: `Purchase against PO ${po.poNumber} from ${supplier.name}`,
          },
          ...(taxAmount > 0
            ? [
                {
                  accountId: systemAccounts['1050'],
                  debitAmount: taxAmount,
                  creditAmount: 0,
                  description: `Input GST for Bill ${invoiceNumber} (PO ${po.poNumber})`,
                },
              ]
            : []),
          {
            // Step 9: Update supplier ledger via Party liability line
            accountId: systemAccounts['2010'],
            partyId: supplier.id,
            debitAmount: 0,
            creditAmount: netAmount,
            description: `Payable to ${supplier.name} for Bill ${invoiceNumber} (PO ${po.poNumber})`,
          },
        ];

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber,
            entryDate: invoiceDate,
            referenceType: 'PURCHASE_WITH_PO',
            referenceId: po.id,
            storeId: po.storeId,
            narration:
              dto.notes ||
              `Purchase bill ${invoiceNumber} booked against PO ${po.poNumber} (${supplier.name})`,
            totalAmount: netAmount,
            lines: {
              create: journalLines,
            },
          },
        });

        // Step 6 & 10: Create Accounting Transaction and Accounts Payable record
        // Linked to PO (poId), store, supplier, and journal entry
        // paymentStatus is initialized as UNPAID with paidAmount = 0
        const transaction = await tx.accountingTransaction.create({
          data: {
            storeId: po.storeId,
            partyId: supplier.id,
            poId: po.id, // Mandatory actual PO UUID
            transactionType: TransactionType.PURCHASE_WITH_PO,
            invoiceNumber,
            invoiceDate,
            dueDate,
            grossAmount,
            taxAmount,
            netAmount,
            paidAmount: 0,
            paymentStatus: PaymentStatus.UNPAID, // Step 10: Create Payable
            notes: dto.notes?.trim() || `Billed against PO ${po.poNumber}`,
            journalEntryId: journalEntry.id,
          },
          include: {
            store: { select: { id: true, code: true, name: true } },
            party: { select: { id: true, code: true, name: true, type: true } },
            purchaseOrder: {
              select: {
                id: true,
                poNumber: true,
                poDate: true,
                status: true,
                totalAmount: true,
              },
            },
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

        // Step 11: Create Audit Log
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entity: 'PurchaseAccount',
            entityId: transaction.id,
            newValues: JSON.stringify({
              transactionId: transaction.id,
              poId: po.id,
              poNumber: po.poNumber,
              invoiceNumber: transaction.invoiceNumber,
              supplier: supplier.name,
              grossAmount,
              taxAmount,
              netAmount,
              journalEntryId: journalEntry.id,
            }),
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
          },
        });

        return transaction;
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * CREATE DIRECT PURCHASE (WITHOUT PO)
   * Completely independent of Purchase Order creation.
   *
   * Database Rule:
   * po_id = NULL
   * Strictly avoids creating any fake PO.
   *
   * Validations:
   * 1. Validate User & Role (ADMIN or ACCOUNT_USER)
   * 2. Validate Store Access
   * 3. Validate Party (Supplier exists, ACTIVE, store isolation)
   * 4. Validate Amounts & Math
   *
   * Atomic Single Database Transaction (ACID):
   * 5. Create Accounting Transaction (poId = null, transactionType = PURCHASE_WITHOUT_PO)
   * 6. Create Journal Entry (referenceType = PURCHASE_WITHOUT_PO)
   * 7. Create Journal Lines (Dr 5010 Expense, Dr 1050 GST, Cr 2010 Payable)
   * 8. Update Supplier Ledger (via partyId on 2010 line)
   * 9. Create Payable (AccountingTransaction UNPAID or PARTIALLY_PAID)
   * 10. Process Immediate Payment if paidAmount > 0 (Payment record created, contra Dr 2010 / Cr 1010/1020)
   * 11. Create Audit Log
   * Rollback all if any step fails.
   */
  static async createDirectPurchase(
    user: { id: string; role: UserRole; storeIds: string[] },
    dto: CreateDirectPurchaseDTO
  ) {
    // 1. Validate User
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: Valid user credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not permitted to perform purchase accounting.`,
        403
      );
    }

    // 2. Validate Store Access
    if (!dto.storeId) {
      throw new Error('Store ID is required for direct purchase billing.');
    }
    const store = await prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!store) {
      throw new Error(`Store with ID '${dto.storeId}' does not exist.`);
    }
    if (user.role !== UserRole.ADMIN && !user.storeIds.includes(dto.storeId)) {
      throw new AccountsSecurityError(
        `Forbidden: You do not have authorization to access store '${store.name}'.`,
        403
      );
    }

    // 3. Validate Party
    if (!dto.partyId) {
      throw new Error('Supplier / Party ID is required for direct purchase billing.');
    }
    const party = await prisma.party.findUnique({
      where: { id: dto.partyId },
    });
    if (!party) {
      throw new Error(`Party with ID '${dto.partyId}' does not exist.`);
    }
    if (party.status !== 'ACTIVE') {
      throw new Error(`Party '${party.name}' is currently INACTIVE.`);
    }
    if (party.storeId && party.storeId !== dto.storeId && user.role !== UserRole.ADMIN) {
      throw new AccountsSecurityError(
        `Party '${party.name}' is assigned to another store and cannot be processed in store '${store.name}'.`,
        403
      );
    }

    // 4. Validate Invoice Number
    const invoiceNumber = dto.invoiceNumber?.trim();
    if (!invoiceNumber) {
      throw new Error('Invoice Number is required. Enter the vendor tax invoice or direct bill number.');
    }
    const existingInvoice = await prisma.accountingTransaction.findUnique({
      where: { invoiceNumber },
    });
    if (existingInvoice) {
      throw new Error(`Transaction with invoice number '${invoiceNumber}' already exists.`);
    }

    // 5. Validate Amounts & Math
    const quantity = Number(dto.quantity);
    const rate = Number(dto.rate);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }
    if (isNaN(rate) || rate <= 0) {
      throw new Error('Rate must be greater than zero.');
    }

    const discountPercent = Math.max(0, Math.min(100, Number(dto.discountPercent || 0)));
    const taxPercent = Math.max(0, Number(dto.taxPercent || 0));

    const baseAmount = quantity * rate;
    const discountAmount = Math.round(baseAmount * (discountPercent / 100) * 100) / 100;
    const grossAmount = Math.round((baseAmount - discountAmount) * 100) / 100;
    const taxAmount = Math.round(grossAmount * (taxPercent / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount + taxAmount) * 100) / 100;

    if (grossAmount <= 0) {
      throw new Error('Calculated taxable gross amount must be greater than zero.');
    }
    if (netAmount <= 0) {
      throw new Error('Calculated net invoice amount must be greater than zero.');
    }

    // Dates
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else if (party.creditDays) {
      dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + party.creditDays);
    }

    // Payment Settlement (Instant Payment / Payable)
    let paymentStatus = (dto.paymentStatus as PaymentStatus) || PaymentStatus.UNPAID;
    let paidAmount = dto.paidAmount !== undefined ? Math.max(0, Math.round(Number(dto.paidAmount) * 100) / 100) : 0;

    if (dto.paymentStatus === 'PAID' && paidAmount === 0) {
      paidAmount = netAmount;
    }

    if (paidAmount >= netAmount && netAmount > 0) {
      paidAmount = netAmount;
      paymentStatus = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      paidAmount = 0;
      paymentStatus = PaymentStatus.UNPAID;
    }

    const paymentMethod = (dto.paymentMethod as PaymentMode) || PaymentMode.BANK_TRANSFER;

    // -------------------------------------------------------------
    // EXECUTE ATOMIC TRANSACTION (ONE DATABASE TRANSACTION)
    // -------------------------------------------------------------
    return prisma.$transaction(
      async (tx) => {
        const systemAccounts = await this.getSystemAccounts(tx);

        const bankOrCashAccountId =
          paymentMethod === PaymentMode.CASH
            ? systemAccounts['1010'] || systemAccounts['1020']
            : systemAccounts['1020'] || systemAccounts['1010'];

        const entryNumber = `JV-DIR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

        // Build Journal Lines (Double-entry strictly balanced)
        const journalLines: any[] = [
          {
            accountId: systemAccounts['5010'],
            debitAmount: grossAmount,
            creditAmount: 0,
            description: `Direct purchase from ${party.name}: ${dto.itemName || 'Direct Goods/Services'}`,
          },
          ...(taxAmount > 0
            ? [
                {
                  accountId: systemAccounts['1050'],
                  debitAmount: taxAmount,
                  creditAmount: 0,
                  description: `Input GST for Direct Invoice ${invoiceNumber} (${party.name})`,
                },
              ]
            : []),
          {
            // Supplier ledger liability credit
            accountId: systemAccounts['2010'],
            partyId: party.id,
            debitAmount: 0,
            creditAmount: netAmount,
            description: `Payable to ${party.name} for Direct Invoice ${invoiceNumber}`,
          },
        ];

        // If immediate payment applied (PAID / PARTIALLY_PAID)
        if (paidAmount > 0) {
          journalLines.push(
            {
              // Clear liability
              accountId: systemAccounts['2010'],
              partyId: party.id,
              debitAmount: paidAmount,
              creditAmount: 0,
              description: `Immediate payment to ${party.name} for Invoice ${invoiceNumber}`,
            },
            {
              // Disburse cash/bank
              accountId: bankOrCashAccountId,
              debitAmount: 0,
              creditAmount: paidAmount,
              description: `Disbursement (${paymentMethod}) for Invoice ${invoiceNumber}`,
            }
          );
        }

        const totalEntryAmount = netAmount + paidAmount;

        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber,
            entryDate: invoiceDate,
            referenceType: 'PURCHASE_WITHOUT_PO',
            referenceId: null,
            storeId: dto.storeId,
            narration:
              dto.notes ||
              `Direct purchase invoice ${invoiceNumber} from ${party.name} (${dto.itemName || 'Direct Goods/Services'})`,
            totalAmount: totalEntryAmount,
            lines: {
              create: journalLines,
            },
          },
        });

        // Create Accounting Transaction
        // CRITICAL: poId IS STRICTLY NULL (NO FAKE PO CREATED!)
        const transaction = await tx.accountingTransaction.create({
          data: {
            storeId: dto.storeId,
            partyId: party.id,
            poId: null, // STRICTLY NULL
            transactionType: TransactionType.PURCHASE_WITHOUT_PO,
            invoiceNumber,
            invoiceDate,
            dueDate,
            grossAmount,
            taxAmount,
            netAmount,
            paidAmount,
            paymentStatus,
            notes: dto.notes?.trim() || `Direct Purchase: ${dto.itemName || ''}`,
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

        // If payment was made, record in Payment table
        if (paidAmount > 0) {
          const paymentCount = await tx.payment.count();
          const paymentNumber = `PAY-${new Date().getFullYear()}-${(paymentCount + 1).toString().padStart(4, '0')}`;

          await tx.payment.create({
            data: {
              paymentNumber,
              paymentDate: invoiceDate,
              partyId: party.id,
              accountId: bankOrCashAccountId,
              transactionId: transaction.id,
              amount: paidAmount,
              paymentMode: paymentMethod,
              referenceNo: dto.referenceNo || null,
              notes: `Immediate settlement for Direct Purchase Invoice ${invoiceNumber}`,
            },
          });
        }

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entity: 'PurchaseAccountDirect',
            entityId: transaction.id,
            newValues: JSON.stringify({
              transactionId: transaction.id,
              poId: null,
              workflow: 'WITHOUT_PO',
              invoiceNumber: transaction.invoiceNumber,
              supplier: party.name,
              item: dto.itemName,
              grossAmount,
              taxAmount,
              netAmount,
              paidAmount,
              paymentStatus,
            }),
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
          },
        });

        return transaction;
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  /**
   * Get purchase transactions with comprehensive search and filtering
   */
  static async getPurchases(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: PurchaseListFilters = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      transactionType: {
        in: [TransactionType.PURCHASE, TransactionType.PURCHASE_WITH_PO, TransactionType.PURCHASE_WITHOUT_PO],
      },
    };

    // Store tenancy
    if (user.role !== UserRole.ADMIN) {
      where.storeId = { in: user.storeIds };
    }

    if (filters.storeId) {
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(filters.storeId)) {
        throw new AccountsSecurityError(`Forbidden: Store access denied for '${filters.storeId}'.`, 403);
      }
      where.storeId = filters.storeId;
    }

    // Type filter
    if (filters.type === 'with-po') {
      where.poId = { not: null };
    } else if (filters.type === 'without-po') {
      where.poId = null;
    }

    // Supplier filter
    const supplierId = filters.supplierId || filters.partyId;
    if (supplierId) {
      where.partyId = supplierId;
    }

    // Status filter
    const status = filters.status || filters.paymentStatus;
    if (status && status !== 'ALL') {
      where.paymentStatus = status as PaymentStatus;
    }

    // Date range
    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = end;
      }
    }

    // Search filter (Invoice #, PO #, Supplier name)
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
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
          party: { select: { id: true, code: true, name: true, type: true, gstin: true } },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              poDate: true,
              status: true,
              totalAmount: true,
            },
          },
        },
      }),
    ]);

    const formattedRecords = transactions.map((t) => {
      const outstanding = Math.round(Math.max(0, t.netAmount - t.paidAmount) * 100) / 100;
      return {
        id: t.id,
        date: t.invoiceDate,
        poId: t.poId,
        poNumber: t.purchaseOrder?.poNumber || null,
        invoiceNumber: t.invoiceNumber,
        supplier: t.party.name,
        supplierCode: t.party.code,
        partyId: t.partyId,
        store: t.store.name,
        storeId: t.storeId,
        grossAmount: t.grossAmount,
        taxAmount: t.taxAmount,
        amount: t.netAmount,
        paid: t.paidAmount,
        outstanding,
        status: t.paymentStatus,
        dueDate: t.dueDate,
        notes: t.notes,
        hasPO: !!t.poId,
      };
    });

    return {
      records: formattedRecords,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

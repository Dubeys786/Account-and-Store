import prisma from '../../../config/db';
import { TransactionType, UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export interface PayablesFilterOptions {
  search?: string;
  supplierId?: string;
  storeId?: string;
  status?: string; // ALL, UNPAID, PARTIALLY_PAID, PAID, OVERDUE
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class PayablesService {
  /**
   * Get invoice-level accounts payable with aging, days overdue, and supplier/store data
   */
  static async getPayables(
    user: { id: string; role: UserRole; storeIds: string[] },
    filters: PayablesFilterOptions = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 50));
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

    if (filters.supplierId) {
      where.partyId = filters.supplierId;
    }

    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = end;
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allTransactions, transactionsCount] = await Promise.all([
      prisma.accountingTransaction.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'desc' }],
        include: {
          store: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true, phone: true, creditDays: true } },
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        },
      }),
      prisma.accountingTransaction.count({ where }),
    ]);

    // Compute invoice-level payables and days overdue
    let totalPayable = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    const formattedRecords = allTransactions.map((t) => {
      const total = Math.round(t.netAmount * 100) / 100;
      const paid = Math.round(t.paidAmount * 100) / 100;
      const outstanding = Math.round(Math.max(0, total - paid) * 100) / 100;

      // Calculate Days Overdue
      let daysOverdue = 0;
      if (t.dueDate && outstanding > 0) {
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        if (today.getTime() > due.getTime()) {
          const diffMs = today.getTime() - due.getTime();
          daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
      }

      // Compute display status
      let status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
      if (outstanding <= 0) {
        status = 'PAID';
      } else if (daysOverdue > 0) {
        status = 'OVERDUE';
      } else if (paid > 0) {
        status = 'PARTIALLY_PAID';
      } else {
        status = 'UNPAID';
      }

      // Aggregates
      totalPayable += total;
      totalPaid += paid;
      totalOutstanding += outstanding;
      if (daysOverdue > 0 && outstanding > 0) {
        overdueCount++;
        overdueAmount += outstanding;
      }

      return {
        id: t.id,
        supplier: t.party.name,
        supplierCode: t.party.code,
        supplierId: t.party.id,
        store: t.store.name,
        storeCode: t.store.code,
        storeId: t.store.id,
        po: t.purchaseOrder?.poNumber || 'PO = N/A',
        poId: t.poId,
        hasPO: !!t.poId,
        invoice: t.invoiceNumber,
        invoiceDate: t.invoiceDate,
        dueDate: t.dueDate,
        total,
        paid,
        outstanding,
        daysOverdue,
        status,
        notes: t.notes,
      };
    });

    // In-memory status filtering if requested
    let filteredRecords = formattedRecords;
    if (filters.status && filters.status !== 'ALL') {
      filteredRecords = formattedRecords.filter((r) => r.status === filters.status);
    }

    const paginatedRecords = filteredRecords.slice(skip, skip + limit);

    return {
      records: paginatedRecords,
      summary: {
        totalPayable: Math.round(totalPayable * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        overdueCount,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
      },
      pagination: {
        total: filteredRecords.length,
        page,
        limit,
        totalPages: Math.ceil(filteredRecords.length / limit),
      },
    };
  }
}

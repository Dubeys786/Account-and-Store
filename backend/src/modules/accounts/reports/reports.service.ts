import prisma from '../../../config/db';
import { PaymentMode, PaymentStatus, TransactionType, UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';
import { BooksService } from '../books/books.service';
import { LedgerService } from '../ledger/ledger.service';

export type ReportType =
  | 'PARTY_LEDGER'
  | 'PURCHASE_REPORT'
  | 'PURCHASE_WITH_PO'
  | 'PURCHASE_WITHOUT_PO'
  | 'PAYABLE_REPORT'
  | 'RECEIVABLE_REPORT'
  | 'PAYMENT_REPORT'
  | 'RECEIPT_REPORT'
  | 'EXPENSE_REPORT'
  | 'INCOME_REPORT'
  | 'DAY_BOOK'
  | 'CASH_BOOK'
  | 'BANK_BOOK'
  | 'STORE_WISE';

export interface ReportFilterOptions {
  reportType: ReportType;
  startDate?: string;
  endDate?: string;
  storeId?: string;
  partyId?: string;
  transactionType?: string;
  paymentMethod?: string;
  poNumber?: string;
  invoiceNumber?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  unlimited?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReportColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge';
  align?: 'left' | 'center' | 'right';
}

export interface ReportResponse {
  reportType: ReportType;
  reportTitle: string;
  reportDescription: string;
  generatedAt: string;
  filtersApplied: Record<string, any>;
  columns: ReportColumnDef[];
  records: any[];
  summary: Record<string, any>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ReportsService {
  /**
   * Helper: check role and tenancy permissions
   */
  private static validateAccess(
    user: { id: string; role: UserRole; storeIds: string[] },
    storeId?: string
  ) {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to generate accounting reports.`,
        403
      );
    }
    if (storeId && storeId !== 'ALL' && user.role !== UserRole.ADMIN) {
      if (!user.storeIds.includes(storeId)) {
        throw new AccountsSecurityError(
          `Forbidden: You do not have permission to view reports for store '${storeId}'.`,
          403
        );
      }
    }
  }

  /**
   * Generate any of the 14 accounting reports with unified filtering, pagination, and sorting
   */
  static async generateReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions
  ): Promise<ReportResponse> {
    this.validateAccess(user, options.storeId);

    const reportType = (options.reportType || 'PURCHASE_REPORT').toUpperCase() as ReportType;
    const isUnlimited = options.unlimited === true || String(options.unlimited) === 'true';
    const page = isUnlimited ? 1 : Math.max(1, Number(options.page || 1));
    const maxLimit = isUnlimited ? 10000 : 200;
    const defaultLimit = isUnlimited ? 10000 : 50;
    const limit = Math.max(1, Math.min(maxLimit, Number(options.limit || defaultLimit)));
    const skip = (page - 1) * limit;

    const startDate = options.startDate ? new Date(options.startDate) : null;
    let endDate: Date | null = null;
    if (options.endDate) {
      endDate = new Date(options.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    switch (reportType) {
      case 'PARTY_LEDGER':
        return this.generatePartyLedgerReport(user, options, { page, limit, skip, startDate, endDate });

      case 'PURCHASE_REPORT':
      case 'PURCHASE_WITH_PO':
      case 'PURCHASE_WITHOUT_PO':
        return this.generatePurchaseReport(user, reportType, options, { page, limit, skip, startDate, endDate });

      case 'PAYABLE_REPORT':
        return this.generatePayableReport(user, options, { page, limit, skip, startDate, endDate });

      case 'RECEIVABLE_REPORT':
        return this.generateReceivableReport(user, options, { page, limit, skip, startDate, endDate });

      case 'PAYMENT_REPORT':
        return this.generatePaymentReport(user, options, { page, limit, skip, startDate, endDate });

      case 'RECEIPT_REPORT':
        return this.generateReceiptReport(user, options, { page, limit, skip, startDate, endDate });

      case 'EXPENSE_REPORT':
        return this.generateExpenseReport(user, options, { page, limit, skip, startDate, endDate });

      case 'INCOME_REPORT':
        return this.generateIncomeReport(user, options, { page, limit, skip, startDate, endDate });

      case 'DAY_BOOK':
        return this.generateDayBookReport(user, options, { page, limit });

      case 'CASH_BOOK':
        return this.generateCashBookReport(user, options);

      case 'BANK_BOOK':
        return this.generateBankBookReport(user, options);

      case 'STORE_WISE':
        return this.generateStoreWiseReport(user, options, { startDate, endDate });

      default:
        throw new Error(`Unsupported report type: '${reportType}'`);
    }
  }

  // =========================================================================
  // 1. PARTY LEDGER REPORT
  // =========================================================================
  private static async generatePartyLedgerReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const columns: ReportColumnDef[] = [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'partyName', label: 'Party', type: 'text' },
      { key: 'voucherNumber', label: 'Voucher #', type: 'text' },
      { key: 'reference', label: 'Reference / Type', type: 'badge' },
      { key: 'particulars', label: 'Particulars', type: 'text' },
      { key: 'debit', label: 'Debit (₹)', type: 'currency', align: 'right' },
      { key: 'credit', label: 'Credit (₹)', type: 'currency', align: 'right' },
      { key: 'balance', label: 'Running Balance (₹)', type: 'currency', align: 'right' },
    ];

    if (options.partyId) {
      if (user.role !== UserRole.ADMIN) {
        const party = await prisma.party.findUnique({
          where: { id: options.partyId },
          select: { id: true, storeId: true, name: true },
        });
        if (!party) {
          throw new AccountsSecurityError(`Party with ID '${options.partyId}' not found.`, 404);
        }
        if (party.storeId && !user.storeIds.includes(party.storeId)) {
          throw new AccountsSecurityError(
            'Forbidden: You are not authorized to view ledger reports for this party.',
            403
          );
        }
      }

      // Specific party ledger using LedgerService
      const ledgerResult = await LedgerService.getPartyLedger(options.partyId, {
        startDate: options.startDate,
        endDate: options.endDate,
      });

      let rows = ledgerResult.entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        partyName: ledgerResult.party.name,
        voucherNumber: entry.voucherNumber,
        reference: entry.referenceType || 'JOURNAL',
        particulars: entry.particulars,
        debit: entry.debit,
        credit: entry.credit,
        balance: entry.formattedBalance,
      }));

      if (options.search) {
        const q = options.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.voucherNumber.toLowerCase().includes(q) ||
            r.particulars.toLowerCase().includes(q) ||
            r.reference.toLowerCase().includes(q)
        );
      }

      const total = rows.length;
      const paginated = rows.slice(p.skip, p.skip + p.limit);

      return {
        reportType: 'PARTY_LEDGER',
        reportTitle: `Party Ledger — ${ledgerResult.party.name}`,
        reportDescription: `Chronological transaction ledger with running balance for ${ledgerResult.party.name} (${ledgerResult.party.code})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: options,
        columns,
        records: paginated,
        summary: {
          openingBalance: ledgerResult.openingBalance.formatted,
          totalDebit: ledgerResult.totalDebit,
          totalCredit: ledgerResult.totalCredit,
          closingBalance: ledgerResult.closingBalance.formatted,
          partyName: ledgerResult.party.name,
          partyCode: ledgerResult.party.code,
        },
        pagination: {
          total,
          page: p.page,
          limit: p.limit,
          totalPages: Math.ceil(total / p.limit),
        },
      };
    }

    // Global party lines across all parties
    const where: any = {};
    if (options.startDate || options.endDate) {
      where.journalEntry = { entryDate: {} };
      if (options.startDate) where.journalEntry.entryDate.gte = p.startDate!;
      if (options.endDate) where.journalEntry.entryDate.lte = p.endDate!;
    }
    where.partyId = { not: null };

    if (user.role !== UserRole.ADMIN) {
      where.party = {
        storeId: { in: user.storeIds },
      };
    }
    if (options.storeId && options.storeId !== 'ALL') {
      where.party = { storeId: options.storeId };
    }

    const [total, lines] = await Promise.all([
      prisma.journalEntryLine.count({ where }),
      prisma.journalEntryLine.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { journalEntry: { entryDate: 'desc' } },
        include: {
          journalEntry: true,
          party: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const rows = lines.map((l) => {
      totalDebitSum += l.debitAmount;
      totalCreditSum += l.creditAmount;
      return {
        id: l.id,
        date: l.journalEntry.entryDate,
        partyName: l.party ? `${l.party.name} (${l.party.code})` : '—',
        voucherNumber: l.journalEntry.entryNumber,
        reference: l.journalEntry.referenceType || 'JOURNAL',
        particulars: l.description || l.journalEntry.narration,
        debit: l.debitAmount,
        credit: l.creditAmount,
        balance: l.debitAmount > 0 ? `+ ₹${l.debitAmount}` : `- ₹${l.creditAmount}`,
      };
    });

    return {
      reportType: 'PARTY_LEDGER',
      reportTitle: 'Global Party Ledger Register',
      reportDescription: 'Comprehensive ledger entries across all active parties and partners',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalDebit: Math.round(totalDebitSum * 100) / 100,
        totalCredit: Math.round(totalCreditSum * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 2, 3, 4. PURCHASE REPORTS (All, With PO, Without PO)
  // =========================================================================
  private static async generatePurchaseReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    type: 'PURCHASE_REPORT' | 'PURCHASE_WITH_PO' | 'PURCHASE_WITHOUT_PO',
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {
      transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
    };

    if (type === 'PURCHASE_WITH_PO') {
      where.poId = { not: null };
    } else if (type === 'PURCHASE_WITHOUT_PO') {
      where.poId = null;
    }

    if (user.role !== UserRole.ADMIN) {
      where.storeId = { in: user.storeIds };
    }
    if (options.storeId && options.storeId !== 'ALL') {
      where.storeId = options.storeId;
    }
    if (options.partyId && options.partyId !== 'ALL') {
      where.partyId = options.partyId;
    }
    if (options.status && options.status !== 'ALL') {
      where.paymentStatus = options.status as PaymentStatus;
    }
    if (options.invoiceNumber) {
      where.invoiceNumber = { contains: options.invoiceNumber.trim(), mode: 'insensitive' };
    }
    if (options.poNumber) {
      where.purchaseOrder = { poNumber: { contains: options.poNumber.trim(), mode: 'insensitive' } };
    }
    if (p.startDate || p.endDate) {
      where.invoiceDate = {};
      if (p.startDate) where.invoiceDate.gte = p.startDate;
      if (p.endDate) where.invoiceDate.lte = p.endDate;
    }
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { party: { name: { contains: q, mode: 'insensitive' } } },
        { party: { code: { contains: q, mode: 'insensitive' } } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, allRecords, records] = await Promise.all([
      prisma.accountingTransaction.count({ where }),
      prisma.accountingTransaction.findMany({
        where,
        select: { grossAmount: true, taxAmount: true, netAmount: true, paidAmount: true },
      }),
      prisma.accountingTransaction.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true } },
          store: { select: { id: true, code: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true, totalAmount: true } },
        },
      }),
    ]);

    let totalGross = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalPaid = 0;

    allRecords.forEach((r) => {
      totalGross += r.grossAmount;
      totalTax += r.taxAmount;
      totalNet += r.netAmount;
      totalPaid += r.paidAmount;
    });

    const totalOutstanding = totalNet - totalPaid;

    const columns: ReportColumnDef[] = [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'text' },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
      { key: 'poNumber', label: 'PO #', type: 'text' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'grossAmount', label: 'Gross (₹)', type: 'currency', align: 'right' },
      { key: 'taxAmount', label: 'Tax (₹)', type: 'currency', align: 'right' },
      { key: 'netAmount', label: 'Net (₹)', type: 'currency', align: 'right' },
      { key: 'paidAmount', label: 'Paid (₹)', type: 'currency', align: 'right' },
      { key: 'outstanding', label: 'Outstanding (₹)', type: 'currency', align: 'right' },
      { key: 'paymentStatus', label: 'Status', type: 'badge', align: 'center' },
    ];

    const rows = records.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate,
      poNumber: r.purchaseOrder?.poNumber || 'Direct Purchase (No PO)',
      supplier: `${r.party.name} (${r.party.code})`,
      store: `${r.store.name} (${r.store.code})`,
      grossAmount: r.grossAmount,
      taxAmount: r.taxAmount,
      netAmount: r.netAmount,
      paidAmount: r.paidAmount,
      outstanding: Math.max(0, Math.round((r.netAmount - r.paidAmount) * 100) / 100),
      paymentStatus: r.paymentStatus,
    }));

    const titleMap = {
      PURCHASE_REPORT: 'Complete Purchase Accounting Report',
      PURCHASE_WITH_PO: 'Purchase Report (With Purchase Orders)',
      PURCHASE_WITHOUT_PO: 'Direct Purchase Report (Without PO)',
    };

    const descMap = {
      PURCHASE_REPORT: 'Audit statement of all vendor purchase invoices, taxes, and settlements',
      PURCHASE_WITH_PO: 'Purchases linked to formal approved PO and material inwards',
      PURCHASE_WITHOUT_PO: 'Direct purchase invoices booked without purchase order requirement',
    };

    return {
      reportType: type,
      reportTitle: titleMap[type],
      reportDescription: descMap[type],
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 5. PAYABLE REPORT
  // =========================================================================
  private static async generatePayableReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {
      transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
    };

    if (user.role !== UserRole.ADMIN) where.storeId = { in: user.storeIds };
    if (options.storeId && options.storeId !== 'ALL') where.storeId = options.storeId;
    if (options.partyId && options.partyId !== 'ALL') where.partyId = options.partyId;

    const [total, records] = await Promise.all([
      prisma.accountingTransaction.count({ where }),
      prisma.accountingTransaction.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { dueDate: 'asc' },
        include: {
          party: { select: { id: true, code: true, name: true, phone: true } },
          store: { select: { id: true, code: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
        },
      }),
    ]);

    const now = new Date();
    let totalOutstanding = 0;
    let overdueCount = 0;

    const rows = records.map((r) => {
      const outstanding = Math.max(0, Math.round((r.netAmount - r.paidAmount) * 100) / 100);
      totalOutstanding += outstanding;
      const due = r.dueDate ? new Date(r.dueDate) : new Date(r.invoiceDate);
      const diffMs = now.getTime() - due.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (daysOverdue > 0) overdueCount++;

      return {
        id: r.id,
        supplier: `${r.party.name} (${r.party.code})`,
        store: `${r.store.name} (${r.store.code})`,
        poNumber: r.purchaseOrder?.poNumber || 'Direct',
        invoiceNumber: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        totalAmount: r.netAmount,
        paidAmount: r.paidAmount,
        outstanding,
        daysOverdue,
        status: r.paymentStatus,
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'poNumber', label: 'PO #', type: 'text' },
      { key: 'invoiceNumber', label: 'Invoice #', type: 'text' },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'totalAmount', label: 'Total (₹)', type: 'currency', align: 'right' },
      { key: 'paidAmount', label: 'Paid (₹)', type: 'currency', align: 'right' },
      { key: 'outstanding', label: 'Outstanding (₹)', type: 'currency', align: 'right' },
      { key: 'daysOverdue', label: 'Days Overdue', type: 'number', align: 'center' },
      { key: 'status', label: 'Status', type: 'badge', align: 'center' },
    ];

    return {
      reportType: 'PAYABLE_REPORT',
      reportTitle: 'Accounts Payable Aging & Outstanding Report',
      reportDescription: 'Current supplier liabilities, payment obligations, and overdue days schedule',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalInvoices: total,
        overdueCount,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 6. RECEIVABLE REPORT
  // =========================================================================
  private static async generateReceivableReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {
      transactionType: { in: ['SALE', 'SALES'] },
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
    };

    if (user.role !== UserRole.ADMIN) where.storeId = { in: user.storeIds };
    if (options.storeId && options.storeId !== 'ALL') where.storeId = options.storeId;
    if (options.partyId && options.partyId !== 'ALL') where.partyId = options.partyId;

    const [total, records] = await Promise.all([
      prisma.accountingTransaction.count({ where }),
      prisma.accountingTransaction.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { dueDate: 'asc' },
        include: {
          party: { select: { id: true, code: true, name: true, phone: true } },
          store: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    const now = new Date();
    let totalOutstanding = 0;
    let overdueCount = 0;

    const rows = records.map((r) => {
      const outstanding = Math.max(0, Math.round((r.netAmount - r.paidAmount) * 100) / 100);
      totalOutstanding += outstanding;
      const due = r.dueDate ? new Date(r.dueDate) : new Date(r.invoiceDate);
      const diffMs = now.getTime() - due.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (daysOverdue > 0) overdueCount++;

      return {
        id: r.id,
        customer: `${r.party.name} (${r.party.code})`,
        store: `${r.store.name} (${r.store.code})`,
        invoiceNumber: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        totalAmount: r.netAmount,
        receivedAmount: r.paidAmount,
        outstanding,
        daysOverdue,
        status: r.paymentStatus,
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'invoiceNumber', label: 'Invoice #', type: 'text' },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'totalAmount', label: 'Total (₹)', type: 'currency', align: 'right' },
      { key: 'receivedAmount', label: 'Received (₹)', type: 'currency', align: 'right' },
      { key: 'outstanding', label: 'Outstanding (₹)', type: 'currency', align: 'right' },
      { key: 'daysOverdue', label: 'Days Overdue', type: 'number', align: 'center' },
      { key: 'status', label: 'Status', type: 'badge', align: 'center' },
    ];

    return {
      reportType: 'RECEIVABLE_REPORT',
      reportTitle: 'Accounts Receivable Aging & Outstanding Report',
      reportDescription: 'Customer trade debtor schedule, pending bill collections, and aging breakdown',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalInvoices: total,
        overdueCount,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 7. PAYMENT REPORT
  // =========================================================================
  private static async generatePaymentReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {};
    if (p.startDate || p.endDate) {
      where.paymentDate = {};
      if (p.startDate) where.paymentDate.gte = p.startDate;
      if (p.endDate) where.paymentDate.lte = p.endDate;
    }
    if (options.partyId && options.partyId !== 'ALL') where.partyId = options.partyId;
    if (options.paymentMethod && options.paymentMethod !== 'ALL') {
      where.paymentMode = options.paymentMethod.toUpperCase().replace(' ', '_') as PaymentMode;
    }

    const [total, records] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
          transaction: {
            select: {
              invoiceNumber: true,
              store: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    let totalDisbursed = 0;
    let cashSum = 0;
    let bankSum = 0;

    const rows = records.map((pay) => {
      totalDisbursed += pay.amount;
      if (pay.paymentMode === PaymentMode.CASH) cashSum += pay.amount;
      else bankSum += pay.amount;

      return {
        id: pay.id,
        paymentNumber: pay.paymentNumber,
        paymentDate: pay.paymentDate,
        supplier: `${pay.party.name} (${pay.party.code})`,
        store: pay.transaction?.store?.name || 'Main Store',
        invoiceNumber: pay.transaction?.invoiceNumber || 'On Account',
        paymentMode: pay.paymentMode,
        referenceNo: pay.referenceNo || '—',
        amount: pay.amount,
        accountName: pay.account?.name || 'General Account',
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'paymentNumber', label: 'Payment #', type: 'text' },
      { key: 'paymentDate', label: 'Date', type: 'date' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'invoiceNumber', label: 'Invoice #', type: 'text' },
      { key: 'paymentMode', label: 'Method', type: 'badge' },
      { key: 'referenceNo', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'currency', align: 'right' },
      { key: 'accountName', label: 'Disbursed Account', type: 'text' },
    ];

    return {
      reportType: 'PAYMENT_REPORT',
      reportTitle: 'Supplier Payment Disbursements Report',
      reportDescription: 'Audit of vendor settlements, remittance modes, bank UTRs, and cheques issued',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalDisbursed: Math.round(totalDisbursed * 100) / 100,
        cashDisbursed: Math.round(cashSum * 100) / 100,
        bankDisbursed: Math.round(bankSum * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 8. RECEIPT REPORT
  // =========================================================================
  private static async generateReceiptReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {};
    if (p.startDate || p.endDate) {
      where.receiptDate = {};
      if (p.startDate) where.receiptDate.gte = p.startDate;
      if (p.endDate) where.receiptDate.lte = p.endDate;
    }
    if (options.partyId && options.partyId !== 'ALL') where.partyId = options.partyId;

    const [total, records] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { receiptDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true, store: { select: { id: true, code: true, name: true } } } },
          account: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    let totalCollected = 0;
    let cashSum = 0;
    let bankSum = 0;

    const rows = records.map((rec) => {
      totalCollected += rec.amount;
      if (rec.paymentMode === PaymentMode.CASH) cashSum += rec.amount;
      else bankSum += rec.amount;

      return {
        id: rec.id,
        receiptNumber: rec.receiptNumber,
        receiptDate: rec.receiptDate,
        customer: `${rec.party.name} (${rec.party.code})`,
        store: rec.party.store?.name || 'Main Store',
        paymentMode: rec.paymentMode,
        referenceNo: rec.referenceNo || '—',
        amount: rec.amount,
        accountName: rec.account?.name || 'General Liquid Account',
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'receiptNumber', label: 'Receipt #', type: 'text' },
      { key: 'receiptDate', label: 'Date', type: 'date' },
      { key: 'customer', label: 'Customer / Payer', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'paymentMode', label: 'Method', type: 'badge' },
      { key: 'referenceNo', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'currency', align: 'right' },
      { key: 'accountName', label: 'Collection Account', type: 'text' },
    ];

    return {
      reportType: 'RECEIPT_REPORT',
      reportTitle: 'Customer Receipt Collections Report',
      reportDescription: 'Audit of customer inflows, wire transfers, cheque deposits, and cash collections',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalCollected: Math.round(totalCollected * 100) / 100,
        cashCollected: Math.round(cashSum * 100) / 100,
        bankCollected: Math.round(bankSum * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 9. EXPENSE REPORT
  // =========================================================================
  private static async generateExpenseReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {};
    if (user.role !== UserRole.ADMIN) where.storeId = { in: user.storeIds };
    if (options.storeId && options.storeId !== 'ALL') where.storeId = options.storeId;
    if (p.startDate || p.endDate) {
      where.expenseDate = {};
      if (p.startDate) where.expenseDate.gte = p.startDate;
      if (p.endDate) where.expenseDate.lte = p.endDate;
    }

    const [total, records] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          store: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    let totalExp = 0;
    const rows = records.map((e) => {
      totalExp += e.amount;
      return {
        id: e.id,
        expenseNumber: e.expenseNumber,
        expenseDate: e.expenseDate,
        category: e.category,
        party: e.party ? `${e.party.name} (${e.party.code})` : '—',
        store: `${e.store.name} (${e.store.code})`,
        paymentMode: e.paymentMode,
        referenceNo: e.referenceNo || '—',
        amount: e.amount,
        description: e.description || '—',
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'expenseNumber', label: 'Voucher #', type: 'text' },
      { key: 'expenseDate', label: 'Date', type: 'date' },
      { key: 'category', label: 'Category', type: 'badge' },
      { key: 'party', label: 'Payee', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'paymentMode', label: 'Mode', type: 'badge' },
      { key: 'referenceNo', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'currency', align: 'right' },
      { key: 'description', label: 'Description', type: 'text' },
    ];

    return {
      reportType: 'EXPENSE_REPORT',
      reportTitle: 'Operating & Administrative Expense Report',
      reportDescription: 'Detailed schedule of rent, payroll, freight, utilities, and maintenance expenditures',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalExpenses: Math.round(totalExp * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 10. INCOME REPORT
  // =========================================================================
  private static async generateIncomeReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number; skip: number; startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const where: any = {};
    if (user.role !== UserRole.ADMIN) where.storeId = { in: user.storeIds };
    if (options.storeId && options.storeId !== 'ALL') where.storeId = options.storeId;
    if (p.startDate || p.endDate) {
      where.incomeDate = {};
      if (p.startDate) where.incomeDate.gte = p.startDate;
      if (p.endDate) where.incomeDate.lte = p.endDate;
    }

    const [total, records] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { incomeDate: 'desc' },
        include: {
          store: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    let totalInc = 0;
    const rows = records.map((i) => {
      totalInc += i.amount;
      return {
        id: i.id,
        incomeNumber: i.incomeNumber,
        incomeDate: i.incomeDate,
        category: i.category,
        party: i.party ? `${i.party.name} (${i.party.code})` : '—',
        store: `${i.store.name} (${i.store.code})`,
        paymentMode: i.paymentMode,
        referenceNo: i.referenceNo || '—',
        amount: i.amount,
        description: i.description || '—',
      };
    });

    const columns: ReportColumnDef[] = [
      { key: 'incomeNumber', label: 'Voucher #', type: 'text' },
      { key: 'incomeDate', label: 'Date', type: 'date' },
      { key: 'category', label: 'Category', type: 'badge' },
      { key: 'party', label: 'Remitter', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'paymentMode', label: 'Mode', type: 'badge' },
      { key: 'referenceNo', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'currency', align: 'right' },
      { key: 'description', label: 'Description', type: 'text' },
    ];

    return {
      reportType: 'INCOME_REPORT',
      reportTitle: 'Direct & Auxiliary Revenue Report',
      reportDescription: 'Breakdown of sales proceeds, scrap disposal, service fee income, and consulting receipts',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: rows,
      summary: {
        totalIncome: Math.round(totalInc * 100) / 100,
        count: total,
      },
      pagination: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  }

  // =========================================================================
  // 11. DAY BOOK REPORT
  // =========================================================================
  private static async generateDayBookReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { page: number; limit: number }
  ): Promise<ReportResponse> {
    const dayBook = await BooksService.getDayBook(user, {
      startDate: options.startDate,
      endDate: options.endDate,
      storeId: options.storeId,
      search: options.search,
      page: p.page,
      limit: p.limit,
    });

    const columns: ReportColumnDef[] = [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'transaction', label: 'Transaction', type: 'text' },
      { key: 'reference', label: 'Reference', type: 'badge' },
      { key: 'party', label: 'Party', type: 'text' },
      { key: 'debit', label: 'Debit', type: 'text' },
      { key: 'credit', label: 'Credit', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'currency', align: 'right' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'createdBy', label: 'Created By', type: 'text' },
    ];

    return {
      reportType: 'DAY_BOOK',
      reportTitle: 'Day Book (Daily Financial Journal)',
      reportDescription: 'Chronological double-entry audit of all transactions and ledger lines',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: dayBook.records,
      summary: dayBook.summary,
      pagination: dayBook.pagination,
    };
  }

  // =========================================================================
  // 12. CASH BOOK REPORT
  // =========================================================================
  private static async generateCashBookReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions
  ): Promise<ReportResponse> {
    const cashBook = await BooksService.getCashBook(user, {
      startDate: options.startDate,
      endDate: options.endDate,
      storeId: options.storeId,
    });

    const columns: ReportColumnDef[] = [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'voucherNumber', label: 'Voucher #', type: 'text' },
      { key: 'particulars', label: 'Particulars', type: 'text' },
      { key: 'party', label: 'Party', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'receipt', label: 'Cash Receipts (Dr ₹)', type: 'currency', align: 'right' },
      { key: 'payment', label: 'Cash Payments (Cr ₹)', type: 'currency', align: 'right' },
      { key: 'runningBalance', label: 'Running Balance (₹)', type: 'currency', align: 'right' },
    ];

    return {
      reportType: 'CASH_BOOK',
      reportTitle: 'Cash Book Register (1010 - Cash on Hand)',
      reportDescription: 'Physical cash inflows, disbursements, and real-time ledger balance',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: cashBook.entries,
      summary: cashBook.summary,
      pagination: {
        total: cashBook.entries.length,
        page: 1,
        limit: cashBook.entries.length,
        totalPages: 1,
      },
    };
  }

  // =========================================================================
  // 13. BANK BOOK REPORT
  // =========================================================================
  private static async generateBankBookReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions
  ): Promise<ReportResponse> {
    const bankBook = await BooksService.getBankBook(user, {
      startDate: options.startDate,
      endDate: options.endDate,
      storeId: options.storeId,
    });

    const columns: ReportColumnDef[] = [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'voucherNumber', label: 'Voucher / Txn #', type: 'text' },
      { key: 'particulars', label: 'Particulars', type: 'text' },
      { key: 'party', label: 'Party', type: 'text' },
      { key: 'store', label: 'Store', type: 'text' },
      { key: 'receipt', label: 'Bank Deposits (Dr ₹)', type: 'currency', align: 'right' },
      { key: 'payment', label: 'Bank Payments (Cr ₹)', type: 'currency', align: 'right' },
      { key: 'runningBalance', label: 'Running Balance (₹)', type: 'currency', align: 'right' },
    ];

    return {
      reportType: 'BANK_BOOK',
      reportTitle: 'Bank Book Register (1020 - Operating Bank Account)',
      reportDescription: 'Bank ledger statement, wire transfers, electronic settlements, and balance',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: bankBook.entries,
      summary: bankBook.summary,
      pagination: {
        total: bankBook.entries.length,
        page: 1,
        limit: bankBook.entries.length,
        totalPages: 1,
      },
    };
  }

  // =========================================================================
  // 14. STORE-WISE ACCOUNTING REPORT
  // =========================================================================
  private static async generateStoreWiseReport(
    user: { id: string; role: UserRole; storeIds: string[] },
    options: ReportFilterOptions,
    p: { startDate: Date | null; endDate: Date | null }
  ): Promise<ReportResponse> {
    const storeWhere: any = { isActive: true };
    if (user.role !== UserRole.ADMIN) {
      storeWhere.id = { in: user.storeIds };
    }
    if (options.storeId && options.storeId !== 'ALL') {
      storeWhere.id = options.storeId;
    }

    const stores = await prisma.store.findMany({
      where: storeWhere,
      orderBy: { code: 'asc' },
    });

    const dateFilter: any = {};
    if (p.startDate) dateFilter.gte = p.startDate;
    if (p.endDate) dateFilter.lte = p.endDate;

    const hasDate = p.startDate || p.endDate;

    const storeRows = await Promise.all(
      stores.map(async (st) => {
        const txDateWhere = hasDate ? { invoiceDate: dateFilter } : {};
        const payDateWhere = hasDate ? { paymentDate: dateFilter } : {};
        const recDateWhere = hasDate ? { receiptDate: dateFilter } : {};
        const expDateWhere = hasDate ? { expenseDate: dateFilter } : {};
        const incDateWhere = hasDate ? { incomeDate: dateFilter } : {};

        const [purchasesAgg, salesAgg, expensesAgg, incomeAgg] = await Promise.all([
          prisma.accountingTransaction.aggregate({
            where: {
              storeId: st.id,
              transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
              ...txDateWhere,
            },
            _sum: { netAmount: true, paidAmount: true },
          }),
          prisma.accountingTransaction.aggregate({
            where: {
              storeId: st.id,
              transactionType: { in: ['SALE', 'SALES'] },
              ...txDateWhere,
            },
            _sum: { netAmount: true, paidAmount: true },
          }),
          prisma.expense.aggregate({
            where: { storeId: st.id, ...expDateWhere },
            _sum: { amount: true },
          }),
          prisma.income.aggregate({
            where: { storeId: st.id, ...incDateWhere },
            _sum: { amount: true },
          }),
        ]);

        const purchases = purchasesAgg._sum.netAmount || 0;
        const purchasePaid = purchasesAgg._sum.paidAmount || 0;
        const payables = Math.max(0, purchases - purchasePaid);

        const sales = salesAgg._sum.netAmount || 0;
        const salesReceived = salesAgg._sum.paidAmount || 0;
        const receivables = Math.max(0, sales - salesReceived);

        const expenses = expensesAgg._sum.amount || 0;
        const income = incomeAgg._sum.amount || 0;

        const netOperatingProfit = Math.round((sales + income - purchases - expenses) * 100) / 100;

        return {
          storeId: st.id,
          storeCode: st.code,
          storeName: st.name,
          location: st.location || '—',
          purchases: Math.round(purchases * 100) / 100,
          sales: Math.round(sales * 100) / 100,
          payables: Math.round(payables * 100) / 100,
          receivables: Math.round(receivables * 100) / 100,
          expenses: Math.round(expenses * 100) / 100,
          income: Math.round(income * 100) / 100,
          netPosition: netOperatingProfit,
        };
      })
    );

    let aggPurchases = 0;
    let aggSales = 0;
    let aggPayables = 0;
    let aggReceivables = 0;
    let aggExpenses = 0;
    let aggIncome = 0;
    let aggNet = 0;

    storeRows.forEach((r) => {
      aggPurchases += r.purchases;
      aggSales += r.sales;
      aggPayables += r.payables;
      aggReceivables += r.receivables;
      aggExpenses += r.expenses;
      aggIncome += r.income;
      aggNet += r.netPosition;
    });

    const columns: ReportColumnDef[] = [
      { key: 'storeCode', label: 'Store Code', type: 'text' },
      { key: 'storeName', label: 'Store Name', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'purchases', label: 'Purchases (₹)', type: 'currency', align: 'right' },
      { key: 'sales', label: 'Sales (₹)', type: 'currency', align: 'right' },
      { key: 'payables', label: 'Payables (₹)', type: 'currency', align: 'right' },
      { key: 'receivables', label: 'Receivables (₹)', type: 'currency', align: 'right' },
      { key: 'expenses', label: 'Expenses (₹)', type: 'currency', align: 'right' },
      { key: 'income', label: 'Income (₹)', type: 'currency', align: 'right' },
      { key: 'netPosition', label: 'Net Operating (₹)', type: 'currency', align: 'right' },
    ];

    return {
      reportType: 'STORE_WISE',
      reportTitle: 'Store-wise Multi-Branch Accounting Report',
      reportDescription: 'Comparative performance, trade liabilities, receivables, and operating profit across all physical stores',
      generatedAt: new Date().toISOString(),
      filtersApplied: options,
      columns,
      records: storeRows,
      summary: {
        totalPurchases: Math.round(aggPurchases * 100) / 100,
        totalSales: Math.round(aggSales * 100) / 100,
        totalPayables: Math.round(aggPayables * 100) / 100,
        totalReceivables: Math.round(aggReceivables * 100) / 100,
        totalExpenses: Math.round(aggExpenses * 100) / 100,
        totalIncome: Math.round(aggIncome * 100) / 100,
        netTotalPosition: Math.round(aggNet * 100) / 100,
        storeCount: storeRows.length,
      },
      pagination: {
        total: storeRows.length,
        page: 1,
        limit: storeRows.length,
        totalPages: 1,
      },
    };
  }

  // =========================================================================
  // ACCOUNTS DASHBOARD LIVE ANALYTICS (REAL DATABASE NUMBERS, NO MOCK DATA)
  // =========================================================================
  static async getDashboardAnalytics(user: { id: string; role: UserRole; storeIds: string[] }) {
    this.validateAccess(user);

    const storeFilter: any = {};
    if (user.role !== UserRole.ADMIN) {
      storeFilter.storeId = { in: user.storeIds };
    }

    // 1. Fetch real monthly data for the past 6 calendar months
    const months: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      months.push({ key, label, start, end });
    }

    // Run parallel monthly database aggregations
    const monthlySeries = await Promise.all(
      months.map(async (m) => {
        const [purchaseAgg, paymentAgg, receiptAgg, expenseAgg, incomeAgg] = await Promise.all([
          prisma.accountingTransaction.aggregate({
            where: {
              ...storeFilter,
              transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
              invoiceDate: { gte: m.start, lte: m.end },
            },
            _sum: { netAmount: true },
          }),
          prisma.payment.aggregate({
            where: {
              paymentDate: { gte: m.start, lte: m.end },
            },
            _sum: { amount: true },
          }),
          prisma.receipt.aggregate({
            where: {
              receiptDate: { gte: m.start, lte: m.end },
            },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: {
              ...storeFilter,
              expenseDate: { gte: m.start, lte: m.end },
            },
            _sum: { amount: true },
          }),
          prisma.income.aggregate({
            where: {
              ...storeFilter,
              incomeDate: { gte: m.start, lte: m.end },
            },
            _sum: { amount: true },
          }),
        ]);

        return {
          monthKey: m.key,
          label: m.label,
          purchases: Math.round((purchaseAgg._sum.netAmount || 0) * 100) / 100,
          payments: Math.round((paymentAgg._sum.amount || 0) * 100) / 100,
          receipts: Math.round((receiptAgg._sum.amount || 0) * 100) / 100,
          expenses: Math.round((expenseAgg._sum.amount || 0) * 100) / 100,
          income: Math.round((incomeAgg._sum.amount || 0) * 100) / 100,
        };
      })
    );

    // 2. Fetch real Outstanding Payables vs Receivables totals
    const [payablesAgg, receivablesAgg] = await Promise.all([
      prisma.accountingTransaction.aggregate({
        where: {
          ...storeFilter,
          transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
        },
        _sum: { netAmount: true, paidAmount: true },
      }),
      prisma.accountingTransaction.aggregate({
        where: {
          ...storeFilter,
          transactionType: { in: ['SALE', 'SALES'] },
        },
        _sum: { netAmount: true, paidAmount: true },
      }),
    ]);

    const totalPayables = Math.max(0, Math.round(((payablesAgg._sum.netAmount || 0) - (payablesAgg._sum.paidAmount || 0)) * 100) / 100);
    const totalReceivables = Math.max(0, Math.round(((receivablesAgg._sum.netAmount || 0) - (receivablesAgg._sum.paidAmount || 0)) * 100) / 100);

    // 3. Category distribution for Expenses (real database breakdown)
    const expenseCategories = await prisma.expense.groupBy({
      by: ['category'],
      where: storeFilter,
      _sum: { amount: true },
    });

    const expenseBreakdown = expenseCategories.map((ec) => ({
      category: ec.category,
      amount: Math.round((ec._sum.amount || 0) * 100) / 100,
    }));

    // 4. Category distribution for Income (real database breakdown)
    const incomeCategories = await prisma.income.groupBy({
      by: ['category'],
      where: storeFilter,
      _sum: { amount: true },
    });

    const incomeBreakdown = incomeCategories.map((ic) => ({
      category: ic.category,
      amount: Math.round((ic._sum.amount || 0) * 100) / 100,
    }));

    // 5. Total volume sums across all 7 series
    let totalPurchasesSum = 0;
    let totalPaymentsSum = 0;
    let totalReceiptsSum = 0;
    let totalExpensesSum = 0;
    let totalIncomeSum = 0;

    monthlySeries.forEach((m) => {
      totalPurchasesSum += m.purchases;
      totalPaymentsSum += m.payments;
      totalReceiptsSum += m.receipts;
      totalExpensesSum += m.expenses;
      totalIncomeSum += m.income;
    });

    return {
      monthlySeries,
      totals: {
        purchases: totalPurchasesSum,
        payments: totalPaymentsSum,
        receipts: totalReceiptsSum,
        payables: totalPayables,
        receivables: totalReceivables,
        expenses: totalExpensesSum,
        income: totalIncomeSum,
      },
      expenseBreakdown,
      incomeBreakdown,
    };
  }
}

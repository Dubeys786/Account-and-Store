import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import prisma from '../../config/db';

import { PartyController } from './party/party.controller';
import { JournalController } from './foundation/journal.controller';
import { TransactionController } from './transaction/transaction.controller';
import { LedgerController } from './ledger/ledger.controller';
import { LedgerService } from './ledger/ledger.service';
import { PurchaseAccountingService } from './purchase/purchase-accounting.service';
import { PaymentService } from './payment/payment.service';
import { ReceiptService } from './receipt/receipt.service';
import { PayablesService } from './payables/payables.service';
import { ReceivablesService } from './receivables/receivables.service';
import { ExpenseService } from './expense/expense.service';
import { IncomeService } from './income/income.service';
import { BooksService } from './books/books.service';
import { ReportsService } from './reports/reports.service';
import { AccountsSecurityError } from './accounts.guard';
import { preventParameterTampering } from '../../middleware/security.middleware';
import { AuditService } from '../audit/audit.service';

const router = Router();

// Accounts modules are strictly accessible by ADMIN and ACCOUNT_USER only.
// STORE_USER is strictly FORBIDDEN to access these routes!
router.use(authenticate, preventParameterTampering, requireRoles([UserRole.ADMIN, UserRole.ACCOUNT_USER]));

// ==========================================
// 1. DASHBOARD & METRICS
// ==========================================
router.get('/dashboard-metrics', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      partyCount,
      activeParties,
      accountCount,
      poCount,
      purchaseAgg,
      salesAgg,
      todayPaymentsAgg,
      allPaymentsAgg,
      todayReceiptsAgg,
      allReceiptsAgg,
      todayPurchasesAgg,
      todaySalesAgg,
      totalExpensesAgg,
      totalIncomeAgg,
      recentTxns,
    ] = await Promise.all([
      prisma.party.count(),
      prisma.party.count({ where: { status: 'ACTIVE' } }),
      prisma.ledgerAccount.count(),
      prisma.purchaseOrder.count(),
      prisma.accountingTransaction.aggregate({
        _sum: { netAmount: true, paidAmount: true },
        where: { transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] } },
      }),
      prisma.accountingTransaction.aggregate({
        _sum: { netAmount: true, paidAmount: true },
        where: { transactionType: { in: ['SALE', 'SALES'] } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paymentDate: { gte: today } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
      }),
      prisma.receipt.aggregate({
        _sum: { amount: true },
        where: { receiptDate: { gte: today } },
      }),
      prisma.receipt.aggregate({
        _sum: { amount: true },
      }),
      prisma.accountingTransaction.aggregate({
        _sum: { netAmount: true },
        where: {
          transactionType: { in: ['PURCHASE', 'PURCHASE_WITH_PO', 'PURCHASE_WITHOUT_PO'] },
          invoiceDate: { gte: today },
        },
      }),
      prisma.accountingTransaction.aggregate({
        _sum: { netAmount: true },
        where: {
          transactionType: { in: ['SALE', 'SALES'] },
          invoiceDate: { gte: today },
        },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        _sum: { amount: true },
      }),
      prisma.accountingTransaction.findMany({
        take: 8,
        orderBy: { invoiceDate: 'desc' },
        include: {
          party: { select: { id: true, code: true, name: true, type: true } },
          store: { select: { id: true, code: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
        },
      }),
    ]);

    const totalPayables = Math.round(((purchaseAgg._sum.netAmount || 0) - (purchaseAgg._sum.paidAmount || 0)) * 100) / 100;
    const totalReceivables = Math.round(((salesAgg._sum.netAmount || 0) - (salesAgg._sum.paidAmount || 0)) * 100) / 100;
    const todayPayments = todayPaymentsAgg._sum.amount ?? (allPaymentsAgg._sum.amount || 0);
    const todayReceipts = todayReceiptsAgg._sum.amount ?? (allReceiptsAgg._sum.amount || 0);
    const todayPurchases = todayPurchasesAgg._sum.netAmount || 0;
    const todaySales = todaySalesAgg._sum.netAmount || 0;
    const totalExpenses = totalExpensesAgg._sum.amount || 0;
    const totalIncome = totalIncomeAgg._sum.amount || 0;
    const outstandingAmount = Math.round(Math.abs(totalReceivables - totalPayables) * 100) / 100;

    res.json({
      success: true,
      message: 'Accounts dashboard metrics retrieved.',
      data: {
        totalPayables,
        totalReceivables,
        todayPayments,
        todayReceipts,
        todayPurchases,
        todaySales,
        totalExpenses,
        totalIncome,
        outstandingAmount,
        activeParties,
        partyCount,
        accountCount,
        poCount,
        recentTransactions: recentTxns,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Accessible active stores for accounts metadata dropdowns
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const where: any = { isActive: true };
    if (user.role !== UserRole.ADMIN && user.storeIds?.length) {
      where.id = { in: user.storeIds };
    }
    const stores = await prisma.store.findMany({
      where,
      select: { id: true, code: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: stores });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. PARTY MASTER (CRUD, Search, Filter, Pagination, Deactivate)
// ==========================================
router.post('/parties', PartyController.createParty);
router.get('/parties', PartyController.getParties);
router.get('/parties/:id', PartyController.getPartyById);
router.put('/parties/:id', PartyController.updateParty);
router.patch('/parties/:id/deactivate', PartyController.deactivateParty);
router.patch('/parties/:id/status', PartyController.toggleStatus);

// ==========================================
// 3. PARTY LEDGER FOUNDATION (Ledger Statement, Balance, Transactions)
// ==========================================
router.get('/parties/:id/ledger', LedgerController.getPartyLedger);
router.get('/parties/:id/balance', LedgerController.getPartyBalance);
router.get('/parties/:id/transactions', LedgerController.getPartyTransactions);
router.get('/ledger', LedgerController.getGenericLedger);

// ==========================================
// 4. ACCOUNTING FOUNDATION (Journal Entries, Double-Entry Balancing, Chart of Accounts)
// ==========================================
router.post('/journal-entries', JournalController.createJournalEntry);
router.get('/journal-entries', JournalController.getJournalEntries);
router.get('/journal-entries/:id', JournalController.getJournalEntryById);
router.get('/ledger-accounts', JournalController.getLedgerAccounts);
router.post('/ledger-accounts', JournalController.createLedgerAccount);

// ==========================================
// 5. ACCOUNTING TRANSACTIONS (Purchase, Return, Sale, Payment, Receipt, Expense, Income, etc.)
// ==========================================
router.post('/transactions', TransactionController.createTransaction);
router.get('/transactions', TransactionController.getTransactions);
router.get('/transactions/:id', TransactionController.getTransactionById);
router.post('/transactions/:id/void', TransactionController.voidTransaction);

// ==========================================
// 5.1 PURCHASE ACCOUNTING WITH PO WORKFLOW
// ==========================================

// List eligible approved/valid POs for With-PO accounting workflow
router.get('/purchases/eligible-pos', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { storeId, partyId, search } = req.query;

    const eligiblePOs = await PurchaseAccountingService.getEligiblePOs(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        storeId: storeId as string,
        partyId: partyId as string,
        search: search as string,
      }
    );

    res.json({
      success: true,
      message: 'Eligible purchase orders retrieved for accounting.',
      data: eligiblePOs,
      count: eligiblePOs.length,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single PO by ID with line items and material inwards for Purchase Entry screen
router.get('/purchases/eligible-pos/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const poDetail = await PurchaseAccountingService.getEligiblePOById(req.params.id, {
      id: user.id,
      role: user.role,
      storeIds: user.storeIds || [],
    });

    res.json({
      success: true,
      message: 'Purchase order details loaded for purchase entry.',
      data: poDetail,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(404).json({ success: false, message: error.message });
  }
});

// Post Purchase Accounting WITH PO (Atomic 11-step single database transaction)
router.post('/purchases/with-po', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { poId, invoiceNumber, invoiceDate, dueDate, notes } = req.body;

    const result = await PurchaseAccountingService.createPurchaseWithPO(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        poId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        notes,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Purchase accounting transaction, journal voucher, supplier ledger, and payable posted successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// Post Direct Purchase Accounting WITHOUT PO (Atomic ACID transaction, po_id = NULL)
router.post('/purchases/without-po', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      partyId,
      storeId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      itemName,
      itemDescription,
      quantity,
      rate,
      discountPercent,
      taxPercent,
      paymentStatus,
      paymentMethod,
      paidAmount,
      referenceNo,
      notes,
    } = req.body;

    const result = await PurchaseAccountingService.createDirectPurchase(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        partyId,
        storeId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        itemName,
        itemDescription,
        quantity,
        rate,
        discountPercent,
        taxPercent,
        paymentStatus,
        paymentMethod,
        paidAmount,
        referenceNo,
        notes,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Direct purchase invoice, journal voucher, party ledger, and payable posted successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// Purchase Accounts List (Supports WITH PO, WITHOUT PO, search, date range, store, supplier, and status filters)
router.get('/purchases', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { search, type, supplierId, partyId, storeId, status, paymentStatus, startDate, endDate, page, limit } =
      req.query;

    const result = await PurchaseAccountingService.getPurchases(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        search: search as string,
        type: type as any,
        supplierId: (supplierId as string) || (partyId as string),
        storeId: storeId as string,
        status: (status as string) || (paymentStatus as string),
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      }
    );

    res.json({
      success: true,
      message: 'Purchase accounting transactions retrieved.',
      data: result.records,
      meta: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. RECEIVABLES & PAYABLES
// ==========================================
router.get('/receivables', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { search, customerId, storeId, status, startDate, endDate, page, limit } = req.query;

    const result = await ReceivablesService.getReceivables(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        search: search as string,
        customerId: customerId as string,
        storeId: storeId as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      }
    );

    res.json({
      success: true,
      message: 'Receivables list and aging retrieved.',
      data: result.records,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/payables', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { search, supplierId, storeId, status, startDate, endDate, page, limit } = req.query;

    const result = await PayablesService.getPayables(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        search: search as string,
        supplierId: supplierId as string,
        storeId: storeId as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      }
    );

    res.json({
      success: true,
      message: 'Payables list and aging retrieved.',
      data: result.records,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. PAYMENTS & RECEIPTS (With Atomic Ledger, Payable/Receivable, Outstanding & Journal Updates)
// ==========================================
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { partyId, storeId, paymentMethod, startDate, endDate, search, page, limit } = req.query;

    const result = await PaymentService.getPayments(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        partyId: partyId as string,
        storeId: storeId as string,
        paymentMethod: paymentMethod as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      }
    );

    res.json({
      success: true,
      message: 'Payments retrieved successfully.',
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/payments/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const payment = await PaymentService.getPaymentById(req.params.id, {
      id: user.id,
      role: user.role,
      storeIds: user.storeIds || [],
    });

    res.json({
      success: true,
      message: 'Payment voucher details retrieved.',
      data: payment,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(404).json({ success: false, message: error.message });
  }
});

router.post('/payments', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { partyId, storeId, transactionId, poId, amount, paymentDate, paymentMethod, referenceNumber, notes } =
      req.body;

    const result = await PaymentService.createPayment(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        partyId,
        storeId,
        transactionId,
        poId,
        amount: Number(amount),
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Payment voucher recorded successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/receipts', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { partyId, storeId, paymentMethod, startDate, endDate, search, page, limit } = req.query;

    const result = await ReceiptService.getReceipts(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        partyId: partyId as string,
        storeId: storeId as string,
        paymentMethod: paymentMethod as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      }
    );

    res.json({
      success: true,
      message: 'Receipts retrieved successfully.',
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/receipts/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const receipt = await ReceiptService.getReceiptById(req.params.id, {
      id: user.id,
      role: user.role,
      storeIds: user.storeIds || [],
    });

    res.json({
      success: true,
      message: 'Receipt voucher details retrieved.',
      data: receipt,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(404).json({ success: false, message: error.message });
  }
});

router.post('/receipts', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { partyId, storeId, transactionId, amount, receiptDate, paymentMethod, referenceNumber, notes } = req.body;

    const result = await ReceiptService.createReceipt(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        partyId,
        storeId,
        transactionId,
        amount: Number(amount),
        receiptDate,
        paymentMethod,
        referenceNumber,
        notes,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Receipt voucher recorded successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 8. EXPENSES & INCOME
// ==========================================
router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await ExpenseService.getExpenses(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query
    );
    res.json({ success: true, message: 'Expenses retrieved.', data: result });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const expense = await ExpenseService.getExpenseById(
      req.params.id,
      { id: user.id, role: user.role, storeIds: user.storeIds || [] }
    );
    res.json({ success: true, message: 'Expense details retrieved.', data: expense });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(404).json({ success: false, message: error.message });
  }
});

router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { expenseDate, storeId, category, partyId, amount, paymentMethod, reference, description } = req.body;

    const result = await ExpenseService.createExpense(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        expenseDate,
        storeId,
        category,
        partyId,
        amount: Number(amount),
        paymentMethod,
        reference,
        description,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Expense voucher recorded successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/income', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await IncomeService.getIncome(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query
    );
    res.json({ success: true, message: 'Income records retrieved.', data: result });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/income/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const income = await IncomeService.getIncomeById(
      req.params.id,
      { id: user.id, role: user.role, storeIds: user.storeIds || [] }
    );
    res.json({ success: true, message: 'Income details retrieved.', data: income });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(404).json({ success: false, message: error.message });
  }
});

router.post('/income', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { incomeDate, storeId, category, partyId, amount, paymentMethod, reference, description } = req.body;

    const result = await IncomeService.createIncome(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      {
        incomeDate,
        storeId,
        category,
        partyId,
        amount: Number(amount),
        paymentMethod,
        reference,
        description,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      message: 'Income voucher recorded successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. DAY BOOK, CASH BOOK, BANK BOOK
// ==========================================
router.get('/day-book', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await BooksService.getDayBook(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query
    );
    res.json({
      success: true,
      message: 'Day Book transactions retrieved successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/cash-book', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await BooksService.getCashBook(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query
    );
    res.json({
      success: true,
      message: 'Cash Book ledger calculated successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/bank-book', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await BooksService.getBankBook(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query
    );
    res.json({
      success: true,
      message: 'Bank Book ledger calculated successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 10. ACCOUNTING REPORTS & LIVE ANALYTICS
// ==========================================
router.get('/reports', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Accounting reports catalog retrieved.',
    data: {
      availableReports: [
        { id: 'PARTY_LEDGER', title: 'Party Ledger', category: 'Ledgers & Statements', desc: 'Chronological party statement with running balances' },
        { id: 'PURCHASE_REPORT', title: 'Purchase Report', category: 'Purchases & Inward', desc: 'Comprehensive record of all purchase transactions' },
        { id: 'PURCHASE_WITH_PO', title: 'Purchase With PO', category: 'Purchases & Inward', desc: 'Purchases linked to approved purchase orders' },
        { id: 'PURCHASE_WITHOUT_PO', title: 'Purchase Without PO', category: 'Purchases & Inward', desc: 'Direct purchase bills booked without purchase orders' },
        { id: 'PAYABLE_REPORT', title: 'Payable Report', category: 'Trade Obligations', desc: 'Outstanding supplier bills and aging schedule' },
        { id: 'RECEIVABLE_REPORT', title: 'Receivable Report', category: 'Trade Obligations', desc: 'Customer trade receivables and overdue collections' },
        { id: 'PAYMENT_REPORT', title: 'Payment Report', category: 'Cash & Banking', desc: 'Vendor disbursements, bank transfers, and cheques' },
        { id: 'RECEIPT_REPORT', title: 'Receipt Report', category: 'Cash & Banking', desc: 'Customer collections, wire transfers, and deposits' },
        { id: 'EXPENSE_REPORT', title: 'Expense Report', category: 'Operating Accounts', desc: 'Operating expenditure, utilities, payroll, and logistics' },
        { id: 'INCOME_REPORT', title: 'Income Report', category: 'Operating Accounts', desc: 'Direct sales revenue, auxiliary, and scrap income' },
        { id: 'DAY_BOOK', title: 'Day Book', category: 'Statutory Books', desc: 'Chronological double-entry journal audit log' },
        { id: 'CASH_BOOK', title: 'Cash Book', category: 'Statutory Books', desc: 'Physical cash register (1010) with running balance' },
        { id: 'BANK_BOOK', title: 'Bank Book', category: 'Statutory Books', desc: 'Operating bank register (1020) with running balance' },
        { id: 'STORE_WISE', title: 'Store-wise Accounting Report', category: 'Management Financials', desc: 'Multi-branch comparative financial performance' },
      ],
    },
  });
});

router.get('/reports/generate', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await ReportsService.generateReport(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query as any
    );
    res.json({
      success: true,
      message: `${result.reportTitle} generated successfully.`,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError || error.name === 'AccountsSecurityError' || error.statusCode) {
      res.status(error.statusCode || 403).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reports/export', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const format = ((req.query.format as string) || 'CSV').toUpperCase();
    const result = await ReportsService.generateReport(
      { id: user.id, role: user.role, storeIds: user.storeIds || [] },
      req.query as any
    );

    await AuditService.record({
      userId: user.id,
      action: 'EXPORT',
      entity: 'Report',
      entityId: (req.query.reportType as string) || 'ACCOUNTING_REPORT',
      newValues: {
        format,
        reportType: req.query.reportType,
        recordCount: result.records?.length || 0,
        filters: req.query,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `${result.reportTitle} exported successfully as ${format}.`,
      data: result,
      format,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/dashboard-analytics', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const result = await ReportsService.getDashboardAnalytics({
      id: user.id,
      role: user.role,
      storeIds: user.storeIds || [],
    });
    res.json({
      success: true,
      message: 'Live accounts dashboard analytics calculated.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AccountsSecurityError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/settings', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Accounting configuration and chart of accounts settings retrieved.',
    data: {
      financialYear: '2026-2027',
      baseCurrency: 'INR (₹)',
      gstRegistered: true,
      autoPostingEnabled: true,
    },
  });
});

export default router;

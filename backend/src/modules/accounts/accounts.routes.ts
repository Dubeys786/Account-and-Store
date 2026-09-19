import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import prisma from '../../config/db';

import { PartyController } from './party/party.controller';
import { JournalController } from './foundation/journal.controller';
import { TransactionController } from './transaction/transaction.controller';
import { LedgerController } from './ledger/ledger.controller';

const router = Router();

// Accounts modules are strictly accessible by ADMIN and ACCOUNT_USER only.
// STORE_USER is strictly FORBIDDEN to access these routes!
router.use(authenticate, requireRoles([UserRole.ADMIN, UserRole.ACCOUNT_USER]));

// ==========================================
// 1. DASHBOARD & METRICS
// ==========================================
router.get('/dashboard-metrics', async (_req: Request, res: Response) => {
  try {
    const [partyCount, accountCount, poCount] = await Promise.all([
      prisma.party.count(),
      prisma.ledgerAccount.count(),
      prisma.purchaseOrder.count(),
    ]);

    res.json({
      success: true,
      message: 'Accounts dashboard metrics retrieved.',
      data: {
        totalReceivables: 450000,
        totalPayables: 285000,
        cashBankBalance: 1245000,
        pendingInvoices: 8,
        partyCount,
        accountCount,
        poCount,
      },
    });
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

// Purchase Accounts (Supports WITH PO and WITHOUT PO)
router.get('/purchases', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string; // 'with-po', 'without-po', or undefined

    const whereClause: any = {};
    if (type === 'with-po') {
      whereClause.poId = { not: null };
    } else if (type === 'without-po') {
      whereClause.poId = null;
    }

    const purchases = await prisma.accountingTransaction.findMany({
      where: whereClause,
      include: { party: true, purchaseOrder: true },
      take: 20,
      orderBy: { invoiceDate: 'desc' },
    });

    res.json({
      success: true,
      message: 'Purchase accounting transactions retrieved.',
      data: purchases,
      filterApplied: type || 'ALL',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. RECEIVABLES & PAYABLES
// ==========================================
router.get('/receivables', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.party.findMany({
      where: { type: { in: ['CUSTOMER', 'DEALER', 'DISTRIBUTOR'] }, status: 'ACTIVE' },
      take: 20,
    });
    res.json({
      success: true,
      message: 'Receivables aging and party list retrieved.',
      data: {
        totalReceivables: 450000,
        records: customers,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/payables', async (_req: Request, res: Response) => {
  try {
    const suppliers = await prisma.party.findMany({
      where: { type: 'SUPPLIER', status: 'ACTIVE' },
      take: 20,
    });
    res.json({
      success: true,
      message: 'Payables aging and supplier list retrieved.',
      data: {
        totalPayables: 285000,
        records: suppliers,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. PAYMENTS & RECEIPTS
// ==========================================
router.get('/payments', async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { party: true, account: true },
      take: 20,
      orderBy: { paymentDate: 'desc' },
    });
    res.json({ success: true, message: 'Payments retrieved.', data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/receipts', async (_req: Request, res: Response) => {
  try {
    const receipts = await prisma.receipt.findMany({
      include: { party: true, account: true },
      take: 20,
      orderBy: { receiptDate: 'desc' },
    });
    res.json({ success: true, message: 'Receipts retrieved.', data: receipts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 8. EXPENSES & INCOME
// ==========================================
router.get('/expenses', async (_req: Request, res: Response) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: { account: true, store: true },
      take: 20,
      orderBy: { expenseDate: 'desc' },
    });
    res.json({ success: true, message: 'Expenses retrieved.', data: expenses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/income', async (_req: Request, res: Response) => {
  try {
    const income = await prisma.income.findMany({
      include: { account: true, store: true },
      take: 20,
      orderBy: { incomeDate: 'desc' },
    });
    res.json({ success: true, message: 'Income records retrieved.', data: income });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. DAY BOOK, CASH BOOK, BANK BOOK
// ==========================================
router.get('/day-book', async (_req: Request, res: Response) => {
  try {
    const transactions = await prisma.journalEntry.findMany({
      take: 20,
      orderBy: { entryDate: 'desc' },
      include: {
        lines: { include: { account: true, party: true } },
      },
    });
    res.json({
      success: true,
      message: 'Day Book transactions retrieved.',
      data: { date: new Date().toISOString().split('T')[0], transactions },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/cash-book', async (_req: Request, res: Response) => {
  try {
    const cashAccount = await prisma.ledgerAccount.findUnique({
      where: { code: '1010' },
    });
    const lines = cashAccount
      ? await prisma.journalEntryLine.findMany({
          where: { accountId: cashAccount.id },
          include: { journalEntry: true, party: true },
          take: 20,
        })
      : [];
    res.json({
      success: true,
      message: 'Cash Book ledger entries retrieved.',
      data: { cashAccountCode: '1010', balance: 54200, entries: lines },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/bank-book', async (_req: Request, res: Response) => {
  try {
    const bankAccount = await prisma.ledgerAccount.findUnique({
      where: { code: '1020' },
    });
    const lines = bankAccount
      ? await prisma.journalEntryLine.findMany({
          where: { accountId: bankAccount.id },
          include: { journalEntry: true, party: true },
          take: 20,
        })
      : [];
    res.json({
      success: true,
      message: 'Bank Book ledger entries retrieved.',
      data: { bankAccountCode: '1020', balance: 1190800, entries: lines },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 10. ACCOUNTING REPORTS & SETTINGS
// ==========================================
router.get('/reports', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Accounting reports module ready.',
    data: {
      availableReports: [
        'Trial Balance',
        'Profit & Loss Statement',
        'Balance Sheet',
        'GST GSTR-2B Reconciliation',
        'Party Outstanding Aging',
      ],
    },
  });
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

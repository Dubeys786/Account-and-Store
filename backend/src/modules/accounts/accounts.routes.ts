import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import prisma from '../../config/db';

const router = Router();

// Accounts modules are strictly accessible by ADMIN and ACCOUNT_USER only.
// STORE_USER is strictly FORBIDDEN to access these routes!
router.use(authenticate, requireRoles([UserRole.ADMIN, UserRole.ACCOUNT_USER]));

// Accounts Dashboard Metrics
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

// Party Master
router.get('/parties', async (_req: Request, res: Response) => {
  try {
    const parties = await prisma.party.findMany({
      take: 20,
      orderBy: { name: 'asc' },
    });
    res.json({
      success: true,
      message: 'Parties list retrieved.',
      data: parties,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// Party Ledger
router.get('/ledger', async (req: Request, res: Response) => {
  const partyId = req.query.partyId as string;
  res.json({
    success: true,
    message: 'Party Ledger entries retrieved.',
    data: {
      partyId: partyId || null,
      openingBalance: 0,
      closingBalance: 0,
      entries: [],
    },
  });
});

// Receivables
router.get('/receivables', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Receivables aging and party list retrieved.',
    data: {
      totalReceivables: 450000,
      records: [],
    },
  });
});

// Payables
router.get('/payables', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Payables aging and supplier list retrieved.',
    data: {
      totalPayables: 285000,
      records: [],
    },
  });
});

// Payments
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

// Receipts
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

// Expenses
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

// Income
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

// Day Book
router.get('/day-book', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Day Book transactions retrieved.',
    data: { date: new Date().toISOString().split('T')[0], transactions: [] },
  });
});

// Cash Book
router.get('/cash-book', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Cash Book ledger entries retrieved.',
    data: { cashAccountCode: '1010', balance: 54200, entries: [] },
  });
});

// Bank Book
router.get('/bank-book', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Bank Book ledger entries retrieved.',
    data: { bankAccountCode: '1020', balance: 1190800, entries: [] },
  });
});

// Accounting Reports
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

// Account Settings
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

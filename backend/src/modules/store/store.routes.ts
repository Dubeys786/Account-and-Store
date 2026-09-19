import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import prisma from '../../config/db';

const router = Router();

// Store modules are accessible by ADMIN and STORE_USER only. ACCOUNT_USER is forbidden.
router.use(authenticate, requireRoles([UserRole.ADMIN, UserRole.STORE_USER]));

// Store Dashboard Metrics
router.get('/dashboard-metrics', async (_req: Request, res: Response) => {
  try {
    const [totalItems, totalPOs, totalInwards, lowStockCount] = await Promise.all([
      prisma.item.count(),
      prisma.purchaseOrder.count(),
      prisma.materialInward.count(),
      prisma.item.count({ where: { currentStock: { lte: 10 } } }),
    ]);

    res.json({
      success: true,
      message: 'Store dashboard metrics retrieved.',
      data: {
        totalItems,
        totalPOs,
        totalInwards,
        lowStockCount,
        availableStockUnits: 515,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Item Master
router.get('/items', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      take: 20,
      orderBy: { code: 'asc' },
    });
    res.json({
      success: true,
      message: 'Items list retrieved.',
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PO Master
router.get('/purchase-orders', async (_req: Request, res: Response) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      take: 20,
      include: { party: true, store: true, items: true },
      orderBy: { poDate: 'desc' },
    });
    res.json({
      success: true,
      message: 'Purchase Orders retrieved.',
      data: pos,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Material Inward
router.get('/material-inwards', async (_req: Request, res: Response) => {
  try {
    const inwards = await prisma.materialInward.findMany({
      take: 20,
      include: { party: true, purchaseOrder: true, items: true },
      orderBy: { inwardDate: 'desc' },
    });
    res.json({
      success: true,
      message: 'Material Inwards retrieved.',
      data: inwards,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stock Register
router.get('/stock-register', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
        minStock: true,
        reorderLevel: true,
      },
    });
    res.json({
      success: true,
      message: 'Stock Register retrieved.',
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Issue / Return
router.get('/issue-return', async (_req: Request, res: Response) => {
  try {
    const transactions = await prisma.stockTransaction.findMany({
      take: 20,
      include: { item: true, store: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      message: 'Stock Issue / Return transactions retrieved.',
      data: transactions,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reports
router.get('/reports', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Store reports module placeholder ready.',
    data: {
      availableReports: [
        'Stock Valuation Summary',
        'Item Consumption Analysis',
        'Pending PO Aging Report',
        'Supplier Inward Rejection Rate',
      ],
    },
  });
});

export default router;

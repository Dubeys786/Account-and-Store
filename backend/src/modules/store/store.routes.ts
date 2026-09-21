import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { ItemController } from './item/item.controller';
import { POController } from './po/po.controller';
import { InwardController } from './inward/inward.controller';
import { StockController } from './stock/stock.controller';
import { StoreDashboardService } from './dashboard/dashboard.service';
import { StoreReportsService } from './reports/reports.service';

import { preventParameterTampering } from '../../middleware/security.middleware';

const router = Router();

// Store modules are strictly accessible by STORE_INCHARGE, STORE_MANAGER, STORE_USER, and ACCOUNT_AND_STORE_INCHARGE.
router.use(authenticate, preventParameterTampering, requireRoles(['STORE_INCHARGE', 'STORE_MANAGER', 'STORE_USER', 'ACCOUNT_AND_STORE_INCHARGE']));

// Lookup endpoints for forms (scoped to authorized stores)
router.get('/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const where: any = { isActive: true };
    if (user.storeIds?.length) {
      where.id = { in: user.storeIds };
    }
    const stores = await prisma.store.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: stores });
  } catch (err) {
    next(err);
  }
});

router.get('/suppliers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await prisma.party.findMany({
      where: {
        type: { in: ['SUPPLIER', 'BOTH'] },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1. DASHBOARD METRICS
// ==========================================
router.get('/dashboard-metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.activeStoreId || (req.query.storeId as string);
    const data = await StoreDashboardService.getDashboardMetrics(storeId);
    res.json({
      success: true,
      message: 'Store dashboard metrics retrieved.',
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. ITEM MASTER CRUD
// ==========================================
router.get('/items', ItemController.getItems);
router.get('/items/:id', ItemController.getItemById);
router.post('/items', ItemController.createItem);
router.put('/items/:id', ItemController.updateItem);
router.patch('/items/:id/status', ItemController.toggleStatus);
router.delete('/items/:id', ItemController.deleteItem);

// ==========================================
// 3. PURCHASE ORDER (PO MASTER)
// ==========================================
router.get('/purchase-orders', POController.getPurchaseOrders);
router.get('/purchase-orders/:id', POController.getPOById);
router.post('/purchase-orders', POController.createPurchaseOrder);
router.patch('/purchase-orders/:id/status', POController.updateStatus);

// ==========================================
// 4. MATERIAL INWARD
// ==========================================
router.get('/material-inwards', InwardController.getMaterialInwards);
router.get('/material-inwards/:id', InwardController.getInwardById);
router.post('/material-inwards', InwardController.createMaterialInward);

// ==========================================
// 5. STOCK REGISTER & TRANSACTIONS (ISSUE / RETURN)
// ==========================================
router.get('/stock-register', StockController.getStockRegister);
router.post('/stock/issue', StockController.issueStock);
router.post('/stock/return', StockController.returnStock);
router.get('/stock/open-issues', StockController.getOpenIssues);
router.get('/stock/return-summary', StockController.getReturnSummary);
router.get('/stock/transactions', StockController.getTransactions);

// Backward compatible alias
router.get('/issue-return', StockController.getTransactions);

// ==========================================
// 6. STORE REPORTS
// ==========================================
router.get('/reports/valuation', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await StoreReportsService.getStockValuation();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/consumption', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await StoreReportsService.getItemConsumption();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/pending-pos', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await StoreReportsService.getPendingPOs();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/supplier-rejection', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await StoreReportsService.getSupplierRejectionReport();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/return-age', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req.query.storeId as string) || req.activeStoreId;
    const data = await StoreReportsService.getReturnAgeReport(storeId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

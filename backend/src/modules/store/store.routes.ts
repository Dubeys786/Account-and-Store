import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { ItemController } from './item/item.controller';
import { POController } from './po/po.controller';
import { InwardController } from './inward/inward.controller';
import { StockController } from './stock/stock.controller';
import { StoreDashboardService } from './dashboard/dashboard.service';
import { StoreReportsService } from './reports/reports.service';

const router = Router();

// Store modules are strictly accessible by ADMIN and STORE_USER only. ACCOUNT_USER is forbidden.
router.use(authenticate, requireRoles([UserRole.ADMIN, UserRole.STORE_USER]));

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

export default router;

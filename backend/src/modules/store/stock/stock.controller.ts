import { Request, Response, NextFunction } from 'express';
import { StockService } from './stock.service';
import { StockTransactionType, UserRole } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

export class StockController {
  static async getStockRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || req.activeStoreId;

      if (storeId && user.role !== UserRole.ADMIN && !user.storeIds.includes(storeId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization to view stock register for store '${storeId}'.`,
        });
        return;
      }

      const register = await StockService.getStockRegister(storeId);

      res.status(200).json({
        success: true,
        message: 'Stock register retrieved successfully.',
        data: register,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async issueStock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { itemId, storeId, quantity, department, referenceId, notes } = req.body;
      const targetStoreId = storeId || req.activeStoreId;

      if (!itemId || !targetStoreId || !quantity) {
        res.status(400).json({
          success: false,
          message: 'Item ID, Store ID, and Quantity are required.',
        });
        return;
      }

      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(targetStoreId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization to issue stock from store '${targetStoreId}'.`,
        });
        return;
      }

      const result = await StockService.issueStock({
        itemId,
        storeId: targetStoreId,
        quantity: Number(quantity),
        department,
        referenceId,
        notes,
      });

      await AuditService.record({
        userId: user.id,
        action: 'UPDATE',
        entity: 'StockIssue',
        entityId: result.transaction?.id || null,
        newValues: { itemId, storeId: targetStoreId, quantity, department },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Check if this issue caused item stock to fall at or below reorder level
      await NotificationService.checkLowStockAlert(itemId, targetStoreId);

      res.status(200).json({
        success: true,
        message: 'Stock issued successfully.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async returnStock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const {
        originalIssueId,
        itemId,
        storeId,
        quantity,
        returnDate,
        condition,
        returnReason,
        department,
        referenceId,
        notes,
      } = req.body;
      const targetStoreId = storeId || req.activeStoreId;

      if (!originalIssueId) {
        res.status(400).json({
          success: false,
          message: 'Original Issue ID is required to process a return.',
        });
        return;
      }

      if (!quantity || Number(quantity) <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid Return Quantity is required.',
        });
        return;
      }

      if (targetStoreId && user.role !== UserRole.ADMIN && !user.storeIds.includes(targetStoreId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization to return stock to store '${targetStoreId}'.`,
        });
        return;
      }

      const result = await StockService.returnStock({
        originalIssueId,
        itemId,
        storeId: targetStoreId,
        quantity: Number(quantity),
        returnDate,
        condition,
        returnReason,
        department,
        referenceId,
        notes,
      });

      await AuditService.record({
        userId: user.id,
        action: 'UPDATE',
        entity: 'StockReturn',
        entityId: result.transaction?.id || null,
        newValues: {
          originalIssueId,
          itemId,
          storeId: targetStoreId,
          quantity,
          condition,
          returnReason,
          daysHeld: result.daysHeld,
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Notify store users of returned item
      const itemInfo = result.transaction?.item;
      await NotificationService.notifyStoreUsers(targetStoreId, {
        title: 'Item Returned',
        message: `${itemInfo?.name || 'Item'} — ${quantity} ${itemInfo?.unit || 'units'} returned (${condition || 'Good'}).`,
        type: 'STORE',
        referenceType: 'item_return',
        referenceId: result.transaction?.id,
      });

      res.status(200).json({
        success: true,
        message: 'Stock returned successfully.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getOpenIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { storeId } = req.query;
      const targetStoreId = (storeId as string) || req.activeStoreId;

      if (targetStoreId && user.role !== UserRole.ADMIN && !user.storeIds.includes(targetStoreId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization for store '${targetStoreId}'.`,
        });
        return;
      }

      const openIssues = await StockService.getOpenIssues(targetStoreId);

      res.status(200).json({
        success: true,
        message: 'Open issues retrieved successfully.',
        data: openIssues,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getReturnSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { storeId } = req.query;
      const targetStoreId = (storeId as string) || req.activeStoreId;

      if (targetStoreId && user.role !== UserRole.ADMIN && !user.storeIds.includes(targetStoreId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization for store '${targetStoreId}'.`,
        });
        return;
      }

      const summary = await StockService.getReturnSummary(targetStoreId);

      res.status(200).json({
        success: true,
        message: 'Return age summary retrieved successfully.',
        data: summary,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { storeId, itemId, type } = req.query;
      const targetStoreId = (storeId as string) || req.activeStoreId;

      if (targetStoreId && user.role !== UserRole.ADMIN && !user.storeIds.includes(targetStoreId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization to view stock transactions for store '${targetStoreId}'.`,
        });
        return;
      }

      const transactions = await StockService.getTransactions({
        storeId: targetStoreId,
        itemId: itemId as string,
        type: type as StockTransactionType,
      });

      res.status(200).json({
        success: true,
        message: 'Stock transactions retrieved.',
        data: transactions,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

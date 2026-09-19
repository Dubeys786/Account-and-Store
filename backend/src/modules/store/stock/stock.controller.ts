import { Request, Response, NextFunction } from 'express';
import { StockService } from './stock.service';
import { StockTransactionType } from '@prisma/client';

export class StockController {
  static async getStockRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const storeId = req.activeStoreId || (req.query.storeId as string);
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

  static async issueStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId, storeId, quantity, department, referenceId, notes } = req.body;
      const targetStoreId = storeId || req.activeStoreId;

      if (!itemId || !targetStoreId || !quantity) {
        res.status(400).json({
          success: false,
          message: 'Item ID, Store ID, and Quantity are required.',
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

      res.status(200).json({
        success: true,
        message: 'Stock issued successfully.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async returnStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId, storeId, quantity, department, referenceId, notes } = req.body;
      const targetStoreId = storeId || req.activeStoreId;

      if (!itemId || !targetStoreId || !quantity) {
        res.status(400).json({
          success: false,
          message: 'Item ID, Store ID, and Quantity are required.',
        });
        return;
      }

      const result = await StockService.returnStock({
        itemId,
        storeId: targetStoreId,
        quantity: Number(quantity),
        department,
        referenceId,
        notes,
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

  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, itemId, type } = req.query;
      const transactions = await StockService.getTransactions({
        storeId: (storeId as string) || req.activeStoreId,
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

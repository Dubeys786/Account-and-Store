import { Request, Response, NextFunction } from 'express';
import { POService } from './po.service';
import { POStatus } from '@prisma/client';

export class POController {
  static async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, status, partyId } = req.query;
      const orders = await POService.getPurchaseOrders({
        storeId: storeId as string,
        status: status as POStatus,
        partyId: partyId as string,
      });

      res.status(200).json({
        success: true,
        message: 'Purchase orders retrieved.',
        data: orders,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getPOById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await POService.getPOById(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Purchase order details retrieved.',
        data: po,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { partyId, storeId, expectedDelivery, notes, items, poNumber } = req.body;

      if (!partyId || !storeId || !items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Party, Store, and at least one item are required.',
        });
        return;
      }

      const po = await POService.createPurchaseOrder({
        poNumber,
        partyId,
        storeId,
        expectedDelivery,
        notes,
        items,
      });

      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully.',
        data: po,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      if (!status || !Object.values(POStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${Object.values(POStatus).join(', ')}`,
        });
        return;
      }

      const updated = await POService.updatePOStatus(req.params.id, status);
      res.status(200).json({
        success: true,
        message: `PO status updated to ${status}.`,
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

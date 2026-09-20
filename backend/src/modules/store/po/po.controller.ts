import { Request, Response, NextFunction } from 'express';
import { POService } from './po.service';
import { POStatus, UserRole } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';

export class POController {
  static async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { storeId, status, partyId } = req.query;

      const requestedStoreId = storeId as string;
      let storeIdsFilter: string[] | undefined = undefined;

      if (user.role !== UserRole.ADMIN) {
        if (requestedStoreId) {
          if (!user.storeIds.includes(requestedStoreId)) {
            res.status(403).json({
              success: false,
              message: `Forbidden: You do not have authorization to access purchase orders for store '${requestedStoreId}'.`,
            });
            return;
          }
        } else {
          storeIdsFilter = user.storeIds;
        }
      }

      const orders = await POService.getPurchaseOrders({
        storeId: requestedStoreId,
        storeIds: storeIdsFilter,
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

  static async getPOById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const po = await POService.getPOById(req.params.id);

      if (!po) {
        res.status(404).json({ success: false, message: `Purchase order with ID '${req.params.id}' not found.` });
        return;
      }

      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(po.storeId)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have authorization to access this Purchase Order.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Purchase order details retrieved.',
        data: po,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createPurchaseOrder(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { partyId, storeId, expectedDelivery, notes, items, poNumber } = req.body;

      if (!partyId || !storeId || !items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Party, Store, and at least one item are required.',
        });
        return;
      }

      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(storeId)) {
        res.status(403).json({
          success: false,
          message: `Forbidden: You do not have authorization to create Purchase Orders for store '${storeId}'.`,
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

      await AuditService.record({
        userId: user.id,
        action: 'CREATE',
        entity: 'PurchaseOrder',
        entityId: po.id,
        newValues: { poNumber: po.poNumber, storeId: po.storeId, partyId: po.partyId, totalAmount: po.totalAmount },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
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

  static async updateStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { status } = req.body;
      if (!status || !Object.values(POStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${Object.values(POStatus).join(', ')}`,
        });
        return;
      }

      const po = await POService.getPOById(req.params.id);
      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(po.storeId)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have authorization to modify this Purchase Order.',
        });
        return;
      }

      const updated = await POService.updatePOStatus(req.params.id, status);

      await AuditService.record({
        userId: user.id,
        action: 'UPDATE',
        entity: 'PurchaseOrder',
        entityId: updated.id,
        oldValues: { status: po.status },
        newValues: { status: updated.status },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

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

import { Request, Response, NextFunction } from 'express';
import { InwardService } from './inward.service';
import { UserRole } from '@prisma/client';
import prisma from '../../../config/db';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

export class InwardController {
  static async getMaterialInwards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { storeId, poId, search } = req.query;
      const requestedStoreId = storeId as string;
      let storeIdsFilter: string[] | undefined = undefined;

      if (user.role !== UserRole.ADMIN) {
        if (requestedStoreId) {
          if (!user.storeIds.includes(requestedStoreId)) {
            res.status(403).json({
              success: false,
              message: `Forbidden: You do not have authorization to access material inwards for store '${requestedStoreId}'.`,
            });
            return;
          }
        } else {
          storeIdsFilter = user.storeIds;
        }
      }

      const inwards = await InwardService.getMaterialInwards({
        storeId: requestedStoreId,
        storeIds: storeIdsFilter,
        poId: poId as string,
        search: search as string,
      });

      res.status(200).json({
        success: true,
        message: 'Material inwards retrieved.',
        data: inwards,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getInwardById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const inward = await InwardService.getInwardById(req.params.id);

      if (!inward) {
        res.status(404).json({ success: false, message: `Material inward with ID '${req.params.id}' not found.` });
        return;
      }

      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(inward.storeId)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have authorization to access this Material Inward record.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Material inward details retrieved.',
        data: inward,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createMaterialInward(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { poId, referenceNumber, remarks, items, inwardNumber, inwardDate } = req.body;

      if (!poId || !items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Purchase Order ID and items array are required.',
        });
        return;
      }

      // Check PO store authorization
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: { id: true, storeId: true, poNumber: true },
      });

      if (!po) {
        res.status(404).json({ success: false, message: `Purchase Order with ID '${poId}' not found.` });
        return;
      }

      if (user.role !== UserRole.ADMIN && !user.storeIds.includes(po.storeId)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have authorization to record Material Inward for this Purchase Order.',
        });
        return;
      }

      const inward = await InwardService.createMaterialInward({
        poId,
        referenceNumber,
        remarks,
        items,
        inwardNumber,
        inwardDate,
      });

      await AuditService.record({
        userId: user.id,
        action: 'CREATE',
        entity: 'MaterialInward',
        entityId: inward.id,
        newValues: { inwardNumber: inward.inwardNumber, poId, storeId: po.storeId },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Notify store users
      await NotificationService.notifyStoreUsers(po.storeId, {
        title: 'Material Inward Completed',
        message: `Material Inward ${inward.inwardNumber} has been completed and stock has been updated.`,
        type: 'STORE',
        referenceType: 'material_inward',
        referenceId: inward.id,
      });

      res.status(201).json({
        success: true,
        message: 'Material inward recorded and stock updated.',
        data: inward,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

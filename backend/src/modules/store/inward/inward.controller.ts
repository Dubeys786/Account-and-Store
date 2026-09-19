import { Request, Response, NextFunction } from 'express';
import { InwardService } from './inward.service';

export class InwardController {
  static async getMaterialInwards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, poId } = req.query;
      const inwards = await InwardService.getMaterialInwards({
        storeId: storeId as string,
        poId: poId as string,
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

  static async getInwardById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inward = await InwardService.getInwardById(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Material inward details retrieved.',
        data: inward,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createMaterialInward(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { poId, referenceNumber, remarks, items, inwardNumber, inwardDate } = req.body;

      if (!poId || !items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Purchase Order ID and items array are required.',
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

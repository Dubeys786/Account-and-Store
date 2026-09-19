import { Request, Response, NextFunction } from 'express';
import { ItemService } from './item.service';

export class ItemController {
  static async getItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, category, status, sortBy, sortOrder, page, limit } = req.query;

      const result = await ItemService.getItems({
        search: search as string,
        category: category as string,
        status: status as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        message: 'Items fetched successfully.',
        data: result.items,
        meta: result.pagination,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ItemService.getItemById(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Item retrieved successfully.',
        data: item,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, name, brand, category, unit, description, minStock, maxStock, reorderLevel, currentStock } = req.body;

      if (!code || !name || !category) {
        res.status(400).json({
          success: false,
          message: 'Item code, name, and category are required fields.',
        });
        return;
      }

      const item = await ItemService.createItem({
        code,
        name,
        brand,
        category,
        unit: unit || 'PCS',
        description,
        minStock,
        maxStock,
        reorderLevel,
        currentStock,
      });

      res.status(201).json({
        success: true,
        message: 'Item created successfully.',
        data: item,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ItemService.updateItem(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Item updated successfully.',
        data: item,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, message: 'isActive boolean is required.' });
        return;
      }

      const item = await ItemService.toggleItemStatus(req.params.id, isActive);
      res.status(200).json({
        success: true,
        message: `Item status updated to ${isActive ? 'active' : 'inactive'}.`,
        data: item,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ItemService.deleteItem(req.params.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

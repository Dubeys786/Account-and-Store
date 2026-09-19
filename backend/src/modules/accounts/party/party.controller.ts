import { Request, Response, NextFunction } from 'express';
import { PartyService } from './party.service';
import { validatePartyAccess, validateStoreAccess, AccountsSecurityError } from '../accounts.guard';
import { UserRole } from '@prisma/client';

export class PartyController {
  /**
   * POST /api/v1/accounts/parties
   * Create a new party
   */
  static async createParty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId } = req.body;
      if (storeId) {
        validateStoreAccess(req, storeId);
      }

      const party = await PartyService.createParty(req.body);
      res.status(201).json({
        success: true,
        message: 'Party master record created successfully.',
        data: party,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/parties
   * List parties with search, filtering, and pagination
   */
  static async getParties(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, type, status, storeId, page, limit, sortBy, sortOrder } = req.query;

      if (storeId) {
        validateStoreAccess(req, storeId as string);
      }

      const isAdmin = req.user?.role === UserRole.ADMIN;
      const result = await PartyService.getParties(
        {
          search: search as string,
          type: type as any,
          status: status as any,
          storeId: storeId as string,
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any,
        },
        req.user?.storeIds,
        isAdmin
      );

      res.status(200).json({
        success: true,
        message: 'Parties list retrieved successfully.',
        data: result.parties,
        meta: result.pagination,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/parties/:id
   * Get single party details by ID
   */
  static async getPartyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const party = await validatePartyAccess(req, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Party retrieved successfully.',
        data: party,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/v1/accounts/parties/:id
   * Update party master record
   */
  static async updateParty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate access to current party
      await validatePartyAccess(req, req.params.id);

      // If updating storeId, validate access to the new store
      if (req.body.storeId) {
        validateStoreAccess(req, req.body.storeId);
      }

      const updated = await PartyService.updateParty(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Party updated successfully.',
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/accounts/parties/:id/deactivate
   * Deactivate a party (status -> INACTIVE)
   */
  static async deactivateParty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await validatePartyAccess(req, req.params.id);
      const deactivated = await PartyService.deactivateParty(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Party deactivated successfully.',
        data: deactivated,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/accounts/parties/:id/status
   * Toggle party status
   */
  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await validatePartyAccess(req, req.params.id);
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ success: false, message: 'Status field is required.' });
        return;
      }

      const updated = await PartyService.toggleStatus(req.params.id, status);
      res.status(200).json({
        success: true,
        message: `Party status updated to ${status}.`,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

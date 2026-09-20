import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';

export class AdminController {
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await AdminService.getUsers();
      res.json({
        success: true,
        message: 'Users retrieved successfully.',
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await AdminService.getUserById(id);
      res.json({
        success: true,
        message: 'User details retrieved successfully.',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, phone, roles, storeIds, defaultStoreId } = req.body;

      if (!name || !email || !roles || !Array.isArray(roles)) {
        res.status(400).json({
          success: false,
          message: 'Name, email, and roles (array) are required fields.',
        });
        return;
      }

      const adminUserId = req.user!.id;
      const user = await AdminService.createUser(
        { name, email, password, phone, roles, storeIds, defaultStoreId },
        adminUserId
      );

      res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: user,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to create user.',
      });
    }
  }

  static async updateUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { roles } = req.body;

      if (!roles || !Array.isArray(roles)) {
        res.status(400).json({
          success: false,
          message: 'roles (array of role names) is required.',
        });
        return;
      }

      const adminUserId = req.user!.id;
      const user = await AdminService.updateUserRoles(id, roles, adminUserId);

      res.json({
        success: true,
        message: 'User roles updated successfully.',
        data: user,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to update user roles.',
      });
    }
  }

  static async updateUserStores(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { storeIds, defaultStoreId } = req.body;

      if (!storeIds || !Array.isArray(storeIds)) {
        res.status(400).json({
          success: false,
          message: 'storeIds (array of store IDs) is required.',
        });
        return;
      }

      const adminUserId = req.user!.id;
      const user = await AdminService.updateUserStores(id, storeIds, defaultStoreId, adminUserId);

      res.json({
        success: true,
        message: 'User store assignments updated successfully.',
        data: user,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to update user store assignments.',
      });
    }
  }

  static async toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'isActive (boolean) is required.',
        });
        return;
      }

      const adminUserId = req.user!.id;
      const result = await AdminService.toggleUserStatus(id, isActive, adminUserId);

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to toggle user status.',
      });
    }
  }

  static async getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await AdminService.getRoles();
      res.json({
        success: true,
        message: 'Roles retrieved successfully.',
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await AdminService.getPermissions();
      res.json({
        success: true,
        message: 'Permissions retrieved successfully.',
        data: permissions,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await AdminService.getAuditLogs(limit, offset);
      res.json({
        success: true,
        message: 'Audit logs retrieved successfully.',
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }
}

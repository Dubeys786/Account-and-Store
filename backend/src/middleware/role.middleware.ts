import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Restrict endpoint access to specific user roles
 */
export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User is not authenticated.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access denied. Role '${req.user.role}' is not authorized to access this module. Allowed roles: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Ensure user has permissions for the active or requested store
 */
export function requireStoreAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: User is not authenticated.',
    });
    return;
  }

  // Admin has access to all stores
  if (req.user.role === UserRole.ADMIN) {
    return next();
  }

  const storeId = req.activeStoreId || (req.query.storeId as string) || (req.body?.storeId as string);

  if (storeId && !req.user.storeIds.includes(storeId)) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have authorization to access data for this store.',
    });
    return;
  }

  next();
}

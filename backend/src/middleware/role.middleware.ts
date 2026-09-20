import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Restrict endpoint access to specific user roles
 */
export function requireRoles(allowedRoles: (string | UserRole)[]) {
  const allowed = allowedRoles.map((r) => String(r));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User is not authenticated.',
      });
      return;
    }

    const userRoles = req.user.roles && req.user.roles.length > 0 
      ? req.user.roles 
      : [String(req.user.role)];

    // Admin has universal superuser access
    if (userRoles.includes('ADMIN') || req.user.role === UserRole.ADMIN) {
      return next();
    }

    const hasRole = userRoles.some((role) => allowed.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access denied. Role(s) '${userRoles.join(', ')}' not authorized to access this module. Allowed roles: ${allowed.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Restrict endpoint access to specific permissions
 */
export function requirePermissions(requiredPermissions: string | string[], matchAll = false) {
  const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User is not authenticated.',
      });
      return;
    }

    const userRoles = req.user.roles && req.user.roles.length > 0 
      ? req.user.roles 
      : [String(req.user.role)];

    // Admin has universal superuser access
    if (userRoles.includes('ADMIN') || req.user.role === UserRole.ADMIN) {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasPermission = matchAll
      ? perms.every((p) => userPerms.includes(p))
      : perms.some((p) => userPerms.includes(p));

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Insufficient permissions. Required: ${perms.join(', ')}.`,
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

  const userRoles = req.user.roles && req.user.roles.length > 0 
    ? req.user.roles 
    : [String(req.user.role)];

  // Admin has access to all stores
  if (userRoles.includes('ADMIN') || req.user.role === UserRole.ADMIN) {
    return next();
  }

  const storeId =
    req.activeStoreId ||
    (req.query.storeId as string) ||
    (req.body?.storeId as string) ||
    (req.headers['x-store-id'] as string);

  if (storeId && (!req.user.storeIds || !req.user.storeIds.includes(storeId))) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have authorization to access data for this store.',
    });
    return;
  }

  next();
}

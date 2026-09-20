import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Parameter Tampering & Role Manipulation Guard
 * Strictly prevents users from altering:
 * - role
 * - user_id / userId
 * - store_id / storeId
 * to bypass authorization boundaries.
 */
export function preventParameterTampering(req: Request, res: Response, next: NextFunction): void {
  // If not authenticated yet, continue to authentication middleware
  if (!req.user) {
    return next();
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // 1. Role Manipulation Protection
  const bodyRole = req.body?.role;
  const queryRole = req.query?.role;
  if (bodyRole && bodyRole !== req.user.role && req.user.role !== UserRole.ADMIN) {
    AuditService.recordSecurityViolation(
      req.user.id,
      'Role manipulation attempted in request body',
      { attemptedRole: bodyRole, actualRole: req.user.role, path: req.originalUrl },
      ipAddress,
      userAgent
    );
    res.status(403).json({
      success: false,
      message: 'Parameter tampering detected: Role manipulation is strictly prohibited.',
    });
    return;
  }

  if (queryRole && queryRole !== req.user.role && req.user.role !== UserRole.ADMIN) {
    AuditService.recordSecurityViolation(
      req.user.id,
      'Role manipulation attempted in query parameters',
      { attemptedRole: queryRole, actualRole: req.user.role, path: req.originalUrl },
      ipAddress,
      userAgent
    );
    res.status(403).json({
      success: false,
      message: 'Parameter tampering detected: Role manipulation is strictly prohibited.',
    });
    return;
  }

  // 2. User ID Impersonation Protection
  const bodyUserId = req.body?.userId || req.body?.user_id;
  if (bodyUserId && bodyUserId !== req.user.id && req.user.role !== UserRole.ADMIN) {
    AuditService.recordSecurityViolation(
      req.user.id,
      'User impersonation attempted in request body',
      { attemptedUserId: bodyUserId, actualUserId: req.user.id, path: req.originalUrl },
      ipAddress,
      userAgent
    );
    res.status(403).json({
      success: false,
      message: 'Parameter tampering detected: Cannot impersonate or specify a different user_id.',
    });
    return;
  }

  // 3. Store Tenancy Parameter Protection
  const requestedStoreId =
    req.body?.storeId ||
    req.body?.store_id ||
    req.query?.storeId ||
    req.query?.store_id ||
    req.headers['x-store-id'];

  if (
    requestedStoreId &&
    requestedStoreId !== 'ALL' &&
    req.user.role !== UserRole.ADMIN &&
    !req.user.storeIds.includes(requestedStoreId as string)
  ) {
    AuditService.recordSecurityViolation(
      req.user.id,
      'Unauthorized store parameter access attempted',
      { attemptedStoreId: requestedStoreId, permittedStoreIds: req.user.storeIds, path: req.originalUrl },
      ipAddress,
      userAgent
    );
    res.status(403).json({
      success: false,
      message: `Parameter tampering detected: You do not have authorization to access store '${requestedStoreId}'.`,
    });
    return;
  }

  next();
}

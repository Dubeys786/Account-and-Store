import prisma from '../../config/db';
import { UserRole } from '@prisma/client';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'PURCHASE'
  | 'JOURNAL'
  | 'ADJUSTMENT'
  | 'VOID'
  | 'EXPORT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SECURITY_EVENT';

export interface AuditEventInput {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Asynchronously record an audit trail event
   */
  static async record(event: AuditEventInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId || null,
          action: event.action,
          entity: event.entity,
          entityId: event.entityId || null,
          oldValues: event.oldValues ? (typeof event.oldValues === 'string' ? event.oldValues : JSON.stringify(event.oldValues)) : null,
          newValues: event.newValues ? (typeof event.newValues === 'string' ? event.newValues : JSON.stringify(event.newValues)) : null,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
        },
      });
    } catch (err: any) {
      // Non-blocking log to console in case of audit storage failure
      console.error('[AUDIT_ERROR] Failed to record audit log:', err.message);
    }
  }

  /**
   * Log a security violation event
   */
  static async recordSecurityViolation(
    userId: string | null,
    reason: string,
    details: Record<string, any>,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<void> {
    await this.record({
      userId,
      action: 'SECURITY_EVENT',
      entity: 'SecurityGuard',
      entityId: details.targetId || null,
      oldValues: null,
      newValues: { reason, details, timestamp: new Date().toISOString() },
      ipAddress,
      userAgent,
    });
  }
}

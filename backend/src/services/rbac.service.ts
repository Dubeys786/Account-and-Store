import prisma from '../config/db';
import { AccessibleWorkspaces } from '../types';

export interface UserRbacData {
  roles: string[];
  permissions: string[];
  accessibleWorkspaces: AccessibleWorkspaces;
}

export class RbacService {
  /**
   * Retrieves all roles and deduplicated permissions assigned to a user.
   * If user has no userRoles assignments, falls back to their legacy user.role enum.
   */
  static async getUserRbacData(userId: string, legacyRole?: string): Promise<UserRbacData> {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    let roles: string[] = assignments.map((a) => a.role.name);
    const permissionSet = new Set<string>();

    if (roles.length > 0) {
      for (const assignment of assignments) {
        if (assignment.role?.rolePermissions) {
          for (const rp of assignment.role.rolePermissions) {
            if (rp.permission?.code) {
              permissionSet.add(rp.permission.code);
            }
          }
        }
      }
    } else if (legacyRole) {
      // Backwards compatibility fallback if user hasn't been migrated yet
      roles = [legacyRole];
      const legacyRoleRecord = await prisma.role.findUnique({
        where: { name: legacyRole },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      if (legacyRoleRecord?.rolePermissions) {
        for (const rp of legacyRoleRecord.rolePermissions) {
          if (rp.permission?.code) {
            permissionSet.add(rp.permission.code);
          }
        }
      }
    }

    const permissions = Array.from(permissionSet).filter(Boolean);

    // Compute accessible workspaces based on roles and permissions
    const isAdmin = roles.includes('ADMIN');
    const hasAdminPerm = permissions.some(
      (p) => p && (p.startsWith('users.') || p.startsWith('roles.') || p.startsWith('audit_logs.') || p.startsWith('system_settings.'))
    );

    const hasStoreRole = roles.some((r) => ['ADMIN', 'STORE_MANAGER', 'STORE_USER'].includes(r));
    const hasStorePerm = permissions.some(
      (p) =>
        p.startsWith('store.') ||
        p.startsWith('item.') ||
        p.startsWith('po.') ||
        p.startsWith('material_inward.') ||
        p.startsWith('stock.') ||
        p.startsWith('store_reports.')
    );

    const hasAccountsRole = roles.some((r) => ['ADMIN', 'ACCOUNT_MANAGER', 'ACCOUNT_USER'].includes(r));
    const hasAccountsPerm = permissions.some(
      (p) =>
        p.startsWith('accounts.') ||
        p.startsWith('party.') ||
        p.startsWith('purchase.') ||
        p.startsWith('ledger.') ||
        p.startsWith('receivables.') ||
        p.startsWith('payables.') ||
        p.startsWith('payment.') ||
        p.startsWith('receipt.') ||
        p.startsWith('expense.') ||
        p.startsWith('income.') ||
        p.startsWith('day_book.') ||
        p.startsWith('cash_book.') ||
        p.startsWith('bank_book.') ||
        p.startsWith('accounting_reports.') ||
        p.startsWith('account_settings.')
    );

    const accessibleWorkspaces: AccessibleWorkspaces = {
      admin: isAdmin || hasAdminPerm,
      store: isAdmin || hasStoreRole || hasStorePerm,
      accounts: isAdmin || hasAccountsRole || hasAccountsPerm,
    };

    return {
      roles,
      permissions,
      accessibleWorkspaces,
    };
  }
}

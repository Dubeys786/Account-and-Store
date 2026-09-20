import prisma from '../config/db';
import { AccessibleWorkspaces } from '../types';

export interface UserRbacData {
  roles: string[];
  permissions: string[];
  accessibleWorkspaces: AccessibleWorkspaces;
}

export class RbacService {
  /**
   * Retrieves all roles and deduplicated permissions assigned to a user from the database.
   */
  static async getUserRbacData(userId: string): Promise<UserRbacData> {
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

    const roles: string[] = assignments.map((a) => a.role.name);
    const permissionSet = new Set<string>();

    if (roles.length > 0) {
      for (const assignment of assignments) {
        if (assignment.role?.rolePermissions) {
          for (const rp of assignment.role.rolePermissions) {
            if (rp.permission?.name) {
              permissionSet.add(rp.permission.name);
            }
          }
        }
      }
    }

    const permissions = Array.from(permissionSet).filter(Boolean);

    // Dynamic role matching based on database role assignments
    const hasStoreRole = roles.some((r) =>
      ['STORE_INCHARGE', 'STORE_MANAGER', 'STORE_USER'].includes(r)
    );
    const hasStorePerm = permissions.some(
      (p) =>
        p.startsWith('store.') ||
        p.startsWith('item.') ||
        p.startsWith('po.') ||
        p.startsWith('material_inward.') ||
        p.startsWith('stock.') ||
        p.startsWith('store_reports.')
    );

    const hasAccountsRole = roles.some((r) =>
      ['ACCOUNT_AND_STORE_INCHARGE', 'ACCOUNT_MANAGER', 'ACCOUNT_USER'].includes(r)
    );
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
      store: hasStoreRole || hasStorePerm,
      accounts: hasAccountsRole || hasAccountsPerm,
    };

    return {
      roles,
      permissions,
      accessibleWorkspaces,
    };
  }
}

import prisma from './db';

export const DEFINED_PERMISSIONS = [
  // Store permissions
  { name: 'store.view', module: 'STORE', description: 'View store dashboard and locations' },
  { name: 'store.create', module: 'STORE', description: 'Create new store locations' },
  { name: 'store.edit', module: 'STORE', description: 'Modify store locations' },
  { name: 'store.delete', module: 'STORE', description: 'Deactivate store locations' },
  { name: 'item.view', module: 'STORE', description: 'View items and catalog' },
  { name: 'item.create', module: 'STORE', description: 'Create item master records' },
  { name: 'item.edit', module: 'STORE', description: 'Edit item master records' },
  { name: 'item.delete', module: 'STORE', description: 'Deactivate or delete items' },
  { name: 'po.view', module: 'STORE', description: 'View purchase orders' },
  { name: 'po.create', module: 'STORE', description: 'Create purchase orders' },
  { name: 'po.edit', module: 'STORE', description: 'Edit purchase orders' },
  { name: 'po.approve', module: 'STORE', description: 'Approve purchase orders' },
  { name: 'material_inward.view', module: 'STORE', description: 'View material inwards (GRN)' },
  { name: 'material_inward.create', module: 'STORE', description: 'Receive material inward records' },
  { name: 'material_inward.edit', module: 'STORE', description: 'Modify material inward records' },
  { name: 'stock.view', module: 'STORE', description: 'View stock register and balance' },
  { name: 'stock.issue', module: 'STORE', description: 'Issue stock to departments' },
  { name: 'stock.return', module: 'STORE', description: 'Accept stock returns' },
  { name: 'store_reports.view', module: 'STORE', description: 'View store and inventory reports' },

  // Accounts permissions
  { name: 'accounts.view', module: 'ACCOUNTS', description: 'View accounts overview and dashboard' },
  { name: 'party.view', module: 'ACCOUNTS', description: 'View supplier and customer parties' },
  { name: 'party.create', module: 'ACCOUNTS', description: 'Create new parties' },
  { name: 'party.edit', module: 'ACCOUNTS', description: 'Edit party details and status' },
  { name: 'purchase.view', module: 'ACCOUNTS', description: 'View purchase invoices and bills' },
  { name: 'purchase.create', module: 'ACCOUNTS', description: 'Book purchase invoices' },
  { name: 'purchase.edit', module: 'ACCOUNTS', description: 'Edit purchase invoices' },
  { name: 'purchase.with_po', module: 'ACCOUNTS', description: 'Book purchases against approved POs' },
  { name: 'purchase.without_po', module: 'ACCOUNTS', description: 'Book direct purchase invoices' },
  { name: 'ledger.view', module: 'ACCOUNTS', description: 'View party ledgers and statements' },
  { name: 'receivables.view', module: 'ACCOUNTS', description: 'View trade receivables' },
  { name: 'payables.view', module: 'ACCOUNTS', description: 'View trade payables' },
  { name: 'payment.view', module: 'ACCOUNTS', description: 'View payment vouchers' },
  { name: 'payment.create', module: 'ACCOUNTS', description: 'Create payment vouchers' },
  { name: 'payment.approve', module: 'ACCOUNTS', description: 'Approve payments' },
  { name: 'receipt.view', module: 'ACCOUNTS', description: 'View receipt vouchers' },
  { name: 'receipt.create', module: 'ACCOUNTS', description: 'Create receipt vouchers' },
  { name: 'expense.view', module: 'ACCOUNTS', description: 'View operating expenses' },
  { name: 'expense.create', module: 'ACCOUNTS', description: 'Record operating expenses' },
  { name: 'expense.approve', module: 'ACCOUNTS', description: 'Approve expense payments' },
  { name: 'income.view', module: 'ACCOUNTS', description: 'View revenue and income records' },
  { name: 'income.create', module: 'ACCOUNTS', description: 'Record direct and other income' },
  { name: 'day_book.view', module: 'ACCOUNTS', description: 'View chronological day book' },
  { name: 'cash_book.view', module: 'ACCOUNTS', description: 'View cash register (1010)' },
  { name: 'bank_book.view', module: 'ACCOUNTS', description: 'View bank register (1020)' },
  { name: 'accounting_reports.view', module: 'ACCOUNTS', description: 'Generate statutory financial reports' },
  { name: 'account_settings.view', module: 'ACCOUNTS', description: 'View accounting configuration' },
  { name: 'account_settings.manage', module: 'ACCOUNTS', description: 'Modify fiscal year and GST settings' },

  // Administration permissions
  { name: 'users.view', module: 'ADMIN', description: 'View users list' },
  { name: 'users.create', module: 'ADMIN', description: 'Create new users' },
  { name: 'users.edit', module: 'ADMIN', description: 'Update user profiles and status' },
  { name: 'users.disable', module: 'ADMIN', description: 'Deactivate user accounts' },
  { name: 'roles.view', module: 'ADMIN', description: 'View roles' },
  { name: 'roles.manage', module: 'ADMIN', description: 'Assign and update user roles' },
  { name: 'permissions.view', module: 'ADMIN', description: 'View defined permissions' },
  { name: 'permissions.manage', module: 'ADMIN', description: 'Modify role permission mappings' },
  { name: 'audit_logs.view', module: 'ADMIN', description: 'View system audit logs' },
  { name: 'system_settings.manage', module: 'ADMIN', description: 'Manage enterprise system settings' },
];

export const ROLE_DEFINITIONS: Record<string, { description: string; permissions: string[] }> = {
  ADMIN: {
    description: 'System Administrator with full access across Store, Accounts, and Administration',
    permissions: DEFINED_PERMISSIONS.map((p) => p.name),
  },
  STORE_MANAGER: {
    description: 'Store & Inventory Manager with full control over catalog, POs, inward, and inventory',
    permissions: [
      'store.view',
      'store.create',
      'store.edit',
      'item.view',
      'item.create',
      'item.edit',
      'item.delete',
      'po.view',
      'po.create',
      'po.edit',
      'po.approve',
      'material_inward.view',
      'material_inward.create',
      'material_inward.edit',
      'stock.view',
      'stock.issue',
      'stock.return',
      'store_reports.view',
    ],
  },
  STORE_USER: {
    description: 'Standard Store Operator with daily catalog view, PO viewing, inward receipt, and stock movement',
    permissions: [
      'store.view',
      'item.view',
      'po.view',
      'material_inward.view',
      'material_inward.create',
      'stock.view',
      'stock.issue',
      'stock.return',
      'store_reports.view',
    ],
  },
  ACCOUNT_MANAGER: {
    description: 'Finance & Accounting Manager with full control over parties, bills, ledgers, books, and reports',
    permissions: [
      'accounts.view',
      'party.view',
      'party.create',
      'party.edit',
      'purchase.view',
      'purchase.create',
      'purchase.edit',
      'purchase.with_po',
      'purchase.without_po',
      'ledger.view',
      'receivables.view',
      'payables.view',
      'payment.view',
      'payment.create',
      'payment.approve',
      'receipt.view',
      'receipt.create',
      'expense.view',
      'expense.create',
      'expense.approve',
      'income.view',
      'income.create',
      'day_book.view',
      'cash_book.view',
      'bank_book.view',
      'accounting_reports.view',
      'account_settings.view',
      'account_settings.manage',
    ],
  },
  ACCOUNT_USER: {
    description: 'Accounting Operator with ledger, bills, and voucher creation access',
    permissions: [
      'accounts.view',
      'party.view',
      'party.create',
      'purchase.view',
      'purchase.create',
      'purchase.with_po',
      'purchase.without_po',
      'ledger.view',
      'receivables.view',
      'payables.view',
      'payment.view',
      'payment.create',
      'receipt.view',
      'receipt.create',
      'expense.view',
      'expense.create',
      'income.view',
      'income.create',
      'day_book.view',
      'cash_book.view',
      'bank_book.view',
      'accounting_reports.view',
      'account_settings.view',
    ],
  },
  VIEWER: {
    description: 'Read-only observer with cross-module viewing permissions but no mutation privileges',
    permissions: [
      'store.view',
      'item.view',
      'po.view',
      'material_inward.view',
      'stock.view',
      'store_reports.view',
      'accounts.view',
      'party.view',
      'purchase.view',
      'ledger.view',
      'receivables.view',
      'payables.view',
      'payment.view',
      'receipt.view',
      'expense.view',
      'income.view',
      'day_book.view',
      'cash_book.view',
      'bank_book.view',
      'accounting_reports.view',
    ],
  },
};

export async function seedRbacSystem() {
  console.log('🔒 Seeding RBAC Roles, Permissions, and Mappings...');

  // 1. Seed Permissions
  for (const p of DEFINED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { module: p.module, description: p.description },
      create: p,
    });
  }

  // 2. Seed Roles and RolePermissions
  for (const [roleName, def] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: def.description, isSystem: true },
      create: {
        name: roleName,
        description: def.description,
        isSystem: true,
      },
    });

    // Fetch permission IDs for this role
    const perms = await prisma.permission.findMany({
      where: { name: { in: def.permissions } },
      select: { id: true },
    });

    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // 3. Sync User Roles for existing users based on their primary role
  const allUsers = await prisma.user.findMany({
    include: { userRoles: true },
  });

  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  for (const user of allUsers) {
    let targetRoleName = 'VIEWER';
    if (user.role === 'ADMIN') targetRoleName = 'ADMIN';
    else if (user.role === 'STORE_USER') targetRoleName = 'STORE_USER';
    else if (user.role === 'ACCOUNT_USER') targetRoleName = 'ACCOUNT_USER';

    const roleId = roleMap.get(targetRoleName);
    if (roleId && !user.userRoles.some((ur) => ur.roleId === roleId)) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId,
        },
      });
    }
  }

  console.log('✅ RBAC Roles & Permissions seeded successfully.');
}

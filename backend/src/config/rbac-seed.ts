import bcrypt from 'bcryptjs';
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
  { name: 'accounting_reports.view', module: 'ACCOUNTS', description: 'Generate accounting and financial reports' },
  { name: 'account_settings.view', module: 'ACCOUNTS', description: 'View account preferences and configurations' },
  { name: 'account_settings.manage', module: 'ACCOUNTS', description: 'Manage accounting chart and settings' },
];

const STORE_PERMISSIONS = [
  'store.view',
  'store.create',
  'store.edit',
  'store.delete',
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
];

const ACCOUNTS_PERMISSIONS = [
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
];

export const ROLE_DEFINITIONS: Record<string, { description: string; permissions: string[] }> = {
  STORE_INCHARGE: {
    description: 'Store Incharge with full operational and management authority over Store & Inventory',
    permissions: STORE_PERMISSIONS,
  },
  ACCOUNT_AND_STORE_INCHARGE: {
    description: 'Account & Store Incharge with primary access to Accounts & Finance',
    permissions: ACCOUNTS_PERMISSIONS,
  },
  STORE_MANAGER: {
    description: 'Store Manager operational role',
    permissions: STORE_PERMISSIONS,
  },
  STORE_USER: {
    description: 'Store operational user role',
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
    description: 'Accounting manager role',
    permissions: ACCOUNTS_PERMISSIONS,
  },
  ACCOUNT_USER: {
    description: 'Accounting operator role',
    permissions: ACCOUNTS_PERMISSIONS.filter((p) => !p.endsWith('.approve') && !p.endsWith('.manage')),
  },
  VIEWER: {
    description: 'Read-only viewer role',
    permissions: ['store.view', 'accounts.view'],
  },
};

export async function seedRbacSystem() {
  console.log('🔒 Seeding RBAC Roles, Permissions, and Two-User System Access...');

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

  // 3. Lookup stores
  const stores = await prisma.store.findMany();
  const mainStore = stores.find((s) => s.code === 'STR-001') || stores[0];
  const branchStore = stores.find((s) => s.code === 'STR-002') || stores[1];

  const storeInchargeRole = await prisma.role.findUnique({ where: { name: 'STORE_INCHARGE' } });
  const acctInchargeRole = await prisma.role.findUnique({
    where: { name: 'ACCOUNT_AND_STORE_INCHARGE' },
  });

  // Secure default hash for initial setup from environment or bcrypt generator
  const envPassword = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';
  const defaultPasswordHash = await bcrypt.hash(envPassword, 10);

  // 4. Configure User 1 — Sakshi (dubeysakshi618@gmail.com)
  const sakshi = await prisma.user.upsert({
    where: { email: 'dubeysakshi618@gmail.com' },
    update: {
      name: 'Sakshi',
      jobTitle: 'Store Incharge',
      workspace: 'Store',
      role: 'STORE_USER',
      isActive: true,
    },
    create: {
      name: 'Sakshi',
      email: 'dubeysakshi618@gmail.com',
      passwordHash: defaultPasswordHash,
      role: 'STORE_USER',
      jobTitle: 'Store Incharge',
      workspace: 'Store',
      isActive: true,
    },
  });

  if (storeInchargeRole) {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: sakshi.id } });
    await prisma.userRoleAssignment.create({
      data: {
        userId: sakshi.id,
        roleId: storeInchargeRole.id,
      },
    });
  }

  // Create Profile for Sakshi
  await prisma.profile.upsert({
    where: { userId: sakshi.id },
    update: {
      fullName: 'Sakshi',
      email: 'dubeysakshi618@gmail.com',
      jobTitle: 'Store Incharge',
      workspace: 'Store',
    },
    create: {
      userId: sakshi.id,
      fullName: 'Sakshi',
      email: 'dubeysakshi618@gmail.com',
      jobTitle: 'Store Incharge',
      workspace: 'Store',
    },
  });

  // Assign store access for Sakshi
  if (mainStore) {
    await prisma.storeUser.deleteMany({ where: { userId: sakshi.id } });
    await prisma.storeUser.create({
      data: { userId: sakshi.id, storeId: mainStore.id, isDefault: true },
    });
    if (branchStore) {
      await prisma.storeUser.create({
        data: { userId: sakshi.id, storeId: branchStore.id, isDefault: false },
      });
    }
  }

  // 5. Configure User 2 — Akhilesh (dubeyakhilesh2005@gmail.com)
  const akhilesh = await prisma.user.upsert({
    where: { email: 'dubeyakhilesh2005@gmail.com' },
    update: {
      name: 'Akhilesh',
      jobTitle: 'Account & Store Incharge',
      workspace: 'Accounts',
      role: 'ACCOUNT_USER',
      isActive: true,
    },
    create: {
      name: 'Akhilesh',
      email: 'dubeyakhilesh2005@gmail.com',
      passwordHash: defaultPasswordHash,
      role: 'ACCOUNT_USER',
      jobTitle: 'Account & Store Incharge',
      workspace: 'Accounts',
      isActive: true,
    },
  });

  if (acctInchargeRole) {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: akhilesh.id } });
    await prisma.userRoleAssignment.create({
      data: {
        userId: akhilesh.id,
        roleId: acctInchargeRole.id,
      },
    });
  }

  // Create Profile for Akhilesh
  await prisma.profile.upsert({
    where: { userId: akhilesh.id },
    update: {
      fullName: 'Akhilesh',
      email: 'dubeyakhilesh2005@gmail.com',
      jobTitle: 'Account & Store Incharge',
      workspace: 'Accounts',
    },
    create: {
      userId: akhilesh.id,
      fullName: 'Akhilesh',
      email: 'dubeyakhilesh2005@gmail.com',
      jobTitle: 'Account & Store Incharge',
      workspace: 'Accounts',
    },
  });

  // Assign store access for Akhilesh
  if (mainStore) {
    await prisma.storeUser.deleteMany({ where: { userId: akhilesh.id } });
    await prisma.storeUser.create({
      data: { userId: akhilesh.id, storeId: mainStore.id, isDefault: true },
    });
    if (branchStore) {
      await prisma.storeUser.create({
        data: { userId: akhilesh.id, storeId: branchStore.id, isDefault: false },
      });
    }
  }

  console.log('✅ Two Users (Sakshi & Akhilesh) seeded with Database Profiles and RBAC roles.');
}

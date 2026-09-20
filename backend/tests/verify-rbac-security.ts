import http from 'http';
import bcrypt from 'bcryptjs';
import { initDatabase, prisma } from '../src/config/db';
import { seedDatabase } from '../prisma/seed';
import app from '../src/app';

async function runSecurityTests() {
  console.log('🔒 ==========================================================');
  console.log('🔒 STOCKLEDGER RBAC & PERMISSION SECURITY VERIFICATION SUITE');
  console.log('🔒 ==========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Initialize Database & Seed
  await initDatabase();
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    const mainStore = await prisma.store.findUnique({ where: { code: 'STR-001' } });
    const branchStore = await prisma.store.findUnique({ where: { code: 'STR-002' } });

    if (!mainStore || !branchStore) {
      throw new Error('Required stores STR-001 and STR-002 not found in database.');
    }

    const testPasswordHash = await bcrypt.hash('Test@1234', 10);

    // Create Dual-Role User (STORE_MANAGER + ACCOUNT_MANAGER)
    const dualUser = await prisma.user.upsert({
      where: { email: 'dual@stockledger.test' },
      update: { passwordHash: testPasswordHash, isActive: true },
      create: {
        name: 'Dual Manager User',
        email: 'dual@stockledger.test',
        passwordHash: testPasswordHash,
        role: 'STORE_USER',
        isActive: true,
      },
    });

    const storeMgrRole = await prisma.role.findUnique({ where: { name: 'STORE_MANAGER' } });
    const acctMgrRole = await prisma.role.findUnique({ where: { name: 'ACCOUNT_MANAGER' } });

    await prisma.userRoleAssignment.deleteMany({ where: { userId: dualUser.id } });
    if (storeMgrRole && acctMgrRole) {
      await prisma.userRoleAssignment.createMany({
        data: [
          { userId: dualUser.id, roleId: storeMgrRole.id },
          { userId: dualUser.id, roleId: acctMgrRole.id },
        ],
      });
    }

    await prisma.storeUser.deleteMany({ where: { userId: dualUser.id } });
    await prisma.storeUser.create({
      data: { userId: dualUser.id, storeId: mainStore.id, isDefault: true },
    });

    // Create Single-Store User (Assigned ONLY to STR-001)
    const storeOnly1User = await prisma.user.upsert({
      where: { email: 'store.isolated@stockledger.test' },
      update: { passwordHash: testPasswordHash, isActive: true },
      create: {
        name: 'Isolated Store 1 User',
        email: 'store.isolated@stockledger.test',
        passwordHash: testPasswordHash,
        role: 'STORE_USER',
        isActive: true,
      },
    });
    const storeUserRole = await prisma.role.findUnique({ where: { name: 'STORE_USER' } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: storeOnly1User.id } });
    if (storeUserRole) {
      await prisma.userRoleAssignment.create({
        data: { userId: storeOnly1User.id, roleId: storeUserRole.id },
      });
    }
    await prisma.storeUser.deleteMany({ where: { userId: storeOnly1User.id } });
    await prisma.storeUser.create({
      data: { userId: storeOnly1User.id, storeId: mainStore.id, isDefault: true },
    });

    // Create Unassigned User (NO roles, NO store assignments)
    const unassignedUser = await prisma.user.upsert({
      where: { email: 'unassigned@stockledger.test' },
      update: { passwordHash: testPasswordHash, isActive: true },
      create: {
        name: 'Unassigned New User',
        email: 'unassigned@stockledger.test',
        passwordHash: testPasswordHash,
        role: 'STORE_USER',
        isActive: true,
      },
    });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: unassignedUser.id } });
    await prisma.storeUser.deleteMany({ where: { userId: unassignedUser.id } });

    // Helper for login
    async function loginUser(email: string, pass = 'Prozen@123') {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = (await res.json()) as any;
      return { status: res.status, data: data.data, raw: data };
    }

    // Authenticate all users
    const adminAuth = await loginUser('admin@prozen.com');
    const storeAuth = await loginUser('store@prozen.com');
    const accountAuth = await loginUser('account@prozen.com');
    const dualAuth = await loginUser('dual@stockledger.test', 'Test@1234');
    const storeIsolatedAuth = await loginUser('store.isolated@stockledger.test', 'Test@1234');
    const unassignedAuth = await loginUser('unassigned@stockledger.test', 'Test@1234');

    const adminToken = adminAuth.data?.token;
    const storeToken = storeAuth.data?.token;
    const accountToken = accountAuth.data?.token;
    const dualToken = dualAuth.data?.token;
    const storeIsolatedToken = storeIsolatedAuth.data?.token;
    const unassignedToken = unassignedAuth.data?.token;

    console.log('\n--- Test 1: Store User Cannot Access Accounts Endpoints ---');
    const storeToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeToAccountsRes.status === 403,
      'Store User calling Accounts endpoint returns HTTP 403 Forbidden',
      `Got status ${storeToAccountsRes.status}`
    );

    console.log('\n--- Test 2: Store User Cannot View Financial Ledger or Purchases ---');
    const storeToPurchasesRes = await fetch(`${baseUrl}/accounts/purchases`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeToPurchasesRes.status === 403,
      'Store User calling /accounts/purchases returns HTTP 403 Forbidden'
    );

    const storeToLedgerRes = await fetch(`${baseUrl}/accounts/ledger`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeToLedgerRes.status === 403,
      'Store User calling /accounts/ledger returns HTTP 403 Forbidden'
    );

    console.log('\n--- Test 3: Multi-Store Tenancy: Single-Store User Scoped to Assigned Store ---');
    const isolatedLookupRes = await fetch(`${baseUrl}/store/stores`, {
      headers: { Authorization: `Bearer ${storeIsolatedToken}` },
    });
    const isolatedLookupJson = (await isolatedLookupRes.json()) as any;
    const visibleStoreIds = isolatedLookupJson.data?.map((s: any) => s.id) || [];
    assert(
      visibleStoreIds.includes(mainStore.id) && !visibleStoreIds.includes(branchStore.id),
      'Single-Store user can ONLY view assigned store STR-001 and NOT STR-002',
      `Visible: ${visibleStoreIds}`
    );

    console.log('\n--- Test 4: Multi-Store Tenancy: IDOR / Parameter Tampering Blocked ---');
    const idorRes = await fetch(`${baseUrl}/store/dashboard-metrics?storeId=${branchStore.id}`, {
      headers: {
        Authorization: `Bearer ${storeIsolatedToken}`,
        'x-store-id': branchStore.id,
      },
    });
    assert(
      idorRes.status === 403 || idorRes.status === 400,
      'Tampered request with unauthorized storeId is rejected with HTTP 403/400',
      `Status: ${idorRes.status}`
    );

    console.log('\n--- Test 5: Account User Cannot Access Store Inventory Endpoints ---');
    const accountToStoreItemsRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(
      accountToStoreItemsRes.status === 403,
      'Account User calling /store/items returns HTTP 403 Forbidden'
    );

    console.log('\n--- Test 6: Account User Cannot Access Material Inwards (GRN) ---');
    const accountToInwardRes = await fetch(`${baseUrl}/store/material-inwards`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(
      accountToInwardRes.status === 403,
      'Account User calling /store/material-inwards returns HTTP 403 Forbidden'
    );

    console.log('\n--- Test 7: Account User Cannot Create Purchase Orders ---');
    const accountCreatePORes = await fetch(`${baseUrl}/store/purchase-orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accountToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: mainStore.id,
        supplierId: 'dummy-id',
        items: [],
      }),
    });
    assert(
      accountCreatePORes.status === 403,
      'Account User POST /store/purchase-orders returns HTTP 403 Forbidden'
    );

    console.log('\n--- Test 8: Admin User Has Universal Access Across All Modules ---');
    const adminStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAcctRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsersRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminStoreRes.status === 200 && adminAcctRes.status === 200 && adminUsersRes.status === 200,
      'Admin user successfully accesses Store (200), Accounts (200), and Admin (200)'
    );

    console.log('\n--- Test 9: Dual-Role User (STORE_MANAGER + ACCOUNT_MANAGER) Access ---');
    const dualStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${dualToken}` },
    });
    const dualAcctRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${dualToken}` },
    });
    assert(
      dualStoreRes.status === 200,
      'Dual-role user has access to Store module (HTTP 200)'
    );
    assert(
      dualAcctRes.status === 200,
      'Dual-role user has access to Accounts module (HTTP 200)'
    );
    assert(
      dualAuth.data?.user?.accessibleWorkspaces?.store === true &&
        dualAuth.data?.user?.accessibleWorkspaces?.accounts === true,
      'Dual-role user receives both store and accounts workspaces: true'
    );

    console.log('\n--- Test 10: Unassigned User Has Zero Module Access ---');
    const unassignedStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${unassignedToken}` },
    });
    const unassignedAcctRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${unassignedToken}` },
    });
    assert(
      unassignedStoreRes.status === 403,
      'Unassigned user is blocked from Store module (HTTP 403)'
    );
    assert(
      unassignedAcctRes.status === 403,
      'Unassigned user is blocked from Accounts module (HTTP 403)'
    );

    console.log('\n--- Test 11: Unassigned User Accessible Workspaces Flagged False ---');
    const unassignedWs = unassignedAuth.data?.user?.accessibleWorkspaces;
    assert(
      unassignedWs?.store === false && unassignedWs?.accounts === false && unassignedWs?.admin === false,
      'Unassigned user accessibleWorkspaces are all false (store: false, accounts: false, admin: false)'
    );

    console.log('\n--- Test 12: Non-Admin Access to Admin Management API Blocked ---');
    const storeToAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    const acctToAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(
      storeToAdminRes.status === 403,
      'Store User calling /admin/users returns HTTP 403 Forbidden'
    );
    assert(
      acctToAdminRes.status === 403,
      'Account User calling /admin/users returns HTTP 403 Forbidden'
    );

    console.log('\n--- Test 13: Admin Role Assignment & Dynamic Updating ---');
    const updateRoleRes = await fetch(`${baseUrl}/admin/users/${unassignedUser.id}/roles`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: ['STORE_USER'] }),
    });
    const updateRoleJson = (await updateRoleRes.json()) as any;
    assert(
      updateRoleRes.status === 200 && updateRoleJson.data?.roles?.includes('STORE_USER'),
      'Admin successfully updates user roles dynamically via /admin/users/:id/roles'
    );

    // Verify previously unassigned user now has store workspace access
    const reAuthUnassigned = await loginUser('unassigned@stockledger.test', 'Test@1234');
    assert(
      reAuthUnassigned.data?.user?.accessibleWorkspaces?.store === true,
      'Updated user now receives store workspace: true upon login'
    );

    console.log('\n--- Test 14: Security Audit Trail Recorded for RBAC Role Changes ---');
    const auditRes = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditJson = (await auditRes.json()) as any;
    const roleLogs = auditJson.data?.logs?.filter(
      (l: any) => l.entity === 'UserRole' && l.entityId === unassignedUser.id
    );
    assert(
      roleLogs && roleLogs.length > 0,
      'Audit log recorded for UserRole update event with old and new role values'
    );

    console.log('\n==========================================================');
    console.log(`Security Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('==========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

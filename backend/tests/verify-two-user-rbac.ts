import http from 'http';
import { initDatabase, prisma } from '../src/config/db';
import { seedRbacSystem } from '../src/config/rbac-seed';
import app from '../src/app';

async function runTwoUserRbacVerification() {
  console.log('===============================================================');
  console.log('STOCKLEDGER: TWO-USER ACCESS & RBAC ENFORCEMENT VERIFICATION');
  console.log('===============================================================\n');

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

  // 1. Initialize DB and Seed Sakshi & Akhilesh
  await initDatabase();
  await seedRbacSystem();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    console.log('\n--- Test Phase 1: Database Records for Sakshi & Akhilesh ---');
    const sakshiUser = await prisma.user.findUnique({
      where: { email: 'dubeysakshi618@gmail.com' },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
      },
    });

    const sakshiRoles = sakshiUser?.userRoles.map((r) => r.role.name) || [];
    assert(!!sakshiUser, 'Sakshi user exists in database');
    assert(sakshiUser?.name === 'Sakshi', `Sakshi name is 'Sakshi' (actual: ${sakshiUser?.name})`);
    assert(sakshiUser?.jobTitle === 'Store Incharge', `Sakshi jobTitle is 'Store Incharge' (actual: ${sakshiUser?.jobTitle})`);
    assert(sakshiUser?.workspace === 'Store', `Sakshi workspace is 'Store' (actual: ${sakshiUser?.workspace})`);
    assert(sakshiRoles.includes('STORE_INCHARGE'), `Sakshi has RBAC role 'STORE_INCHARGE' (actual: ${sakshiRoles.join(', ')})`);
    assert(!!sakshiUser?.profile, 'Sakshi profile record exists in profiles table');
    assert(sakshiUser?.profile?.jobTitle === 'Store Incharge', `Sakshi profile jobTitle is 'Store Incharge'`);
    assert(sakshiUser?.profile?.workspace === 'Store', `Sakshi profile workspace is 'Store'`);

    const akhileshUser = await prisma.user.findUnique({
      where: { email: 'dubeyakhilesh2005@gmail.com' },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
      },
    });

    const akhileshRoles = akhileshUser?.userRoles.map((r) => r.role.name) || [];
    assert(!!akhileshUser, 'Akhilesh user exists in database');
    assert(akhileshUser?.name === 'Akhilesh', `Akhilesh name is 'Akhilesh' (actual: ${akhileshUser?.name})`);
    assert(akhileshUser?.jobTitle === 'Account & Store Incharge', `Akhilesh jobTitle is 'Account & Store Incharge' (actual: ${akhileshUser?.jobTitle})`);
    assert(akhileshUser?.workspace === 'Accounts', `Akhilesh workspace is 'Accounts' (actual: ${akhileshUser?.workspace})`);
    assert(akhileshRoles.includes('ACCOUNT_AND_STORE_INCHARGE'), `Akhilesh has RBAC role 'ACCOUNT_AND_STORE_INCHARGE' (actual: ${akhileshRoles.join(', ')})`);
    assert(!!akhileshUser?.profile, 'Akhilesh profile record exists in profiles table');
    assert(akhileshUser?.profile?.jobTitle === 'Account & Store Incharge', `Akhilesh profile jobTitle is 'Account & Store Incharge'`);
    assert(akhileshUser?.profile?.workspace === 'Accounts', `Akhilesh profile workspace is 'Accounts'`);

    console.log('\n--- Test Phase 2: Login & Authentication Payloads ---');
    // Login Sakshi
    const testPassword = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';
    const sakshiLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dubeysakshi618@gmail.com',
        password: testPassword,
      }),
    });
    const sakshiLoginData = (await sakshiLoginRes.json()) as any;
    assert(sakshiLoginRes.status === 200, 'Sakshi login succeeds with 200');
    assert(!!sakshiLoginData.data?.token, 'Sakshi receives JWT token');
    assert(sakshiLoginData.data?.user?.jobTitle === 'Store Incharge', `Sakshi login response returns jobTitle: Store Incharge`);
    assert(sakshiLoginData.data?.user?.workspace === 'Store', `Sakshi login response returns workspace: Store`);
    assert(sakshiLoginData.data?.user?.accessibleWorkspaces?.store === true, 'Sakshi has accessibleWorkspaces.store === true');
    assert(sakshiLoginData.data?.user?.accessibleWorkspaces?.accounts === false, 'Sakshi has accessibleWorkspaces.accounts === false');
    assert(!sakshiLoginData.data?.user?.accessibleWorkspaces?.admin, 'Sakshi has NO admin workspace access');

    const sakshiToken = sakshiLoginData.data?.token;

    // Login Akhilesh
    const akhileshLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dubeyakhilesh2005@gmail.com',
        password: testPassword,
      }),
    });
    const akhileshLoginData = (await akhileshLoginRes.json()) as any;
    assert(akhileshLoginRes.status === 200, 'Akhilesh login succeeds with 200');
    assert(!!akhileshLoginData.data?.token, 'Akhilesh receives JWT token');
    assert(akhileshLoginData.data?.user?.jobTitle === 'Account & Store Incharge', `Akhilesh login response returns jobTitle: Account & Store Incharge`);
    assert(akhileshLoginData.data?.user?.workspace === 'Accounts', `Akhilesh login response returns workspace: Accounts`);
    assert(akhileshLoginData.data?.user?.accessibleWorkspaces?.accounts === true, 'Akhilesh has accessibleWorkspaces.accounts === true');
    assert(akhileshLoginData.data?.user?.accessibleWorkspaces?.store === false, 'Akhilesh has accessibleWorkspaces.store === false');
    assert(!akhileshLoginData.data?.user?.accessibleWorkspaces?.admin, 'Akhilesh has NO admin workspace access');

    const akhileshToken = akhileshLoginData.data?.token;

    console.log('\n--- Test Phase 3: Sakshi Access Boundaries (Store Allowed, Accounts Denied) ---');
    // Sakshi accesses store items
    const sakshiStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(sakshiStoreRes.status === 200, `Sakshi accessing /store/items returns 200 OK (actual: ${sakshiStoreRes.status})`);

    // Sakshi accesses store dashboard metrics
    const sakshiStoreMetricsRes = await fetch(`${baseUrl}/store/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(sakshiStoreMetricsRes.status === 200, `Sakshi accessing /store/dashboard-metrics returns 200 OK (actual: ${sakshiStoreMetricsRes.status})`);

    // Sakshi tries to access accounts dashboard metrics
    const sakshiAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(sakshiAccountsRes.status === 403, `Sakshi accessing /accounts/dashboard-metrics is rejected with 403 Forbidden (actual: ${sakshiAccountsRes.status})`);

    // Sakshi tries to access accounts parties
    const sakshiPartiesRes = await fetch(`${baseUrl}/accounts/parties`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(sakshiPartiesRes.status === 403, `Sakshi accessing /accounts/parties is rejected with 403 Forbidden (actual: ${sakshiPartiesRes.status})`);

    console.log('\n--- Test Phase 4: Akhilesh Access Boundaries (Accounts Allowed, Store Denied) ---');
    // Akhilesh accesses accounts dashboard metrics
    const akhileshAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(akhileshAccountsRes.status === 200, `Akhilesh accessing /accounts/dashboard-metrics returns 200 OK (actual: ${akhileshAccountsRes.status})`);

    // Akhilesh accesses accounts parties
    const akhileshPartiesRes = await fetch(`${baseUrl}/accounts/parties`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(akhileshPartiesRes.status === 200, `Akhilesh accessing /accounts/parties returns 200 OK (actual: ${akhileshPartiesRes.status})`);

    // Akhilesh tries to access store items
    const akhileshStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(akhileshStoreRes.status === 403, `Akhilesh accessing /store/items is rejected with 403 Forbidden (actual: ${akhileshStoreRes.status})`);

    // Akhilesh tries to access store dashboard metrics
    const akhileshStoreMetricsRes = await fetch(`${baseUrl}/store/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(akhileshStoreMetricsRes.status === 403, `Akhilesh accessing /store/dashboard-metrics is rejected with 403 Forbidden (actual: ${akhileshStoreMetricsRes.status})`);

    console.log('\n--- Test Phase 5: Complete Removal of Admin Route Surface ---');
    // Sakshi tries to access /admin/users
    const sakshiAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(sakshiAdminRes.status === 404 || sakshiAdminRes.status === 403, `Sakshi accessing /admin/users returns 404 unmounted (actual: ${sakshiAdminRes.status})`);

    // Akhilesh tries to access /admin/users
    const akhileshAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(akhileshAdminRes.status === 404 || akhileshAdminRes.status === 403, `Akhilesh accessing /admin/users returns 404 unmounted (actual: ${akhileshAdminRes.status})`);

    // Public / unauthenticated user tries to access /admin/users
    const anonAdminRes = await fetch(`${baseUrl}/admin/users`);
    assert(anonAdminRes.status === 404, `Unauthenticated request to /admin/users returns 404 unmounted (actual: ${anonAdminRes.status})`);

    console.log('\n===============================================================');
    console.log(`RBAC ENFORCEMENT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTwoUserRbacVerification();

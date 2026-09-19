import { initDatabase, prisma } from '../src/config/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { seedDatabase } from '../prisma/seed';
import app from '../src/app';
import http from 'http';

async function runTests() {
  console.log('🧪 Starting PROZEN Backend Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Start temporary test server
  await initDatabase();
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // TEST 1: Database Connection & Seeded Entities Count
    console.log('Test Suite 1: Database Connectivity & Models');
    const [users, stores, items, parties, accounts] = await Promise.all([
      prisma.user.findMany(),
      prisma.store.findMany(),
      prisma.item.findMany(),
      prisma.party.findMany(),
      prisma.ledgerAccount.findMany(),
    ]);

    assert(users.length >= 3, `Seeded users exist (found ${users.length})`);
    assert(stores.length >= 2, `Seeded stores exist (found ${stores.length})`);
    assert(items.length >= 3, `Seeded items exist (found ${items.length})`);
    assert(parties.length >= 3, `Seeded parties exist (found ${parties.length})`);
    assert(accounts.length >= 10, `Chart of accounts seeded (found ${accounts.length})`);

    // TEST 2: Health Endpoint Check
    console.log('\nTest Suite 2: API Health Check');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = (await healthRes.json()) as any;
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthJson.data?.status === 'healthy', 'Health status is healthy');
    assert(healthJson.data?.database?.status === 'connected', 'Database status is connected');

    // TEST 3: Authentication & Password Verification
    console.log('\nTest Suite 3: Authentication & Credentials');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@prozen.com', password: 'Prozen@123' }),
    });
    const adminLogin = (await adminLoginRes.json()) as any;
    assert(adminLoginRes.status === 200, 'Admin login succeeds with HTTP 200');
    assert(adminLogin.data?.user?.role === 'ADMIN', 'Admin user receives ADMIN role');
    assert(typeof adminLogin.data?.token === 'string', 'Admin receives valid JWT token');

    const storeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@prozen.com', password: 'Prozen@123' }),
    });
    const storeLogin = (await storeLoginRes.json()) as any;
    assert(storeLoginRes.status === 200, 'Store user login succeeds');
    assert(storeLogin.data?.user?.role === 'STORE_USER', 'Store user receives STORE_USER role');

    const accountLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'account@prozen.com', password: 'Prozen@123' }),
    });
    const accountLogin = (await accountLoginRes.json()) as any;
    assert(accountLoginRes.status === 200, 'Account user login succeeds');
    assert(accountLogin.data?.user?.role === 'ACCOUNT_USER', 'Account user receives ACCOUNT_USER role');

    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@prozen.com', password: 'WrongPassword' }),
    });
    assert(badLoginRes.status === 401, 'Bad password rejected with HTTP 401');

    // TEST 4: Role-Based Authorization Enforcement
    console.log('\nTest Suite 4: Role-Based Authorization Enforcement');
    const storeToken = storeLogin.data?.token;
    const accountToken = accountLogin.data?.token;
    const adminToken = adminLogin.data?.token;

    // STORE_USER trying to access Accounts module -> MUST BE FORBIDDEN (403)
    const storeToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeToAccountsRes.status === 403,
      'STORE_USER accessing Accounts module is blocked with HTTP 403 Forbidden'
    );

    // ACCOUNT_USER trying to access Accounts module -> MUST SUCCEED (200)
    const accountToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(
      accountToAccountsRes.status === 200,
      'ACCOUNT_USER accessing Accounts module is granted with HTTP 200 OK'
    );

    // ACCOUNT_USER trying to access Store module -> MUST BE FORBIDDEN (403)
    const accountToStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(
      accountToStoreRes.status === 403,
      'ACCOUNT_USER accessing Store module is blocked with HTTP 403 Forbidden'
    );

    // STORE_USER trying to access Store module -> MUST SUCCEED (200)
    const storeToStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeToStoreRes.status === 200,
      'STORE_USER accessing Store module is granted with HTTP 200 OK'
    );

    // ADMIN accessing both -> MUST SUCCEED (200)
    const adminToStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminToStoreRes.status === 200 && adminToAccountsRes.status === 200,
      'ADMIN has full access to both Store and Accounts modules'
    );

    // TEST 5: Purchase Accounts Workflow Architecture (WITH PO vs WITHOUT PO)
    console.log('\nTest Suite 5: Purchase Workflow Rules (WITH PO vs WITHOUT PO)');
    const purchaseWithPoRes = await fetch(`${baseUrl}/accounts/purchases?type=with-po`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    const purchaseWithoutPoRes = await fetch(`${baseUrl}/accounts/purchases?type=without-po`, {
      headers: { Authorization: `Bearer ${accountToken}` },
    });
    assert(purchaseWithPoRes.status === 200, 'WITH PO filter API endpoint functions correctly');
    assert(purchaseWithoutPoRes.status === 200, 'WITHOUT PO filter API endpoint functions correctly');

    console.log('\n----------------------------------------');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('----------------------------------------\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

import { initDatabase, prisma } from '../src/config/db';
import { seedDatabase } from '../src/config/seed';
import app from '../src/app';
import http from 'http';

async function runTests() {
  console.log('🧪 Starting STOCKLEDGER Backend Automated Test Suite...\n');
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
    // TEST 1: Database Connection & Seeded Infrastructure
    console.log('Test Suite 1: Database Connectivity & Models');
    const [users, stores, items, parties, accounts] = await Promise.all([
      prisma.user.findMany(),
      prisma.store.findMany(),
      prisma.item.findMany(),
      prisma.party.findMany(),
      prisma.ledgerAccount.findMany(),
    ]);

    assert(users.length >= 2, `Seeded system users exist (found ${users.length})`);
    assert(stores.length >= 2, `Physical stores exist (found ${stores.length})`);
    assert(accounts.length >= 10, `Chart of accounts seeded (found ${accounts.length})`);

    // TEST 2: Health Endpoint Check
    console.log('\nTest Suite 2: API Health Check');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = (await healthRes.json()) as any;
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthJson.data?.status === 'healthy', 'Health status is healthy');
    assert(healthJson.data?.database?.status === 'connected', 'Database status is connected');

    // TEST 3: Authentication & Password Verification (Sakshi & Akhilesh)
    console.log('\nTest Suite 3: Authentication & Credentials');
    const testPassword = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';

    const sakshiLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeysakshi618@gmail.com', password: testPassword }),
    });
    const sakshiLogin = (await sakshiLoginRes.json()) as any;
    assert(sakshiLoginRes.status === 200, 'Sakshi login succeeds with HTTP 200');
    assert(sakshiLogin.data?.user?.jobTitle === 'Store Incharge', 'Sakshi receives Store Incharge jobTitle');
    assert(sakshiLogin.data?.user?.accessibleWorkspaces?.store === true, 'Sakshi receives store workspace access');
    assert(typeof sakshiLogin.data?.token === 'string', 'Sakshi receives valid JWT token');

    const akhileshLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeyakhilesh2005@gmail.com', password: testPassword }),
    });
    const akhileshLogin = (await akhileshLoginRes.json()) as any;
    assert(akhileshLoginRes.status === 200, 'Akhilesh login succeeds with HTTP 200');
    assert(akhileshLogin.data?.user?.jobTitle === 'Account & Store Incharge', 'Akhilesh receives Account & Store Incharge jobTitle');
    assert(akhileshLogin.data?.user?.accessibleWorkspaces?.accounts === true, 'Akhilesh receives accounts workspace access');
    assert(akhileshLogin.data?.user?.accessibleWorkspaces?.store === true, 'Akhilesh receives store workspace access');

    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeysakshi618@gmail.com', password: 'WrongPassword' }),
    });
    assert(badLoginRes.status === 401, 'Bad password rejected with HTTP 401');

    // TEST 4: Role-Based Authorization Enforcement
    console.log('\nTest Suite 4: Role-Based Authorization Enforcement');
    const sakshiToken = sakshiLogin.data?.token;
    const akhileshToken = akhileshLogin.data?.token;

    // Sakshi (Store Incharge) trying to access Accounts module -> MUST BE FORBIDDEN (403)
    const sakshiToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(
      sakshiToAccountsRes.status === 403,
      'Store Incharge accessing Accounts module is blocked with HTTP 403 Forbidden'
    );

    // Akhilesh (Account & Store Incharge) accessing Accounts module -> MUST SUCCEED (200)
    const akhileshToAccountsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(
      akhileshToAccountsRes.status === 200,
      'Account & Store Incharge accessing Accounts module is granted with HTTP 200 OK'
    );

    // Sakshi accessing Store module -> MUST SUCCEED (200)
    const sakshiToStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    assert(
      sakshiToStoreRes.status === 200,
      'Store Incharge accessing Store module is granted with HTTP 200 OK'
    );

    // Akhilesh accessing Store module -> MUST SUCCEED (200) (Retains full store access)
    const akhileshToStoreRes = await fetch(`${baseUrl}/store/items`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(
      akhileshToStoreRes.status === 200,
      'Account & Store Incharge accessing Store module is granted with HTTP 200 OK (retains store access)'
    );

    // TEST 5: Purchase Accounts Workflow Architecture (WITH PO vs WITHOUT PO)
    console.log('\nTest Suite 5: Purchase Workflow Rules (WITH PO vs WITHOUT PO)');
    const purchaseWithPoRes = await fetch(`${baseUrl}/accounts/purchases?type=with-po`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    const purchaseWithoutPoRes = await fetch(`${baseUrl}/accounts/purchases?type=without-po`, {
      headers: { Authorization: `Bearer ${akhileshToken}` },
    });
    assert(purchaseWithPoRes.status === 200, 'WITH PO filter API endpoint functions correctly');
    assert(purchaseWithoutPoRes.status === 200, 'WITHOUT PO filter API endpoint functions correctly');

    // TEST 6: Session Persistence via /auth/me
    console.log('\nTest Suite 6: Session Persistence');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    });
    const meJson = (await meRes.json()) as any;
    assert(meRes.status === 200, 'GET /api/v1/auth/me succeeds with HTTP 200');
    assert(meJson.data?.user?.email === 'dubeysakshi618@gmail.com', 'Restores correct user session');

    console.log('\n----------------------------------------');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('----------------------------------------\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

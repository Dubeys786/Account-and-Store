import { app } from '../src/app';
import { initDatabase } from '../src/config/db';
import { seedDatabase } from '../src/config/seed';
import http from 'http';

async function runLoginVerification() {
  console.log('===============================================================');
  console.log('STOCKLEDGER: LOGIN 404 FIX & ROUTING VERIFICATION');
  console.log('===============================================================\n');

  await initDatabase();
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${desc} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Test POST /api/v1/auth/login with valid credentials (Sakshi)
    console.log('--- Test 1: Canonical Endpoint POST /api/v1/auth/login (Sakshi) ---');
    const res1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeysakshi618@gmail.com', password: 'Stockledger@123' }),
    });
    const data1 = await res1.json();
    assert(res1.status === 200, 'HTTP Status is 200', `got ${res1.status}`);
    assert(data1.success === true, 'Response success is true');
    assert(typeof data1.data?.token === 'string', 'Received valid JWT token');
    assert(data1.data?.user?.email === 'dubeysakshi618@gmail.com', 'User email matches');
    assert(data1.data?.user?.accessibleWorkspaces?.store === true, 'Has store workspace access');

    // 2. Test POST /api/auth/login via unversioned alias (Akhilesh)
    console.log('\n--- Test 2: Unversioned Route Alias POST /api/auth/login (Akhilesh) ---');
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeyakhilesh2005@gmail.com', password: 'Stockledger@123' }),
    });
    const data2 = await res2.json();
    assert(res2.status === 200, 'HTTP Status is 200 via /api/auth/login alias', `got ${res2.status}`);
    assert(data2.success === true, 'Response success is true');
    assert(typeof data2.data?.token === 'string', 'Received valid JWT token');
    assert(data2.data?.user?.email === 'dubeyakhilesh2005@gmail.com', 'User email matches');
    assert(data2.data?.user?.accessibleWorkspaces?.accounts === true, 'Has accounts workspace access');

    // 3. Test Invalid Password returns 401 (NOT 404)
    console.log('\n--- Test 3: Invalid Password Returns 401 ---');
    const res3 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeysakshi618@gmail.com', password: 'WrongPassword999!' }),
    });
    const data3 = await res3.json();
    assert(res3.status === 401, 'HTTP Status is 401', `got ${res3.status}`);
    assert(data3.success === false, 'Response success is false');
    assert(data3.message === 'Invalid email or password.', 'Error message is "Invalid email or password."', data3.message);

    // 4. Test Missing Fields returns 400
    console.log('\n--- Test 4: Missing Fields Returns 400 ---');
    const res4 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });
    const data4 = await res4.json();
    assert(res4.status === 400, 'HTTP Status is 400 for empty payload', `got ${res4.status}`);
    assert(data4.success === false, 'Response success is false');

    // 5. Test Authenticated Session persistence via /api/v1/auth/me
    console.log('\n--- Test 5: Session Persistence GET /api/v1/auth/me ---');
    const res5 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${data1.data.token}` },
    });
    const data5 = await res5.json();
    assert(res5.status === 200, 'HTTP Status is 200 for /auth/me', `got ${res5.status}`);
    assert(data5.data?.user?.email === 'dubeysakshi618@gmail.com', 'Restored user profile matches');

    // 6. Test GET /api/v1/health & /api/health
    console.log('\n--- Test 6: Health Endpoints ---');
    const res6a = await fetch(`${baseUrl}/api/v1/health`);
    const res6b = await fetch(`${baseUrl}/api/health`);
    assert(res6a.status === 200, 'GET /api/v1/health returns 200');
    assert(res6b.status === 200, 'GET /api/health alias returns 200');

    // 7. Test CORS preflight & headers
    console.log('\n--- Test 7: CORS for Deployed Domains ---');
    const res7 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://stockledger-frontend.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const allowOrigin = res7.headers.get('access-control-allow-origin');
    assert(
      allowOrigin === 'https://stockledger-frontend.vercel.app',
      'CORS allows Vercel deployed origin',
      `got ${allowOrigin}`
    );

    console.log('\n===============================================================');
    console.log(`LOGIN FIX VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    process.exit(0);
  }
}

runLoginVerification().catch((e) => {
  console.error('Fatal verification error:', e);
  process.exit(1);
});

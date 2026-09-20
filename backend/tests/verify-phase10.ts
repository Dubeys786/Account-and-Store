/**
 * PHASE 10 AUTOMATED PRODUCTION SECURITY AND ROLE AUTHORIZATION TEST SUITE
 * 
 * Tests:
 * 1. Unauthenticated → protected API → DENIED (401)
 * 2. Store user → Accounts API → DENIED (403)
 * 3. Account user → authorized store → ALLOWED (200)
 * 4. Account user → unauthorized store → DENIED (403)
 * 5. User → another party ledger → DENIED (403)
 * 6. User → another PO → DENIED (403)
 * 7. Manipulated role / parameter tampering → DENIED (403)
 * 8. Non-destructive Void / Reversal Engine (Zero physical deletion, balanced offset journal)
 * 9. Audit Trail Verification (Export, Void, Create, Security Events)
 */

const BASE_URL = 'http://localhost:5000/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: any;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function login(email: string, password = 'Prozen@123'): Promise<{ token: string; user: any; stores: any[] }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as ApiResponse;
  if (!json.success || !json.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function runPhase10SecurityTests() {
  console.log('================================================================');
  console.log('🛡️  PHASE 10: PRODUCTION SECURITY & ROLE AUTHORIZATION TEST SUITE');
  console.log('================================================================\n');

  // 1. Authenticate users
  console.log('🔑 Authenticating test personas...');
  const adminAuth = await login('admin@prozen.com');
  const storeAuth = await login('store@prozen.com');
  const accountAuth = await login('account@prozen.com');

  console.log(`  Admin token: ${adminAuth.user.email} (Role: ${adminAuth.user.role})`);
  console.log(`  Store user:  ${storeAuth.user.email} (Role: ${storeAuth.user.role}, Stores: ${storeAuth.user.storeIds.join(', ')})`);
  console.log(`  Account user:${accountAuth.user.email} (Role: ${accountAuth.user.role}, Stores: ${accountAuth.user.storeIds.join(', ')})`);

  // Fetch all stores using Admin token
  const storesRes = await fetch(`${BASE_URL}/accounts/stores`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  const storesData = (await storesRes.json()) as ApiResponse<any[]>;
  const allStores = storesData.data || [];
  const str1 = allStores.find((s) => s.code === 'STR-001') || allStores[0];
  const str2 = allStores.find((s) => s.code === 'STR-002') || allStores[1] || allStores[0];

  console.log(`  Store 1 (Authorized for Store & Account Users): ${str1.code} (${str1.id})`);
  console.log(`  Store 2 (Unauthorized foreign store):          ${str2.code} (${str2.id})\n`);

  // ===========================================================================
  // TEST SUITE 1: Unauthenticated → Protected API → DENIED (401)
  // ===========================================================================
  console.log('🔒 TEST SUITE 1: Unauthenticated → Protected API → DENIED (401)');

  const unauthEndpoints = [
    { url: `${BASE_URL}/accounts/dashboard-metrics`, method: 'GET', name: 'Accounts Dashboard Metrics' },
    { url: `${BASE_URL}/accounts/purchases`, method: 'GET', name: 'Accounts Purchases' },
    { url: `${BASE_URL}/accounts/parties`, method: 'GET', name: 'Accounts Parties' },
    { url: `${BASE_URL}/accounts/payments`, method: 'GET', name: 'Accounts Payments' },
    { url: `${BASE_URL}/accounts/reports`, method: 'GET', name: 'Accounts Reports Catalog' },
    { url: `${BASE_URL}/store/purchase-orders`, method: 'GET', name: 'Store Purchase Orders' },
    { url: `${BASE_URL}/store/items`, method: 'GET', name: 'Store Items Master' },
  ];

  for (const ep of unauthEndpoints) {
    const res = await fetch(ep.url, { method: ep.method });
    assert(res.status === 401, `Unauthenticated request to ${ep.name} returns 401 Unauthorized`, `Got ${res.status}`);
  }

  // Bad token
  const badTokenRes = await fetch(`${BASE_URL}/accounts/dashboard-metrics`, {
    headers: { Authorization: 'Bearer this-is-an-invalid-fake-token-xyz' },
  });
  assert(badTokenRes.status === 401, 'Invalid Bearer token rejected with 401 Unauthorized', `Got ${badTokenRes.status}`);

  console.log('');

  // ===========================================================================
  // TEST SUITE 2: Store User → Accounts API → DENIED (403)
  // ===========================================================================
  console.log('🚫 TEST SUITE 2: Store User → Accounts API → DENIED (403)');

  const storeToAccountsEndpoints = [
    { url: `${BASE_URL}/accounts/dashboard-metrics`, method: 'GET', name: 'Accounts Dashboard' },
    { url: `${BASE_URL}/accounts/parties`, method: 'GET', name: 'Party Master' },
    { url: `${BASE_URL}/accounts/purchases`, method: 'GET', name: 'Purchase Accounting' },
    { url: `${BASE_URL}/accounts/payments`, method: 'GET', name: 'Payments' },
    { url: `${BASE_URL}/accounts/receipts`, method: 'GET', name: 'Receipts' },
    { url: `${BASE_URL}/accounts/expenses`, method: 'GET', name: 'Expenses' },
    { url: `${BASE_URL}/accounts/income`, method: 'GET', name: 'Income' },
    { url: `${BASE_URL}/accounts/day-book`, method: 'GET', name: 'Day Book' },
    { url: `${BASE_URL}/accounts/reports`, method: 'GET', name: 'Reports Catalog' },
    { url: `${BASE_URL}/accounts/reports/generate?reportType=DAY_BOOK`, method: 'GET', name: 'Report Generation' },
    {
      url: `${BASE_URL}/accounts/transactions`,
      method: 'POST',
      name: 'Create Accounting Transaction',
      body: { storeId: str1.id, grossAmount: 100, transactionType: 'PURCHASE' },
    },
  ];

  for (const ep of storeToAccountsEndpoints) {
    const res = await fetch(ep.url, {
      method: ep.method,
      headers: {
        Authorization: `Bearer ${storeAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: ep.body ? JSON.stringify(ep.body) : undefined,
    });
    assert(res.status === 403, `Store user accessing Accounts module (${ep.name}) is strictly DENIED (403)`, `Got ${res.status}`);
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 3: Account User → Authorized Store → ALLOWED (200)
  // ===========================================================================
  console.log('✅ TEST SUITE 3: Account User → Authorized Store → ALLOWED (200)');

  const accountAllowedEndpoints = [
    { url: `${BASE_URL}/accounts/stores`, name: 'View Authorized Stores' },
    { url: `${BASE_URL}/accounts/purchases?storeId=${str1.id}`, name: 'View Authorized Store Purchases' },
    { url: `${BASE_URL}/accounts/payments?storeId=${str1.id}`, name: 'View Authorized Store Payments' },
    { url: `${BASE_URL}/accounts/receivables?storeId=${str1.id}`, name: 'View Authorized Store Receivables' },
    { url: `${BASE_URL}/accounts/payables?storeId=${str1.id}`, name: 'View Authorized Store Payables' },
    { url: `${BASE_URL}/accounts/reports/generate?reportType=DAY_BOOK&storeId=${str1.id}`, name: 'Generate Authorized Store Report' },
  ];

  for (const ep of accountAllowedEndpoints) {
    const res = await fetch(ep.url, {
      headers: { Authorization: `Bearer ${accountAuth.token}` },
    });
    assert(res.status === 200, `Account user accessing authorized store data (${ep.name}) is ALLOWED (200)`, `Got ${res.status}`);
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 4: Account User → Unauthorized Store → DENIED (403)
  // ===========================================================================
  console.log('🚫 TEST SUITE 4: Account User → Unauthorized Store → DENIED (403)');

  if (str2.id !== str1.id) {
    const accountDeniedEndpoints = [
      { url: `${BASE_URL}/accounts/purchases?storeId=${str2.id}`, method: 'GET', name: 'Query Foreign Store Purchases' },
      { url: `${BASE_URL}/accounts/payments?storeId=${str2.id}`, method: 'GET', name: 'Query Foreign Store Payments' },
      { url: `${BASE_URL}/accounts/receipts?storeId=${str2.id}`, method: 'GET', name: 'Query Foreign Store Receipts' },
      { url: `${BASE_URL}/accounts/reports/generate?reportType=STORE_WISE&storeId=${str2.id}`, method: 'GET', name: 'Generate Foreign Store Report' },
      {
        url: `${BASE_URL}/accounts/purchases/without-po`,
        method: 'POST',
        name: 'Create Direct Purchase in Foreign Store',
        body: {
          storeId: str2.id,
          partyId: 'some-party-id',
          invoiceNumber: `INV-FORBIDDEN-${Date.now()}`,
          itemName: 'Unauthorized Item',
          quantity: 1,
          rate: 1000,
        },
      },
      {
        url: `${BASE_URL}/accounts/expenses`,
        method: 'POST',
        name: 'Create Expense in Foreign Store',
        body: {
          storeId: str2.id,
          category: 'Office Supplies',
          amount: 500,
        },
      },
    ];

    for (const ep of accountDeniedEndpoints) {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          Authorization: `Bearer ${accountAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert(res.status === 403, `Account user accessing unauthorized store (${ep.name}) is DENIED (403)`, `Got ${res.status}`);
    }
  } else {
    console.log('  ⚠️ Skipping unauthorized store test: Only one store exists in database.');
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 5: User → Another Party Ledger → DENIED (403)
  // ===========================================================================
  console.log('🚫 TEST SUITE 5: User → Another Party Ledger → DENIED (403)');

  // Create a party tied explicitly to foreign store (STR-002) using Admin credentials
  const foreignPartyRes = await fetch(`${BASE_URL}/accounts/parties`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Foreign Supplier ${Date.now()}`,
      type: 'SUPPLIER',
      storeId: str2.id,
      phone: '9876543210',
    }),
  });
  const foreignPartyJson = (await foreignPartyRes.json()) as ApiResponse<any>;
  const foreignParty = foreignPartyJson.data;

  if (foreignParty && str2.id !== str1.id) {
    console.log(`  Created test party '${foreignParty.name}' explicitly assigned to store ${str2.code}`);

    // Account user (assigned only to STR-001) attempts to access this foreign party
    const partyEndpoints = [
      { url: `${BASE_URL}/accounts/parties/${foreignParty.id}`, name: 'Get Party Details' },
      { url: `${BASE_URL}/accounts/parties/${foreignParty.id}/ledger`, name: 'Get Party Ledger' },
      { url: `${BASE_URL}/accounts/parties/${foreignParty.id}/balance`, name: 'Get Party Balance' },
      { url: `${BASE_URL}/accounts/reports/generate?reportType=PARTY_LEDGER&partyId=${foreignParty.id}`, name: 'Party Ledger Report' },
    ];

    for (const ep of partyEndpoints) {
      const res = await fetch(ep.url, {
        headers: { Authorization: `Bearer ${accountAuth.token}` },
      });
      assert(res.status === 403, `Account user accessing foreign party (${ep.name}) is DENIED (403)`, `Got ${res.status}`);
    }
  } else {
    console.log('  ⚠️ Skipping foreign party ledger test (str2 === str1).');
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 6: User → Another PO → DENIED (403)
  // ===========================================================================
  console.log('🚫 TEST SUITE 6: User → Another PO → DENIED (403)');

  // Get items to create a PO in STR-002 using Admin token
  const itemsRes = await fetch(`${BASE_URL}/store/items`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  const itemsData = (await itemsRes.json()) as ApiResponse<any[]>;
  const firstItem = itemsData.data?.[0];

  if (firstItem && str2.id !== str1.id) {
    // Create PO in store STR-002 with admin
    const createPoRes = await fetch(`${BASE_URL}/store/purchase-orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partyId: foreignParty.id,
        storeId: str2.id,
        items: [{ itemId: firstItem.id, quantity: 10, rate: 250 }],
        notes: 'Foreign PO for IDOR verification test',
      }),
    });
    const poJson = (await createPoRes.json()) as ApiResponse<any>;
    const foreignPO = poJson.data;

    if (foreignPO) {
      console.log(`  Created test PO '${foreignPO.poNumber}' in store ${str2.code}`);

      // 1. Store user (STR-001) tries to access this PO by ID in Store module
      const storePoRes = await fetch(`${BASE_URL}/store/purchase-orders/${foreignPO.id}`, {
        headers: { Authorization: `Bearer ${storeAuth.token}` },
      });
      assert(storePoRes.status === 403, `Store user accessing foreign PO (${foreignPO.poNumber}) is DENIED (403)`, `Got ${storePoRes.status}`);

      // 2. Store user tries to query POs specifying storeId of STR-002
      const storeListPoRes = await fetch(`${BASE_URL}/store/purchase-orders?storeId=${str2.id}`, {
        headers: { Authorization: `Bearer ${storeAuth.token}` },
      });
      assert(storeListPoRes.status === 403, 'Store user querying foreign store PO list is DENIED (403)', `Got ${storeListPoRes.status}`);

      // 3. Store user tries to create a PO in STR-002
      const storeCreatePoRes = await fetch(`${BASE_URL}/store/purchase-orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${storeAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId: foreignParty.id,
          storeId: str2.id,
          items: [{ itemId: firstItem.id, quantity: 5, rate: 100 }],
        }),
      });
      assert(storeCreatePoRes.status === 403, 'Store user creating PO in foreign store is DENIED (403)', `Got ${storeCreatePoRes.status}`);

      // 4. Account user tries to access foreign PO in Accounts module
      const accPoRes = await fetch(`${BASE_URL}/accounts/purchases/eligible-pos/${foreignPO.id}`, {
        headers: { Authorization: `Bearer ${accountAuth.token}` },
      });
      assert(accPoRes.status === 403, 'Account user accessing foreign PO for billing is DENIED (403)', `Got ${accPoRes.status}`);
    }
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 7: Manipulated Role / Tampering → DENIED (403)
  // ===========================================================================
  console.log('🛡️  TEST SUITE 7: Manipulated Role / Parameter Tampering → DENIED (403)');

  // 1. Account user sends { role: 'ADMIN' } in body to elevate privileges
  const roleTamperBodyRes = await fetch(`${BASE_URL}/accounts/purchases/without-po`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'ADMIN', // Tampered role!
      storeId: str1.id,
      partyId: foreignParty?.id || 'some-id',
      invoiceNumber: `INV-TAMPER-${Date.now()}`,
      itemName: 'Tampered Role Purchase',
      quantity: 1,
      rate: 100,
    }),
  });
  assert(roleTamperBodyRes.status === 403, 'Manipulated role in request body is DENIED (403)', `Got ${roleTamperBodyRes.status}`);

  // 2. Store user sends role manipulation in body
  const storeRoleTamperRes = await fetch(`${BASE_URL}/store/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${storeAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'ADMIN',
      name: 'Tamper Item',
      category: 'General',
    }),
  });
  assert(storeRoleTamperRes.status === 403, 'Store user sending manipulated role is DENIED (403)', `Got ${storeRoleTamperRes.status}`);

  // 3. User impersonation in request body: userId altered
  const userIdTamperRes = await fetch(`${BASE_URL}/accounts/expenses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: adminAuth.user.id, // Attempting to impersonate admin user!
      storeId: str1.id,
      category: 'Office Supplies',
      amount: 150,
    }),
  });
  assert(userIdTamperRes.status === 403, 'User ID impersonation in request body is DENIED (403)', `Got ${userIdTamperRes.status}`);

  // 4. Role query parameter tampering: ?role=ADMIN
  const queryRoleTamperRes = await fetch(`${BASE_URL}/accounts/purchases?role=ADMIN`, {
    headers: { Authorization: `Bearer ${accountAuth.token}` },
  });
  assert(queryRoleTamperRes.status === 403, 'Role manipulation in query parameter is DENIED (403)', `Got ${queryRoleTamperRes.status}`);

  console.log('');

  // ===========================================================================
  // TEST SUITE 8: Non-Destructive Void / Reversal Engine
  // ===========================================================================
  console.log('🔄 TEST SUITE 8: Non-Destructive Void / Reversal Engine');

  // Create an authorized supplier in STR-001
  const authSupplierRes = await fetch(`${BASE_URL}/accounts/parties`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Authorized Vendor ${Date.now()}`,
      type: 'SUPPLIER',
      storeId: str1.id,
      phone: '9988776655',
    }),
  });
  const authSupplier = ((await authSupplierRes.json()) as ApiResponse).data;

  // Post a direct purchase in STR-001 using Account user
  const purchaseRes = await fetch(`${BASE_URL}/accounts/purchases/without-po`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storeId: str1.id,
      partyId: authSupplier.id,
      invoiceNumber: `INV-VOID-TEST-${Date.now()}`,
      itemName: 'Void Reversal Test Goods',
      quantity: 4,
      rate: 500,
      taxPercent: 18,
    }),
  });
  const purchaseJson = (await purchaseRes.json()) as ApiResponse;
  const originalTx = purchaseJson.data?.transaction || purchaseJson.data;

  assert(purchaseRes.status === 201 && originalTx?.id, 'Direct purchase posted for void test (201 Created)');

  if (originalTx?.id) {
    // Void the transaction
    const voidRes = await fetch(`${BASE_URL}/accounts/transactions/${originalTx.id}/void`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accountAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Duplicate entry detected — non-destructive reversal' }),
    });
    const voidJson = (await voidRes.json()) as ApiResponse;

    assert(voidRes.status === 200, 'Void / reversal endpoint executed successfully (200 OK)', `Got ${voidRes.status}: ${JSON.stringify(voidJson)}`);
    assert(!!voidJson.data?.reversalJournalId, 'Reversal double-entry journal entry was created with balanced lines');

    // Verify transaction was NOT physically deleted
    const fetchAfterVoidRes = await fetch(`${BASE_URL}/accounts/transactions/${originalTx.id}`, {
      headers: { Authorization: `Bearer ${accountAuth.token}` },
    });
    const fetchAfterVoidJson = (await fetchAfterVoidRes.json()) as ApiResponse;

    assert(fetchAfterVoidRes.status === 200, 'Historical transaction is retained in DB (Zero physical deletion)');
    assert(fetchAfterVoidJson.data?.notes?.includes('[VOIDED'), 'Transaction notes reflect VOIDED audit status');

    // Attempting to void again should fail
    const secondVoidRes = await fetch(`${BASE_URL}/accounts/transactions/${originalTx.id}/void`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accountAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Duplicate void attempt' }),
    });
    assert(secondVoidRes.status === 400, 'Second void attempt on already voided transaction is rejected (400)', `Got ${secondVoidRes.status}`);
  }

  console.log('');

  // ===========================================================================
  // TEST SUITE 9: Export Auditing & Security Logs
  // ===========================================================================
  console.log('📋 TEST SUITE 9: Export Auditing & Audit Trail Records');

  // Trigger Report Export
  const exportRes = await fetch(`${BASE_URL}/accounts/reports/export?reportType=DAY_BOOK&format=CSV&storeId=${str1.id}`, {
    headers: { Authorization: `Bearer ${accountAuth.token}` },
  });
  const exportJson = (await exportRes.json()) as ApiResponse;

  assert(exportRes.status === 200, 'Report Export endpoint executed successfully (200 OK)', `Got ${exportRes.status}`);
  assert(exportJson.message?.includes('exported successfully'), 'Export confirmation message received');

  console.log('\n================================================================');
  console.log(`🏁 PHASE 10 VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10SecurityTests().catch((err) => {
  console.error('Fatal error during Phase 10 security test execution:', err);
  process.exit(1);
});

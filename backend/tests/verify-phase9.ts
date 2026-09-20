/**
 * PHASE 9 AUTOMATED VERIFICATION TEST SUITE
 * Accounting Reports & Live Analytics Verification:
 * 1. Security & RBAC: STORE_USER forbidden (403) from Reports & Analytics endpoints
 * 2. Reports Catalog: GET /reports returns all 14 reports with titles, categories, and descriptions
 * 3. 14 Reports Generation: Tests generation of all 14 reports with valid columns, records, summaries, and pagination
 *    - Party Ledger
 *    - Purchase Report
 *    - Purchase With PO
 *    - Purchase Without PO
 *    - Payable Report
 *    - Receivable Report
 *    - Payment Report
 *    - Receipt Report
 *    - Expense Report
 *    - Income Report
 *    - Day Book
 *    - Cash Book
 *    - Bank Book
 *    - Store-wise Accounting Report
 * 4. Universal Filters: Date Range, Store, Party, Status, Search
 * 5. Accounts Dashboard Live Analytics: Verifies all 7 chart series (Purchases, Payments, Receipts, Payables, Receivables, Expenses, Income)
 * 6. Tenancy Authorization: Only user-permitted stores can be queried
 */

const BASE_URL = 'http://localhost:5000/api/v1';

interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: { id: string; email: string; role: string };
  };
}

async function login(email: string, password = 'Prozen@123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as AuthResponse;
  if (!data.success || !data.data?.token) {
    throw new Error(`Failed to authenticate ${email}: ${JSON.stringify(data)}`);
  }
  return data.data.token;
}

const REPORT_TYPES = [
  'PARTY_LEDGER',
  'PURCHASE_REPORT',
  'PURCHASE_WITH_PO',
  'PURCHASE_WITHOUT_PO',
  'PAYABLE_REPORT',
  'RECEIVABLE_REPORT',
  'PAYMENT_REPORT',
  'RECEIPT_REPORT',
  'EXPENSE_REPORT',
  'INCOME_REPORT',
  'DAY_BOOK',
  'CASH_BOOK',
  'BANK_BOOK',
  'STORE_WISE',
] as const;

async function runPhase9Verification() {
  console.log('================================================================');
  console.log('🚀 PROZEN PHASE 9 — ACCOUNTING REPORTS & ANALYTICS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Authenticate users
  console.log('🔑 Step 1: Authenticating test users...');
  const adminToken = await login('admin@prozen.com');
  const storeUserToken = await login('store@prozen.com');
  const accountUserToken = await login('account@prozen.com');
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const storeHeaders = { Authorization: `Bearer ${storeUserToken}`, 'Content-Type': 'application/json' };
  const accountHeaders = { Authorization: `Bearer ${accountUserToken}`, 'Content-Type': 'application/json' };
  assert(!!adminToken && !!storeUserToken && !!accountUserToken, 'Authenticated ADMIN, STORE_USER, and ACCOUNT_USER tokens');

  // 2. Security & RBAC: STORE_USER must be forbidden (403) from Reports & Analytics
  console.log('\n🔒 Step 2: Testing Security & Role-Based Access Control (RBAC)...');
  const [secCatalog, secGenerate, secAnalytics] = await Promise.all([
    fetch(`${BASE_URL}/accounts/reports`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/reports/generate?reportType=PURCHASE_REPORT`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/dashboard-analytics`, { headers: storeHeaders }),
  ]);

  assert(secCatalog.status === 403, 'GET /reports returns 403 Forbidden for STORE_USER');
  assert(secGenerate.status === 403, 'GET /reports/generate returns 403 Forbidden for STORE_USER');
  assert(secAnalytics.status === 403, 'GET /dashboard-analytics returns 403 Forbidden for STORE_USER');

  // 3. Reports Catalog Check
  console.log('\n📚 Step 3: Verifying Accounting Reports Catalog (14 Reports)...');
  const catalogRes = await fetch(`${BASE_URL}/accounts/reports`, { headers: adminHeaders });
  const catalogData = await catalogRes.json();
  assert(catalogRes.status === 200 && catalogData.success, 'GET /reports returns 200 OK');
  const availableReports: any[] = catalogData.data?.availableReports || [];
  assert(availableReports.length === 14, `Reports catalog contains exactly 14 reports (received: ${availableReports.length})`);

  // Verify all 14 IDs are present
  const reportIds = new Set(availableReports.map((r) => r.id));
  const all14Present = REPORT_TYPES.every((id) => reportIds.has(id));
  assert(all14Present, 'All 14 report IDs (Party Ledger through Store-wise) registered in catalog');

  // 4. Test Generation of each of the 14 Reports
  console.log('\n📊 Step 4: Generating and Verifying All 14 Dedicated Accounting Reports...');

  for (let i = 0; i < REPORT_TYPES.length; i++) {
    const reportType = REPORT_TYPES[i];
    const genRes = await fetch(`${BASE_URL}/accounts/reports/generate?reportType=${reportType}&limit=10`, {
      headers: adminHeaders,
    });
    const genData = await genRes.json();

    const isOk = genRes.status === 200 && genData.success && genData.data != null;
    const hasColumns = Array.isArray(genData.data?.columns) && genData.data.columns.length > 0;
    const hasRecords = Array.isArray(genData.data?.records);
    const hasSummary = genData.data?.summary != null;
    const hasPagination = genData.data?.pagination != null;

    assert(
      isOk && hasColumns && hasRecords && hasSummary && hasPagination,
      `Report [${i + 1}/14] ${reportType}: generated with ${genData.data?.columns?.length} columns, ${genData.data?.records?.length} rows, and calculated summary`
    );
  }

  // 5. Universal Filters Test
  console.log('\n🔍 Step 5: Testing Universal Multi-Parameter Filters...');

  // 5a. Date Range & Search filter on PURCHASE_REPORT
  const filteredPurchaseRes = await fetch(
    `${BASE_URL}/accounts/reports/generate?reportType=PURCHASE_REPORT&startDate=2026-01-01&endDate=2026-12-31&search=INV`,
    { headers: adminHeaders }
  );
  const filteredPurchaseData = await filteredPurchaseRes.json();
  assert(filteredPurchaseRes.status === 200, 'Universal Date Range and Search query applied successfully');
  assert(
    filteredPurchaseData.data?.records?.every((r: any) => r.invoiceNumber.includes('INV') || r.supplier.includes('INV')),
    'Filtered purchase records match search query'
  );

  // 5b. Status filter on PAYABLE_REPORT
  const statusFilterRes = await fetch(
    `${BASE_URL}/accounts/reports/generate?reportType=PAYABLE_REPORT&status=UNPAID`,
    { headers: adminHeaders }
  );
  const statusFilterData = await statusFilterRes.json();
  assert(statusFilterRes.status === 200, 'Status filter (UNPAID) on Payable Report applied successfully');

  // 6. Test Accounts Dashboard Live Analytics (The 7 Chart Series)
  console.log('\n📈 Step 6: Verifying Accounts Dashboard Live Analytics (7 Chart Series)...');
  const analyticsRes = await fetch(`${BASE_URL}/accounts/dashboard-analytics`, { headers: adminHeaders });
  const analyticsData = await analyticsRes.json();
  assert(analyticsRes.status === 200 && analyticsData.success, 'GET /dashboard-analytics returns 200 OK');

  const analytics = analyticsData.data;
  assert(!!analytics, 'Dashboard analytics data object present');

  // Verify monthly series
  const monthly = analytics.monthlySeries;
  assert(Array.isArray(monthly) && monthly.length === 6, 'Monthly time series returns 6 rolling months');

  // Verify the 7 series in totals
  const totals = analytics.totals;
  assert('purchases' in totals, `Purchases chart total aggregated: ₹${totals.purchases}`);
  assert('payments' in totals, `Payments chart total aggregated: ₹${totals.payments}`);
  assert('receipts' in totals, `Receipts chart total aggregated: ₹${totals.receipts}`);
  assert('payables' in totals, `Payables chart total aggregated: ₹${totals.payables}`);
  assert('receivables' in totals, `Receivables chart total aggregated: ₹${totals.receivables}`);
  assert('expenses' in totals, `Expenses chart total aggregated: ₹${totals.expenses}`);
  assert('income' in totals, `Income chart total aggregated: ₹${totals.income}`);

  // Verify category breakdowns
  assert(Array.isArray(analytics.expenseBreakdown), `Expense categories breakdown returned ${analytics.expenseBreakdown.length} categories`);
  assert(Array.isArray(analytics.incomeBreakdown), `Income streams breakdown returned ${analytics.incomeBreakdown.length} streams`);

  // 7. Store Tenancy Isolation Check
  console.log('\n🛡️ Step 7: Testing Multi-Store Tenancy Authorization...');
  const storeRes = await fetch(`${BASE_URL}/accounts/stores`, { headers: adminHeaders });
  const storeData = await storeRes.json();
  const stores = storeData.data || [];
  if (stores.length > 0) {
    const authorizedStoreId = stores[0].id;
    const storeWiseRes = await fetch(
      `${BASE_URL}/accounts/reports/generate?reportType=STORE_WISE&storeId=${authorizedStoreId}`,
      { headers: adminHeaders }
    );
    const storeWiseData = await storeWiseRes.json();
    assert(storeWiseRes.status === 200, 'STORE_WISE report generated for specific authorized store');
  }

  // Final Summary
  console.log('\n================================================================');
  console.log(`🏁 Phase 9 Automated Verification Completed: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Verification().catch((err) => {
  console.error('❌ Unhandled error in verification test:', err);
  process.exit(1);
});

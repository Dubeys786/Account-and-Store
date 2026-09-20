import prisma from '../config/db';

async function verify() {
  const baseUrl = 'http://localhost:5000/api/v1';
  const password = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';

  console.log('================================================================');
  console.log('STOCKLEDGER: LIVE API VERIFICATION (ZERO DEMO DATA & DYNAMIC PROOF)');
  console.log('================================================================\n');

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

  // 1. Authenticate Sakshi (Store Incharge)
  console.log('Phase 1: Authenticating Sakshi (Store Incharge)...');
  const sakshiLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dubeysakshi618@gmail.com', password }),
  });
  const sakshiLogin = (await sakshiLoginRes.json()) as any;
  assert(sakshiLoginRes.status === 200, 'Sakshi login succeeds');
  assert(sakshiLogin.data?.user?.jobTitle === 'Store Incharge', 'Sakshi jobTitle is Store Incharge');
  assert(sakshiLogin.data?.user?.workspace === 'Store', 'Sakshi workspace is Store');
  const sakshiToken = sakshiLogin.data?.token;

  // 2. Query Store Dashboard Metrics
  console.log('\nPhase 2: Verifying Store Dashboard Metrics (Pristine Empty State)...');
  const storeMetricsRes = await fetch(`${baseUrl}/store/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  const storeMetrics = (await storeMetricsRes.json()) as any;
  assert(storeMetricsRes.status === 200, 'Store dashboard metrics returned HTTP 200');
  assert(storeMetrics.data?.totalItems === 0, `Total Items is 0 (actual: ${storeMetrics.data?.totalItems})`);
  assert(storeMetrics.data?.totalPurchaseOrders === 0, `Purchase Orders count is 0 (actual: ${storeMetrics.data?.totalPurchaseOrders})`);
  assert(storeMetrics.data?.totalMaterialInwards === 0, `Material Inwards count is 0 (actual: ${storeMetrics.data?.totalMaterialInwards})`);
  assert(storeMetrics.data?.totalStockQuantity === 0, `Total Available Stock is 0 (actual: ${storeMetrics.data?.totalStockQuantity})`);
  assert(storeMetrics.data?.outstandingBalance === 0, `Outstanding Balance is 0 (actual: ${storeMetrics.data?.outstandingBalance})`);
  assert(storeMetrics.data?.lowStockCount === 0, `Low Stock Count is 0 (actual: ${storeMetrics.data?.lowStockCount})`);
  assert(Array.isArray(storeMetrics.data?.recentPurchaseOrders) && storeMetrics.data?.recentPurchaseOrders.length === 0, 'Recent POs list is empty []');
  assert(Array.isArray(storeMetrics.data?.recentMaterialInwards) && storeMetrics.data?.recentMaterialInwards.length === 0, 'Recent Inwards list is empty []');
  assert(Array.isArray(storeMetrics.data?.recentStockTransactions) && storeMetrics.data?.recentStockTransactions.length === 0, 'Recent Stock Transactions list is empty []');

  // 3. Authenticate Akhilesh (Account & Store Incharge)
  console.log('\nPhase 3: Authenticating Akhilesh (Account & Store Incharge)...');
  const akhileshLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dubeyakhilesh2005@gmail.com', password }),
  });
  const akhileshLogin = (await akhileshLoginRes.json()) as any;
  assert(akhileshLoginRes.status === 200, 'Akhilesh login succeeds');
  assert(akhileshLogin.data?.user?.jobTitle === 'Account & Store Incharge', 'Akhilesh jobTitle is Account & Store Incharge');
  assert(akhileshLogin.data?.user?.workspace === 'Accounts', 'Akhilesh workspace is Accounts');
  const akhileshToken = akhileshLogin.data?.token;
  const storeId = akhileshLogin.data?.user?.storeIds?.[0];

  // 4. Query Accounts Dashboard Metrics
  console.log('\nPhase 4: Verifying Accounts Dashboard Metrics (Pristine Empty State)...');
  const accountsMetricsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const acctMetrics = (await accountsMetricsRes.json()) as any;
  assert(accountsMetricsRes.status === 200, 'Accounts dashboard metrics returned HTTP 200');
  assert(acctMetrics.data?.totalPayables === 0, `Total Payables is ₹0 (actual: ₹${acctMetrics.data?.totalPayables})`);
  assert(acctMetrics.data?.totalReceivables === 0, `Total Receivables is ₹0 (actual: ₹${acctMetrics.data?.totalReceivables})`);
  assert(acctMetrics.data?.todayPayments === 0, `Today's Payments is ₹0 (actual: ₹${acctMetrics.data?.todayPayments})`);
  assert(acctMetrics.data?.todayReceipts === 0, `Today's Receipts is ₹0 (actual: ₹${acctMetrics.data?.todayReceipts})`);
  assert(acctMetrics.data?.todayPurchases === 0, `Today's Purchases is ₹0 (actual: ₹${acctMetrics.data?.todayPurchases})`);
  assert(acctMetrics.data?.todaySales === 0, `Today's Sales is ₹0 (actual: ₹${acctMetrics.data?.todaySales})`);
  assert(acctMetrics.data?.totalExpenses === 0, `Total Expenses is ₹0 (actual: ₹${acctMetrics.data?.totalExpenses})`);
  assert(acctMetrics.data?.totalIncome === 0, `Total Income is ₹0 (actual: ₹${acctMetrics.data?.totalIncome})`);
  assert(acctMetrics.data?.outstandingAmount === 0, `Outstanding Amount is ₹0 (actual: ₹${acctMetrics.data?.outstandingAmount})`);
  assert(acctMetrics.data?.activeParties === 0, `Active Parties is 0 (actual: ${acctMetrics.data?.activeParties})`);
  assert(acctMetrics.data?.partyCount === 0, `Total Parties is 0 (actual: ${acctMetrics.data?.partyCount})`);
  assert(Array.isArray(acctMetrics.data?.recentTransactions) && acctMetrics.data?.recentTransactions.length === 0, 'Recent Transactions list is empty []');

  // 5. Query Accounts Analytics (Charts & Breakdowns)
  console.log('\nPhase 5: Verifying Accounts Dashboard Analytics (Pristine Empty State)...');
  const analyticsRes = await fetch(`${baseUrl}/accounts/analytics/dashboard`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const analytics = (await analyticsRes.json()) as any;
  assert(analyticsRes.status === 200, 'Accounts analytics returned HTTP 200');
  assert(analytics.data?.totals?.purchases === 0, `Analytics totals.purchases is 0 (actual: ${analytics.data?.totals?.purchases})`);
  assert(analytics.data?.totals?.payments === 0, `Analytics totals.payments is 0 (actual: ${analytics.data?.totals?.payments})`);
  assert(analytics.data?.totals?.receipts === 0, `Analytics totals.receipts is 0 (actual: ${analytics.data?.totals?.receipts})`);
  assert(analytics.data?.totals?.payables === 0, `Analytics totals.payables is 0 (actual: ${analytics.data?.totals?.payables})`);
  assert(analytics.data?.totals?.receivables === 0, `Analytics totals.receivables is 0 (actual: ${analytics.data?.totals?.receivables})`);
  assert(analytics.data?.totals?.expenses === 0, `Analytics totals.expenses is 0 (actual: ${analytics.data?.totals?.expenses})`);
  assert(analytics.data?.totals?.income === 0, `Analytics totals.income is 0 (actual: ${analytics.data?.totals?.income})`);
  assert(Array.isArray(analytics.data?.expenseBreakdown) && analytics.data?.expenseBreakdown.length === 0, 'Expense Breakdown is empty []');
  assert(Array.isArray(analytics.data?.incomeBreakdown) && analytics.data?.incomeBreakdown.length === 0, 'Income Breakdown is empty []');

  // 6. Dynamic Real Transaction Proof
  console.log('\nPhase 6: Dynamic Real Transaction Proof (Simulating real purchase of ₹25,000)...');
  
  // 6a. Create a real supplier party
  const partyRes = await fetch(`${baseUrl}/accounts/parties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${akhileshToken}`,
    },
    body: JSON.stringify({
      code: 'PRT-REAL-001',
      name: 'Dynamic Test Real Supplier',
      type: 'SUPPLIER',
      creditLimit: 100000,
      creditDays: 30,
    }),
  });
  const partyData = (await partyRes.json()) as any;
  assert(partyRes.status === 201, 'Created real supplier party PRT-REAL-001');
  const partyId = partyData.data?.id;

  // 6b. Book direct purchase invoice of ₹25,000
  const txnRes = await fetch(`${baseUrl}/accounts/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${akhileshToken}`,
    },
    body: JSON.stringify({
      storeId,
      transactionType: 'PURCHASE_WITHOUT_PO',
      partyId,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      grossAmount: 25000,
      taxAmount: 0,
      netAmount: 25000,
      notes: 'Real procurement invoice proof test',
    }),
  });
  const txnData = (await txnRes.json()) as any;
  assert(txnRes.status === 201, 'Booked real purchase invoice of ₹25,000', JSON.stringify(txnData));

  // 6c. Re-query Dashboard Metrics to verify dynamic calculation from database
  const dynamicMetricsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const dynamicMetrics = (await dynamicMetricsRes.json()) as any;
  assert(dynamicMetrics.data?.todayPurchases === 25000, `Today's Purchases dynamically calculated as ₹25,000 (actual: ₹${dynamicMetrics.data?.todayPurchases})`);
  assert(dynamicMetrics.data?.totalPayables === 25000, `Total Payables dynamically calculated as ₹25,000 (actual: ₹${dynamicMetrics.data?.totalPayables})`);
  assert(dynamicMetrics.data?.activeParties === 1, `Active Parties dynamically incremented to 1 (actual: ${dynamicMetrics.data?.activeParties})`);
  assert(dynamicMetrics.data?.recentTransactions?.length === 1, `Recent Transactions dynamically contains 1 transaction (actual: ${dynamicMetrics.data?.recentTransactions?.length})`);

  // 6d. Clean up the dynamic test record so database returns to pristine empty state
  console.log('\nCleaning up dynamic test record...');
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.accountingTransaction.deleteMany({});
  await prisma.party.deleteMany({});

  // 6e. Confirm database is back to 0
  const cleanMetricsRes = await fetch(`${baseUrl}/accounts/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const cleanMetrics = (await cleanMetricsRes.json()) as any;
  assert(cleanMetrics.data?.todayPurchases === 0, `After cleanup, Today's Purchases returns to ₹0 (actual: ₹${cleanMetrics.data?.todayPurchases})`);
  assert(cleanMetrics.data?.totalPayables === 0, `After cleanup, Total Payables returns to ₹0 (actual: ₹${cleanMetrics.data?.totalPayables})`);
  assert(cleanMetrics.data?.activeParties === 0, `After cleanup, Active Parties returns to 0 (actual: ${cleanMetrics.data?.activeParties})`);

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

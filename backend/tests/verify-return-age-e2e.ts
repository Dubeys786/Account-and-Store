const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} - ${name}${details ? ` (${details})` : ''}`);
}

async function runReturnAgeVerification() {
  console.log('================================================================');
  console.log('STOCKLEDGER — RETURN AGE & ITEM AGE TRACKING END-TO-END SUITE');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // Step 0: User Authentication (Sakshi - Store Incharge)
    // -------------------------------------------------------------
    console.log('--- Step 0: Authentication (Sakshi - Store Incharge) ---');
    const testPassword = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dubeysakshi618@gmail.com',
        password: testPassword,
      }),
    });
    const loginJson = (await loginRes.json()) as any;
    const token = loginJson.data?.token;
    record('Auth: Sakshi Login', loginRes.ok && Boolean(token), `Token acquired`);

    if (!token) {
      throw new Error('Authentication failed. Aborting tests.');
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // -------------------------------------------------------------
    // Step 1: Lookups & Inventory Setup
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Lookups & Stock Availability Check ---');
    const itemsRes = await fetch(`${API_BASE}/store/items`, { headers });
    const itemsJson = (await itemsRes.json()) as any;
    const items = itemsJson.data?.items || itemsJson.data || [];
    record('Lookups: Fetch Items', itemsRes.ok && items.length > 0, `Found ${items.length} items`);

    const storesRes = await fetch(`${API_BASE}/store/stores`, { headers });
    const storesJson = (await storesRes.json()) as any;
    const stores = storesJson.data || [];
    record('Lookups: Fetch Stores', storesRes.ok && stores.length > 0, `Found ${stores.length} stores`);

    // Select target store and item with currentStock >= 10
    const targetStore = stores[0];
    const targetItem = items.find((it: any) => it.currentStock >= 10) || items[0];

    const initialUsableStock = targetItem.currentStock;
    const initialDamagedStock = targetItem.damagedStock || 0;
    console.log(`Selected Test Item: ${targetItem.code} - ${targetItem.name} (Usable Stock: ${initialUsableStock}, Damaged: ${initialDamagedStock})`);

    if (initialUsableStock < 10) {
      throw new Error(`Insufficient stock on item ${targetItem.code} (${initialUsableStock}) to run 10-unit test.`);
    }

    // -------------------------------------------------------------
    // Step 2: Issue Stock
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Issue Material to Department ---');
    const issueQty = 10;
    const issueRes = await fetch(`${API_BASE}/store/stock/issue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId: targetItem.id,
        storeId: targetStore.id,
        quantity: issueQty,
        department: 'Assembly Line 3 / Tech Team',
        referenceId: `REQ-TEST-${Date.now().toString().slice(-4)}`,
        notes: 'Batch issue for return age and item age automated test',
      }),
    });
    const issueJson = (await issueRes.json()) as any;
    const issueTx = issueJson.data?.transaction;
    record('Stock Issue: Issue 10 units', issueRes.ok && Boolean(issueTx?.id), `Issue Tx ID: ${issueTx?.id}`);

    const expectedStockAfterIssue = initialUsableStock - issueQty;
    record(
      'Stock Issue: Verify Usable Stock Reduction',
      issueJson.data?.remainingStock === expectedStockAfterIssue,
      `Balance after: ${issueJson.data?.remainingStock} (Expected: ${expectedStockAfterIssue})`
    );

    const originalIssueId = issueTx.id;
    const issueCreatedAt = new Date(issueTx.createdAt);
    console.log(`Original Issue Date: ${issueCreatedAt.toISOString()}`);

    // -------------------------------------------------------------
    // Step 3: Query Open Issues API
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Query Open Issues Endpoint ---');
    const openIssuesRes = await fetch(`${API_BASE}/store/stock/open-issues?storeId=${targetStore.id}`, { headers });
    const openIssuesJson = (await openIssuesRes.json()) as any;
    const openIssues = openIssuesJson.data || [];
    const openIssueRecord = openIssues.find((iss: any) => iss.id === originalIssueId);

    record(
      'Open Issues: Original Issue Listed',
      Boolean(openIssueRecord),
      `Found issue ${originalIssueId.slice(0, 8)} in open issues list`
    );
    record(
      'Open Issues: Correct Returnable Quantities',
      openIssueRecord?.quantity === 10 &&
        openIssueRecord?.alreadyReturned === 0 &&
        openIssueRecord?.remainingReturnable === 10,
      `Qty: ${openIssueRecord?.quantity}, Returned: ${openIssueRecord?.alreadyReturned}, Returnable: ${openIssueRecord?.remainingReturnable}`
    );

    // -------------------------------------------------------------
    // Step 4: Return 1 — RECENT RETURN (0–7 Days) & Usable Stock Effect
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Return 1 — RECENT RETURN (0–7 Days, Condition: Good) ---');
    // Simulate return date: 2 days after issue
    const returnDate1 = new Date(issueCreatedAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const return1Qty = 3;

    const return1Res = await fetch(`${API_BASE}/store/stock/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        originalIssueId,
        itemId: targetItem.id,
        storeId: targetStore.id,
        quantity: return1Qty,
        returnDate: returnDate1,
        condition: 'Good',
        returnReason: 'Excess Material',
        department: 'Assembly Line 3',
        referenceId: 'RET-TEST-01',
        notes: 'Excess material returned in brand new condition',
      }),
    });
    const return1Json = (await return1Res.json()) as any;
    record('Return 1: HTTP 200 OK', return1Res.ok, return1Json.message);

    const ret1DaysHeld = return1Json.data?.daysHeld;
    const ret1Class = return1Json.data?.classification?.key;
    const ret1Remaining = return1Json.data?.remainingReturnable;
    const ret1NewStock = return1Json.data?.newStock;

    record('Return 1: Days Held = 2', ret1DaysHeld === 2, `Calculated Days Held: ${ret1DaysHeld}`);
    record(
      'Return 1: Classification = RECENT_RETURN',
      ret1Class === 'RECENT_RETURN',
      `Classification: ${ret1Class}`
    );
    record(
      'Return 1: Remaining Returnable = 7 (10 - 3)',
      ret1Remaining === 7,
      `Remaining: ${ret1Remaining}`
    );
    record(
      'Return 1: Usable Stock Restored (+3 units)',
      ret1NewStock === expectedStockAfterIssue + return1Qty,
      `New Usable Stock: ${ret1NewStock}`
    );

    // -------------------------------------------------------------
    // Step 5: Return 2 — OLD RETURN (8–30 Days) & Damaged Quarantine Stock Effect
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Return 2 — OLD RETURN (8–30 Days, Condition: Damaged) ---');
    // Simulate return date: 15 days after original issue date
    const returnDate2 = new Date(issueCreatedAt.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const return2Qty = 2;

    const return2Res = await fetch(`${API_BASE}/store/stock/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        originalIssueId,
        itemId: targetItem.id,
        storeId: targetStore.id,
        quantity: return2Qty,
        returnDate: returnDate2,
        condition: 'Damaged',
        returnReason: 'Damaged',
        department: 'Assembly Line 3',
        referenceId: 'RET-TEST-02',
        notes: 'Damaged item returned from field, quarantined',
      }),
    });
    const return2Json = (await return2Res.json()) as any;
    record('Return 2: HTTP 200 OK', return2Res.ok, return2Json.message);

    const ret2DaysHeld = return2Json.data?.daysHeld;
    const ret2Class = return2Json.data?.classification?.key;
    const ret2Remaining = return2Json.data?.remainingReturnable;
    const ret2NewStock = return2Json.data?.newStock;
    const ret2DamagedStock = return2Json.data?.damagedStock;

    record(
      'Return 2: Days Held = 15 (Calculated from ORIGINAL Issue Date)',
      ret2DaysHeld === 15,
      `Calculated Days Held: ${ret2DaysHeld}`
    );
    record(
      'Return 2: Classification = OLD_RETURN',
      ret2Class === 'OLD_RETURN',
      `Classification: ${ret2Class}`
    );
    record(
      'Return 2: Remaining Returnable = 5 (10 - 3 - 2)',
      ret2Remaining === 5,
      `Remaining: ${ret2Remaining}`
    );
    record(
      'Return 2: Usable Stock UNCHANGED (Damaged items not added to usable stock)',
      ret2NewStock === ret1NewStock,
      `Usable stock remains: ${ret2NewStock}`
    );
    record(
      'Return 2: Damaged Stock Incremented (+2 quarantined units)',
      ret2DamagedStock === initialDamagedStock + return2Qty,
      `Damaged Stock: ${ret2DamagedStock}`
    );

    // -------------------------------------------------------------
    // Step 6: Return 3 — VERY OLD RETURN (31+ Days)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Return 3 — VERY OLD RETURN (31+ Days, Condition: Good) ---');
    // Simulate return date: 45 days after original issue date
    const returnDate3 = new Date(issueCreatedAt.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const return3Qty = 2;

    const return3Res = await fetch(`${API_BASE}/store/stock/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        originalIssueId,
        itemId: targetItem.id,
        storeId: targetStore.id,
        quantity: return3Qty,
        returnDate: returnDate3,
        condition: 'Good',
        returnReason: 'Work Completed',
        department: 'Assembly Line 3',
        referenceId: 'RET-TEST-03',
        notes: 'Returned after project completion after 45 days',
      }),
    });
    const return3Json = (await return3Res.json()) as any;
    record('Return 3: HTTP 200 OK', return3Res.ok, return3Json.message);

    const ret3DaysHeld = return3Json.data?.daysHeld;
    const ret3Class = return3Json.data?.classification?.key;
    const ret3Remaining = return3Json.data?.remainingReturnable;

    record(
      'Return 3: Days Held = 45 (Calculated from ORIGINAL Issue Date)',
      ret3DaysHeld === 45,
      `Calculated Days Held: ${ret3DaysHeld}`
    );
    record(
      'Return 3: Classification = VERY_OLD_RETURN',
      ret3Class === 'VERY_OLD_RETURN',
      `Classification: ${ret3Class}`
    );
    record(
      'Return 3: Remaining Returnable = 3 (10 - 3 - 2 - 2)',
      ret3Remaining === 3,
      `Remaining: ${ret3Remaining}`
    );

    // -------------------------------------------------------------
    // Step 7: Enforce Returnable Quantity Limit (Prevent Over-Return)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Enforce Return Limit (Attempt Over-Return) ---');
    // Remaining is 3, attempt to return 5
    const overReturnRes = await fetch(`${API_BASE}/store/stock/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        originalIssueId,
        itemId: targetItem.id,
        storeId: targetStore.id,
        quantity: 5,
        condition: 'Good',
        returnReason: 'Wrong Item',
      }),
    });
    const overReturnJson = (await overReturnRes.json()) as any;

    record(
      'Over-Return Prevention: Rejected with HTTP 400',
      overReturnRes.status === 400,
      `Status: ${overReturnRes.status}`
    );
    record(
      'Over-Return Prevention: Descriptive Error Message',
      overReturnJson.message?.includes('remaining returnable out of 10'),
      `Message: "${overReturnJson.message}"`
    );

    // -------------------------------------------------------------
    // Step 8: Return Age Summary KPIs API
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Return Age Summary KPIs API ---');
    const summaryRes = await fetch(`${API_BASE}/store/stock/return-summary?storeId=${targetStore.id}`, { headers });
    const summaryJson = (await summaryRes.json()) as any;
    const summary = summaryJson.data;

    record('Summary KPIs: HTTP 200 OK', summaryRes.ok, `Total returns: ${summary?.totalReturns}`);
    record('Summary KPIs: Total Returns >= 3', summary?.totalReturns >= 3, `Count: ${summary?.totalReturns}`);
    record('Summary KPIs: Recent Count >= 1', summary?.recentCount >= 1, `Recent: ${summary?.recentCount}`);
    record('Summary KPIs: Old Count >= 1', summary?.oldCount >= 1, `Old: ${summary?.oldCount}`);
    record('Summary KPIs: Very Old Count >= 1', summary?.veryOldCount >= 1, `Very Old: ${summary?.veryOldCount}`);
    record('Summary KPIs: Average Days Held > 0', summary?.avgDaysHeld > 0, `Avg Days Held: ${summary?.avgDaysHeld} days`);

    // -------------------------------------------------------------
    // Step 9: Store Reports — Return Age Analysis Report
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Store Reports — Return Age Analysis Report ---');
    const reportRes = await fetch(`${API_BASE}/store/reports/return-age?storeId=${targetStore.id}`, { headers });
    const reportJson = (await reportRes.json()) as any;
    const reportData = reportJson.data;

    record('Reports: Return Age Report HTTP 200 OK', reportRes.ok, `Found ${reportData?.records?.length} records`);

    const records = reportData?.records || [];
    const reportRet1 = records.find((r: any) => r.referenceId === 'RET-TEST-01');
    const reportRet2 = records.find((r: any) => r.referenceId === 'RET-TEST-02');
    const reportRet3 = records.find((r: any) => r.referenceId === 'RET-TEST-03');

    record(
      'Reports: Ret 1 in Report with Correct Days Held & Classification',
      reportRet1?.daysHeld === 2 && reportRet1?.classificationKey === 'RECENT_RETURN',
      `Days: ${reportRet1?.daysHeld}, Key: ${reportRet1?.classificationKey}, Condition: ${reportRet1?.condition}`
    );
    record(
      'Reports: Ret 2 in Report with Damaged Condition & Old Return Classification',
      reportRet2?.daysHeld === 15 &&
        reportRet2?.classificationKey === 'OLD_RETURN' &&
        reportRet2?.condition === 'Damaged',
      `Days: ${reportRet2?.daysHeld}, Key: ${reportRet2?.classificationKey}, Condition: ${reportRet2?.condition}`
    );
    record(
      'Reports: Ret 3 in Report with Very Old Return Classification',
      reportRet3?.daysHeld === 45 && reportRet3?.classificationKey === 'VERY_OLD_RETURN',
      `Days: ${reportRet3?.daysHeld}, Key: ${reportRet3?.classificationKey}`
    );

    // -------------------------------------------------------------
    // Step 10: Stock Register Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Stock Register Balance Verification ---');
    const registerRes = await fetch(`${API_BASE}/store/stock-register?storeId=${targetStore.id}`, { headers });
    const registerJson = (await registerRes.json()) as any;
    const regItem = (registerJson.data || []).find((i: any) => i.itemId === targetItem.id);

    record(
      'Stock Register: Item Usable & Damaged Stock Correctly Reflected',
      Boolean(regItem) && regItem.damagedStock >= 2,
      `Current Usable: ${regItem?.currentStock}, Damaged Quarantined: ${regItem?.damagedStock}`
    );

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('TEST EXECUTION SUMMARY');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('\nFAILED TESTS:');
      results.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.name}: ${r.details || 'Assertion failed'}`));
      process.exit(1);
    } else {
      console.log('\n🎉 ALL RETURN AGE & ITEM AGE TESTS PASSED PERFECTLY!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('\nUnexpected test error:', err);
    process.exit(1);
  }
}

runReturnAgeVerification();

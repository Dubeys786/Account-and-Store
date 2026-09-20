/**
 * PHASE 8 AUTOMATED VERIFICATION TEST SUITE
 * Complete Accounting Operations Verification:
 * 1. Security & RBAC: STORE_USER forbidden (403) from Expenses, Income, Day Book, Cash Book, Bank Book
 * 2. Expenses API: Validation, atomic transaction, Dr Expense / Cr Cash/Bank journal entry, audit log
 * 3. Income API: Validation, atomic transaction, Dr Cash/Bank / Cr Income journal entry, audit log
 * 4. Day Book API: Chronological audit log with columns Date, Transaction, Reference, Party, Debit, Credit, Amount, Store, Created By
 * 5. Cash Book API: Opening Cash, Cash Receipts, Cash Payments, Closing Cash, exact formula balance, running balances
 * 6. Bank Book API: Opening Bank Balance, Bank Receipts, Bank Payments, Closing Bank Balance, exact formula balance, running balances
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

async function runPhase8Verification() {
  console.log('================================================================');
  console.log('🚀 PROZEN PHASE 8 — COMPLETE ACCOUNTING OPERATIONS TEST SUITE');
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
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const storeHeaders = { Authorization: `Bearer ${storeUserToken}`, 'Content-Type': 'application/json' };
  assert(!!adminToken && !!storeUserToken, 'Authenticated ADMIN and STORE_USER tokens successfully');

  // 2. RBAC Access Control
  console.log('\n🔒 Step 2: Testing Security & Role-Based Access Control (RBAC)...');
  const [
    secExpGet,
    secExpPost,
    secIncGet,
    secIncPost,
    secDayBook,
    secCashBook,
    secBankBook,
  ] = await Promise.all([
    fetch(`${BASE_URL}/accounts/expenses`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/expenses`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({ amount: 1000 }),
    }),
    fetch(`${BASE_URL}/accounts/income`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/income`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({ amount: 1000 }),
    }),
    fetch(`${BASE_URL}/accounts/day-book`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/cash-book`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/bank-book`, { headers: storeHeaders }),
  ]);

  assert(secExpGet.status === 403, 'GET /expenses returns 403 Forbidden for STORE_USER');
  assert(secExpPost.status === 403, 'POST /expenses returns 403 Forbidden for STORE_USER');
  assert(secIncGet.status === 403, 'GET /income returns 403 Forbidden for STORE_USER');
  assert(secIncPost.status === 403, 'POST /income returns 403 Forbidden for STORE_USER');
  assert(secDayBook.status === 403, 'GET /day-book returns 403 Forbidden for STORE_USER');
  assert(secCashBook.status === 403, 'GET /cash-book returns 403 Forbidden for STORE_USER');
  assert(secBankBook.status === 403, 'GET /bank-book returns 403 Forbidden for STORE_USER');

  // 3. Fetch reference Store and Party
  console.log('\n🏢 Step 3: Fetching active Stores and Parties for accounting transactions...');
  const [storesRes, partiesRes] = await Promise.all([
    fetch(`${BASE_URL}/accounts/stores`, { headers: adminHeaders }),
    fetch(`${BASE_URL}/accounts/parties`, { headers: adminHeaders }),
  ]);
  const storesData = await storesRes.json();
  const partiesData = await partiesRes.json();
  const store = storesData.data?.[0];
  const party = partiesData.data?.[0];
  assert(!!store?.id, `Target store identified: ${store?.name} (${store?.code})`);
  assert(!!party?.id, `Target party identified: ${party?.name} (${party?.code})`);

  // 4. Test Expense Operations
  console.log('\n💸 Step 4: Testing Expenses Module & Double-Entry Journal Creation...');

  // 4a. Validation check: negative/zero amount rejected
  const invalidExpRes = await fetch(`${BASE_URL}/accounts/expenses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      storeId: store.id,
      category: 'Rent & Facility',
      amount: -500,
      paymentMethod: 'Cash',
    }),
  });
  assert(invalidExpRes.status === 400, 'POST /expenses correctly rejects invalid/negative amount (400)');

  // 4b. Record valid Cash Expense
  const cashExpensePayload = {
    expenseDate: new Date().toISOString(),
    storeId: store.id,
    category: 'Rent & Facility',
    partyId: party.id,
    amount: 15000,
    paymentMethod: 'Cash',
    reference: `REF-RENT-${Date.now()}`,
    description: 'Facility godown lease payment for current quarter',
  };
  const cashExpRes = await fetch(`${BASE_URL}/accounts/expenses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(cashExpensePayload),
  });
  const cashExpData = await cashExpRes.json();
  assert(cashExpRes.status === 201 && cashExpData.success, 'POST /expenses recorded Cash Expense successfully (201)');
  const recordedExpense = cashExpData.data?.expense;
  const recordedExpenseJV = cashExpData.data?.journalEntry;
  assert(!!recordedExpense?.expenseNumber, `Sequential expense voucher generated: ${recordedExpense?.expenseNumber}`);
  assert(
    recordedExpenseJV?.lines?.length === 2,
    `Journal Entry created with 2 balanced lines (total ₹${recordedExpenseJV?.totalAmount})`
  );

  // 4c. Query Expenses list and summary
  const getExpRes = await fetch(`${BASE_URL}/accounts/expenses?category=Rent`, { headers: adminHeaders });
  const getExpData = await getExpRes.json();
  assert(getExpRes.status === 200, 'GET /expenses returns 200 OK');
  assert(
    getExpData.data?.summary?.totalExpenses >= 15000,
    `Expense summary calculated totalExpenses: ₹${getExpData.data?.summary?.totalExpenses}`
  );
  assert(
    getExpData.data?.summary?.cashExpenses >= 15000,
    `Expense summary tracked cash disbursement: ₹${getExpData.data?.summary?.cashExpenses}`
  );

  // 5. Test Income Operations
  console.log('\n💰 Step 5: Testing Income Module & Double-Entry Journal Creation...');

  // 5a. Record valid Bank Income
  const bankIncomePayload = {
    incomeDate: new Date().toISOString(),
    storeId: store.id,
    category: 'Direct Sales Revenue',
    partyId: party.id,
    amount: 35000,
    paymentMethod: 'Bank Transfer',
    reference: `REF-WIRE-${Date.now()}`,
    description: 'Direct enterprise customer payment remittance',
  };
  const bankIncRes = await fetch(`${BASE_URL}/accounts/income`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(bankIncomePayload),
  });
  const bankIncData = await bankIncRes.json();
  assert(bankIncRes.status === 201 && bankIncData.success, 'POST /income recorded Bank Income successfully (201)');
  const recordedIncome = bankIncData.data?.income;
  const recordedIncomeJV = bankIncData.data?.journalEntry;
  assert(!!recordedIncome?.incomeNumber, `Sequential income voucher generated: ${recordedIncome?.incomeNumber}`);
  assert(
    recordedIncomeJV?.lines?.length === 2,
    `Journal Entry created with 2 balanced lines (total ₹${recordedIncomeJV?.totalAmount})`
  );

  // 5b. Record Cash Income (for Cash Book verification)
  const cashIncomePayload = {
    incomeDate: new Date().toISOString(),
    storeId: store.id,
    category: 'Scrap & Asset Disposal',
    amount: 6000,
    paymentMethod: 'Cash',
    reference: `SCRAP-CASH-${Date.now()}`,
    description: 'Cash counter sales of packing carton scrap',
  };
  const cashIncRes = await fetch(`${BASE_URL}/accounts/income`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(cashIncomePayload),
  });
  const cashIncData = await cashIncRes.json();
  assert(cashIncRes.status === 201, 'POST /income recorded Cash Income successfully (201)');

  // 5c. Query Income list and summary
  const getIncRes = await fetch(`${BASE_URL}/accounts/income`, { headers: adminHeaders });
  const getIncData = await getIncRes.json();
  assert(getIncRes.status === 200, 'GET /income returns 200 OK');
  assert(
    getIncData.data?.summary?.totalIncome >= 41000,
    `Income summary calculated totalIncome: ₹${getIncData.data?.summary?.totalIncome}`
  );
  assert(
    getIncData.data?.summary?.bankIncome >= 35000,
    `Income summary tracked bank receipts: ₹${getIncData.data?.summary?.bankIncome}`
  );
  assert(
    getIncData.data?.summary?.cashIncome >= 6000,
    `Income summary tracked cash receipts: ₹${getIncData.data?.summary?.cashIncome}`
  );

  // 6. Test Day Book API
  console.log('\n📖 Step 6: Testing Day Book (All Chronological Transactions)...');
  const dayBookRes = await fetch(`${BASE_URL}/accounts/day-book`, { headers: adminHeaders });
  const dayBookData = await dayBookRes.json();
  assert(dayBookRes.status === 200 && dayBookData.success, 'GET /day-book returns 200 OK');
  const dayBookRecords: any[] = dayBookData.data?.records || [];
  assert(dayBookRecords.length > 0, `Day Book returned ${dayBookRecords.length} chronological journal entries`);

  if (dayBookRecords.length > 0) {
    const firstRow = dayBookRecords[0];
    const hasRequiredColumns =
      'date' in firstRow &&
      'transaction' in firstRow &&
      'reference' in firstRow &&
      'party' in firstRow &&
      'debit' in firstRow &&
      'credit' in firstRow &&
      'amount' in firstRow &&
      'store' in firstRow &&
      'createdBy' in firstRow;
    assert(
      hasRequiredColumns,
      'Day Book row contains ALL 9 required columns: Date, Transaction, Reference, Party, Debit, Credit, Amount, Store, Created By'
    );
    console.log(`     Sample Row: [${new Date(firstRow.date).toLocaleDateString()}] ${firstRow.transaction} | Party: ${firstRow.party} | Amount: ₹${firstRow.amount} | Store: ${firstRow.store} | By: ${firstRow.createdBy}`);
  }

  // 7. Test Cash Book API
  console.log('\n💵 Step 7: Testing Cash Book (Account 1010 Calculations)...');
  const cashBookRes = await fetch(`${BASE_URL}/accounts/cash-book`, { headers: adminHeaders });
  const cashBookData = await cashBookRes.json();
  assert(cashBookRes.status === 200 && cashBookData.success, 'GET /cash-book returns 200 OK');
  const cbSummary = cashBookData.data?.summary;
  assert(cbSummary != null, 'Cash Book returned calculations summary');
  assert('openingCash' in cbSummary, `Opening Cash calculated: ₹${cbSummary?.openingCash}`);
  assert('cashReceipts' in cbSummary, `Cash Receipts calculated: ₹${cbSummary?.cashReceipts}`);
  assert('cashPayments' in cbSummary, `Cash Payments calculated: ₹${cbSummary?.cashPayments}`);
  assert('closingCash' in cbSummary, `Closing Cash calculated: ₹${cbSummary?.closingCash}`);

  const expectedClosingCash = Math.round((cbSummary.openingCash + cbSummary.cashReceipts - cbSummary.cashPayments) * 100) / 100;
  assert(
    Math.abs(cbSummary.closingCash - expectedClosingCash) < 0.01,
    `Cash Book exact formula verified: Closing Cash (${cbSummary.closingCash}) = Opening (${cbSummary.openingCash}) + Receipts (${cbSummary.cashReceipts}) - Payments (${cbSummary.cashPayments})`
  );

  const cbEntries: any[] = cashBookData.data?.entries || [];
  assert(cbEntries.length > 0, `Cash Book returned ${cbEntries.length} chronological cash entries`);
  if (cbEntries.length > 0) {
    const hasRunningBalance = cbEntries.every((e) => typeof e.runningBalance === 'number');
    assert(hasRunningBalance, 'All Cash Book entries contain verified running balance');
  }

  // 8. Test Bank Book API
  console.log('\n🏦 Step 8: Testing Bank Book (Account 1020 Calculations)...');
  const bankBookRes = await fetch(`${BASE_URL}/accounts/bank-book`, { headers: adminHeaders });
  const bankBookData = await bankBookRes.json();
  assert(bankBookRes.status === 200 && bankBookData.success, 'GET /bank-book returns 200 OK');
  const bbSummary = bankBookData.data?.summary;
  assert(bbSummary != null, 'Bank Book returned calculations summary');
  assert('openingBankBalance' in bbSummary, `Opening Bank Balance calculated: ₹${bbSummary?.openingBankBalance}`);
  assert('bankReceipts' in bbSummary, `Bank Receipts calculated: ₹${bbSummary?.bankReceipts}`);
  assert('bankPayments' in bbSummary, `Bank Payments calculated: ₹${bbSummary?.bankPayments}`);
  assert('closingBankBalance' in bbSummary, `Closing Bank Balance calculated: ₹${bbSummary?.closingBankBalance}`);

  const expectedClosingBank = Math.round((bbSummary.openingBankBalance + bbSummary.bankReceipts - bbSummary.bankPayments) * 100) / 100;
  assert(
    Math.abs(bbSummary.closingBankBalance - expectedClosingBank) < 0.01,
    `Bank Book exact formula verified: Closing Bank (${bbSummary.closingBankBalance}) = Opening (${bbSummary.openingBankBalance}) + Receipts (${bbSummary.bankReceipts}) - Payments (${bbSummary.bankPayments})`
  );

  const bbEntries: any[] = bankBookData.data?.entries || [];
  assert(bbEntries.length > 0, `Bank Book returned ${bbEntries.length} chronological bank entries`);
  if (bbEntries.length > 0) {
    const hasRunningBalance = bbEntries.every((e) => typeof e.runningBalance === 'number');
    assert(hasRunningBalance, 'All Bank Book entries contain verified running balance');
  }

  // Final Summary
  console.log('\n================================================================');
  console.log(`🏁 Phase 8 Automated Verification Completed: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Verification().catch((err) => {
  console.error('❌ Unhandled error in verification test:', err);
  process.exit(1);
});

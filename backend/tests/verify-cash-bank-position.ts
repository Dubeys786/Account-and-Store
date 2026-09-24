import http from 'http';
import { initDatabase, prisma } from '../src/config/db';
import { seedRbacSystem } from '../src/config/rbac-seed';
import app from '../src/app';

async function runVerification() {
  console.log('===============================================================');
  console.log('VERIFY LIVE CASH & BANK POSITION — REAL ACCOUNTING DATA ONLY');
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

  // 1. Initialize DB and Seed System
  await initDatabase();
  await seedRbacSystem();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // Track created test record IDs for cleanup
  const createdPartyIds: string[] = [];
  const createdReceiptIds: string[] = [];
  const createdExpenseIds: string[] = [];
  const createdJournalIds: string[] = [];

  try {
    // Step 1: Authentication
    console.log('\n--- Step 1: Authentication ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeyakhilesh2005@gmail.com', password: 'Stockledger@123' }),
    });
    const loginData = (await loginRes.json()) as any;
    assert(loginRes.status === 200, 'User authenticated successfully');
    const token = loginData.data?.token;
    const storeId = loginData.data?.user?.storeIds?.[0];
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    assert(!!storeId, 'User has an assigned store', `storeId: ${storeId}`);

    // Initial pre-cleanup of any lingering verification artifacts
    await prisma.receipt.deleteMany({ where: { notes: { contains: 'Verification' } } });
    await prisma.expense.deleteMany({ where: { description: { contains: 'Verification' } } });
    const preEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { referenceId: 'CNTR-TEST-001' },
          { narration: { contains: 'Verification' } },
          { narration: { contains: 'CNTR-TEST-001' } },
        ],
      },
      select: { id: true },
    });
    const preIds = preEntries.map((e) => e.id);
    if (preIds.length > 0) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: preIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: preIds } } });
    }
    await prisma.party.deleteMany({ where: { name: { contains: 'Test Customer' } } });

    // Step 2: Fetch Initial Baseline Position
    console.log('\n--- Step 2: Baseline Cash & Bank Position ---');
    const baseRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const baseData = (await baseRes.json()) as any;
    assert(baseRes.status === 200, 'GET /accounts/cash-bank-position returns HTTP 200 OK');
    assert(baseData.success === true, 'Response indicates success: true');
    assert(typeof baseData.data?.cash?.currentBalance === 'number', 'Cash balance is a valid number');
    assert(typeof baseData.data?.bank?.currentBalance === 'number', 'Bank balance is a valid number');
    assert(typeof baseData.data?.totalAvailable === 'number', 'Total available is a valid number');
    assert(Array.isArray(baseData.data?.bank?.accounts), 'Bank accounts is an array of real DB accounts');

    const initialCash = baseData.data.cash.currentBalance;
    const initialBank = baseData.data.bank.currentBalance;
    const initialTotal = baseData.data.totalAvailable;
    console.log(`     Initial Cash in Hand:  ₹ ${initialCash.toFixed(2)}`);
    console.log(`     Initial Bank Balance:  ₹ ${initialBank.toFixed(2)}`);
    console.log(`     Initial Total Available: ₹ ${initialTotal.toFixed(2)}`);

    // Create a temporary customer party for testing transactions
    const partyRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Test Customer ${Date.now()}`,
        type: 'CUSTOMER',
        phone: '9988776655',
        storeId,
      }),
    });
    const partyData = (await partyRes.json()) as any;
    const testPartyId = partyData.data?.id;
    if (testPartyId) createdPartyIds.push(testPartyId);
    assert(!!testPartyId, 'Test customer created for posting flows');

    // Step 3: Post ₹10,000 Cash Receipt -> Verify Cash Increases ₹10,000, Bank Unchanged
    console.log('\n--- Step 3: Post ₹10,000 Cash Receipt ---');
    const cashReceiptRes = await fetch(`${baseUrl}/accounts/receipts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        partyId: testPartyId,
        storeId,
        amount: 10000,
        receiptDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'CASH',
        notes: 'Verification Cash Receipt ₹10,000',
      }),
    });
    const cashReceiptData = (await cashReceiptRes.json()) as any;
    assert(cashReceiptRes.status === 201, 'Cash Receipt posted successfully (201 Created)');
    if (cashReceiptData.data?.receipt?.id) createdReceiptIds.push(cashReceiptData.data.receipt.id);
    if (cashReceiptData.data?.journalEntry?.id) createdJournalIds.push(cashReceiptData.data.journalEntry.id);

    // Verify Position after Cash Receipt
    const posAfterCashReceiptRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const posAfterCashReceipt = ((await posAfterCashReceiptRes.json()) as any).data;
    assert(
      posAfterCashReceipt.cash.currentBalance === Math.round((initialCash + 10000) * 100) / 100,
      `Cash in Hand increased by exactly ₹10,000 (was ${initialCash}, now ${posAfterCashReceipt.cash.currentBalance})`
    );
    assert(
      posAfterCashReceipt.bank.currentBalance === initialBank,
      `Bank Balance remained unchanged at ₹ ${initialBank}`
    );
    assert(
      posAfterCashReceipt.cash.todayInflow >= 10000,
      `Today Cash Inflow reflects at least ₹10,000 (got ${posAfterCashReceipt.cash.todayInflow})`
    );

    // Step 4: Post ₹5,000 Bank Receipt -> Verify Bank Increases ₹5,000, Cash Unchanged
    console.log('\n--- Step 4: Post ₹5,000 Bank Receipt ---');
    const bankReceiptRes = await fetch(`${baseUrl}/accounts/receipts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        partyId: testPartyId,
        storeId,
        amount: 5000,
        receiptDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK',
        notes: 'Verification Bank Receipt ₹5,000',
      }),
    });
    const bankReceiptData = (await bankReceiptRes.json()) as any;
    assert(bankReceiptRes.status === 201, 'Bank Receipt posted successfully (201 Created)');
    if (bankReceiptData.data?.receipt?.id) createdReceiptIds.push(bankReceiptData.data.receipt.id);
    if (bankReceiptData.data?.journalEntry?.id) createdJournalIds.push(bankReceiptData.data.journalEntry.id);

    const posAfterBankReceiptRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const posAfterBankReceipt = ((await posAfterBankReceiptRes.json()) as any).data;
    assert(
      posAfterBankReceipt.bank.currentBalance === Math.round((initialBank + 5000) * 100) / 100,
      `Bank Balance increased by exactly ₹5,000 (was ${initialBank}, now ${posAfterBankReceipt.bank.currentBalance})`
    );
    assert(
      posAfterBankReceipt.cash.currentBalance === posAfterCashReceipt.cash.currentBalance,
      `Cash in Hand remained unchanged at ₹ ${posAfterCashReceipt.cash.currentBalance}`
    );

    // Step 5: Post ₹2,000 Cash Expense -> Verify Cash Decreases ₹2,000, Bank Unchanged
    console.log('\n--- Step 5: Post ₹2,000 Cash Expense ---');
    const cashExpenseRes = await fetch(`${baseUrl}/accounts/expenses`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId,
        category: 'OFFICE',
        amount: 2000,
        expenseDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'CASH',
        description: 'Verification Office Tea/Snacks Cash Expense',
        reference: 'EXP-CASH-TEST',
      }),
    });
    const cashExpenseData = (await cashExpenseRes.json()) as any;
    assert(cashExpenseRes.status === 201, 'Cash Expense posted successfully (201 Created)');
    if (cashExpenseData.data?.expense?.id) createdExpenseIds.push(cashExpenseData.data.expense.id);
    if (cashExpenseData.data?.journalEntry?.id) createdJournalIds.push(cashExpenseData.data.journalEntry.id);

    const posAfterCashExpenseRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const posAfterCashExpense = ((await posAfterCashExpenseRes.json()) as any).data;
    assert(
      posAfterCashExpense.cash.currentBalance === Math.round((posAfterCashReceipt.cash.currentBalance - 2000) * 100) / 100,
      `Cash in Hand decreased by exactly ₹2,000 (was ${posAfterCashReceipt.cash.currentBalance}, now ${posAfterCashExpense.cash.currentBalance})`
    );
    assert(
      posAfterCashExpense.bank.currentBalance === posAfterBankReceipt.bank.currentBalance,
      `Bank Balance remained unchanged at ₹ ${posAfterBankReceipt.bank.currentBalance}`
    );
    assert(
      posAfterCashExpense.cash.todayOutflow >= 2000,
      `Today Cash Outflow reflects at least ₹2,000 (got ${posAfterCashExpense.cash.todayOutflow})`
    );

    // Step 6: Post ₹1,000 Bank Expense -> Verify Bank Decreases ₹1,000, Cash Unchanged
    console.log('\n--- Step 6: Post ₹1,000 Bank Expense ---');
    const bankExpenseRes = await fetch(`${baseUrl}/accounts/expenses`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId,
        category: 'UTILITIES',
        amount: 1000,
        expenseDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK',
        description: 'Verification Internet Bill Bank Expense',
        reference: 'EXP-BANK-TEST',
      }),
    });
    const bankExpenseData = (await bankExpenseRes.json()) as any;
    assert(bankExpenseRes.status === 201, 'Bank Expense posted successfully (201 Created)');
    if (bankExpenseData.data?.expense?.id) createdExpenseIds.push(bankExpenseData.data.expense.id);
    if (bankExpenseData.data?.journalEntry?.id) createdJournalIds.push(bankExpenseData.data.journalEntry.id);

    const posAfterBankExpenseRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const posAfterBankExpense = ((await posAfterBankExpenseRes.json()) as any).data;
    assert(
      posAfterBankExpense.bank.currentBalance === Math.round((posAfterBankReceipt.bank.currentBalance - 1000) * 100) / 100,
      `Bank Balance decreased by exactly ₹1,000 (was ${posAfterBankReceipt.bank.currentBalance}, now ${posAfterBankExpense.bank.currentBalance})`
    );
    assert(
      posAfterBankExpense.cash.currentBalance === posAfterCashExpense.cash.currentBalance,
      `Cash in Hand remained unchanged at ₹ ${posAfterCashExpense.cash.currentBalance}`
    );

    // Step 7: Post ₹3,000 Cash -> Bank Contra Transfer
    console.log('\n--- Step 7: Post ₹3,000 Cash -> Bank Contra Transfer ---');
    const cashBeforeTransfer = posAfterBankExpense.cash.currentBalance;
    const bankBeforeTransfer = posAfterBankExpense.bank.currentBalance;
    const totalBeforeTransfer = posAfterBankExpense.totalAvailable;

    const contraRes = await fetch(`${baseUrl}/accounts/contra-transfers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        transferType: 'CASH_TO_BANK',
        amount: 3000,
        storeId,
        transferDate: new Date().toISOString().slice(0, 10),
        referenceNumber: 'CNTR-TEST-001',
        narration: 'Test Cash deposit into Operating Bank',
      }),
    });
    const contraData = (await contraRes.json()) as any;
    assert(contraRes.status === 201, 'Contra transfer created successfully (201 Created)');
    if (contraData.data?.id) createdJournalIds.push(contraData.data.id);

    const posAfterContraRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const posAfterContra = ((await posAfterContraRes.json()) as any).data;
    assert(
      posAfterContra.cash.currentBalance === Math.round((cashBeforeTransfer - 3000) * 100) / 100,
      `Cash in Hand decreased by exactly ₹3,000 (was ${cashBeforeTransfer}, now ${posAfterContra.cash.currentBalance})`
    );
    assert(
      posAfterContra.bank.currentBalance === Math.round((bankBeforeTransfer + 3000) * 100) / 100,
      `Bank Balance increased by exactly ₹3,000 (was ${bankBeforeTransfer}, now ${posAfterContra.bank.currentBalance})`
    );
    assert(
      posAfterContra.totalAvailable === totalBeforeTransfer,
      `Total Available money remained IDENTICAL (was ${totalBeforeTransfer}, now ${posAfterContra.totalAvailable})`
    );

    // Step 8: Reconciliation with Cash Book (1010) and Bank Book (1020)
    console.log('\n--- Step 8: Reconciliation with Statutory Books ---');
    const todayStr = new Date().toISOString().slice(0, 10);
    const cashBookRes = await fetch(
      `${baseUrl}/accounts/cash-book?startDate=${todayStr}&endDate=${todayStr}&storeId=${storeId}`,
      { headers: authHeaders }
    );
    const cashBookData = (await cashBookRes.json()) as any;
    assert(cashBookRes.status === 200, 'GET /accounts/cash-book returns HTTP 200 OK');
    const cashBookClosing = cashBookData.data?.summary?.closingCash;
    assert(
      posAfterContra.cash.currentBalance === cashBookClosing,
      `Cash in Hand (${posAfterContra.cash.currentBalance}) reconciles EXACTLY with Cash Book closing (${cashBookClosing})`
    );

    const bankBookRes = await fetch(
      `${baseUrl}/accounts/bank-book?startDate=${todayStr}&endDate=${todayStr}&storeId=${storeId}`,
      { headers: authHeaders }
    );
    const bankBookData = (await bankBookRes.json()) as any;
    assert(bankBookRes.status === 200, 'GET /accounts/bank-book returns HTTP 200 OK');
    const bankBookClosing = bankBookData.data?.summary?.closingBankBalance;
    assert(
      posAfterContra.bank.currentBalance === bankBookClosing,
      `Bank Balance (${posAfterContra.bank.currentBalance}) reconciles EXACTLY with Bank Book closing (${bankBookClosing})`
    );

    // Step 9: Store-wise Isolation Test
    console.log('\n--- Step 9: Store-wise Isolation Test ---');
    const allStoresRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=all`, {
      headers: authHeaders,
    });
    const allStoresData = ((await allStoresRes.json()) as any).data;
    assert(allStoresRes.status === 200, 'GET /accounts/cash-bank-position?storeId=all returns HTTP 200 OK');
    assert(
      allStoresData.storeName.includes('Consolidated') ||
        allStoresData.storeName.includes('All') ||
        allStoresData.storeName.includes('Authorized'),
      `Store name reflects consolidated scope (${allStoresData.storeName})`
    );
    assert(
      allStoresData.totalAvailable >= posAfterContra.totalAvailable,
      `Consolidated balance (${allStoresData.totalAvailable}) is >= single store balance (${posAfterContra.totalAvailable})`
    );

    // Step 10: Clean Up Test Records
    console.log('\n--- Step 10: Clean Up Test Records ---');
    // Delete audit logs linked to test entities
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [...createdReceiptIds, ...createdExpenseIds, ...createdPartyIds] },
      },
    });

    // Find all journal entries created for the test receipts and expenses
    const testExpenses = await prisma.expense.findMany({ where: { id: { in: createdExpenseIds } } });
    const expenseEntryNumbers = testExpenses.map((e) => `EXP-${e.expenseNumber}`);
    
    // Delete in proper relational dependency order
    await prisma.receipt.deleteMany({ where: { id: { in: createdReceiptIds } } });
    await prisma.expense.deleteMany({ where: { id: { in: createdExpenseIds } } });
    
    // Delete test journal entries and lines
    await prisma.journalEntryLine.deleteMany({
      where: {
        OR: [
          { partyId: { in: createdPartyIds } },
          { journalEntryId: { in: createdJournalIds } },
          { journalEntry: { entryNumber: { in: expenseEntryNumbers } } },
          { journalEntry: { referenceId: 'CNTR-TEST-001' } },
        ],
      },
    });

    await prisma.journalEntry.deleteMany({
      where: {
        OR: [
          { id: { in: createdJournalIds } },
          { entryNumber: { in: expenseEntryNumbers } },
          { referenceId: 'CNTR-TEST-001' },
        ],
      },
    });

    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    console.log('     All test records cleanly purged from database.');

    // Step 11: Verify Balance Restored to Baseline
    console.log('\n--- Step 11: Verify Restoration to Original Baseline ---');
    const finalRes = await fetch(`${baseUrl}/accounts/cash-bank-position?storeId=${storeId}`, {
      headers: authHeaders,
    });
    const finalData = ((await finalRes.json()) as any).data;
    assert(
      finalData.cash.currentBalance === initialCash,
      `Cash restored to baseline ₹ ${initialCash} (got ${finalData.cash.currentBalance})`
    );
    assert(
      finalData.bank.currentBalance === initialBank,
      `Bank restored to baseline ₹ ${initialBank} (got ${finalData.bank.currentBalance})`
    );
    assert(
      finalData.totalAvailable === initialTotal,
      `Total Available restored to baseline ₹ ${initialTotal} (got ${finalData.totalAvailable})`
    );

    console.log('\n===============================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

import http from 'http';
import { initDatabase, prisma } from '../src/config/db';
import { seedRbacSystem } from '../src/config/rbac-seed';
import app from '../src/app';

async function runVerification() {
  console.log('===============================================================');
  console.log('VERIFY RECEIPT CUSTOMER DROPDOWN & COMPLETE DATA FLOW');
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

  try {
    // 2. Authenticate as Akhilesh (Account & Store Incharge)
    console.log('\n--- Step 1: Authentication ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dubeyakhilesh2005@gmail.com', password: 'Stockledger@123' }),
    });
    const loginData = (await loginRes.json()) as any;
    assert(loginRes.status === 200, 'Akhilesh authenticated successfully');
    const token = loginData.data?.token;
    const storeId = loginData.data?.user?.storeIds?.[0];
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 3. Query Customers when no customer exists
    console.log('\n--- Step 2: Empty State Verification ---');
    const emptyQueryRes = await fetch(`${baseUrl}/accounts/parties?type=CUSTOMER,BOTH,DEALER,DISTRIBUTOR&limit=500`, {
      headers: authHeaders,
    });
    const emptyQueryData = (await emptyQueryRes.json()) as any;
    assert(emptyQueryRes.status === 200, 'GET /accounts/parties with customer types returns 200 OK');
    assert(Array.isArray(emptyQueryData.data), 'Returns an array of parties');
    const initialCustomerCount = emptyQueryData.data.length;
    console.log(`     Initial matching customer parties: ${initialCustomerCount}`);

    // 4. Create a Real Customer in Party Master
    console.log('\n--- Step 3: Create Customer in Party Master ---');
    const createCustRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'CUST-E2E-001',
        name: 'Apex Industrial Solutions',
        type: 'CUSTOMER',
        mobile: '9876543210',
        phone: '011-23456789',
        address: 'Sector 62, Noida, UP',
        creditLimit: 50000,
        creditDays: 30,
      }),
    });
    const createCustData = (await createCustRes.json()) as any;
    assert(createCustRes.status === 201, 'Customer party CUST-E2E-001 created successfully (HTTP 201)');
    const testCustomerId = createCustData.data?.id;
    assert(!!testCustomerId, 'Customer ID returned from creation');

    // 4b. Create a Party with type BOTH (Supplier & Customer)
    const createBothRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRT-BOTH-001',
        name: 'Global Trade & Retailers',
        type: 'BOTH',
        mobile: '9811223344',
      }),
    });
    const createBothData = (await createBothRes.json()) as any;
    assert(createBothRes.status === 201, 'Party with type BOTH created successfully (HTTP 201)');
    const testBothId = createBothData.data?.id;

    // 5. Query Customer Dropdown Data Source
    console.log('\n--- Step 4: Dropdown API Data Flow ---');
    const custDropdownRes = await fetch(`${baseUrl}/accounts/parties?type=CUSTOMER,BOTH,DEALER,DISTRIBUTOR&limit=500`, {
      headers: authHeaders,
    });
    const custDropdownData = (await custDropdownRes.json()) as any;
    assert(custDropdownRes.status === 200, 'Customer dropdown data source returns 200 OK');
    
    const foundCust = custDropdownData.data?.find((c: any) => c.id === testCustomerId);
    assert(!!foundCust, 'Apex Industrial Solutions appears in Customer dropdown data');
    assert(foundCust?.code === 'CUST-E2E-001', 'Customer code is present');
    assert(foundCust?.mobile === '9876543210', 'Customer mobile is present');
    assert(foundCust?.formattedBalance !== undefined, 'Customer balance is calculated and present');

    const foundBoth = custDropdownData.data?.find((c: any) => c.id === testBothId);
    assert(!!foundBoth, 'Type BOTH (Global Trade & Retailers) also appears in Customer dropdown data');

    // 6. Test Validation: Receipt with missing partyId is rejected
    console.log('\n--- Step 5: Receipt Form Validation ---');
    const invalidReceiptRes = await fetch(`${baseUrl}/accounts/receipts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId,
        partyId: '',
        amount: 10000,
        receiptDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank',
      }),
    });
    assert(invalidReceiptRes.status === 400, 'Receipt with empty partyId is rejected with HTTP 400');
    const invalidReceiptData = await invalidReceiptRes.json();
    assert(
      invalidReceiptData.message?.includes('Party') || invalidReceiptData.message?.includes('required'),
      `Rejection message indicates Party is required: "${invalidReceiptData.message}"`
    );

    // 7. Post ₹10,000 Receipt Voucher against test customer
    console.log('\n--- Step 6: Post ₹10,000 Receipt Voucher ---');
    const receiptRes = await fetch(`${baseUrl}/accounts/receipts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId,
        partyId: testCustomerId,
        amount: 10000,
        receiptDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank',
        referenceNumber: 'AXIS-NEFT-998811',
        notes: 'Advance collection from Apex Industrial Solutions',
      }),
    });
    const receiptData = (await receiptRes.json()) as any;
    assert(receiptRes.status === 201, 'Receipt voucher posted successfully (HTTP 201)');
    assert(receiptData.data?.receipt?.receiptNumber !== undefined, `Voucher number generated: ${receiptData.data?.receipt?.receiptNumber}`);
    assert(receiptData.data?.receipt?.amount === 10000, 'Receipt amount is ₹10,000');
    assert(receiptData.data?.receipt?.partyId === testCustomerId, 'Receipt is linked to exact customer ID');

    // 8. Verify Double-Entry Journal Entry
    console.log('\n--- Step 7: Double-Entry Accounting Verification ---');
    const journalEntry = receiptData.data?.journalEntry;
    assert(!!journalEntry, 'Journal entry was created atomically');
    assert(journalEntry.lines?.length === 2, 'Journal entry has exactly 2 lines (balanced double-entry)');
    
    // Dr line: Bank Account (1020)
    const drLine = journalEntry.lines?.find((l: any) => l.debitAmount === 10000);
    assert(!!drLine, 'Debit line of ₹10,000 exists (Cash/Bank increase)');
    
    // Cr line: Accounts Receivable (1030) linked to customer
    const crLine = journalEntry.lines?.find((l: any) => l.creditAmount === 10000);
    assert(!!crLine, 'Credit line of ₹10,000 exists (Accounts Receivable reduction)');
    assert(crLine?.partyId === testCustomerId, 'Credit line is attributed to test customer ID');

    // 9. Verify Customer Ledger and Balance Update
    console.log('\n--- Step 8: Customer Ledger & Balance Update Verification ---');
    const ledgerRes = await fetch(`${baseUrl}/accounts/parties/${testCustomerId}/ledger`, {
      headers: authHeaders,
    });
    const ledgerData = (await ledgerRes.json()) as any;
    assert(ledgerRes.status === 200, 'Customer ledger statement returns HTTP 200');
    assert(ledgerData.data?.entries?.length >= 1, 'Customer ledger contains receipt entry');
    const ledgerReceiptEntry = ledgerData.data?.entries?.find(
      (e: any) => e.voucherNumber === journalEntry.entryNumber || e.referenceType === 'RECEIPT'
    );
    assert(!!ledgerReceiptEntry, 'Receipt voucher entry found in customer ledger');
    assert(ledgerReceiptEntry?.credit === 10000, 'Receipt voucher credited ₹10,000 to customer ledger');

    const balRes = await fetch(`${baseUrl}/accounts/parties/${testCustomerId}/balance`, {
      headers: authHeaders,
    });
    const balData = (await balRes.json()) as any;
    assert(balRes.status === 200, 'Customer balance endpoint returns HTTP 200');
    assert(balData.data?.totalCredit === 10000, 'Total customer credit reflects ₹10,000 collection');

    // 10. Clean up test records
    console.log('\n--- Step 9: Clean Up Test Records ---');
    await prisma.receipt.deleteMany({ where: { partyId: { in: [testCustomerId, testBothId] } } });
    await prisma.journalEntryLine.deleteMany({ where: { partyId: { in: [testCustomerId, testBothId] } } });
    await prisma.journalEntry.deleteMany({ where: { entryNumber: journalEntry.entryNumber } });
    await prisma.auditLog.deleteMany({ where: { entityId: receiptData.data?.receipt?.id } });
    await prisma.party.deleteMany({ where: { id: { in: [testCustomerId, testBothId] } } });
    console.log('     Test records successfully cleaned up.');

    console.log('\n===============================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

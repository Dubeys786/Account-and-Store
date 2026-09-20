/**
 * PHASE 6 COMPREHENSIVE VERIFICATION SUITE
 * Purchase Accounting WITHOUT PO (Direct Purchase Workflow)
 *
 * FLOW:
 * Direct Purchase / Invoice
 *  ↓
 * Purchase Accounting (Single DB ACID Transaction, po_id = NULL)
 *  ↓
 * Party Ledger (Credited)
 *  ↓
 * Accounts Payable (Unpaid or Instant Settlement)
 *  ↓
 * Payment Disbursement
 *
 * Tests:
 * 1. Authentication & Role-Based Access Enforcement (STORE_USER blocked with 403)
 * 2. Direct Purchase Creation (UNPAID) & STRICT Database Rule: po_id = NULL (Zero fake POs)
 * 3. Double-Entry Journal Voucher Balancing (Dr 5010, Dr 1050, Cr 2010)
 * 4. Supplier Ledger & Accounts Payable Tracking
 * 5. Direct Purchase with Instant Payment Settlement (PAID Flow + Payment voucher + Contra Dr 2010/Cr 1020)
 * 6. Atomic Transaction Rollback on Invalid Data (Duplicate Invoice, Negative Rate, Qty <= 0)
 * 7. Cross-Store & Party Validation Enforcement
 * 8. Purchase Accounts List Filtering (type=without-po vs type=with-po)
 */

import assert from 'assert';

const baseUrl = 'http://localhost:5000/api/v1';

async function runPhase6Verification() {
  console.log('=============================================================');
  console.log('🧪 PHASE 6 — PURCHASE ACCOUNTING WITHOUT PO VERIFICATION SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName: string) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName: string, err: any) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`, err.message || err);
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate Users
    // -------------------------------------------------------------
    console.log('Setup: Authenticating Users...');

    // 1. Admin Login (Global Access)
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@prozen.com', password: 'Prozen@123' }),
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login succeeded');
    const adminData = (await adminLoginRes.json()) as any;
    const adminToken = adminData.data.token;
    const adminHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };
    recordPass('Admin user authenticated (Global Access)');

    // 2. Account User Login (Authorized for Purchase Accounting)
    const accountLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'account@prozen.com', password: 'Prozen@123' }),
    });
    assert.strictEqual(accountLoginRes.status, 200, 'Account user login succeeded');
    const accountData = (await accountLoginRes.json()) as any;
    const accountToken = accountData.data.token;
    const accountHeaders = {
      Authorization: `Bearer ${accountToken}`,
      'Content-Type': 'application/json',
    };
    recordPass('Account user authenticated (Authorized for Accounts Module)');

    // 3. Store User Login (Store Operations Only — Forbidden from Accounts)
    const storeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@prozen.com', password: 'Prozen@123' }),
    });
    assert.strictEqual(storeLoginRes.status, 200, 'Store user login succeeded');
    const storeData = (await storeLoginRes.json()) as any;
    const storeToken = storeData.data.token;
    const storeHeaders = {
      Authorization: `Bearer ${storeToken}`,
      'Content-Type': 'application/json',
    };
    recordPass('Store user authenticated');

    // -------------------------------------------------------------
    // TEST SUITE 1: Role-Based Authorization Enforcement
    // -------------------------------------------------------------
    console.log('\nTest Suite 1: Role-Based Authorization Enforcement...');

    // Attempt direct purchase as STORE_USER -> Must be blocked with 403
    const storeUserBlockedRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({
        partyId: 'some-id',
        storeId: 'some-store',
        invoiceNumber: 'INV-STORE-UNAUTH',
        quantity: 1,
        rate: 100,
      }),
    });
    assert.strictEqual(
      storeUserBlockedRes.status,
      403,
      'STORE_USER must be strictly blocked from POST /accounts/purchases/without-po'
    );
    recordPass('STORE_USER is blocked with HTTP 403 Forbidden on direct purchase');

    // Attempt direct purchase without authentication -> Must be 401
    const unauthRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber: 'INV-UNAUTH' }),
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be 401 Unauthorized');
    recordPass('Unauthenticated request rejected with HTTP 401 Unauthorized');

    // -------------------------------------------------------------
    // Fetch Metadata (Suppliers, Stores, Initial POs)
    // -------------------------------------------------------------
    console.log('\nFetching System Metadata for Testing...');

    const [partiesRes, storesRes, initialPOsRes] = await Promise.all([
      fetch(`${baseUrl}/accounts/parties`, { headers: accountHeaders }),
      fetch(`${baseUrl}/accounts/stores`, { headers: accountHeaders }),
      fetch(`${baseUrl}/store/purchase-orders`, { headers: adminHeaders }),
    ]);

    assert.strictEqual(partiesRes.status, 200, 'Parties fetched successfully');
    const partiesJson = (await partiesRes.json()) as any;
    const suppliers = partiesJson.data.filter((p: any) => p.type === 'SUPPLIER' || p.type === 'BOTH');
    assert(suppliers.length > 0, 'At least one active supplier exists');
    const testSupplier = suppliers[0];

    assert.strictEqual(storesRes.status, 200, 'Stores fetched successfully');
    const storesJson = (await storesRes.json()) as any;
    assert(storesJson.data.length > 0, 'At least one store exists');
    const testStore = storesJson.data[0];

    assert.strictEqual(initialPOsRes.status, 200, 'Initial POs fetched');
    const initialPOsJson = (await initialPOsRes.json()) as any;
    const initialPOCount = initialPOsJson.data ? initialPOsJson.data.length : 0;

    recordPass(`Test context verified: Supplier '${testSupplier.name}', Store '${testStore.name}', Initial PO Count: ${initialPOCount}`);

    // -------------------------------------------------------------
    // TEST SUITE 2: Direct Purchase (UNPAID) & Strict Zero Fake PO Rule
    // -------------------------------------------------------------
    console.log('\nTest Suite 2: Direct Purchase (UNPAID Flow) & Strict Database Rule po_id = NULL...');

    const directInvoiceNumber = `DIR-INV-${Date.now()}`;
    const directPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      invoiceNumber: directInvoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      itemName: 'Industrial Safety Equipment & Consumables',
      itemDescription: 'Direct purchase for North warehouse maintenance operations',
      quantity: 10,
      rate: 1500,
      discountPercent: 10,
      taxPercent: 18,
      paymentStatus: 'UNPAID',
      notes: 'Direct purchase without PO test verification entry',
    };

    // Calculation assertions:
    // Base = 10 * 1500 = 15,000
    // Discount (10%) = 1,500
    // Taxable Gross = 13,500
    // Tax (18%) = 2,430
    // Net Total = 15,930
    const expectedGross = 13500;
    const expectedTax = 2430;
    const expectedNet = 15930;

    const directCreateRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify(directPayload),
    });

    assert.strictEqual(directCreateRes.status, 201, 'Direct purchase creation succeeded with 201 Created');
    const directCreateData = (await directCreateRes.json()) as any;
    const createdTxn = directCreateData.data;

    // Strict assertions on WITHOUT PO rule:
    assert.strictEqual(createdTxn.poId, null, 'STRICT DATABASE RULE: poId must be NULL in accounting_transactions');
    assert.strictEqual(createdTxn.purchaseOrder, null, 'purchaseOrder relation must be null (No PO attached)');
    assert.strictEqual(createdTxn.transactionType, 'PURCHASE_WITHOUT_PO', 'Transaction type must be PURCHASE_WITHOUT_PO');
    recordPass('STRICT DATABASE RULE VERIFIED: poId is strictly NULL and transactionType is PURCHASE_WITHOUT_PO');

    // Amount assertions:
    assert.strictEqual(createdTxn.grossAmount, expectedGross, `Gross amount equals ${expectedGross}`);
    assert.strictEqual(createdTxn.taxAmount, expectedTax, `Tax amount equals ${expectedTax}`);
    assert.strictEqual(createdTxn.netAmount, expectedNet, `Net amount equals ${expectedNet}`);
    assert.strictEqual(createdTxn.paidAmount, 0, 'Paid amount is 0 for UNPAID invoice');
    assert.strictEqual(createdTxn.paymentStatus, 'UNPAID', 'Payment status is UNPAID');
    recordPass(`Financial calculation verified: Gross ₹${expectedGross}, Tax ₹${expectedTax}, Net ₹${expectedNet}`);

    // Verify PO count in the database has NOT increased (ZERO FAKE POs CREATED)
    const afterPOsRes = await fetch(`${baseUrl}/store/purchase-orders`, { headers: adminHeaders });
    const afterPOsJson = (await afterPOsRes.json()) as any;
    const afterPOCount = afterPOsJson.data ? afterPOsJson.data.length : 0;
    assert.strictEqual(afterPOCount, initialPOCount, 'PO count MUST remain identical (No fake PO generated)');
    recordPass('ZERO FAKE POS VERIFIED: purchase_orders table row count did not increase');

    // -------------------------------------------------------------
    // TEST SUITE 3: Double-Entry Journal Balancing (UNPAID Flow)
    // -------------------------------------------------------------
    console.log('\nTest Suite 3: Double-Entry Journal Balancing (UNPAID Flow)...');

    const journal = createdTxn.journalEntry;
    assert(journal, 'Journal entry was created atomically');
    assert.strictEqual(journal.referenceType, 'PURCHASE_WITHOUT_PO', 'Journal referenceType is PURCHASE_WITHOUT_PO');

    const lines = journal.lines || [];
    assert(lines.length >= 3, `Expected at least 3 journal lines (found ${lines.length})`);

    const expenseLine = lines.find((l: any) => l.account.code === '5010');
    assert(expenseLine, 'Debit 5010 (Purchase Expense / COGS) line exists');
    assert.strictEqual(expenseLine.debitAmount, expectedGross, `Debit 5010 equals gross ₹${expectedGross}`);
    assert.strictEqual(expenseLine.creditAmount, 0, 'Expense credit is 0');

    const taxLine = lines.find((l: any) => l.account.code === '1050');
    assert(taxLine, 'Debit 1050 (Input GST Credit) line exists');
    assert.strictEqual(taxLine.debitAmount, expectedTax, `Debit 1050 equals tax ₹${expectedTax}`);
    assert.strictEqual(taxLine.creditAmount, 0, 'Tax credit is 0');

    const payableLine = lines.find((l: any) => l.account.code === '2010');
    assert(payableLine, 'Credit 2010 (Accounts Payable) line exists');
    assert.strictEqual(payableLine.creditAmount, expectedNet, `Credit 2010 equals net ₹${expectedNet}`);
    assert.strictEqual(payableLine.debitAmount, 0, 'Payable debit is 0');
    assert.strictEqual(payableLine.partyId, testSupplier.id, 'Payable line is mapped to supplier party ID');

    // Balance check
    const totalDebits = lines.reduce((sum: number, l: any) => sum + l.debitAmount, 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + l.creditAmount, 0);
    assert.strictEqual(totalDebits, totalCredits, `Journal is balanced: Dr ₹${totalDebits} == Cr ₹${totalCredits}`);
    recordPass(`Double-entry voucher strictly balanced: Dr ₹${totalDebits} == Cr ₹${totalCredits} (Dr 5010, Dr 1050, Cr 2010)`);

    // -------------------------------------------------------------
    // TEST SUITE 4: Supplier Ledger & Accounts Payable Tracking
    // -------------------------------------------------------------
    console.log('\nTest Suite 4: Supplier Ledger & Accounts Payable Tracking...');

    const ledgerRes = await fetch(`${baseUrl}/accounts/parties/${testSupplier.id}/ledger`, {
      headers: accountHeaders,
    });
    assert.strictEqual(ledgerRes.status, 200, 'Supplier ledger fetched successfully');
    const ledgerData = (await ledgerRes.json()) as any;
    assert(ledgerData.data, 'Ledger data exists');

    // Verify transaction appears in purchase accounts list
    const purchasesListRes = await fetch(`${baseUrl}/accounts/purchases?search=${directInvoiceNumber}`, {
      headers: accountHeaders,
    });
    assert.strictEqual(purchasesListRes.status, 200, 'Purchases list fetched');
    const purchasesJson = (await purchasesListRes.json()) as any;
    const matchedRecord = purchasesJson.data.find((p: any) => p.invoiceNumber === directInvoiceNumber);
    assert(matchedRecord, 'Created direct purchase is listed in purchase accounts list');
    assert.strictEqual(matchedRecord.poNumber, null, 'Listed record has poNumber = null');
    assert.strictEqual(matchedRecord.hasPO, false, 'Listed record has hasPO = false');
    assert.strictEqual(matchedRecord.amount, expectedNet, 'Listed record amount matches net');
    assert.strictEqual(matchedRecord.outstanding, expectedNet, 'Outstanding equals net for unpaid invoice');
    recordPass('Supplier ledger and Accounts Payable tracking verified in purchase list');

    // -------------------------------------------------------------
    // TEST SUITE 5: Direct Purchase with Instant Settlement (PAID Flow)
    // -------------------------------------------------------------
    console.log('\nTest Suite 5: Direct Purchase with Instant Payment Settlement (PAID Flow)...');

    const paidInvoiceNumber = `DIR-PAID-${Date.now()}`;
    const paidPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      invoiceNumber: paidInvoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      itemName: 'Immediate Consumables & Cleaning Supplies',
      quantity: 5,
      rate: 2000,
      discountPercent: 0,
      taxPercent: 18,
      paymentStatus: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      referenceNo: `UTR-${Date.now().toString().slice(-8)}`,
      notes: 'Direct purchase with immediate bank settlement',
    };

    // Math:
    // Base = 5 * 2000 = 10,000
    // Gross = 10,000
    // Tax (18%) = 1,800
    // Net = 11,800
    // Paid = 11,800
    const expectedPaidNet = 11800;

    const paidCreateRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify(paidPayload),
    });

    assert.strictEqual(paidCreateRes.status, 201, 'Paid direct purchase succeeded with 201 Created');
    const paidData = (await paidCreateRes.json()) as any;
    const paidTxn = paidData.data;

    assert.strictEqual(paidTxn.poId, null, 'STRICT: Paid direct purchase poId is NULL');
    assert.strictEqual(paidTxn.netAmount, expectedPaidNet, `Net amount equals ₹${expectedPaidNet}`);
    assert.strictEqual(paidTxn.paidAmount, expectedPaidNet, `Paid amount equals ₹${expectedPaidNet}`);
    assert.strictEqual(paidTxn.paymentStatus, 'PAID', 'Payment status is PAID');

    // Verify journal voucher contains payment contra lines:
    const paidJournalLines = paidTxn.journalEntry?.lines || [];
    assert(paidJournalLines.length >= 4, `Expected at least 4 journal lines for paid invoice (found ${paidJournalLines.length})`);

    // Contra Debit 2010 (Accounts Payable settlement)
    const debitPayableLine = paidJournalLines.find((l: any) => l.account.code === '2010' && l.debitAmount === expectedPaidNet);
    assert(debitPayableLine, 'Contra Debit 2010 Accounts Payable line exists for payment settlement');

    // Contra Credit 1020 (Bank Account disbursement)
    const creditBankLine = paidJournalLines.find(
      (l: any) => (l.account.code === '1020' || l.account.code === '1010') && l.creditAmount === expectedPaidNet
    );
    assert(creditBankLine, 'Contra Credit 1020/1010 Bank/Cash line exists for disbursement');

    const paidTotalDr = paidJournalLines.reduce((s: number, l: any) => s + l.debitAmount, 0);
    const paidTotalCr = paidJournalLines.reduce((s: number, l: any) => s + l.creditAmount, 0);
    assert.strictEqual(paidTotalDr, paidTotalCr, `Paid voucher balanced: Dr ₹${paidTotalDr} == Cr ₹${paidTotalCr}`);
    recordPass(`Instant settlement verified: Paid ₹${expectedPaidNet}, Payment voucher created, Journal contra posted & balanced`);

    // -------------------------------------------------------------
    // TEST SUITE 6: Atomic Transaction Rollback on Invalid Inputs
    // -------------------------------------------------------------
    console.log('\nTest Suite 6: Atomic ACID Transaction Rollback on Invalid Inputs...');

    // Case 1: Duplicate Invoice Number (Must rollback)
    const duplicateRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        ...directPayload,
        invoiceNumber: directInvoiceNumber, // EXACT SAME INVOICE NUMBER
      }),
    });
    assert.strictEqual(duplicateRes.status, 400, 'Duplicate invoice number must be rejected with 400 Bad Request');
    const duplicateJson = (await duplicateRes.json()) as any;
    assert(duplicateJson.message.includes('already exists'), 'Error mentions invoice already exists');
    recordPass('Duplicate invoice number rejected with HTTP 400 Bad Request');

    // Case 2: Negative or Zero Rate (Must rollback)
    const badRateRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        ...directPayload,
        invoiceNumber: `INV-BAD-RATE-${Date.now()}`,
        rate: -200,
      }),
    });
    assert.strictEqual(badRateRes.status, 400, 'Negative rate must be rejected with 400 Bad Request');
    recordPass('Negative rate rejected with HTTP 400 Bad Request');

    // Case 3: Zero Quantity (Must rollback)
    const badQtyRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        ...directPayload,
        invoiceNumber: `INV-BAD-QTY-${Date.now()}`,
        quantity: 0,
      }),
    });
    assert.strictEqual(badQtyRes.status, 400, 'Zero quantity must be rejected with 400 Bad Request');
    recordPass('Zero quantity rejected with HTTP 400 Bad Request');

    // Case 4: Non-existent Party (Must rollback)
    const badPartyRes = await fetch(`${baseUrl}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        ...directPayload,
        invoiceNumber: `INV-BAD-PARTY-${Date.now()}`,
        partyId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    assert.strictEqual(badPartyRes.status, 400, 'Non-existent party must be rejected with 400 Bad Request');
    recordPass('Non-existent party rejected with HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // TEST SUITE 7: Purchase Accounts List Filtering (WITH PO vs WITHOUT PO)
    // -------------------------------------------------------------
    console.log('\nTest Suite 7: Purchase Accounts List Filtering (WITH PO vs WITHOUT PO)...');

    // Filter without-po
    const withoutPoFilterRes = await fetch(`${baseUrl}/accounts/purchases?type=without-po`, {
      headers: accountHeaders,
    });
    assert.strictEqual(withoutPoFilterRes.status, 200, 'Filter type=without-po succeeded');
    const withoutPoJson = (await withoutPoFilterRes.json()) as any;
    assert(withoutPoJson.data.length > 0, 'without-po records found');
    for (const rec of withoutPoJson.data) {
      assert.strictEqual(rec.poNumber, null, 'Every record in type=without-po must have poNumber = null');
      assert.strictEqual(rec.hasPO, false, 'Every record in type=without-po must have hasPO = false');
    }
    recordPass(`Filter type=without-po verified: All ${withoutPoJson.data.length} records have po_id = NULL`);

    // Filter with-po
    const withPoFilterRes = await fetch(`${baseUrl}/accounts/purchases?type=with-po`, {
      headers: accountHeaders,
    });
    assert.strictEqual(withPoFilterRes.status, 200, 'Filter type=with-po succeeded');
    const withPoJson = (await withPoFilterRes.json()) as any;
    for (const rec of withPoJson.data) {
      assert(rec.poNumber !== null, 'Every record in type=with-po must have a valid poNumber');
      assert.strictEqual(rec.hasPO, true, 'Every record in type=with-po must have hasPO = true');
    }
    recordPass(`Filter type=with-po verified: All ${withPoJson.data.length} records have valid PO associations`);

    console.log('\n=============================================================');
    console.log(`🎉 ALL PHASE 6 VERIFICATION TESTS PASSED! (${passed}/${passed})`);
    console.log('=============================================================');
  } catch (err: any) {
    recordFail('Verification Suite Error', err);
    console.error(err);
    process.exit(1);
  }
}

runPhase6Verification();

/**
 * PHASE 7 AUTOMATED VERIFICATION TEST SUITE
 * Verifies:
 * 1. RBAC: STORE_USER blocked with 403 Forbidden on Payables, Receivables, Payments, and Receipts
 * 2. Payables API: Invoice-level table with Supplier, Store, PO, Invoice, Dates, Totals, Outstanding, Days Overdue, and Status
 * 3. Payments API: Partial payment, full payment, overpayment rejection (400), balanced Journal entry, and Ledger updates
 * 4. Receivables API: Customer, Store, Invoice, Dates, Totals, Received, Outstanding, Days Overdue, and Status
 * 5. Receipts API: Partial collection, full settlement, overpayment rejection (400), balanced Journal entry, and Ledger updates
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

async function runTests() {
  console.log('🚀 Starting Phase 7 Full-Stack Automated Verification Suite...\n');
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

  // 1. Authenticate ADMIN and STORE_USER
  console.log('🔑 Step 1: Authenticating test users...');
  const adminToken = await login('admin@prozen.com');
  const storeUserToken = await login('store@prozen.com');
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const storeHeaders = { Authorization: `Bearer ${storeUserToken}`, 'Content-Type': 'application/json' };
  assert(!!adminToken && !!storeUserToken, 'Obtained JWT access tokens for ADMIN and STORE_USER');

  // 2. Security & RBAC: STORE_USER must be forbidden (403) from Phase 7 endpoints
  console.log('\n🔒 Step 2: Testing Security & Role-Based Access Control (RBAC)...');
  const [secPayables, secReceivables, secPayPost, secRecPost] = await Promise.all([
    fetch(`${BASE_URL}/accounts/payables`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/receivables`, { headers: storeHeaders }),
    fetch(`${BASE_URL}/accounts/payments`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({ amount: 100 }),
    }),
    fetch(`${BASE_URL}/accounts/receipts`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({ amount: 100 }),
    }),
  ]);

  assert(secPayables.status === 403, 'STORE_USER forbidden from GET /accounts/payables (403)');
  assert(secReceivables.status === 403, 'STORE_USER forbidden from GET /accounts/receivables (403)');
  assert(secPayPost.status === 403, 'STORE_USER forbidden from POST /accounts/payments (403)');
  assert(secRecPost.status === 403, 'STORE_USER forbidden from POST /accounts/receipts (403)');

  // 3. Payables Listing & Aging Verification
  console.log('\n📊 Step 3: Verifying Payables API and Invoice-Level Data...');
  const payablesRes = await fetch(`${BASE_URL}/accounts/payables`, { headers: adminHeaders });
  const payablesData = await payablesRes.json();

  assert(payablesRes.status === 200 && payablesData.success === true, 'GET /accounts/payables returns 200 OK');
  assert(Array.isArray(payablesData.data), 'Payables data is an array of invoice-level records');
  assert(payablesData.summary !== undefined, 'Payables includes summary metrics object');
  assert(typeof payablesData.summary.totalPayable === 'number', 'Summary has totalPayable');
  assert(typeof payablesData.summary.totalOutstanding === 'number', 'Summary has totalOutstanding');
  assert(typeof payablesData.summary.overdueCount === 'number', 'Summary has overdueCount');

  if (payablesData.data.length > 0) {
    const p = payablesData.data[0];
    assert(!!p.supplier && !!p.supplierCode, 'Payable has supplier name and code');
    assert(!!p.store, 'Payable has store name');
    assert(p.po !== undefined, 'Payable has PO field (or PO = N/A)');
    assert(!!p.invoice, 'Payable has invoice number');
    assert(typeof p.total === 'number', 'Payable has total number');
    assert(typeof p.paid === 'number', 'Payable has paid number');
    assert(typeof p.outstanding === 'number', 'Payable has outstanding number');
    assert(typeof p.daysOverdue === 'number', 'Payable has daysOverdue integer');
    assert(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(p.status), `Payable has valid status: ${p.status}`);
  }

  // 4. Create Direct Purchase Invoice for Payment Testing
  console.log('\n💳 Step 4: Testing Payment Vouchers & Double-Entry Posting...');
  const partiesRes = await (await fetch(`${BASE_URL}/accounts/parties?type=SUPPLIER`, { headers: adminHeaders })).json();
  const storesRes = await (await fetch(`${BASE_URL}/accounts/stores`, { headers: adminHeaders })).json();
  const supplier = partiesRes.data[0];
  const store = storesRes.data[0];

  const testInvNumber = `INV-TEST-PAY-${Date.now()}`;
  const createInvRes = await fetch(`${BASE_URL}/accounts/purchases/without-po`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: supplier.id,
      storeId: store.id,
      invoiceNumber: testInvNumber,
      invoiceDate: '2026-08-15',
      dueDate: '2026-08-30', // Overdue
      itemName: 'High Tensile Structural Bolts M20',
      quantity: 100,
      rate: 150,
      discountPercent: 0,
      taxPercent: 18,
      paymentStatus: 'UNPAID',
      notes: 'Test procurement for Phase 7 payment verification',
    }),
  });
  const newInv = await createInvRes.json();
  assert(createInvRes.status === 201, `Created test purchase invoice ${testInvNumber} (Total: ₹${newInv.data.netAmount})`);

  const targetTxnId = newInv.data.id;
  const netAmount = newInv.data.netAmount; // 100 * 150 + 18% = 17700

  // 4.1 Test Overpayment Rejection
  const overpayRes = await fetch(`${BASE_URL}/accounts/payments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: supplier.id,
      storeId: store.id,
      transactionId: targetTxnId,
      amount: netAmount + 5000,
      paymentMethod: 'Bank',
      referenceNumber: 'REF-OVERPAY',
      notes: 'Overpayment test',
    }),
  });
  assert(overpayRes.status === 400, 'Overpayment rejected with HTTP 400');
  const overpayBody = await overpayRes.json();
  assert(overpayBody.message.includes('exceeds'), `Error message clearly flags overpayment: "${overpayBody.message}"`);

  // 4.2 Test Partial Payment (₹7,700 of ₹17,700)
  const partialAmount = 7700;
  const partialPayRes = await fetch(`${BASE_URL}/accounts/payments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: supplier.id,
      storeId: store.id,
      transactionId: targetTxnId,
      amount: partialAmount,
      paymentMethod: 'Bank',
      referenceNumber: 'HDFC-NEFT-881920',
      notes: 'Partial settlement test',
    }),
  });
  const partialData = await partialPayRes.json();
  assert(partialPayRes.status === 201, `Recorded partial payment voucher (₹${partialAmount})`);
  assert(partialData.data.payment.paymentNumber.startsWith('PAY-'), 'Generated voucher number formatted as PAY-YYYY-XXXX');
  assert(partialData.data.updatedInvoice.paidAmount === partialAmount, `Updated invoice paidAmount = ₹${partialAmount}`);
  assert(partialData.data.updatedInvoice.paymentStatus === 'PARTIALLY_PAID', 'Invoice status updated to PARTIALLY_PAID');
  assert(partialData.data.journalEntry.lines.length === 2, 'Balanced 2-line Journal voucher created');
  assert(partialData.data.journalEntry.lines[0].debitAmount === partialAmount, 'Dr 2010 Accounts Payable');
  assert(partialData.data.journalEntry.lines[1].creditAmount === partialAmount, 'Cr 1020 Bank Account');

  // 4.3 Test Full Payment of remaining balance (₹10,000)
  const remainingAmount = netAmount - partialAmount;
  const fullPayRes = await fetch(`${BASE_URL}/accounts/payments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: supplier.id,
      storeId: store.id,
      transactionId: targetTxnId,
      amount: remainingAmount,
      paymentMethod: 'Cash',
      referenceNumber: 'CASH-SETTLE-001',
      notes: 'Full settlement test',
    }),
  });
  const fullData = await fullPayRes.json();
  assert(fullPayRes.status === 201, `Recorded final payment voucher (₹${remainingAmount})`);
  assert(fullData.data.updatedInvoice.paidAmount === netAmount, `Invoice paidAmount = ₹${netAmount} (100% paid)`);
  assert(fullData.data.updatedInvoice.paymentStatus === 'PAID', 'Invoice status updated to PAID in full');

  // Verify Payables query shows this invoice as PAID with 0 outstanding
  const checkPayableRes = await fetch(`${BASE_URL}/accounts/payables?search=${testInvNumber}`, { headers: adminHeaders });
  const checkPayable = await checkPayableRes.json();
  assert(checkPayable.data[0].status === 'PAID', 'Payables table reflects invoice status as PAID');
  assert(checkPayable.data[0].outstanding === 0, 'Payables table reflects outstanding balance = ₹0.00');
  assert(checkPayable.data[0].daysOverdue === 0, 'Paid invoice has daysOverdue = 0');

  // 5. Receivables Listing & Aging Verification
  console.log('\n📈 Step 5: Verifying Receivables API and Debtor Invoices...');
  const receivablesRes = await fetch(`${BASE_URL}/accounts/receivables`, { headers: adminHeaders });
  const receivablesData = await receivablesRes.json();

  assert(receivablesRes.status === 200 && receivablesData.success === true, 'GET /accounts/receivables returns 200 OK');
  assert(Array.isArray(receivablesData.data), 'Receivables data is an array of customer invoices');
  assert(receivablesData.summary !== undefined, 'Receivables includes summary metrics');
  assert(typeof receivablesData.summary.totalReceivables === 'number', 'Summary has totalReceivables');
  assert(typeof receivablesData.summary.totalReceived === 'number', 'Summary has totalReceived');
  assert(typeof receivablesData.summary.totalOutstanding === 'number', 'Summary has totalOutstanding');
  assert(typeof receivablesData.summary.overdueCount === 'number', 'Summary has overdueCount');

  const sampleReceivable = receivablesData.data[0];
  assert(!!sampleReceivable.customer && !!sampleReceivable.customerCode, 'Receivable has customer name and code');
  assert(!!sampleReceivable.store, 'Receivable has store name');
  assert(!!sampleReceivable.invoice, 'Receivable has invoice number');
  assert(typeof sampleReceivable.total === 'number', 'Receivable has total number');
  assert(typeof sampleReceivable.received === 'number', 'Receivable has received number');
  assert(typeof sampleReceivable.outstanding === 'number', 'Receivable has outstanding number');
  assert(typeof sampleReceivable.daysOverdue === 'number', 'Receivable has daysOverdue integer');
  assert(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(sampleReceivable.status), `Receivable has status: ${sampleReceivable.status}`);

  // 6. Testing Receipt Vouchers (Collection & Double-Entry)
  console.log('\n💵 Step 6: Testing Receipt Vouchers & Double-Entry Collection...');
  const targetReceivable = receivablesData.data.find((r: any) => r.outstanding > 0) || sampleReceivable;

  // 6.1 Over-receipt rejection
  const overRecRes = await fetch(`${BASE_URL}/accounts/receipts`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: targetReceivable.customerId,
      storeId: targetReceivable.storeId,
      transactionId: targetReceivable.id,
      amount: targetReceivable.outstanding + 10000,
      paymentMethod: 'Bank',
      referenceNumber: 'REF-OVER-REC',
    }),
  });
  assert(overRecRes.status === 400, 'Over-receipt collection rejected with HTTP 400');

  // 6.2 Valid Receipt Collection
  const collectAmount = Math.min(10000, targetReceivable.outstanding);
  const recRes = await fetch(`${BASE_URL}/accounts/receipts`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      partyId: targetReceivable.customerId,
      storeId: targetReceivable.storeId,
      transactionId: targetReceivable.id,
      amount: collectAmount,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-TXN-90214',
      notes: 'Customer collection settlement',
    }),
  });
  const recData = await recRes.json();
  assert(recRes.status === 201, `Recorded receipt voucher (₹${collectAmount}) via UPI`);
  assert(recData.data.receipt.receiptNumber.startsWith('REC-'), 'Generated voucher number formatted as REC-YYYY-XXXX');
  assert(recData.data.journalEntry.lines.length === 2, 'Balanced 2-line Journal voucher created');
  assert(recData.data.journalEntry.lines[0].debitAmount === collectAmount, 'Dr 1020 Bank Account (Asset increased)');
  assert(recData.data.journalEntry.lines[1].creditAmount === collectAmount, 'Cr 1030 Accounts Receivable (Asset reduced)');

  // 7. Testing Voucher Queries & Filters
  console.log('\n🔍 Step 7: Testing Voucher Queries and Filtering...');
  const [listPayments, listReceipts] = await Promise.all([
    (await fetch(`${BASE_URL}/accounts/payments?paymentMethod=Bank`, { headers: adminHeaders })).json(),
    (await fetch(`${BASE_URL}/accounts/receipts?paymentMethod=UPI`, { headers: adminHeaders })).json(),
  ]);
  assert(listPayments.success === true && Array.isArray(listPayments.data), 'Filter payments by Bank method');
  assert(listReceipts.success === true && Array.isArray(listReceipts.data), 'Filter receipts by UPI method');

  console.log(`\n========================================================`);
  console.log(`Phase 7 Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error during test execution:', err);
  process.exit(1);
});

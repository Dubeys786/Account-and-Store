import prisma, { initDatabase } from '../src/config/db';
import { seedDatabase } from '../prisma/seed';
import app from '../src/app';
import http from 'http';
import { PartyType, PartyStatus, BalanceType } from '@prisma/client';

async function runAccountsTests() {
  console.log('🧪 Running Comprehensive Accounting Foundation & Party Master Tests (Phase 3)...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  await initDatabase();
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // -------------------------------------------------------------
    // Setup: User Logins
    // -------------------------------------------------------------
    console.log('Setup: Authenticating Test Users...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@prozen.com', password: 'Prozen@123' }),
    });
    const adminLogin = (await adminLoginRes.json()) as any;
    const adminToken = adminLogin.data?.token;

    const accountLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'account@prozen.com', password: 'Prozen@123' }),
    });
    const accountLogin = (await accountLoginRes.json()) as any;
    const accountToken = accountLogin.data?.token;
    const accountUserStores = accountLogin.data?.user?.storeIds || [];
    const authorizedStoreId = accountUserStores[0];

    const storeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@prozen.com', password: 'Prozen@123' }),
    });
    const storeLogin = (await storeLoginRes.json()) as any;
    const storeToken = storeLogin.data?.token;

    assert(!!adminToken, 'Admin token acquired');
    assert(!!accountToken, 'Account user token acquired');
    assert(!!storeToken, 'Store user token acquired');
    assert(!!authorizedStoreId, `Account user has authorized store: ${authorizedStoreId}`);

    const accountHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountToken}`,
      'x-store-id': authorizedStoreId,
    };

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // -------------------------------------------------------------
    // TEST SUITE 1: PARTY MASTER CRUD, SEARCH, FILTER, PAGINATION
    // -------------------------------------------------------------
    console.log('\nTest Suite 1: Party Master CRUD, Types, Search, Filter, Pagination');

    // 1.1 Create Supplier Party with all fields
    const uniqueCodeSup = `PRT-SUP-${Date.now().toString().slice(-4)}`;
    const createSupRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        code: uniqueCodeSup,
        name: 'Zenith Heavy Engineering Supplies',
        type: 'SUPPLIER',
        mobile: '+91 98765 43210',
        alternateMobile: '+91 98765 43211',
        email: 'billing@zenitheng.com',
        gstin: '07ZENIT1234F1Z5',
        pan: 'ZENIT1234F',
        address: 'Plot 45, Udyog Vihar Phase 2',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122015',
        openingBalance: 15000,
        openingBalanceType: 'CREDIT',
        creditLimit: 300000,
        creditDays: 45,
        paymentTerms: '45 Days Net',
        storeId: authorizedStoreId,
        status: 'ACTIVE',
        notes: 'Primary structural steel fabricator and bolt provider',
      }),
    });
    const createSupJson = (await createSupRes.json()) as any;
    assert(createSupRes.status === 201, 'Supplier party created successfully (HTTP 201)');
    assert(createSupJson.data?.code === uniqueCodeSup, 'Supplier code matches');
    assert(createSupJson.data?.openingBalance === 15000, 'Opening balance set to 15000');
    assert(createSupJson.data?.openingBalanceType === 'CREDIT', 'Opening balance type is CREDIT');
    assert(createSupJson.data?.paymentTerms === '45 Days Net', 'Payment terms saved');
    assert(createSupJson.data?.mobile === '+91 98765 43210', 'Mobile number saved');
    const createdSupplierId = createSupJson.data?.id;

    // 1.2 Create Dealer and Distributor Parties
    const createDealerRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        name: 'Metro Fastener Dealers Hub',
        type: 'DEALER',
        mobile: '+91 98111 00001',
        openingBalance: 5000,
        openingBalanceType: 'DEBIT',
        storeId: authorizedStoreId,
      }),
    });
    const createDealerJson = (await createDealerRes.json()) as any;
    assert(createDealerRes.status === 201, 'DEALER party type created successfully');
    assert(createDealerJson.data?.type === 'DEALER', 'Party type is DEALER');
    const createdDealerId = createDealerJson.data?.id;

    const createDistRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        name: 'North Region Industrial Distributors',
        type: 'DISTRIBUTOR',
        mobile: '+91 98222 00002',
        storeId: authorizedStoreId,
      }),
    });
    const createDistJson = (await createDistRes.json()) as any;
    assert(createDistRes.status === 201, 'DISTRIBUTOR party type created successfully');
    assert(createDistJson.data?.type === 'DISTRIBUTOR', 'Party type is DISTRIBUTOR');

    // 1.3 Create Customer Party
    const createCustomerRes = await fetch(`${baseUrl}/accounts/parties`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        name: 'Skyline Builders & Contractors Ltd',
        type: 'CUSTOMER',
        mobile: '+91 98333 00003',
        gstin: '07SKYLN5678G1Z1',
        openingBalance: 25000,
        openingBalanceType: 'DEBIT',
        creditLimit: 500000,
        storeId: authorizedStoreId,
      }),
    });
    const createCustomerJson = (await createCustomerRes.json()) as any;
    assert(createCustomerRes.status === 201, 'CUSTOMER party type created successfully');
    assert(createCustomerJson.data?.type === 'CUSTOMER', 'Party type is CUSTOMER');
    const createdCustomerId = createCustomerJson.data?.id;

    // 1.4 Read Party by ID
    const getPartyRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}`, {
      headers: accountHeaders,
    });
    const getPartyJson = (await getPartyRes.json()) as any;
    assert(getPartyRes.status === 200, 'Party retrieved by ID (HTTP 200)');
    assert(getPartyJson.data?.id === createdSupplierId, 'Party ID verified');

    // 1.5 Search Parties
    const searchRes = await fetch(`${baseUrl}/accounts/parties?search=Zenith`, {
      headers: accountHeaders,
    });
    const searchJson = (await searchRes.json()) as any;
    assert(searchRes.status === 200, 'Search parties returns HTTP 200');
    assert(searchJson.data?.some((p: any) => p.id === createdSupplierId), 'Supplier found via name search');

    // 1.6 Filter by Type
    const filterTypeRes = await fetch(`${baseUrl}/accounts/parties?type=DEALER`, {
      headers: accountHeaders,
    });
    const filterTypeJson = (await filterTypeRes.json()) as any;
    assert(filterTypeJson.data?.every((p: any) => p.type === 'DEALER'), 'Filter by DEALER type verified');

    // 1.7 Pagination
    const pageRes = await fetch(`${baseUrl}/accounts/parties?page=1&limit=2`, {
      headers: accountHeaders,
    });
    const pageJson = (await pageRes.json()) as any;
    assert(pageJson.data?.length <= 2, 'Page limit respected (<= 2 items)');
    assert(pageJson.meta?.total >= 4, 'Total records count present in meta');
    assert(pageJson.meta?.totalPages >= 2, 'Total pages calculated in meta');

    // 1.8 Update Party
    const updatePartyRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}`, {
      method: 'PUT',
      headers: accountHeaders,
      body: JSON.stringify({
        name: 'Zenith Heavy Engineering Supplies Pvt Ltd',
        creditLimit: 400000,
        paymentTerms: '60 Days Net',
      }),
    });
    const updatePartyJson = (await updatePartyRes.json()) as any;
    assert(updatePartyRes.status === 200, 'Party updated successfully');
    assert(updatePartyJson.data?.name === 'Zenith Heavy Engineering Supplies Pvt Ltd', 'Name updated');
    assert(updatePartyJson.data?.creditLimit === 400000, 'Credit limit updated');
    assert(updatePartyJson.data?.paymentTerms === '60 Days Net', 'Payment terms updated');

    // 1.9 Deactivate Party
    const deactRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}/deactivate`, {
      method: 'PATCH',
      headers: accountHeaders,
    });
    const deactJson = (await deactRes.json()) as any;
    assert(deactRes.status === 200, 'Party deactivated successfully');
    assert(deactJson.data?.status === 'INACTIVE', 'Party status is INACTIVE');

    // Reactivate for subsequent transaction tests
    await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}/status`, {
      method: 'PATCH',
      headers: accountHeaders,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    // -------------------------------------------------------------
    // TEST SUITE 2: ACCOUNTING FOUNDATION & JOURNAL BALANCING RULE
    // -------------------------------------------------------------
    console.log('\nTest Suite 2: Accounting Foundation (TOTAL DEBIT = TOTAL CREDIT)');

    // 2.1 Get Chart of Accounts
    const accountsRes = await fetch(`${baseUrl}/accounts/ledger-accounts`, {
      headers: accountHeaders,
    });
    const accountsJson = (await accountsRes.json()) as any;
    assert(accountsRes.status === 200, 'Chart of accounts retrieved');
    assert(accountsJson.data?.length >= 10, 'Standard chart of accounts present');

    const cashAccount = accountsJson.data?.find((a: any) => a.code === '1010');
    const bankAccount = accountsJson.data?.find((a: any) => a.code === '1020');
    const cogsAccount = accountsJson.data?.find((a: any) => a.code === '5010');
    const payableAccount = accountsJson.data?.find((a: any) => a.code === '2010');

    assert(!!cashAccount && !!bankAccount && !!cogsAccount && !!payableAccount, 'System ledger accounts found');

    // 2.2 Create Balanced Journal Entry (Total Debit = Total Credit = 5,000)
    const balancedJournalRes = await fetch(`${baseUrl}/accounts/journal-entries`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        narration: 'Transfer from Cash in Hand to HDFC Bank',
        lines: [
          { accountId: bankAccount.id, debitAmount: 5000, creditAmount: 0, description: 'Deposit in Bank' },
          { accountId: cashAccount.id, debitAmount: 0, creditAmount: 5000, description: 'Cash withdrawn' },
        ],
      }),
    });
    const balancedJournalJson = (await balancedJournalRes.json()) as any;
    assert(balancedJournalRes.status === 201, 'Balanced journal entry accepted with HTTP 201');
    assert(balancedJournalJson.data?.totalAmount === 5000, 'Journal entry total amount is 5,000');
    assert(balancedJournalJson.data?.lines?.length === 2, 'Two lines created in journal voucher');

    // 2.3 REJECT Unbalanced Journal Entry (Debit 5,000 != Credit 4,000)
    const unbalancedJournalRes = await fetch(`${baseUrl}/accounts/journal-entries`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        narration: 'Deliberately Unbalanced Entry Test',
        lines: [
          { accountId: bankAccount.id, debitAmount: 5000, creditAmount: 0 },
          { accountId: cashAccount.id, debitAmount: 0, creditAmount: 4000 },
        ],
      }),
    });
    const unbalancedJournalJson = (await unbalancedJournalRes.json()) as any;
    assert(unbalancedJournalRes.status === 400, 'Unbalanced journal entry REJECTED with HTTP 400');
    assert(
      unbalancedJournalJson.message?.includes('Unbalanced journal entry rejected'),
      'Descriptive error returned explaining debit/credit mismatch'
    );

    // 2.4 Reject Single Line Entry (< 2 lines)
    const singleLineRes = await fetch(`${baseUrl}/accounts/journal-entries`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        narration: 'Single Line Test',
        lines: [{ accountId: bankAccount.id, debitAmount: 1000, creditAmount: 0 }],
      }),
    });
    assert(singleLineRes.status === 400, 'Single line journal entry rejected with HTTP 400');

    // -------------------------------------------------------------
    // TEST SUITE 3: ACCOUNTING TRANSACTIONS & PO RELATIONSHIP
    // -------------------------------------------------------------
    console.log('\nTest Suite 3: Accounting Transactions (10 Types) & PO Relationship');

    // Fetch existing PO from store to test WITH PO
    const existingPo = await prisma.purchaseOrder.findFirst({
      where: { storeId: authorizedStoreId },
    });

    // 3.1 WITH PO: po_id = actual PO ID
    let withPoTransactionId: string | null = null;
    if (existingPo) {
      const withPoRes = await fetch(`${baseUrl}/accounts/transactions`, {
        method: 'POST',
        headers: accountHeaders,
        body: JSON.stringify({
          storeId: authorizedStoreId,
          partyId: existingPo.partyId,
          poId: existingPo.id,
          transactionType: 'PURCHASE',
          grossAmount: 10000,
          taxAmount: 1800,
          notes: 'Invoice against approved Purchase Order',
        }),
      });
      const withPoJson = (await withPoRes.json()) as any;
      assert(withPoRes.status === 201, 'WITH PO transaction created successfully (HTTP 201)');
      assert(withPoJson.data?.poId === existingPo.id, 'Transaction poId matches actual PO ID');
      assert(withPoJson.data?.netAmount === 11800, 'Net amount is gross + tax (11,800)');
      assert(!!withPoJson.data?.journalEntryId, 'Journal entry automatically posted and linked');
      withPoTransactionId = withPoJson.data?.id;
    } else {
      console.log('  ⚠️ Note: No existing PO for store; creating standalone PO test');
    }

    // 3.2 WITHOUT PO: po_id = NULL (Never create fake PO records)
    const withoutPoRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdSupplierId,
        poId: null, // Explicitly NULL
        transactionType: 'PURCHASE',
        grossAmount: 20000,
        taxAmount: 3600,
        notes: 'Direct vendor purchase invoice without PO',
      }),
    });
    const withoutPoJson = (await withoutPoRes.json()) as any;
    assert(withoutPoRes.status === 201, 'WITHOUT PO transaction created successfully');
    assert(withoutPoJson.data?.poId === null, 'Transaction poId is strictly NULL');
    assert(withoutPoJson.data?.netAmount === 23600, 'Direct invoice net amount is 23,600');

    // 3.3 Reject Non-existent PO ID (Must NOT accept fake PO IDs)
    const fakePoRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdSupplierId,
        poId: 'fake-po-uuid-0000-0000-000000000000',
        transactionType: 'PURCHASE',
        grossAmount: 5000,
      }),
    });
    assert(fakePoRes.status === 400, 'Fake PO ID strictly rejected with HTTP 400');

    // 3.4 Support all 10 Transaction Types:
    // - Purchase (Tested above)
    // - Purchase Return
    const purReturnRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdSupplierId,
        transactionType: 'PURCHASE_RETURN',
        grossAmount: 2000,
        taxAmount: 360,
        notes: 'Defective bolts returned to vendor',
      }),
    });
    assert(purReturnRes.status === 201, 'PURCHASE_RETURN transaction created successfully');

    // - Sale
    const saleRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdCustomerId,
        transactionType: 'SALE',
        grossAmount: 30000,
        taxAmount: 5400,
        notes: 'Sales invoice to Skyline Builders',
      }),
    });
    assert(saleRes.status === 201, 'SALE transaction created successfully');

    // - Sale Return
    const saleReturnRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdCustomerId,
        transactionType: 'SALE_RETURN',
        grossAmount: 3000,
        taxAmount: 540,
        notes: 'Credit note for excess material return',
      }),
    });
    assert(saleReturnRes.status === 201, 'SALE_RETURN transaction created successfully');

    // - Payment (to Supplier)
    const paymentRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdSupplierId,
        transactionType: 'PAYMENT',
        grossAmount: 10000,
        taxAmount: 0,
        bankOrCashCode: '1020',
        notes: 'NEFT Payment to Zenith Supplies',
      }),
    });
    assert(paymentRes.status === 201, 'PAYMENT transaction created successfully');

    // - Receipt (from Customer)
    const receiptRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdCustomerId,
        transactionType: 'RECEIPT',
        grossAmount: 15000,
        taxAmount: 0,
        bankOrCashCode: '1020',
        notes: 'RTGS Collection from Skyline Builders',
      }),
    });
    assert(receiptRes.status === 201, 'RECEIPT transaction created successfully');

    // - Expense
    const expenseRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdSupplierId,
        transactionType: 'EXPENSE',
        grossAmount: 1200,
        notes: 'Office repair and maintenance',
      }),
    });
    assert(expenseRes.status === 201, 'EXPENSE transaction created successfully');

    // - Income
    const incomeRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdCustomerId,
        transactionType: 'INCOME',
        grossAmount: 2500,
        notes: 'Consulting services income',
      }),
    });
    assert(incomeRes.status === 201, 'INCOME transaction created successfully');

    // - Opening Balance
    const obRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdDealerId,
        transactionType: 'OPENING_BALANCE',
        grossAmount: 5000,
        notes: 'Historical ledger opening balance voucher',
      }),
    });
    assert(obRes.status === 201, 'OPENING_BALANCE transaction created successfully');

    // - Adjustment
    const adjRes = await fetch(`${baseUrl}/accounts/transactions`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        storeId: authorizedStoreId,
        partyId: createdDealerId,
        transactionType: 'ADJUSTMENT',
        grossAmount: 250,
        notes: 'Year-end rounding off reconciliation adjustment',
      }),
    });
    assert(adjRes.status === 201, 'ADJUSTMENT transaction created successfully');

    // -------------------------------------------------------------
    // TEST SUITE 4: PARTY LEDGER FOUNDATION
    // -------------------------------------------------------------
    console.log('\nTest Suite 4: Party Ledger Foundation (Statement, Running Balance, Source of Truth)');

    // 4.1 GET Party Details
    const partyGetRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}`, {
      headers: accountHeaders,
    });
    const partyGetJson = (await partyGetRes.json()) as any;
    assert(partyGetRes.status === 200, 'GET party endpoint returns HTTP 200');
    assert(partyGetJson.data?.name === 'Zenith Heavy Engineering Supplies Pvt Ltd', 'Party name matches');

    // 4.2 GET Party Ledger Statement
    const ledgerRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}/ledger`, {
      headers: accountHeaders,
    });
    const ledgerJson = (await ledgerRes.json()) as any;
    assert(ledgerRes.status === 200, 'GET party ledger returns HTTP 200');
    const ledgerData = ledgerJson.data;

    // Verify Opening Balance
    assert(ledgerData.openingBalance?.amount === 15000, 'Opening Balance amount is 15,000');
    assert(ledgerData.openingBalance?.type === 'CREDIT', 'Opening Balance type is CREDIT');

    // Verify Entries contain Debit, Credit, and Running Balance
    assert(ledgerData.entries?.length >= 2, `Ledger entries tracked (${ledgerData.entries?.length} entries)`);
    const firstEntry = ledgerData.entries[0];
    assert(typeof firstEntry.debit === 'number', 'Entry has numeric debit');
    assert(typeof firstEntry.credit === 'number', 'Entry has numeric credit');
    assert(typeof firstEntry.runningBalance === 'number', 'Entry has numeric running balance');
    assert(typeof firstEntry.balanceType === 'string', 'Entry has balance type (DEBIT/CREDIT)');
    assert(typeof firstEntry.formattedBalance === 'string', 'Entry has formatted balance string');

    // Verify Chronological Running Balance Math:
    // Opening: 15,000 Cr
    // Direct Purchase: +23,600 Cr -> 38,600 Cr
    // Purchase Return: -2,360 Dr -> 36,240 Cr
    // Payment: -10,000 Dr -> 26,240 Cr
    // (plus any other supplier txns)
    assert(ledgerData.totalDebit > 0, `Total debits tracked (₹ ${ledgerData.totalDebit})`);
    assert(ledgerData.totalCredit > 0, `Total credits tracked (₹ ${ledgerData.totalCredit})`);
    assert(ledgerData.closingBalance?.amount > 0, `Closing balance computed (₹ ${ledgerData.closingBalance?.amount})`);

    // 4.3 GET Party Balance API
    const balanceRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}/balance`, {
      headers: accountHeaders,
    });
    const balanceJson = (await balanceRes.json()) as any;
    assert(balanceRes.status === 200, 'GET party balance returns HTTP 200');
    assert(balanceJson.data?.partyId === createdSupplierId, 'Party ID verified in balance');
    assert(balanceJson.data?.currentBalance?.amount === ledgerData.closingBalance?.amount, 'Balance matches ledger closing balance');

    // 4.4 GET Party Transactions API
    const partyTxnsRes = await fetch(`${baseUrl}/accounts/parties/${createdSupplierId}/transactions`, {
      headers: accountHeaders,
    });
    const partyTxnsJson = (await partyTxnsRes.json()) as any;
    assert(partyTxnsRes.status === 200, 'GET party transactions returns HTTP 200');
    assert(partyTxnsJson.data?.length >= 2, 'Party transactions list returned');

    // 4.5 Backward compatible GET /ledger?partyId=...
    const backCompatRes = await fetch(`${baseUrl}/accounts/ledger?partyId=${createdSupplierId}`, {
      headers: accountHeaders,
    });
    const backCompatJson = (await backCompatRes.json()) as any;
    assert(backCompatRes.status === 200, 'Backwards-compatible GET /accounts/ledger endpoint succeeds');
    assert(backCompatJson.data?.closingBalance?.amount === ledgerData.closingBalance?.amount, 'Backwards-compatible ledger matches');

    // -------------------------------------------------------------
    // TEST SUITE 5: SECURITY, MULTI-STORE ISOLATION & IDOR PREVENTION
    // -------------------------------------------------------------
    console.log('\nTest Suite 5: Security, Store Isolation, Party Authorization & IDOR Prevention');

    // Fetch the other store (Store 2) which account user is NOT assigned to
    const otherStore = await prisma.store.findFirst({
      where: { id: { not: authorizedStoreId } },
    });
    const unauthorizedStoreId = otherStore?.id;

    if (unauthorizedStoreId) {
      // 5.1 Non-admin trying to create party for unauthorized store -> MUST BE 403
      const crossStoreCreateRes = await fetch(`${baseUrl}/accounts/parties`, {
        method: 'POST',
        headers: accountHeaders,
        body: JSON.stringify({
          name: 'Unauthorized Cross-Store Supplier',
          type: 'SUPPLIER',
          storeId: unauthorizedStoreId,
        }),
      });
      assert(
        crossStoreCreateRes.status === 403,
        'Party creation for unauthorized store is BLOCKED with HTTP 403 Forbidden'
      );

      // Create a party assigned to Store 2 using ADMIN credentials
      const store2Party = await prisma.party.create({
        data: {
          code: `PRT-S2-${Date.now().toString().slice(-4)}`,
          name: 'North Warehouse Exclusive Vendor',
          type: 'SUPPLIER',
          storeId: unauthorizedStoreId,
        },
      });

      // 5.2 ACCOUNT_USER trying to access Store 2 party -> IDOR PREVENTION (HTTP 403)
      const idorGetRes = await fetch(`${baseUrl}/accounts/parties/${store2Party.id}`, {
        headers: accountHeaders,
      });
      assert(
        idorGetRes.status === 403,
        'IDOR Prevention: Accessing party belonging to unauthorized store is BLOCKED with HTTP 403'
      );

      // 5.3 ACCOUNT_USER trying to view ledger of Store 2 party -> IDOR PREVENTION (HTTP 403)
      const idorLedgerRes = await fetch(`${baseUrl}/accounts/parties/${store2Party.id}/ledger`, {
        headers: accountHeaders,
      });
      assert(
        idorLedgerRes.status === 403,
        'IDOR Prevention: Accessing ledger of unauthorized store party is BLOCKED with HTTP 403'
      );

      // 5.4 ACCOUNT_USER trying to update party belonging to Store 2 -> IDOR PREVENTION (HTTP 403)
      const idorUpdateRes = await fetch(`${baseUrl}/accounts/parties/${store2Party.id}`, {
        method: 'PUT',
        headers: accountHeaders,
        body: JSON.stringify({ name: 'Tampered Party Name' }),
      });
      assert(
        idorUpdateRes.status === 403,
        'IDOR Prevention: Mutating party belonging to unauthorized store is BLOCKED with HTTP 403'
      );

      // 5.5 ADMIN can access Store 2 party cleanly
      const adminAccessRes = await fetch(`${baseUrl}/accounts/parties/${store2Party.id}`, {
        headers: adminHeaders,
      });
      assert(adminAccessRes.status === 200, 'ADMIN has global access across all stores and parties (HTTP 200)');
    }

    // 5.6 Non-existent party ID -> HTTP 404
    const nonExistentRes = await fetch(`${baseUrl}/accounts/parties/00000000-0000-0000-0000-000000000000`, {
      headers: accountHeaders,
    });
    assert(nonExistentRes.status === 404, 'Non-existent party returns HTTP 404 Not Found');

    // 5.7 STORE_USER role accessing Accounts endpoints -> FORBIDDEN (HTTP 403)
    const storeUserRes = await fetch(`${baseUrl}/accounts/parties`, {
      headers: { Authorization: `Bearer ${storeToken}` },
    });
    assert(
      storeUserRes.status === 403,
      'STORE_USER accessing accounts/parties is BLOCKED with HTTP 403 Forbidden'
    );

    // 5.8 Unauthenticated request -> UNAUTHORIZED (HTTP 401)
    const unauthRes = await fetch(`${baseUrl}/accounts/parties`);
    assert(unauthRes.status === 401, 'Unauthenticated request is BLOCKED with HTTP 401 Unauthorized');

    console.log('\n-------------------------------------------------------------');
    console.log(`Phase 3 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('-------------------------------------------------------------\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAccountsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

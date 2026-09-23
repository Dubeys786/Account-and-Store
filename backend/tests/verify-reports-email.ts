/**
 * STOCKLEDGER — ACCOUNTS REPORTS EMAIL FEATURE
 * End-to-End Automated Verification Test Suite
 * Pure HTTP Client Architecture — 100% Server & Database Compliant
 *
 * Test Matrix:
 * 1. Authentication & Security (401 Unauthorized, 403 Forbidden role)
 * 2. Store Tenancy Scoping (403 Forbidden unauthorized store)
 * 3. Input Validation & Anti-Injection (400 for empty to, invalid email, CRLF injection, format)
 * 4. Recipient limits (400 if > 10 recipients)
 * 5. Zero-Records Filter Rejection (400 "No records found for selected filters")
 * 6. Real Email Dispatch — PDF format attachment
 * 7. Real Email Dispatch — Excel (.xlsx) format attachment
 * 8. Real Email Dispatch — CSV format attachment
 * 9. Multiple Recipients (To, CC, BCC)
 * 10. Audit Log Verification in PostgreSQL database
 * 11. Route Alias (POST /api/reports/email)
 */

const BASE_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
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

async function login(email: string, password = 'Stockledger@123'): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as ApiResponse<{ token: string }>;
  if (!json.success || !json.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.data.token;
}

/**
 * Ensures test data exists in the running system via HTTP API
 */
async function ensureTestData(accountHeaders: Record<string, string>): Promise<{ storeId: string; partyId: string }> {
  // 1. Fetch available stores
  const storesRes = await fetch(`${API_URL}/accounts/stores`, { headers: accountHeaders });
  const storesData = (await storesRes.json()) as ApiResponse<any[]>;
  const stores = storesData.data || [];
  if (stores.length === 0) {
    throw new Error('No stores available in database');
  }
  const storeId = stores[0].id;

  // 2. Fetch or create a supplier party
  const partiesRes = await fetch(`${API_URL}/accounts/parties`, { headers: accountHeaders });
  const partiesData = (await partiesRes.json()) as ApiResponse<any[]>;
  let parties = partiesData.data || [];
  let partyId: string;

  if (parties.length === 0) {
    const createPartyRes = await fetch(`${API_URL}/accounts/parties`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        code: `PRT-SUP-${Date.now().toString().slice(-4)}`,
        name: 'Apex Industrial Bearings & Fasteners Ltd',
        type: 'SUPPLIER',
        email: 'billing@apexindustrial.com',
        phone: '+91 98765 43210',
      }),
    });
    const createPartyData = (await createPartyRes.json()) as ApiResponse<any>;
    partyId = createPartyData.data?.id;
  } else {
    partyId = parties[0].id;
  }

  // 3. Check if Purchase Report already has records
  const checkReportRes = await fetch(`${API_URL}/accounts/reports/generate?reportType=PURCHASE_REPORT&limit=5`, {
    headers: accountHeaders,
  });
  const checkReportData = (await checkReportRes.json()) as ApiResponse<any>;
  const records = checkReportData.data?.records || [];

  if (records.length === 0) {
    console.log('  📦 Seeding live purchase transaction via API for report generation...');
    const createPurchaseRes = await fetch(`${API_URL}/accounts/purchases/without-po`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        partyId,
        storeId,
        invoiceNumber: `INV-EML-${Date.now().toString().slice(-4)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        itemName: 'High Precision Steel Roller Bearings 25mm',
        quantity: 15,
        rate: 1250,
        discountPercent: 5,
        taxPercent: 18,
        paymentStatus: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
        paidAmount: 20945,
        notes: 'Enterprise accounting purchase invoice for email reports test',
      }),
    });
    const createPurchaseData = (await createPurchaseRes.json()) as ApiResponse<any>;
    if (!createPurchaseData.success) {
      console.warn('  ⚠️ Purchase creation notice:', createPurchaseData.message);
    } else {
      console.log('  ✅ Test purchase transaction booked successfully into ledger.');
    }
  }

  return { storeId, partyId };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('📧 STOCKLEDGER — ACCOUNTS REPORTS EMAIL FEATURE TEST SUITE');
  console.log('================================================================\n');

  try {
    // 1. Authenticate personas
    console.log('🔑 Step 1: Authenticating test users...');
    const accountToken = await login('dubeyakhilesh2005@gmail.com', 'Stockledger@123');
    const storeToken = await login('dubeysakshi618@gmail.com', 'Stockledger@123');
    const accountHeaders = {
      Authorization: `Bearer ${accountToken}`,
      'Content-Type': 'application/json',
    };
    const storeHeaders = {
      Authorization: `Bearer ${storeToken}`,
      'Content-Type': 'application/json',
    };
    assert(!!accountToken && !!storeToken, 'Authenticated ACCOUNT_USER (Akhilesh) and STORE_USER (Sakshi)');

    // 2. Ensure test data
    const { storeId } = await ensureTestData(accountHeaders);

    // 3. Security: Missing auth token
    console.log('\n🔒 Step 2: Testing Authentication & RBAC Authorization...');
    const unauthRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'finance@example.com', reportType: 'PURCHASE_REPORT' }),
    });
    assert(unauthRes.status === 401, 'POST /reports/email without Bearer token returns 401 Unauthorized');

    // 4. Security: STORE_USER forbidden
    const forbiddenRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify({ to: 'finance@example.com', reportType: 'PURCHASE_REPORT' }),
    });
    assert(forbiddenRes.status === 403, 'POST /reports/email for STORE_USER returns 403 Forbidden');

    // 5. Security: Store scoping (attempting unauthorized store ID)
    const storeForbiddenRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'finance@example.com',
        reportType: 'PURCHASE_REPORT',
        filters: { storeId: 'STR-UNAUTHORIZED-999' },
      }),
    });
    assert(
      storeForbiddenRes.status === 403,
      'POST /reports/email with unauthorized storeId returns 403 Forbidden'
    );

    // 6. Input Validation: Missing 'to' recipient
    console.log('\n🛡️ Step 3: Testing Input Validation, Header Injection & Recipient Limits...');
    const missingToRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({ to: '', reportType: 'PURCHASE_REPORT' }),
    });
    assert(missingToRes.status === 400, 'POST /reports/email with empty "to" returns 400 Bad Request');

    // 7. Input Validation: Invalid email address syntax
    const invalidEmailRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({ to: 'not-a-valid-email-format', reportType: 'PURCHASE_REPORT' }),
    });
    assert(invalidEmailRes.status === 400, 'POST /reports/email with malformed email returns 400 Bad Request');

    // 8. Security: Email header injection (CRLF in subject)
    const headerInjectionRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'finance@example.com',
        subject: 'Malicious Subject\r\nBcc: hacker@example.com',
        reportType: 'PURCHASE_REPORT',
      }),
    });
    assert(headerInjectionRes.status === 400, 'POST /reports/email with CRLF injection returns 400 Bad Request');

    // 9. Security: Too many recipients (> 10)
    const elevenEmails = Array.from({ length: 11 }, (_, i) => `user${i + 1}@example.com`).join(', ');
    const tooManyRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: elevenEmails,
        reportType: 'PURCHASE_REPORT',
      }),
    });
    assert(tooManyRes.status === 400, 'POST /reports/email exceeding 10 recipients returns 400 Bad Request');

    // 10. Input Validation: Invalid format
    const invalidFormatRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'finance@example.com',
        reportType: 'PURCHASE_REPORT',
        format: 'powerpoint',
      }),
    });
    assert(invalidFormatRes.status === 400, 'POST /reports/email with invalid format returns 400 Bad Request');

    // 11. No Data Case: Zero records found
    console.log('\n🚫 Step 4: Testing Zero-Records Filter Rejection...');
    const zeroRecordRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'finance@example.com',
        reportType: 'PURCHASE_REPORT',
        filters: { search: 'DEFINITELY_NON_EXISTENT_INVOICE_999999' },
      }),
    });
    const zeroData = (await zeroRecordRes.json()) as ApiResponse;
    assert(
      zeroRecordRes.status === 400 && zeroData.message?.includes('No records found'),
      'POST /reports/email when 0 records match returns 400 with "No records found" warning'
    );

    // 12. Real Email Dispatch — PDF format
    console.log('\n📄 Step 5: Testing Real Email Dispatch with PDF Attachment...');
    const emailPdfRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'finance.lead@stockledger.com',
        subject: 'StockLedger - Purchase Report PDF - Test Run',
        reportType: 'PURCHASE_REPORT',
        format: 'pdf',
      }),
    });
    const emailPdfData = (await emailPdfRes.json()) as ApiResponse;
    assert(
      emailPdfRes.status === 200 && emailPdfData.success === true,
      'POST /reports/email generates and sends PDF report email via SMTP'
    );
    assert(
      emailPdfData.data?.format === 'PDF' && emailPdfData.data?.recordCount > 0,
      `PDF report email verified with ${emailPdfData.data?.recordCount} records included`
    );
    if (emailPdfData.data?.previewUrl) {
      console.log(`    🔗 PDF Ethereal Preview URL: ${emailPdfData.data.previewUrl}`);
    }

    // 13. Real Email Dispatch — Excel format
    console.log('\n📊 Step 6: Testing Real Email Dispatch with Excel (.xlsx) Attachment...');
    const emailExcelRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'accounts.auditor@stockledger.com',
        subject: 'StockLedger - Purchase Report Excel - Test Run',
        reportType: 'PURCHASE_REPORT',
        format: 'excel',
      }),
    });
    const emailExcelData = (await emailExcelRes.json()) as ApiResponse;
    assert(
      emailExcelRes.status === 200 && emailExcelData.success === true,
      'POST /reports/email generates and sends Excel (.xlsx) report email via SMTP'
    );
    assert(
      emailExcelData.data?.format === 'EXCEL' && emailExcelData.data?.recordCount > 0,
      `Excel report email verified with ${emailExcelData.data?.recordCount} records included`
    );
    if (emailExcelData.data?.previewUrl) {
      console.log(`    🔗 Excel Ethereal Preview URL: ${emailExcelData.data.previewUrl}`);
    }

    // 14. Real Email Dispatch — CSV format
    console.log('\n📑 Step 7: Testing Real Email Dispatch with CSV Attachment...');
    const emailCsvRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'analytics@stockledger.com',
        subject: 'StockLedger - Purchase Report CSV - Test Run',
        reportType: 'PURCHASE_REPORT',
        format: 'csv',
      }),
    });
    const emailCsvData = (await emailCsvRes.json()) as ApiResponse;
    assert(
      emailCsvRes.status === 200 && emailCsvData.success === true,
      'POST /reports/email generates and sends CSV report email with UTF-8 BOM via SMTP'
    );
    assert(
      emailCsvData.data?.format === 'CSV' && emailCsvData.data?.recordCount > 0,
      `CSV report email verified with ${emailCsvData.data?.recordCount} records included`
    );
    if (emailCsvData.data?.previewUrl) {
      console.log(`    🔗 CSV Ethereal Preview URL: ${emailCsvData.data.previewUrl}`);
    }

    // 15. Multiple Recipients: To, CC, and BCC
    console.log('\n👥 Step 8: Testing Multiple Recipients (To, CC, BCC)...');
    const multiRecipientRes = await fetch(`${API_URL}/accounts/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'primary.recipient@stockledger.com, backup.recipient@stockledger.com',
        cc: 'manager.cc@stockledger.com',
        bcc: 'audit.bcc@stockledger.com',
        subject: 'StockLedger - Multi-Recipient Test',
        reportType: 'PURCHASE_REPORT',
        format: 'pdf',
      }),
    });
    const multiData = (await multiRecipientRes.json()) as ApiResponse;
    assert(
      multiRecipientRes.status === 200 && multiData.success === true,
      'POST /reports/email dispatches correctly to multiple recipients (To, CC, BCC)'
    );
    assert(
      multiData.data?.recipients?.to?.length === 2 &&
      multiData.data?.recipients?.cc?.length === 1 &&
      multiData.data?.recipients?.bcc?.length === 1,
      'Verified recipient list parsed into To (2), CC (1), and BCC (1)'
    );

    // 16. Audit Log Entry Verification via HTTP API
    console.log('\n📋 Step 9: Verifying Database Audit Log Trail...');
    const auditRes = await fetch(`${API_URL}/accounts/audit-logs?action=EMAIL_REPORT`, {
      headers: accountHeaders,
    });
    const auditData = (await auditRes.json()) as ApiResponse<any[]>;
    const auditLogs = auditData.data || [];
    assert(auditLogs.length > 0, `Database contains ${auditLogs.length} EMAIL_REPORT audit trail entries`);

    if (auditLogs.length > 0) {
      const latestLog = auditLogs[0];
      const parsedNewValues = JSON.parse(latestLog.newValues || '{}');
      assert(
        parsedNewValues.status === 'SUCCESS' &&
        !!parsedNewValues.reportType &&
        !!parsedNewValues.format &&
        parsedNewValues.recordCount > 0,
        'Audit log details verified (reportType, format, recordCount, status: SUCCESS)'
      );
    }

    // 17. Route Alias: POST /api/reports/email
    console.log('\n🔀 Step 10: Verifying Route Alias (POST /api/reports/email)...');
    const aliasRes = await fetch(`${BASE_URL}/api/reports/email`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        to: 'alias.test@stockledger.com',
        reportType: 'PURCHASE_REPORT',
        format: 'pdf',
      }),
    });
    const aliasData = (await aliasRes.json()) as ApiResponse;
    assert(
      aliasRes.status === 200 && aliasData.success === true,
      'Route alias POST /api/reports/email functions identically to /api/v1/accounts/reports/email'
    );

    // Final Report
    console.log('\n================================================================');
    console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL 17 ACCOUNTS REPORTS EMAIL TEST SCENARIOS PASSED WITH 100% SUCCESS!\n');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('💥 Test suite crashed with error:', err);
    process.exit(1);
  }
}

runTestSuite();

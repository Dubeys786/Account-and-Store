import { initDatabase } from '../src/config/db';
import prisma from '../src/config/db';
import app from '../src/app';
import http from 'http';

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

async function runPOVerification() {
  console.log('================================================================');
  console.log('STOCKLEDGER — PO UNIT RATE USER INPUT & VALIDATION TEST SUITE');
  console.log('================================================================\n');

  let server: http.Server | null = null;

  try {
    // -------------------------------------------------------------
    // 1. Code Contract & Static Verification of POMasterPage.tsx
    // -------------------------------------------------------------
    console.log('--- Step 1: Frontend Code Contract Verification ---');
    const fs = await import('fs');
    const path = await import('path');
    const poPagePath = path.resolve(__dirname, '../../frontend/src/pages/store/POMasterPage.tsx');
    const poPageContent = fs.readFileSync(poPagePath, 'utf8');

    // Check that hardcoded rates (100, 50) were eradicated
    const hasInitialRate100 = poPageContent.includes('const initialRate = 100;');
    const hasDefaultRate50 = poPageContent.includes('const defaultRate = 50;');
    record('No Hardcoded Initial Rate (₹100 removed)', !hasInitialRate100, 'initialRate is not 100');
    record('No Hardcoded Added Line Rate (₹50 removed)', !hasDefaultRate50, 'defaultRate is not 50');

    // Check that initial rate is empty string
    const hasInitialRateEmpty = poPageContent.includes("const initialRate = '';");
    const hasDefaultRateEmpty = poPageContent.includes("const defaultRate = '';");
    record('Initial Line Unit Rate is EMPTY string', hasInitialRateEmpty, "initialRate = ''");
    record('Newly Added Line Unit Rate is EMPTY string', hasDefaultRateEmpty, "defaultRate = ''");

    // Check placeholder
    const hasPlaceholder = poPageContent.includes('placeholder="Enter unit rate"');
    record('Unit Rate input has placeholder "Enter unit rate"', hasPlaceholder, 'placeholder="Enter unit rate"');

    // Check validation error message
    const hasValidationMsg = poPageContent.includes("setCreateError('Unit Rate is required.')");
    record('Validation enforces "Unit Rate is required."', hasValidationMsg, 'setCreateError("Unit Rate is required.")');

    // Check item selection does NOT assign rate
    const itemSelectionBlock = poPageContent.slice(
      poPageContent.indexOf("if (field === 'itemId')"),
      poPageContent.indexOf("if (field === 'itemId')") + 300
    );
    const itemSelectionAssignsRate = itemSelectionBlock.includes('row.rate');
    record('Item selection does NOT auto-populate Unit Rate', !itemSelectionAssignsRate, 'updateLine for itemId updates only code, name, unit');

    // Check calculations are gated on valid rate
    const rateCheckCalculation = poPageContent.includes('rateNum > 0 && qtyNum > 0');
    record('Calculations require valid positive rate', rateCheckCalculation, 'subtotal/tax/totals only compute when rate > 0');

    // Check historical view renders line.rate
    const hasHistoricalRate = poPageContent.includes('₹ {line.rate}');
    record('Existing PO View renders saved line.rate', hasHistoricalRate, 'Historical rate preserved in view modal');

    // -------------------------------------------------------------
    // Start Server
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Starting In-Process API Test Server ---');
    await initDatabase();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const port = (server.address() as any).port;
    const API_BASE = `http://localhost:${port}/api/v1`;
    record('Test Server Started', Boolean(port), `Running on port ${port}`);

    // -------------------------------------------------------------
    // 3. Authentication
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Authentication ---');
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
    record('Auth: Sakshi Login (Store Incharge)', loginRes.ok && Boolean(token), 'JWT Token acquired');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // -------------------------------------------------------------
    // 4. Database Item Master Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Item Master Integrity Verification ---');
    const itemsRes = await fetch(`${API_BASE}/store/items`, { headers: authHeaders });
    const itemsJson = (await itemsRes.json()) as any;
    const itemsList = itemsJson.data || [];
    record('Fetch Items list', itemsRes.ok && itemsList.length > 0, `Loaded ${itemsList.length} items`);

    const testItem = itemsList[0];
    record(
      'Item Master data intact in database',
      Boolean(testItem && testItem.id && testItem.code && testItem.name && testItem.unit),
      `Item ${testItem?.code} (${testItem?.name}) with unit: ${testItem?.unit}, stock: ${testItem?.currentStock}`
    );

    // -------------------------------------------------------------
    // 5. Fetch Active Store & Supplier
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Fetch Store and Supplier ---');
    const storesRes = await fetch(`${API_BASE}/store/stores`, { headers: authHeaders });
    const storesJson = (await storesRes.json()) as any;
    const testStore = (storesJson.data || [])[0];
    record('Fetch Store', Boolean(testStore), `Store: ${testStore?.name} (${testStore?.code})`);

    const suppliersRes = await fetch(`${API_BASE}/store/suppliers`, { headers: authHeaders });
    const suppliersJson = (await suppliersRes.json()) as any;
    const suppliersList = Array.isArray(suppliersJson.data) ? suppliersJson.data : (suppliersJson.data?.suppliers || []);
    const testSupplier = suppliersList[0];
    record('Fetch Supplier', Boolean(testSupplier), `Supplier: ${testSupplier?.name} (${testSupplier?.code})`);

    if (!testItem || !testStore || !testSupplier) {
      throw new Error('Prerequisite master data missing to test PO creation');
    }

    // -------------------------------------------------------------
    // 6. Test PO Creation with User-Entered Manual Rate
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Test Purchase Order Creation with Manual Unit Rate ---');
    const manualRate = 150;
    const qty = 10;
    const gstPercent = 18;
    const expectedSubtotal = qty * manualRate; // 1500
    const expectedTax = (expectedSubtotal * gstPercent) / 100; // 270
    const expectedGrandTotal = expectedSubtotal + expectedTax; // 1770

    const createPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Automated test PO for manual unit rate verification',
      items: [
        {
          itemId: testItem.id,
          quantity: qty,
          rate: manualRate,
          discountPercent: 0,
          taxPercent: gstPercent,
        },
      ],
    };

    const createRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createPayload),
    });
    const createJson = (await createRes.json()) as any;
    const createdPO = createJson.data;

    record('PO Creation API Response OK', createRes.ok, `Status: ${createRes.status}`);
    record('PO Created with Correct Subtotal', createdPO?.subtotal === expectedSubtotal, `Subtotal = ₹${createdPO?.subtotal} (Expected: ${expectedSubtotal})`);
    record('PO Created with Correct Tax Amount', createdPO?.taxAmount === expectedTax, `Tax = ₹${createdPO?.taxAmount} (Expected: ${expectedTax})`);
    record('PO Created with Correct Grand Total', createdPO?.totalAmount === expectedGrandTotal, `Total = ₹${createdPO?.totalAmount} (Expected: ${expectedGrandTotal})`);

    // -------------------------------------------------------------
    // 7. Test Multiple Line Items with Independent Manual Rates
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Test Multiple Line Items with Independent Manual Rates ---');
    const secondItem = itemsList.length > 1 ? itemsList[1] : itemsList[0];
    const multiPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Multi-line PO manual rates',
      items: [
        { itemId: testItem.id, quantity: 5, rate: 200, discountPercent: 0, taxPercent: 18 },
        ...(itemsList.length > 1 ? [{ itemId: secondItem.id, quantity: 2, rate: 350, discountPercent: 10, taxPercent: 18 }] : []),
      ],
    };

    const multiRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(multiPayload),
    });
    const multiJson = (await multiRes.json()) as any;
    const multiPO = multiJson.data;
    record('Multiple Line Items PO Created Successfully', multiRes.ok && Boolean(multiPO), `PO Number: ${multiPO?.poNumber}`);

    // Clean up multiPO
    if (multiPO?.id) {
      await prisma.purchaseOrderItem.deleteMany({ where: { poId: multiPO.id } });
      await prisma.purchaseOrder.delete({ where: { id: multiPO.id } });
    }

    // -------------------------------------------------------------
    // 8. Test Fetching Created PO & Verifying Saved Unit Rate
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Verify Historical Saved Unit Rate Preservation ---');
    if (createdPO?.id) {
      const getPoRes = await fetch(`${API_BASE}/store/purchase-orders/${createdPO.id}`, { headers: authHeaders });
      const getPoJson = (await getPoRes.json()) as any;
      const fetchedPO = getPoJson.data;

      const savedLine = fetchedPO?.items?.find((i: any) => i.itemId === testItem.id);
      record('Fetch PO by ID', getPoRes.ok && Boolean(fetchedPO), `PO Number: ${fetchedPO?.poNumber}`);
      record(
        'Saved Unit Rate Preserved Exactly (Historical Record)',
        savedLine?.rate === manualRate,
        `Line Rate in DB: ₹${savedLine?.rate} (User Input: ₹${manualRate})`
      );
      record(
        'Line Item Total Matches Calculated Total',
        savedLine?.total === expectedGrandTotal,
        `Line Total: ₹${savedLine?.total} (Expected: ₹${expectedGrandTotal})`
      );

      // Clean up test PO
      await prisma.purchaseOrderItem.deleteMany({ where: { poId: createdPO.id } });
      await prisma.purchaseOrder.delete({ where: { id: createdPO.id } });
      console.log('Cleaned up test Purchase Order record.');
    }

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`PO VERIFICATION COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} checks`);
    console.log('================================================================');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runPOVerification();

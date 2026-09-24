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
  console.log('STOCKLEDGER — PO UNIT / UOM & UNIT RATE NO AUTO-FILL TEST SUITE');
  console.log('================================================================\n');

  let server: http.Server | null = null;
  const createdPoIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // 1. Code Contract & Static Verification of POMasterPage.tsx
    // -------------------------------------------------------------
    console.log('--- Step 1: Frontend Code Contract & Static Analysis ---');
    const fs = await import('fs');
    const path = await import('path');
    const poPagePath = path.resolve(__dirname, '../../frontend/src/pages/store/POMasterPage.tsx');
    const poPageContent = fs.readFileSync(poPagePath, 'utf8');

    // 1.1 Check Unit Rate auto-fill eradicated
    const hasInitialRate100 = poPageContent.includes('const initialRate = 100;');
    const hasDefaultRate50 = poPageContent.includes('const defaultRate = 50;');
    record('No Hardcoded Initial Rate (₹100 removed)', !hasInitialRate100, 'initialRate is not 100');
    record('No Hardcoded Added Line Rate (₹50 removed)', !hasDefaultRate50, 'defaultRate is not 50');

    // 1.2 Check Unit / UOM auto-fill eradicated
    const hasAutoUnitFirst = poPageContent.includes("unit: first.unit || 'PCS'");
    const hasAutoUnitAdded = poPageContent.includes("unit: available.unit || 'PCS'");
    record('No Auto-Fill Unit in Initial Line (first.unit || PCS removed)', !hasAutoUnitFirst, 'Initial line does not copy item.unit');
    record('No Auto-Fill Unit in Added Line (available.unit || PCS removed)', !hasAutoUnitAdded, 'Added line does not copy item.unit');

    // 1.3 Check initial state for line items
    const hasInitialUnitEmpty = poPageContent.includes("unit: '', // CRITICAL: Unit/UOM initially EMPTY");
    const hasInitialRateEmpty = poPageContent.includes("rate: '', // CRITICAL: Unit Rate initially EMPTY");
    record('Initial Line Unit is explicitly EMPTY string', hasInitialUnitEmpty, "unit: ''");
    record('Initial Line Rate is explicitly EMPTY string', hasInitialRateEmpty, "rate: ''");

    // 1.4 Check Item Selection does NOT auto-fill Unit or Rate
    const itemSelectionBlock = poPageContent.slice(
      poPageContent.indexOf("if (field === 'itemId')"),
      poPageContent.indexOf("if (field === 'itemId')") + 450
    );
    const itemSelectionSetsUnit = itemSelectionBlock.includes('row.unit =');
    const itemSelectionSetsRate = itemSelectionBlock.includes('row.rate =');
    record('Item selection does NOT auto-populate Unit/UOM', !itemSelectionSetsUnit, 'Selecting item leaves row.unit untouched');
    record('Item selection does NOT auto-populate Unit Rate', !itemSelectionSetsRate, 'Selecting item leaves row.rate untouched');

    // 1.5 Check UOM dropdown exists and provides user selection
    const hasUomDropdown = poPageContent.includes('<select') && poPageContent.includes("updateLine(idx, 'unit', e.target.value)");
    const hasSelectUnitOption = poPageContent.includes('<option value="">Select Unit</option>');
    record('Unit / UOM field is a selectable dropdown (<select>)', hasUomDropdown, 'User selects unit from dropdown');
    record('Unit / UOM dropdown starts with "Select Unit" placeholder', hasSelectUnitOption, '<option value="">Select Unit</option>');

    // 1.6 Check UOM options defined (PCS, BOX, KG, GM, LTR, MTR, SET)
    const hasPcs = poPageContent.includes("value: 'PCS'");
    const hasBox = poPageContent.includes("value: 'BOX'");
    const hasKg = poPageContent.includes("value: 'KG'");
    const hasGm = poPageContent.includes("value: 'GM'");
    const hasLtr = poPageContent.includes("value: 'LTR'");
    const hasMtr = poPageContent.includes("value: 'MTR'");
    const hasSet = poPageContent.includes("value: 'SET'");
    record('UOM options include standard units (PCS, BOX, KG, GM, LTR, MTR, SET)',
      hasPcs && hasBox && hasKg && hasGm && hasLtr && hasMtr && hasSet,
      'Standard units available'
    );

    // 1.7 Check Unit Rate placeholder
    const hasPlaceholder = poPageContent.includes('placeholder="Enter unit rate"');
    record('Unit Rate input has placeholder "Enter unit rate"', hasPlaceholder, 'placeholder="Enter unit rate"');

    // 1.8 Check Validation Messages
    const hasUnitValidationMsg = poPageContent.includes("setCreateError('Unit / UOM is required.')");
    const hasRateValidationMsg = poPageContent.includes("setCreateError('Unit Rate is required.')");
    record('Validation enforces "Unit / UOM is required."', hasUnitValidationMsg, 'Blocks save if Unit is empty');
    record('Validation enforces "Unit Rate is required."', hasRateValidationMsg, 'Blocks save if Unit Rate is empty');

    // 1.9 Check PO Details view preserves saved line.unit
    const hasHistoricalUnitRender = poPageContent.includes('{line.quantity} {line.unit || line.item?.unit || \'\'}');
    record('Existing PO View renders saved line.unit with historical fallback', hasHistoricalUnitRender, '{line.quantity} {line.unit || line.item?.unit}');

    // -------------------------------------------------------------
    // Start In-Process Server
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
    // 4. Fetch Master Items, Stores, and Suppliers
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Fetch Master Data ---');
    const itemsRes = await fetch(`${API_BASE}/store/items`, { headers: authHeaders });
    const itemsJson = (await itemsRes.json()) as any;
    const itemsList = itemsJson.data || [];
    const testItem = itemsList[0];
    record('Fetch Items list', itemsRes.ok && itemsList.length > 0, `Loaded ${itemsList.length} items. First: ${testItem?.code} (${testItem?.name})`);

    const storesRes = await fetch(`${API_BASE}/store/stores`, { headers: authHeaders });
    const storesJson = (await storesRes.json()) as any;
    const testStore = (storesJson.data || [])[0];
    record('Fetch Store', Boolean(testStore), `Store: ${testStore?.name}`);

    const suppliersRes = await fetch(`${API_BASE}/store/suppliers`, { headers: authHeaders });
    const suppliersJson = (await suppliersRes.json()) as any;
    const suppliersList = Array.isArray(suppliersJson.data) ? suppliersJson.data : (suppliersJson.data?.suppliers || []);
    const testSupplier = suppliersList[0];
    record('Fetch Supplier', Boolean(testSupplier), `Supplier: ${testSupplier?.name}`);

    // -------------------------------------------------------------
    // 5. Test PO Creation with User-Selected Unit: "KG"
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Test PO Creation with Selected Unit = "KG" (Not PCS!) ---');
    const poKgPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Test PO with Unit KG',
      items: [
        {
          itemId: testItem.id,
          unit: 'KG', // Explicitly selected KG
          quantity: 25,
          rate: 120,
          discountPercent: 0,
          taxPercent: 18,
        },
      ],
    };

    const poKgRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(poKgPayload),
    });
    const poKgJson = (await poKgRes.json()) as any;
    const poKg = poKgJson.data;
    if (poKg?.id) createdPoIds.push(poKg.id);

    record('PO with Unit "KG" Created Successfully', poKgRes.status === 201, `Status: ${poKgRes.status}, PO: ${poKg?.poNumber}`);

    // Fetch and verify line item saved unit is KG
    const getKgRes = await fetch(`${API_BASE}/store/purchase-orders/${poKg?.id}`, { headers: authHeaders });
    const getKgJson = (await getKgRes.json()) as any;
    const fetchedKgPO = getKgJson.data;
    const kgLine = fetchedKgPO?.items?.find((i: any) => i.itemId === testItem.id);

    record('Saved PO Line Unit is "KG"', kgLine?.unit === 'KG', `DB unit: "${kgLine?.unit}" (Expected: "KG")`);
    record('Saved PO Line Rate is 120', kgLine?.rate === 120, `DB rate: ₹${kgLine?.rate}`);

    // -------------------------------------------------------------
    // 6. Test PO Creation with User-Selected Unit: "BOX"
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Test PO Creation with Selected Unit = "BOX" ---');
    const poBoxPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Test PO with Unit BOX',
      items: [
        {
          itemId: testItem.id,
          unit: 'BOX', // Explicitly selected BOX
          quantity: 15,
          rate: 450,
          discountPercent: 5,
          taxPercent: 18,
        },
      ],
    };

    const poBoxRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(poBoxPayload),
    });
    const poBoxJson = (await poBoxRes.json()) as any;
    const poBox = poBoxJson.data;
    if (poBox?.id) createdPoIds.push(poBox.id);

    record('PO with Unit "BOX" Created Successfully', poBoxRes.status === 201, `Status: ${poBoxRes.status}, PO: ${poBox?.poNumber}`);

    // Fetch and verify line item saved unit is BOX
    const getBoxRes = await fetch(`${API_BASE}/store/purchase-orders/${poBox?.id}`, { headers: authHeaders });
    const getBoxJson = (await getBoxRes.json()) as any;
    const fetchedBoxPO = getBoxJson.data;
    const boxLine = fetchedBoxPO?.items?.find((i: any) => i.itemId === testItem.id);

    record('Saved PO Line Unit is "BOX"', boxLine?.unit === 'BOX', `DB unit: "${boxLine?.unit}" (Expected: "BOX")`);
    record('Saved PO Line Rate is 450', boxLine?.rate === 450, `DB rate: ₹${boxLine?.rate}`);

    // -------------------------------------------------------------
    // 7. Test PO Creation with User-Selected Unit: "PCS"
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Test PO Creation with User Selecting "PCS" Manually ---');
    const poPcsPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Test PO with Unit PCS selected manually',
      items: [
        {
          itemId: testItem.id,
          unit: 'PCS', // User selected PCS manually
          quantity: 10,
          rate: 150,
          discountPercent: 0,
          taxPercent: 18,
        },
      ],
    };

    const poPcsRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(poPcsPayload),
    });
    const poPcsJson = (await poPcsRes.json()) as any;
    const poPcs = poPcsJson.data;
    if (poPcs?.id) createdPoIds.push(poPcs.id);

    record('PO with Unit "PCS" Created Successfully', poPcsRes.status === 201, `Status: ${poPcsRes.status}, PO: ${poPcs?.poNumber}`);

    const getPcsRes = await fetch(`${API_BASE}/store/purchase-orders/${poPcs?.id}`, { headers: authHeaders });
    const getPcsJson = (await getPcsRes.json()) as any;
    const fetchedPcsPO = getPcsJson.data;
    const pcsLine = fetchedPcsPO?.items?.find((i: any) => i.itemId === testItem.id);

    record('Saved PO Line Unit is "PCS"', pcsLine?.unit === 'PCS', `DB unit: "${pcsLine?.unit}" (Expected: "PCS")`);
    record('Saved PO Line Rate is 150', pcsLine?.rate === 150, `DB rate: ₹${pcsLine?.rate}`);

    // -------------------------------------------------------------
    // 8. Test Multiple Line Items with Different Distinct Units
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Multi-line PO with Distinct Custom Units per Line ---');
    const secondItem = itemsList.length > 1 ? itemsList[1] : itemsList[0];
    const multiPayload = {
      partyId: testSupplier.id,
      storeId: testStore.id,
      notes: 'Multi-line PO with KG and LTR',
      items: [
        { itemId: testItem.id, unit: 'KG', quantity: 50, rate: 80, discountPercent: 0, taxPercent: 18 },
        ...(itemsList.length > 1 ? [{ itemId: secondItem.id, unit: 'LTR', quantity: 10, rate: 220, discountPercent: 0, taxPercent: 18 }] : []),
      ],
    };

    const multiRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(multiPayload),
    });
    const multiJson = (await multiRes.json()) as any;
    const multiPO = multiJson.data;
    if (multiPO?.id) createdPoIds.push(multiPO.id);

    record('Multi-Line PO Created', multiRes.status === 201, `Status: ${multiRes.status}`);

    const getMultiRes = await fetch(`${API_BASE}/store/purchase-orders/${multiPO?.id}`, { headers: authHeaders });
    const getMultiJson = (await getMultiRes.json()) as any;
    const fetchedMulti = getMultiJson.data;

    const line1 = fetchedMulti?.items?.find((i: any) => i.itemId === testItem.id);
    record('Line 1 Unit Preserved as "KG"', line1?.unit === 'KG', `Line 1 Unit: ${line1?.unit}`);

    if (itemsList.length > 1) {
      const line2 = fetchedMulti?.items?.find((i: any) => i.itemId === secondItem.id);
      record('Line 2 Unit Preserved as "LTR"', line2?.unit === 'LTR', `Line 2 Unit: ${line2?.unit}`);
    }

    // -------------------------------------------------------------
    // 9. Cleanup Created Test POs
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Cleanup Test Records ---');
    for (const id of createdPoIds) {
      await prisma.purchaseOrderItem.deleteMany({ where: { poId: id } });
      await prisma.purchaseOrder.delete({ where: { id } });
    }
    console.log(`Cleaned up ${createdPoIds.length} test Purchase Orders.`);
    record('Database Test Cleanup Successful', true, `Deleted ${createdPoIds.length} test records`);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`PO UNIT / UOM & RATE VERIFICATION: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} checks`);
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

import prisma from '../src/config/db';
import app from '../src/app';
import http from 'http';

async function runStoreTests() {
  console.log('🧪 Running Comprehensive Store & Inventory Automated Tests...\n');
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

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // 1. Obtain Tokens
    console.log('Setup: Authenticating Test Users...');
    const storeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@prozen.com', password: 'Prozen@123' }),
    });
    const storeLogin = (await storeLoginRes.json()) as any;
    const storeToken = storeLogin.data?.token;
    const storeId = storeLogin.data?.user?.storeIds[0];

    const accountLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'account@prozen.com', password: 'Prozen@123' }),
    });
    const accountToken = ((await accountLoginRes.json()) as any).data?.token;

    assert(!!storeToken, 'Store user token acquired');
    assert(!!accountToken, 'Account user token acquired');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${storeToken}`,
      'x-store-id': storeId,
    };

    // 2. ITEM MASTER CRUD TESTS
    console.log('\nTest Suite 1: Item Master CRUD');
    const uniqueCode = `ITM-TEST-${Date.now().toString().slice(-4)}`;
    const createItemRes = await fetch(`${baseUrl}/store/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: uniqueCode,
        name: 'High Tensile Structural Hex Bolt M16',
        brand: 'Unbrako',
        category: 'FASTENERS',
        unit: 'PCS',
        minStock: 25,
        maxStock: 500,
        reorderLevel: 50,
        currentStock: 100,
      }),
    });
    const createItemJson = (await createItemRes.json()) as any;
    assert(createItemRes.status === 201, 'Item created successfully (HTTP 201)');
    assert(createItemJson.data?.code === uniqueCode, 'Item code verified');
    const createdItemId = createItemJson.data?.id;

    // Search and filter items
    const searchRes = await fetch(`${baseUrl}/store/items?search=M16`, { headers: authHeaders });
    const searchJson = (await searchRes.json()) as any;
    assert(searchJson.data?.some((i: any) => i.id === createdItemId), 'Item found via search query');

    // Update item
    const updateItemRes = await fetch(`${baseUrl}/store/items/${createdItemId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'High Tensile Hex Bolt M16 Grade 8.8', reorderLevel: 60 }),
    });
    const updateItemJson = (await updateItemRes.json()) as any;
    assert(updateItemJson.data?.name === 'High Tensile Hex Bolt M16 Grade 8.8', 'Item updated');

    // Toggle status
    const toggleRes = await fetch(`${baseUrl}/store/items/${createdItemId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    const toggleJson = (await toggleRes.json()) as any;
    assert(toggleJson.data?.isActive === false, 'Item deactivated successfully');

    // Reactivate for subsequent tests
    await fetch(`${baseUrl}/store/items/${createdItemId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: true }),
    });

    // 3. PURCHASE ORDER (PO MASTER) TESTS
    console.log('\nTest Suite 2: PO Master & Line Item Math Calculations');
    const parties = await prisma.party.findMany();
    const partyId = parties[0].id;

    // Item 1: 20 qty * 100 rate with 10% disc and 18% tax
    // Base = 2000, Disc = 200, Taxable = 1800, Tax = 324 -> Total = 2124
    // Item 2: 10 qty * 200 rate with 0% disc and 18% tax
    // Base = 2000, Disc = 0, Taxable = 2000, Tax = 360 -> Total = 2360
    // Grand Total = 4484
    const existingItems = await prisma.item.findMany({ where: { id: { not: createdItemId } } });
    const secondItemId = existingItems[0]?.id || createdItemId;

    const createPoRes = await fetch(`${baseUrl}/store/purchase-orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        partyId,
        storeId,
        notes: 'Urgent factory requisition',
        items: [
          { itemId: createdItemId, quantity: 20, rate: 100, discountPercent: 10, taxPercent: 18 },
          { itemId: secondItemId, quantity: 10, rate: 200, discountPercent: 0, taxPercent: 18 },
        ],
      }),
    });
    const createPoJson = (await createPoRes.json()) as any;
    assert(createPoRes.status === 201, 'Purchase Order created (HTTP 201)');
    const po = createPoJson.data;
    assert(po?.items?.length === 2, 'PO has 2 line items');
    assert(po?.items[0]?.total === 2124, `Line 1 math verified (expected 2124, got ${po?.items[0]?.total})`);
    assert(po?.items[1]?.total === 2360, `Line 2 math verified (expected 2360, got ${po?.items[1]?.total})`);
    assert(po?.totalAmount === 4484, `PO grand total math verified (expected 4484, got ${po?.totalAmount})`);
    const createdPoId = po?.id;

    // 4. MATERIAL INWARD & OVER-RECEIVING PREVENTION
    console.log('\nTest Suite 3: Material Inward & Over-receiving Validation');
    // Test negative boundary: attempt to receive 25 when PO only ordered 20
    const overReceiveRes = await fetch(`${baseUrl}/store/material-inwards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poId: createdPoId,
        referenceNumber: 'CHALLAN-999',
        items: [{ itemId: createdItemId, receivedQty: 25, rejectedQty: 0, acceptedQty: 25 }],
      }),
    });
    assert(overReceiveRes.status === 400, 'Over-receiving quantity beyond PO limit is REJECTED with HTTP 400');

    // Valid partial inward: receive 12 of Item 1 (ordered 20)
    const stockBeforeInward = (await prisma.item.findUnique({ where: { id: createdItemId } }))?.currentStock || 0;

    const validInwardRes = await fetch(`${baseUrl}/store/material-inwards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poId: createdPoId,
        referenceNumber: 'CHALLAN-101',
        remarks: 'Quality verified - good condition',
        items: [{ itemId: createdItemId, receivedQty: 12, rejectedQty: 0, acceptedQty: 12 }],
      }),
    });
    const validInwardJson = (await validInwardRes.json()) as any;
    assert(validInwardRes.status === 201, 'Valid material inward processed (HTTP 201)');

    // Verify stock increment
    const stockAfterInward = (await prisma.item.findUnique({ where: { id: createdItemId } }))?.currentStock || 0;
    assert(
      stockAfterInward === stockBeforeInward + 12,
      `Item currentStock incremented by 12 (before: ${stockBeforeInward}, after: ${stockAfterInward})`
    );

    // Verify PO status transitioned to PARTIALLY_RECEIVED
    const poAfterInward = await prisma.purchaseOrder.findUnique({ where: { id: createdPoId } });
    assert(poAfterInward?.status === 'PARTIALLY_RECEIVED', 'PO status updated to PARTIALLY_RECEIVED');

    // 5. STOCK ISSUE & AVAILABILITY VALIDATION
    console.log('\nTest Suite 4: Stock Issue & Overdraft Protection');
    // Negative test: attempt to issue 9999 units (exceeds current stock)
    const overdraftRes = await fetch(`${baseUrl}/store/stock/issue`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        itemId: createdItemId,
        storeId,
        quantity: 9999,
        department: 'Assembly Line 1',
      }),
    });
    assert(overdraftRes.status === 400, 'Overdraft stock issue is blocked with HTTP 400 Insufficient Stock');

    // Valid issue: issue 10 units
    const stockBeforeIssue = (await prisma.item.findUnique({ where: { id: createdItemId } }))?.currentStock || 0;
    const validIssueRes = await fetch(`${baseUrl}/store/stock/issue`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        itemId: createdItemId,
        storeId,
        quantity: 10,
        department: 'Assembly Line 1',
      }),
    });
    assert(validIssueRes.status === 200, 'Valid stock issue completed (HTTP 200)');
    const stockAfterIssue = (await prisma.item.findUnique({ where: { id: createdItemId } }))?.currentStock || 0;
    assert(
      stockAfterIssue === stockBeforeIssue - 10,
      `Item currentStock decremented by 10 (before: ${stockBeforeIssue}, after: ${stockAfterIssue})`
    );

    // 6. STOCK RETURN
    console.log('\nTest Suite 5: Stock Return');
    const validReturnRes = await fetch(`${baseUrl}/store/stock/return`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        itemId: createdItemId,
        storeId,
        quantity: 4,
        department: 'Assembly Line 1',
        notes: 'Excess material returned to store',
      }),
    });
    assert(validReturnRes.status === 200, 'Stock return completed (HTTP 200)');
    const stockAfterReturn = (await prisma.item.findUnique({ where: { id: createdItemId } }))?.currentStock || 0;
    assert(
      stockAfterReturn === stockAfterIssue + 4,
      `Item currentStock incremented by 4 on return (before: ${stockAfterIssue}, after: ${stockAfterReturn})`
    );

    // 7. STOCK REGISTER CALCULATION
    console.log('\nTest Suite 6: Stock Register Calculations');
    const registerRes = await fetch(`${baseUrl}/store/stock-register`, { headers: authHeaders });
    const registerJson = (await registerRes.json()) as any;
    assert(registerRes.status === 200, 'Stock register returned HTTP 200');
    const regItem = registerJson.data?.find((i: any) => i.itemId === createdItemId);
    assert(!!regItem, 'Test item present in stock register');
    assert(regItem?.inward >= 12, 'Inward calculation matches transactions');
    assert(regItem?.issue >= 10, 'Issue calculation matches transactions');
    assert(regItem?.return >= 4, 'Return calculation matches transactions');
    assert(regItem?.currentStock === stockAfterReturn, 'Current stock matches live item balance');

    // 8. DASHBOARD METRICS
    console.log('\nTest Suite 7: Dynamic Dashboard Metrics');
    const metricsRes = await fetch(`${baseUrl}/store/dashboard-metrics`, { headers: authHeaders });
    const metricsJson = (await metricsRes.json()) as any;
    assert(metricsRes.status === 200, 'Dashboard metrics returned HTTP 200');
    const cards = metricsJson.data?.kpiCards;
    assert(cards?.totalItems >= 4, `Total Items is dynamic (found ${cards?.totalItems})`);
    assert(cards?.purchaseOrders >= 1, `Purchase Orders count is dynamic (found ${cards?.purchaseOrders})`);
    assert(cards?.materialInwards >= 1, `Material Inwards count is dynamic (found ${cards?.materialInwards})`);
    assert(cards?.totalAvailableStock > 0, `Total Available Stock is dynamic (found ${cards?.totalAvailableStock})`);

    // 9. UNAUTHORIZED ROLE ACCESS GUARD
    console.log('\nTest Suite 8: Unauthorized Cross-Domain Access Enforcement');
    const accountMutateRes = await fetch(`${baseUrl}/store/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountToken}`,
      },
      body: JSON.stringify({
        code: 'HACK-01',
        name: 'Illegal Item',
        category: 'FASTENERS',
        unit: 'PCS',
      }),
    });
    assert(
      accountMutateRes.status === 403,
      'ACCOUNT_USER attempting Store mutation is FORBIDDEN with HTTP 403'
    );

    console.log('\n-------------------------------------------------------------');
    console.log(`Store & Inventory Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('-------------------------------------------------------------\n');

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runStoreTests().catch((err) => {
  console.error('Fatal store test error:', err);
  process.exit(1);
});

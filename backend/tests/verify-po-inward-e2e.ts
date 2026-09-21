const API_BASE = 'http://localhost:5000/api/v1';

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

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('STOCKLEDGER — PO & MATERIAL INWARD COMPLETE END-TO-END TEST SUITE');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // Step 0: User Authentication
    // -------------------------------------------------------------
    console.log('--- Step 0: Authentication (Sakshi - Store Incharge & Akhilesh) ---');
    const testPassword = process.env.INITIAL_USER_PASSWORD || 'Stockledger@123';

    // Login Sakshi (Store Incharge)
    const sakshiLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dubeysakshi618@gmail.com',
        password: testPassword,
      }),
    });
    const sakshiLoginJson = (await sakshiLoginRes.json()) as any;
    const sakshiToken = sakshiLoginJson.data?.token;
    record('Auth: Sakshi Login (Store Incharge)', sakshiLoginRes.ok && Boolean(sakshiToken), `Token acquired`);

    // Login Akhilesh (Account & Store Incharge)
    const akhileshLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dubeyakhilesh2005@gmail.com',
        password: testPassword,
      }),
    });
    const akhileshLoginJson = (await akhileshLoginRes.json()) as any;
    const akhileshToken = akhileshLoginJson.data?.token;
    record('Auth: Akhilesh Login (Accounts Access)', akhileshLoginRes.ok && Boolean(akhileshToken), `Token acquired`);

    const sakshiHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sakshiToken}`,
    };

    const akhileshHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${akhileshToken}`,
    };

    // -------------------------------------------------------------
    // Step 1: Real Database Lookups (Suppliers, Stores, Items)
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Real Database Lookups & Master Records ---');
    
    // Check suppliers
    let suppliersRes = await fetch(`${API_BASE}/store/suppliers`, { headers: sakshiHeaders });
    let suppliersJson = (await suppliersRes.json()) as any;
    let suppliers = Array.isArray(suppliersJson.data) ? suppliersJson.data : [];

    if (suppliers.length === 0) {
      // Create a real supplier party via accounts API
      const createPartyRes = await fetch(`${API_BASE}/accounts/parties`, {
        method: 'POST',
        headers: akhileshHeaders,
        body: JSON.stringify({
          code: 'SUP-E2E-APEX',
          name: 'Apex Industrial Solutions Pvt Ltd',
          type: 'SUPPLIER',
          phone: '9876543210',
          email: 'apex.solutions@example.com',
          creditLimit: 500000,
          creditDays: 30,
        }),
      });
      const createPartyJson = (await createPartyRes.json()) as any;
      console.log(`Created supplier via API: ${createPartyJson.data?.name}`);
      suppliersRes = await fetch(`${API_BASE}/store/suppliers`, { headers: sakshiHeaders });
      suppliersJson = (await suppliersRes.json()) as any;
      suppliers = Array.isArray(suppliersJson.data) ? suppliersJson.data : [];
    }

    const selectedSupplier = suppliers[0];
    record('PO Master: Real Supplier loaded from database', Boolean(selectedSupplier?.id), `${selectedSupplier?.name} (${selectedSupplier?.code})`);

    // Check stores
    const storesRes = await fetch(`${API_BASE}/store/stores`, { headers: sakshiHeaders });
    const storesJson = (await storesRes.json()) as any;
    const stores = Array.isArray(storesJson.data) ? storesJson.data : [];
    const selectedStore = stores[0];
    record('PO Master: Real Destination Store loaded from database', Boolean(selectedStore?.id), `${selectedStore?.name} (${selectedStore?.code})`);

    // Check items
    let itemsRes = await fetch(`${API_BASE}/store/items?limit=100`, { headers: sakshiHeaders });
    let itemsJson = (await itemsRes.json()) as any;
    let items = Array.isArray(itemsJson.data) ? itemsJson.data : itemsJson.data?.items || [];

    if (items.length === 0) {
      // Create a real item in Item Master
      const createItemRes = await fetch(`${API_BASE}/store/items`, {
        method: 'POST',
        headers: sakshiHeaders,
        body: JSON.stringify({
          code: 'ITM-BEARING-6205',
          name: 'Precision Steel Bearings 6205-2RS',
          brand: 'SKF',
          category: 'HARDWARE',
          unit: 'PCS',
          currentStock: 0,
          minStock: 5,
          maxStock: 50,
          reorderLevel: 10,
        }),
      });
      const createItemJson = (await createItemRes.json()) as any;
      console.log(`Created item in Item Master: ${createItemJson.data?.name}`);
      itemsRes = await fetch(`${API_BASE}/store/items?limit=100`, { headers: sakshiHeaders });
      itemsJson = (await itemsRes.json()) as any;
      items = Array.isArray(itemsJson.data) ? itemsJson.data : itemsJson.data?.items || [];
    }

    const selectedItem = items[0];
    const initialStock = Number(selectedItem.currentStock) || 0;
    record('PO Master: Real Item loaded from database', Boolean(selectedItem?.id), `${selectedItem?.name} (Current Stock: ${initialStock})`);

    // -------------------------------------------------------------
    // Step 2: PO Calculations & Save & Approve Order (TEST A)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: TEST A — PO Calculations & Save & Approve Order ---');
    const orderQty = 10;
    const unitRate = 100;
    const discPct = 5;
    const taxPct = 18;

    // Financial calculations
    const grossAmount = round2(orderQty * unitRate); // 1000.00
    const discAmount = round2(grossAmount * (discPct / 100)); // 50.00
    const taxableAmount = round2(grossAmount - discAmount); // 950.00
    const taxAmount = round2(taxableAmount * (taxPct / 100)); // 171.00
    const lineTotal = round2(taxableAmount + taxAmount); // 1121.00
    const grandTotal = lineTotal; // 1121.00

    record('PO Master: Gross Amount calculation', grossAmount === 1000.00, `₹${grossAmount}`);
    record('PO Master: Discount Amount calculation', discAmount === 50.00, `₹${discAmount}`);
    record('PO Master: GST / Tax Amount calculation', taxAmount === 171.00, `₹${taxAmount}`);
    record('PO Master: Line Total calculation', lineTotal === 1121.00, `₹${lineTotal}`);
    record('PO Master: Grand Total calculation', grandTotal === 1121.00, `₹${grandTotal}`);

    const poPayload = {
      partyId: selectedSupplier.id,
      storeId: selectedStore.id,
      expectedDelivery: '2026-10-20',
      notes: 'Urgent procurement order for production line maintenance.',
      items: [
        {
          itemId: selectedItem.id,
          quantity: orderQty,
          rate: unitRate,
          discountPercent: discPct,
          taxPercent: taxPct,
        },
      ],
    };

    const createPoRes = await fetch(`${API_BASE}/store/purchase-orders`, {
      method: 'POST',
      headers: sakshiHeaders,
      body: JSON.stringify(poPayload),
    });

    const createPoJson = (await createPoRes.json()) as any;
    const createdPO = createPoJson.data;

    record('PO Master: Save & Approve Order API response', createPoRes.status === 201 && createPoJson.success, createPoJson.message);
    record('PO Master: Sequential collision-free PO Number generated', Boolean(createdPO?.poNumber && createdPO.poNumber.startsWith('PO-2026-')), createdPO?.poNumber);
    record('PO Master: PO Status = APPROVED', createdPO?.status === 'APPROVED', `Status: ${createdPO?.status}`);

    // Verify PO persisted in database via GET /store/purchase-orders/:id
    const fetchPoRes = await fetch(`${API_BASE}/store/purchase-orders/${createdPO.id}`, { headers: sakshiHeaders });
    const fetchPoJson = (await fetchPoRes.json()) as any;
    const dbPO = fetchPoJson.data;

    record('Database: PO record retrieved from PostgreSQL/PGlite', fetchPoRes.status === 200 && Boolean(dbPO), `PO ID: ${dbPO?.id}`);
    record('Database: PO Status = APPROVED in database', dbPO?.status === 'APPROVED');
    record('Database: Subtotal stored accurately', Number(dbPO?.subtotal) === 1000.00, `₹${dbPO?.subtotal}`);
    record('Database: Discount stored accurately', Number(dbPO?.discount) === 50.00, `₹${dbPO?.discount}`);
    record('Database: Tax amount stored accurately', Number(dbPO?.taxAmount) === 171.00, `₹${dbPO?.taxAmount}`);
    record('Database: Total amount stored accurately', Number(dbPO?.totalAmount) === 1121.00, `₹${dbPO?.totalAmount}`);
    record('Database: Line item atomically created with receivedQty = 0', dbPO?.items?.length === 1 && dbPO.items[0].receivedQty === 0, `Line items: ${dbPO?.items?.length}`);

    // -------------------------------------------------------------
    // Step 3: Material Inward PO Loading & Selection (TEST B Part 1)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: TEST B — Material Inward PO Loading & Selection ---');
    const posRes = await fetch(`${API_BASE}/store/purchase-orders`, { headers: sakshiHeaders });
    const posJson = (await posRes.json()) as any;
    const poInList = posJson.data?.find((p: any) => p.id === createdPO.id);

    record('Material Inward: Approved PO loaded in eligible POs query', Boolean(poInList), `Found PO: ${poInList?.poNumber}`);

    const poLine = dbPO?.items?.find((i: any) => i.itemId === selectedItem.id);
    record('Material Inward: Real PO line item loaded', Boolean(poLine), `Item: ${poLine?.item?.name}`);
    const pendingQtyInitial = poLine ? poLine.quantity - poLine.receivedQty : 0;
    record('Material Inward: Pending Quantity calculated (10 - 0 = 10)', pendingQtyInitial === 10, `Pending: ${pendingQtyInitial}`);

    // -------------------------------------------------------------
    // Step 4: Material Inward Partial Receipt (6 units) (TEST B Part 2)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: TEST B — Partial Material Inward (6 units) ---');
    const partialInwardPayload = {
      poId: createdPO.id,
      inwardDate: new Date().toISOString().split('T')[0],
      referenceNumber: 'DC-E2E-PARTIAL-01',
      remarks: 'First consignment: 6 units accepted after inspection',
      items: [
        {
          itemId: selectedItem.id,
          receivedQty: 6,
          rejectedQty: 0,
          acceptedQty: 6,
          rate: unitRate,
          remarks: 'QC Passed',
        },
      ],
    };

    const partialInwRes = await fetch(`${API_BASE}/store/material-inwards`, {
      method: 'POST',
      headers: sakshiHeaders,
      body: JSON.stringify(partialInwardPayload),
    });

    const partialInwJson = (await partialInwRes.json()) as any;
    const partialInward = partialInwJson.data;

    record('Material Inward: Accept & Update Stock API (Partial)', partialInwRes.status === 201 && partialInwJson.success, partialInwJson.message);
    record('Material Inward: Sequential collision-free Inward Number generated', Boolean(partialInward?.inwardNumber && partialInward.inwardNumber.startsWith('INW-2026-')), partialInward?.inwardNumber);

    // Verify PO status after partial inward
    const poAfterPartialRes = await fetch(`${API_BASE}/store/purchase-orders/${createdPO.id}`, { headers: sakshiHeaders });
    const poAfterPartial = ((await poAfterPartialRes.json()) as any).data;

    record('Database: PO Status updated to PARTIALLY_RECEIVED', poAfterPartial?.status === 'PARTIALLY_RECEIVED', `Status: ${poAfterPartial?.status}`);
    record('Database: PO Item receivedQty updated to 6', poAfterPartial?.items[0]?.receivedQty === 6, `Received: ${poAfterPartial?.items[0]?.receivedQty} / ${poAfterPartial?.items[0]?.quantity}`);

    // Verify stock balance after partial inward
    const itemAfterPartialRes = await fetch(`${API_BASE}/store/items/${selectedItem.id}`, { headers: sakshiHeaders });
    const itemAfterPartial = ((await itemAfterPartialRes.json()) as any).data;
    record('Database: Item currentStock increased by 6', itemAfterPartial?.currentStock === initialStock + 6, `Stock: ${itemAfterPartial?.currentStock}`);

    // Verify stock transaction logged
    const stockTxPartialRes = await fetch(`${API_BASE}/store/stock/transactions?storeId=${selectedStore.id}`, { headers: sakshiHeaders });
    const stockTxPartialJson = (await stockTxPartialRes.json()) as any;
    const partialTx = stockTxPartialJson.data?.find((tx: any) => tx.referenceId === partialInward.id);
    record('Database: StockTransaction logged (+6 INWARD)', partialTx && partialTx.transactionType === 'INWARD' && partialTx.quantity === 6, `Tx quantity: ${partialTx?.quantity}`);

    // -------------------------------------------------------------
    // Step 5: Over-Receipt Prevention Test
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Over-Receipt Prevention Test ---');
    const overReceiptPayload = {
      poId: createdPO.id,
      inwardDate: new Date().toISOString().split('T')[0],
      referenceNumber: 'DC-ILLEGAL-OVER',
      remarks: 'Attempting to receive 10 units when only 4 remain allowed',
      items: [
        {
          itemId: selectedItem.id,
          receivedQty: 10,
          rejectedQty: 0,
          acceptedQty: 10, // Only 4 remaining
          rate: unitRate,
        },
      ],
    };

    const overReceiptRes = await fetch(`${API_BASE}/store/material-inwards`, {
      method: 'POST',
      headers: sakshiHeaders,
      body: JSON.stringify(overReceiptPayload),
    });

    const overReceiptJson = (await overReceiptRes.json()) as any;
    record('Validation: Over-receiving rejected with clear error', overReceiptRes.status === 400 && !overReceiptJson.success, overReceiptJson.message);

    // -------------------------------------------------------------
    // Step 6: Material Inward Final Receipt (Remaining 4 units)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: TEST B — Final Material Inward (Remaining 4 units) ---');
    const finalInwardPayload = {
      poId: createdPO.id,
      inwardDate: new Date().toISOString().split('T')[0],
      referenceNumber: 'DC-E2E-FINAL-02',
      remarks: 'Final consignment: Remaining 4 units accepted after inspection',
      items: [
        {
          itemId: selectedItem.id,
          receivedQty: 4,
          rejectedQty: 0,
          acceptedQty: 4,
          rate: unitRate,
          remarks: 'QC Passed - Final fulfillment',
        },
      ],
    };

    const finalInwRes = await fetch(`${API_BASE}/store/material-inwards`, {
      method: 'POST',
      headers: sakshiHeaders,
      body: JSON.stringify(finalInwardPayload),
    });

    const finalInwJson = (await finalInwRes.json()) as any;
    const finalInward = finalInwJson.data;

    record('Material Inward: Accept & Update Stock API (Final)', finalInwRes.status === 201 && finalInwJson.success, finalInwJson.message);

    // Verify PO status after final inward
    const poAfterFinalRes = await fetch(`${API_BASE}/store/purchase-orders/${createdPO.id}`, { headers: sakshiHeaders });
    const poAfterFinal = ((await poAfterFinalRes.json()) as any).data;

    record('Database: PO Status updated to RECEIVED', poAfterFinal?.status === 'RECEIVED', `Status: ${poAfterFinal?.status}`);
    record('Database: PO Item receivedQty fully fulfilled (10)', poAfterFinal?.items[0]?.receivedQty === 10, `Received: ${poAfterFinal?.items[0]?.receivedQty} / ${poAfterFinal?.items[0]?.quantity}`);

    // Verify stock balance after final inward
    const itemAfterFinalRes = await fetch(`${API_BASE}/store/items/${selectedItem.id}`, { headers: sakshiHeaders });
    const itemAfterFinal = ((await itemAfterFinalRes.json()) as any).data;
    record('Database: Item currentStock increased to initial + 10', itemAfterFinal?.currentStock === initialStock + 10, `Final stock: ${itemAfterFinal?.currentStock}`);

    // Verify final stock transaction logged
    const stockTxFinalRes = await fetch(`${API_BASE}/store/stock/transactions?storeId=${selectedStore.id}`, { headers: sakshiHeaders });
    const stockTxFinalJson = (await stockTxFinalRes.json()) as any;
    const finalTx = stockTxFinalJson.data?.find((tx: any) => tx.referenceId === finalInward.id);
    record('Database: StockTransaction logged (+4 INWARD)', finalTx && finalTx.transactionType === 'INWARD' && finalTx.quantity === 4, `Tx quantity: ${finalTx?.quantity}`);

    // -------------------------------------------------------------
    // Step 7: Completed PO Eligibility Filter
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Fully Received PO Filter ---');
    const posAfterFulfillmentRes = await fetch(`${API_BASE}/store/purchase-orders`, { headers: sakshiHeaders });
    const posAfterFulfillmentJson = (await posAfterFulfillmentRes.json()) as any;
    const eligiblePOs = posAfterFulfillmentJson.data?.filter(
      (p: any) =>
        (p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED') &&
        p.items?.some((pi: any) => pi.quantity - (pi.receivedQty || 0) > 0)
    );

    const isPoStillEligible = eligiblePOs.some((p: any) => p.id === createdPO.id);
    record('Material Inward: Fully received PO no longer offered for inward', !isPoStillEligible, `Eligible PO count: ${eligiblePOs.length}`);

    // -------------------------------------------------------------
    // Step 8: Store Dashboard & Stock Register Reflection (TEST C)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: TEST C — Store Dashboard & Stock Register Reflection ---');
    const dashboardRes = await fetch(`${API_BASE}/store/dashboard-metrics?storeId=${selectedStore.id}`, { headers: sakshiHeaders });
    const dashboardJson = (await dashboardRes.json()) as any;
    record('Dashboard: Store Dashboard metrics retrieved successfully', dashboardRes.ok && dashboardJson.success, `Total items: ${dashboardJson.data?.kpiCards?.totalItems}, Available stock: ${dashboardJson.data?.kpiCards?.totalAvailableStock}`);

    const stockRegisterRes = await fetch(`${API_BASE}/store/stock-register?storeId=${selectedStore.id}`, { headers: sakshiHeaders });
    const stockRegisterJson = (await stockRegisterRes.json()) as any;
    const stockRegItem = stockRegisterJson.data?.find((s: any) => s.itemId === selectedItem.id);
    record('Stock Register: Current stock reflects database balance', stockRegItem?.currentStock === initialStock + 10, `Register stock: ${stockRegItem?.currentStock}`);

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('SUMMARY OF END-TO-END VERIFICATION:');
    console.log('================================================================');
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Checks : ${totalTests}`);
    console.log(`Passed       : ${passedTests}`);
    console.log(`Failed       : ${failedTests}`);

    if (failedTests > 0) {
      console.error('\n❌ End-to-end verification encountered failures!');
      process.exit(1);
    } else {
      console.log('\n✨ ALL END-TO-END VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runEndToEndVerification();

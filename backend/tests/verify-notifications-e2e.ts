const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('🧪 Starting Pure HTTP E2E Verification of STOCKLEDGER Real Notification System...\n');

  // 1. Health Check
  const healthRes = await fetch(`${BASE_URL}/health`);
  if (!healthRes.ok) throw new Error('API server is not healthy');
  console.log('✅ 1. Backend Server is running and healthy at http://localhost:5000');

  // 2. Login Sakshi (Store Incharge)
  const sakshiLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dubeysakshi618@gmail.com',
      password: process.env.INITIAL_USER_PASSWORD || 'Stockledger@123',
    }),
  });
  const sakshiLoginData = await sakshiLoginRes.json();
  if (!sakshiLoginRes.ok || !sakshiLoginData.data?.token) {
    throw new Error(`Sakshi login failed: ${JSON.stringify(sakshiLoginData)}`);
  }
  const sakshiToken = sakshiLoginData.data.token;
  const sakshiUser = sakshiLoginData.data.user;
  const sakshiStores = sakshiLoginData.data.stores;
  const mainStore = sakshiStores[0];
  if (!mainStore) throw new Error('No store assigned to Sakshi');
  console.log(`✅ 2. Sakshi logged in successfully (User ID: ${sakshiUser.id}, Store: ${mainStore.name})`);

  // 3. Login Akhilesh (Account & Store Incharge)
  const akhileshLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dubeyakhilesh2005@gmail.com',
      password: process.env.INITIAL_USER_PASSWORD || 'Stockledger@123',
    }),
  });
  const akhileshLoginData = await akhileshLoginRes.json();
  if (!akhileshLoginRes.ok || !akhileshLoginData.data?.token) {
    throw new Error(`Akhilesh login failed: ${JSON.stringify(akhileshLoginData)}`);
  }
  const akhileshToken = akhileshLoginData.data.token;
  const akhileshUser = akhileshLoginData.data.user;
  console.log(`✅ 3. Akhilesh logged in successfully (User ID: ${akhileshUser.id})`);

  // 4. Initial unread counts
  const sakshiCountRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  const sakshiInitialCount = (await sakshiCountRes.json()).unreadCount;

  const akhileshCountRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const akhileshInitialCount = (await akhileshCountRes.json()).unreadCount;
  console.log(`✅ 4. Baseline unread counts: Sakshi=${sakshiInitialCount}, Akhilesh=${akhileshInitialCount}`);

  // 5. Ensure Item exists
  let itemsRes = await fetch(`${BASE_URL}/store/items`, {
    headers: { Authorization: `Bearer ${sakshiToken}`, 'x-store-id': mainStore.id },
  });
  let itemsData = await itemsRes.json();
  let item = itemsData.data?.[0];

  if (!item) {
    const createItemRes = await fetch(`${BASE_URL}/store/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sakshiToken}`,
        'x-store-id': mainStore.id,
      },
      body: JSON.stringify({
        code: `ITM-NOTIF-${Date.now().toString().slice(-4)}`,
        name: 'Precision Bearing 6205-ZZ',
        category: 'Mechanical Components',
        unit: 'PCS',
        purchaseRate: 120,
        reorderLevel: 25,
      }),
    });
    const createdItemData = await createItemRes.json();
    if (!createdItemData.data) {
      throw new Error(`Item creation failed: ${JSON.stringify(createdItemData)}`);
    }
    item = createdItemData.data;
  }
  console.log(`✅ 5. Verified Item: ${item.name} (${item.code || item.id})`);

  // 6. Ensure Supplier Party exists (using Akhilesh who has Accounts access)
  let partiesRes = await fetch(`${BASE_URL}/accounts/parties`, {
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  let partiesData = await partiesRes.json();
  let supplier = partiesData.data?.records?.find((p: any) => p.type === 'SUPPLIER') || partiesData.data?.find?.((p: any) => p.type === 'SUPPLIER');

  if (!supplier) {
    const createPartyRes = await fetch(`${BASE_URL}/accounts/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${akhileshToken}`,
      },
      body: JSON.stringify({
        name: 'Standard Hardware Supplies Pvt Ltd',
        type: 'SUPPLIER',
        email: 'standard.hardware@example.com',
        phone: '9820098200',
      }),
    });
    const createdPartyData = await createPartyRes.json();
    if (!createdPartyData.data) {
      throw new Error(`Party creation failed: ${JSON.stringify(createdPartyData)}`);
    }
    supplier = createdPartyData.data;
  }
  console.log(`✅ 6. Verified Supplier: ${supplier.name} (${supplier.id})`);

  // 7. Test Store Event: Create Real Purchase Order
  const poRes = await fetch(`${BASE_URL}/store/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sakshiToken}`,
      'x-store-id': mainStore.id,
    },
    body: JSON.stringify({
      partyId: supplier.id,
      storeId: mainStore.id,
      expectedDelivery: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      notes: 'E2E notification automated test purchase order',
      items: [
        {
          itemId: item.id,
          quantity: 50,
          rate: item.purchaseRate || 120,
          discountPercent: 0,
          taxPercent: 18,
        },
      ],
    }),
  });
  const poData = await poRes.json();
  if (!poRes.ok || !poData.data) {
    throw new Error(`PO creation failed: ${JSON.stringify(poData)}`);
  }
  const createdPo = poData.data;
  console.log(`✅ 7. Real PO created: ${createdPo.poNumber} (ID: ${createdPo.id})`);

  // Verify notification was created for Sakshi
  const sakshiNotesRes = await fetch(`${BASE_URL}/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  const sakshiNotes = (await sakshiNotesRes.json()).data;
  const poNotification = sakshiNotes.find((n: any) => n.referenceId === createdPo.id);
  if (!poNotification) {
    throw new Error('Store notification for PO creation was NOT found for Sakshi!');
  }
  console.log(`✅ 8. PO creation notification verified for Sakshi: "${poNotification.title}"`);

  // 9. Test Store Event: Approve Purchase Order
  const approveRes = await fetch(`${BASE_URL}/store/purchase-orders/${createdPo.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sakshiToken}`,
      'x-store-id': mainStore.id,
    },
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  const approveData = await approveRes.json();
  if (!approveRes.ok) {
    throw new Error(`PO approval failed: ${JSON.stringify(approveData)}`);
  }
  console.log(`✅ 9. PO ${createdPo.poNumber} approved successfully`);

  // Verify PO approval notification
  const sakshiNotesAfterApprove = await (
    await fetch(`${BASE_URL}/notifications?limit=5`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    })
  ).json();
  const approveNote = sakshiNotesAfterApprove.data.find(
    (n: any) => n.referenceId === createdPo.id && n.title === 'Purchase Order Approved'
  );
  if (!approveNote) {
    throw new Error('Store notification for PO approval was NOT found for Sakshi!');
  }
  console.log(`✅ 10. PO approval notification verified: "${approveNote.title}"`);

  // 11. Test Store Event: Material Inward against PO
  const inwardRes = await fetch(`${BASE_URL}/store/material-inwards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sakshiToken}`,
      'x-store-id': mainStore.id,
    },
    body: JSON.stringify({
      poId: createdPo.id,
      inwardDate: new Date().toISOString().slice(0, 10),
      referenceNumber: `INV-${Date.now().toString().slice(-6)}`,
      remarks: 'Received in good condition',
      items: [
        {
          itemId: item.id,
          receivedQty: 50,
          acceptedQty: 50,
          rejectedQty: 0,
          rate: item.purchaseRate || 120,
        },
      ],
    }),
  });
  const inwardData = await inwardRes.json();
  if (!inwardRes.ok || !inwardData.data) {
    throw new Error(`Material Inward failed: ${JSON.stringify(inwardData)}`);
  }
  const createdInward = inwardData.data;
  console.log(`✅ 11. Real Material Inward recorded: ${createdInward.inwardNumber}`);

  // Verify Inward notification
  const sakshiNotesAfterInward = await (
    await fetch(`${BASE_URL}/notifications?limit=5`, {
      headers: { Authorization: `Bearer ${sakshiToken}` },
    })
  ).json();
  const inwardNote = sakshiNotesAfterInward.data.find((n: any) => n.referenceType === 'material_inward');
  if (!inwardNote) {
    throw new Error('Store notification for Material Inward was NOT found for Sakshi!');
  }
  console.log(`✅ 12. Material Inward notification verified: "${inwardNote.title}"`);

  // 13. Test Accounts Event: Record Expense by Akhilesh
  const expenseRes = await fetch(`${BASE_URL}/accounts/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${akhileshToken}`,
      'x-store-id': mainStore.id,
    },
    body: JSON.stringify({
      storeId: mainStore.id,
      category: 'Office Stationery',
      amount: 1450,
      paymentMethod: 'CASH',
      description: 'Printer cartridges and paper reams',
    }),
  });
  const expenseData = await expenseRes.json();
  if (!expenseRes.ok || !expenseData.data) {
    throw new Error(`Expense creation failed: ${JSON.stringify(expenseData)}`);
  }
  const createdExpense = expenseData.data.expense;
  console.log(`✅ 13. Real Accounts Expense recorded: ${createdExpense.expenseNumber}`);

  // Verify Akhilesh received the expense notification
  const akhileshNotes = (
    await (
      await fetch(`${BASE_URL}/notifications?limit=5`, {
        headers: { Authorization: `Bearer ${akhileshToken}` },
      })
    ).json()
  ).data;
  const expenseNote = akhileshNotes.find((n: any) => n.referenceId === createdExpense.id);
  if (!expenseNote) {
    throw new Error('Accounts notification for Expense was NOT found for Akhilesh!');
  }
  console.log(`✅ 14. Expense notification verified for Akhilesh: "${expenseNote.title}"`);

  // 15. STRICT USER ISOLATION CHECK: Sakshi must NOT have received Akhilesh's Accounts notification!
  const sakshiNotesCheck = (
    await (
      await fetch(`${BASE_URL}/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${sakshiToken}` },
      })
    ).json()
  ).data;
  const leakedExpense = sakshiNotesCheck.find((n: any) => n.referenceId === createdExpense.id);
  if (leakedExpense) {
    throw new Error('SECURITY VIOLATION: Sakshi received Accounts notification for Expense!');
  }
  console.log('✅ 15. User Isolation Verified: Sakshi received 0 Accounts notifications!');

  // 16. Test Notification Actions: Mark single notification as read
  const markReadRes = await fetch(`${BASE_URL}/notifications/${expenseNote.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${akhileshToken}` },
  });
  const markReadData = await markReadRes.json();
  const readNotification = markReadData.data?.notification || markReadData.data;
  if (!markReadRes.ok || !readNotification?.isRead) {
    throw new Error(`Failed to mark notification as read: ${JSON.stringify(markReadData)}`);
  }
  console.log(`✅ 16. Single notification marked as read (isRead: true, readAt: ${readNotification.readAt})`);

  // 17. Test Security: Sakshi attempting to mark Akhilesh's notification as read should fail
  const unauthorizedMark = await fetch(`${BASE_URL}/notifications/${expenseNote.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  if (unauthorizedMark.status !== 404 && unauthorizedMark.status !== 400 && unauthorizedMark.status !== 403) {
    throw new Error(`Expected 404/403 for unauthorized mark-as-read, got: ${unauthorizedMark.status}`);
  }
  console.log(`✅ 17. Security Verified: Cross-user modification rejected with status ${unauthorizedMark.status}`);

  // 18. Test Mark All As Read for Sakshi
  const markAllRes = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  const markAllData = await markAllRes.json();
  if (!markAllRes.ok) {
    throw new Error(`Failed to mark all as read: ${JSON.stringify(markAllData)}`);
  }

  const sakshiFinalCountRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${sakshiToken}` },
  });
  const sakshiFinalCount = (await sakshiFinalCountRes.json()).unreadCount;
  if (sakshiFinalCount !== 0) {
    throw new Error(`Expected unreadCount to be 0 after mark-all-read, got: ${sakshiFinalCount}`);
  }
  console.log(`✅ 18. Mark all read verified: Sakshi's unreadCount is strictly ${sakshiFinalCount}`);

  console.log('\n========================================================');
  console.log('🎉 ALL 18 REAL NOTIFICATION SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ E2E VERIFICATION TEST FAILED:', err);
  process.exit(1);
});

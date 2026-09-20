import { UserRole, PartyType, AccountGroup, BalanceType, PartyStatus, POStatus } from '@prisma/client';
import { prisma, initDatabase } from '../src/config/db';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding for PROZEN Store & Accounts...');
  await initDatabase();

  // 1. Seed Stores
  const mainStore = await prisma.store.upsert({
    where: { code: 'STR-001' },
    update: {},
    create: {
      code: 'STR-001',
      name: 'Main Central Store',
      location: 'Building A, Industrial Complex',
      address: 'Plot 12, Industrial Area, Sector 58',
      phone: '+91 98765 43210',
      email: 'store.central@prozen.com',
    },
  });

  const branchStore = await prisma.store.upsert({
    where: { code: 'STR-002' },
    update: {},
    create: {
      code: 'STR-002',
      name: 'North Regional Warehouse',
      location: 'Logistics Hub, North Zone',
      address: 'Gate 4, Logistics Park, GT Road',
      phone: '+91 98765 43211',
      email: 'store.north@prozen.com',
    },
  });

  console.log('✅ Stores seeded: Main Central Store, North Regional Warehouse');

  // 2. Seed Users
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Prozen@123', salt);

  // ADMIN user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@prozen.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      email: 'admin@prozen.com',
      name: 'Chief Administrator',
      passwordHash: defaultPasswordHash,
      role: UserRole.ADMIN,
      phone: '+91 90000 00001',
      storeUsers: {
        create: [
          { storeId: mainStore.id, isDefault: true },
          { storeId: branchStore.id, isDefault: false },
        ],
      },
    },
  });

  // STORE_USER
  const storeUser = await prisma.user.upsert({
    where: { email: 'store@prozen.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      email: 'store@prozen.com',
      name: 'Rajesh Sharma (Store In-Charge)',
      passwordHash: defaultPasswordHash,
      role: UserRole.STORE_USER,
      phone: '+91 90000 00002',
      storeUsers: {
        create: [{ storeId: mainStore.id, isDefault: true }],
      },
    },
  });

  // ACCOUNT_USER
  const accountUser = await prisma.user.upsert({
    where: { email: 'account@prozen.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      email: 'account@prozen.com',
      name: 'Pooja Verma (Finance & Accounts)',
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNT_USER,
      phone: '+91 90000 00003',
      storeUsers: {
        create: [
          { storeId: mainStore.id, isDefault: true },
          { storeId: branchStore.id, isDefault: false },
        ],
      },
    },
  });

  console.log('✅ Users seeded: Admin, Store User, Account User');

  // 3. Seed Chart of Accounts
  const chartOfAccounts = [
    { code: '1010', name: 'Cash in Hand', group: AccountGroup.ASSET, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '1020', name: 'HDFC Bank Current A/c', group: AccountGroup.ASSET, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '1030', name: 'Accounts Receivable', group: AccountGroup.ASSET, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '1040', name: 'Inventory Asset', group: AccountGroup.ASSET, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '1050', name: 'Input GST Credit (CGST+SGST)', group: AccountGroup.ASSET, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '2010', name: 'Accounts Payable', group: AccountGroup.LIABILITY, balanceType: BalanceType.CREDIT, isSystem: true },
    { code: '2020', name: 'Output GST Payable', group: AccountGroup.LIABILITY, balanceType: BalanceType.CREDIT, isSystem: true },
    { code: '3010', name: "Owner's Equity / Capital", group: AccountGroup.EQUITY, balanceType: BalanceType.CREDIT, isSystem: true },
    { code: '4010', name: 'Sales Revenue', group: AccountGroup.INCOME, balanceType: BalanceType.CREDIT, isSystem: true },
    { code: '5010', name: 'Cost of Goods Sold / Purchase Expense', group: AccountGroup.EXPENSE, balanceType: BalanceType.DEBIT, isSystem: true },
    { code: '5020', name: 'Rent & Utility Expense', group: AccountGroup.EXPENSE, balanceType: BalanceType.DEBIT, isSystem: true },
  ];

  for (const acc of chartOfAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    });
  }

  console.log(`✅ Chart of Accounts seeded (${chartOfAccounts.length} system accounts)`);

  // 4. Seed Parties
  const parties = [
    {
      code: 'PRT-SUP-001',
      name: 'Bharat Steel & Fasteners Ltd',
      type: PartyType.SUPPLIER,
      gstin: '07AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      phone: '+91 98111 22233',
      email: 'sales@bharatsteel.com',
      address: 'Industrial Focal Point, Phase 4',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
      creditLimit: 500000,
      creditDays: 30,
      status: PartyStatus.ACTIVE,
    },
    {
      code: 'PRT-SUP-002',
      name: 'Apex Industrial Lubricants Corp',
      type: PartyType.SUPPLIER,
      gstin: '07BBBBB1111B1Z2',
      pan: 'BBBBB1111B',
      phone: '+91 98222 33344',
      email: 'orders@apexlubricants.in',
      address: 'Chemical Zone, Sector 25',
      city: 'Faridabad',
      state: 'Haryana',
      pincode: '121004',
      creditLimit: 250000,
      creditDays: 45,
      status: PartyStatus.ACTIVE,
    },
    {
      code: 'PRT-CUS-001',
      name: 'Metro City Infrastructure Pvt Ltd',
      type: PartyType.CUSTOMER,
      gstin: '07CCCCC2222C1Z9',
      pan: 'CCCCC2222C',
      phone: '+91 98333 44455',
      email: 'procurement@metrocityinfra.com',
      address: 'Commercial Tower B, Okhla',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110020',
      creditLimit: 1000000,
      creditDays: 60,
      status: PartyStatus.ACTIVE,
    },
  ];

  for (const party of parties) {
    await prisma.party.upsert({
      where: { code: party.code },
      update: {},
      create: party,
    });
  }

  console.log(`✅ Parties seeded (${parties.length} parties)`);

  // 5. Seed Items
  const items = [
    {
      code: 'ITM-001',
      name: 'Heavy Duty Structural Steel Beam 100x50',
      brand: 'Tata Structura',
      category: 'RAW_MATERIALS',
      unit: 'PCS',
      description: 'IS 2062 Grade E250 structural steel beam',
      minStock: 20,
      maxStock: 500,
      reorderLevel: 50,
      currentStock: 120,
      isActive: true,
    },
    {
      code: 'ITM-002',
      name: 'Industrial Deep Groove Ball Bearing 6205-2RS',
      brand: 'SKF',
      category: 'HARDWARE',
      unit: 'PCS',
      description: 'Rubber sealed deep groove radial ball bearing',
      minStock: 50,
      maxStock: 1000,
      reorderLevel: 100,
      currentStock: 350,
      isActive: true,
    },
    {
      code: 'ITM-003',
      name: 'Synthetic High Performance Gear Oil ISO VG 220',
      brand: 'Mobil',
      category: 'CONSUMABLES',
      unit: 'LTR',
      description: 'Fully synthetic heavy load industrial gear oil barrel',
      minStock: 5,
      maxStock: 100,
      reorderLevel: 15,
      currentStock: 45,
      isActive: true,
    },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }

  console.log(`✅ Items seeded (${items.length} items)`);

  // 5.1 Seed Purchase Orders & Material Inwards
  const itm1 = await prisma.item.findUnique({ where: { code: 'ITM-001' } });
  const itm2 = await prisma.item.findUnique({ where: { code: 'ITM-002' } });
  const itm3 = await prisma.item.findUnique({ where: { code: 'ITM-003' } });
  const sup1 = await prisma.party.findUnique({ where: { code: 'PRT-SUP-001' } });
  const sup2 = await prisma.party.findUnique({ where: { code: 'PRT-SUP-002' } });

  if (sup1 && itm1 && itm2 && mainStore) {
    // PO 1: Partially Received against Bharat Steel
    const po1 = await prisma.purchaseOrder.upsert({
      where: { poNumber: 'PO-2026-0001' },
      update: {},
      create: {
        poNumber: 'PO-2026-0001',
        poDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        partyId: sup1.id,
        storeId: mainStore.id,
        status: POStatus.PARTIALLY_RECEIVED,
        subtotal: 41500,
        discount: 1200,
        taxAmount: 7254,
        totalAmount: 47554,
        notes: 'Monthly bulk steel beams & ball bearings requisition',
        items: {
          create: [
            {
              itemId: itm1.id,
              quantity: 20,
              rate: 1200,
              discountPercent: 5,
              taxPercent: 18,
              total: 26904,
              receivedQty: 15,
            },
            {
              itemId: itm2.id,
              quantity: 50,
              rate: 350,
              discountPercent: 0,
              taxPercent: 18,
              total: 20650,
              receivedQty: 50,
            },
          ],
        },
      },
    });

    // Material Inward 1 for PO 1
    await prisma.materialInward.upsert({
      where: { inwardNumber: 'INW-2026-0001' },
      update: {},
      create: {
        inwardNumber: 'INW-2026-0001',
        inwardDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        poId: po1.id,
        partyId: sup1.id,
        storeId: mainStore.id,
        referenceNumber: 'CHALLAN-BS-9812',
        remarks: 'Physical inspection passed. Accepted 15 beams and 50 bearings.',
        items: {
          create: [
            {
              itemId: itm1.id,
              receivedQty: 15,
              rejectedQty: 0,
              acceptedQty: 15,
              rate: 1200,
              remarks: '15/20 structural steel beams received in prime condition',
            },
            {
              itemId: itm2.id,
              receivedQty: 50,
              rejectedQty: 0,
              acceptedQty: 50,
              rate: 350,
              remarks: 'All 50 ball bearings verified & accepted',
            },
          ],
        },
      },
    });
  }

  if (sup2 && itm3 && mainStore) {
    // PO 2: Fully Received against Apex Lubricants
    const po2 = await prisma.purchaseOrder.upsert({
      where: { poNumber: 'PO-2026-0002' },
      update: {},
      create: {
        poNumber: 'PO-2026-0002',
        poDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        partyId: sup2.id,
        storeId: mainStore.id,
        status: POStatus.RECEIVED,
        subtotal: 45000,
        discount: 4500,
        taxAmount: 7290,
        totalAmount: 47790,
        notes: 'High-performance synthetic gear oil replenishment',
        items: {
          create: [
            {
              itemId: itm3.id,
              quantity: 10,
              rate: 4500,
              discountPercent: 10,
              taxPercent: 18,
              total: 47790,
              receivedQty: 10,
            },
          ],
        },
      },
    });

    // Material Inward 2 for PO 2
    await prisma.materialInward.upsert({
      where: { inwardNumber: 'INW-2026-0002' },
      update: {},
      create: {
        inwardNumber: 'INW-2026-0002',
        inwardDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        poId: po2.id,
        partyId: sup2.id,
        storeId: mainStore.id,
        referenceNumber: 'INV-APEX-4410',
        remarks: 'All 10 barrels QC tested and stored in Hazardous Chemicals bay',
        items: {
          create: [
            {
              itemId: itm3.id,
              receivedQty: 10,
              rejectedQty: 0,
              acceptedQty: 10,
              rate: 4500,
              remarks: 'Grade ISO VG 220 certified',
            },
          ],
        },
      },
    });
  }

  if (sup1 && itm2 && branchStore) {
    // PO 3: Approved (Awaiting Inward) in North Regional Warehouse
    await prisma.purchaseOrder.upsert({
      where: { poNumber: 'PO-2026-0003' },
      update: {},
      create: {
        poNumber: 'PO-2026-0003',
        poDate: new Date(),
        partyId: sup1.id,
        storeId: branchStore.id,
        status: POStatus.APPROVED,
        subtotal: 10800,
        discount: 0,
        taxAmount: 1944,
        totalAmount: 12744,
        notes: 'Regional warehouse backup maintenance stock',
        items: {
          create: [
            {
              itemId: itm2.id,
              quantity: 30,
              rate: 360,
              discountPercent: 0,
              taxPercent: 18,
              total: 12744,
              receivedQty: 0,
            },
          ],
        },
      },
    });
  }

  console.log('✅ Purchase Orders and Material Inwards seeded');

  // 6. Seed Payments, Receipts, Expenses, and Income
  const bankAccount = await prisma.ledgerAccount.findUnique({ where: { code: '1020' } });
  const cashAccount = await prisma.ledgerAccount.findUnique({ where: { code: '1010' } });
  const rentAccount = await prisma.ledgerAccount.findUnique({ where: { code: '5020' } });
  const salesAccount = await prisma.ledgerAccount.findUnique({ where: { code: '4010' } });
  const supplier1 = await prisma.party.findUnique({ where: { code: 'PRT-SUP-001' } });
  const supplier2 = await prisma.party.findUnique({ where: { code: 'PRT-SUP-002' } });
  const customer1 = await prisma.party.findUnique({ where: { code: 'PRT-CUS-001' } });

  const today = new Date();

  // Payments
  if (bankAccount && supplier1) {
    await prisma.payment.upsert({
      where: { paymentNumber: 'PAY-2026-001' },
      update: {},
      create: {
        paymentNumber: 'PAY-2026-001',
        paymentDate: today,
        partyId: supplier1.id,
        accountId: bankAccount.id,
        amount: 85000,
        paymentMode: 'BANK_TRANSFER',
        referenceNo: 'HDFC-NEFT-984210',
        notes: "Part payment against raw material procurement invoice",
      },
    });
  }

  if (cashAccount && supplier2) {
    await prisma.payment.upsert({
      where: { paymentNumber: 'PAY-2026-002' },
      update: {},
      create: {
        paymentNumber: 'PAY-2026-002',
        paymentDate: today,
        partyId: supplier2.id,
        accountId: cashAccount.id,
        amount: 25000,
        paymentMode: 'CASH',
        referenceNo: 'CASH-VCH-104',
        notes: "Immediate cash settlement for lubricant delivery",
      },
    });
  }

  // Receipts
  if (bankAccount && customer1) {
    await prisma.receipt.upsert({
      where: { receiptNumber: 'REC-2026-001' },
      update: {},
      create: {
        receiptNumber: 'REC-2026-001',
        receiptDate: today,
        partyId: customer1.id,
        accountId: bankAccount.id,
        amount: 145000,
        paymentMode: 'BANK_TRANSFER',
        referenceNo: 'AXIS-RTGS-772911',
        notes: "Client advance for structural beam order",
      },
    });

    await prisma.receipt.upsert({
      where: { receiptNumber: 'REC-2026-002' },
      update: {},
      create: {
        receiptNumber: 'REC-2026-002',
        receiptDate: today,
        partyId: customer1.id,
        accountId: bankAccount.id,
        amount: 65000,
        paymentMode: 'CHEQUE',
        referenceNo: 'CHQ-882190',
        notes: "Milestone completion payment",
      },
    });
  }

  // Expenses
  if (rentAccount && mainStore) {
    await prisma.expense.upsert({
      where: { expenseNumber: 'EXP-2026-001' },
      update: {},
      create: {
        expenseNumber: 'EXP-2026-001',
        expenseDate: today,
        storeId: mainStore.id,
        accountId: rentAccount.id,
        amount: 42000,
        paymentMode: 'BANK_TRANSFER',
        category: 'RENT',
        description: 'Monthly industrial warehouse lease payment',
      },
    });

    await prisma.expense.upsert({
      where: { expenseNumber: 'EXP-2026-002' },
      update: {},
      create: {
        expenseNumber: 'EXP-2026-002',
        expenseDate: today,
        storeId: mainStore.id,
        accountId: rentAccount.id,
        amount: 8500,
        paymentMode: 'CASH',
        category: 'UTILITIES',
        description: 'Electricity, water and high-speed fiber internet charges',
      },
    });
  }

  // Income
  if (salesAccount && mainStore) {
    await prisma.income.upsert({
      where: { incomeNumber: 'INC-2026-001' },
      update: {},
      create: {
        incomeNumber: 'INC-2026-001',
        incomeDate: today,
        storeId: mainStore.id,
        accountId: salesAccount.id,
        amount: 98000,
        paymentMode: 'BANK_TRANSFER',
        category: 'CONSULTING_SALES',
        description: 'Engineering fabrication consultancy and material handling advisory',
      },
    });

    await prisma.income.upsert({
      where: { incomeNumber: 'INC-2026-002' },
      update: {},
      create: {
        incomeNumber: 'INC-2026-002',
        incomeDate: today,
        storeId: mainStore.id,
        accountId: salesAccount.id,
        amount: 24000,
        paymentMode: 'UPI',
        category: 'SCRAP_SALE',
        description: 'Secondary steel offcut and empty barrel scrap disposal',
      },
    });
  }

  console.log('✅ Payments, Receipts, Expenses, and Income records seeded');

  console.log('🎉 PROZEN Store & Accounts database seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

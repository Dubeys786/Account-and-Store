import { UserRole, PartyType, AccountGroup, BalanceType, PartyStatus } from '@prisma/client';
import { prisma, initDatabase } from './db';
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

  // 2. Seed Users
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Prozen@123', salt);

  // ADMIN user
  await prisma.user.upsert({
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
  await prisma.user.upsert({
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
  await prisma.user.upsert({
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

  console.log('🎉 PROZEN Store & Accounts database seeding completed successfully!');
}

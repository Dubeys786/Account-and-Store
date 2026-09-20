import { AccountGroup, BalanceType } from '@prisma/client';
import { prisma, initDatabase } from '../src/config/db';
import { seedRbacSystem } from '../src/config/rbac-seed';

/**
 * Clean Prisma Seed for STOCKLEDGER.
 * Seeds ONLY essential infrastructure:
 * 1. Physical store locations (STR-001, STR-002)
 * 2. System Chart of Accounts (11 system accounts for double-entry bookkeeping)
 * 3. RBAC Roles, Permissions, and System Users (Sakshi & Akhilesh)
 *
 * ZERO demo items, parties, purchase orders, material inwards, or financial transactions are seeded.
 */
export async function seedDatabase() {
  console.log('⚙️ Verifying STOCKLEDGER system infrastructure...');
  await initDatabase();

  // 1. Ensure physical stores exist
  await prisma.store.upsert({
    where: { code: 'STR-001' },
    update: {},
    create: {
      code: 'STR-001',
      name: 'Main Central Store',
      location: 'Building A, Industrial Complex',
      address: 'Plot 12, Industrial Area, Sector 58',
      phone: '+91 98765 43210',
      email: 'store.central@stockledger.com',
    },
  });

  await prisma.store.upsert({
    where: { code: 'STR-002' },
    update: {},
    create: {
      code: 'STR-002',
      name: 'North Regional Warehouse',
      location: 'Logistics Hub, North Zone',
      address: 'Gate 4, Logistics Park, GT Road',
      phone: '+91 98765 43211',
      email: 'store.north@stockledger.com',
    },
  });

  console.log('✅ Physical stores verified: Main Central Store (STR-001), North Regional Warehouse (STR-002)');

  // 2. Ensure system Chart of Accounts exists (necessary for transaction booking)
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

  console.log(`✅ System Chart of Accounts verified (${chartOfAccounts.length} system accounts)`);

  // 3. Ensure RBAC Roles, Permissions, and System Users (Sakshi & Akhilesh) exist
  await seedRbacSystem();

  console.log('✨ System infrastructure initialization complete. Zero demo business data seeded.');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('❌ Initialization error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

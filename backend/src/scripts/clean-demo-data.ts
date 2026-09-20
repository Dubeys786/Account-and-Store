import { initDatabase, prisma } from '../config/db';

async function cleanDemoData() {
  console.log('🧹 =========================================================');
  console.log('🧹 STOCKLEDGER: PURGING ALL DEMO & TEST BUSINESS DATA');
  console.log('🧹 =========================================================\n');

  await initDatabase();

  console.log('1. Deleting demo Store & Inventory operational records...');
  const delInwItems = await prisma.materialInwardItem.deleteMany({});
  console.log(`   - material_inward_items deleted: ${delInwItems.count}`);

  const delInwards = await prisma.materialInward.deleteMany({});
  console.log(`   - material_inwards deleted: ${delInwards.count}`);

  const delPoItems = await prisma.purchaseOrderItem.deleteMany({});
  console.log(`   - purchase_order_items deleted: ${delPoItems.count}`);

  const delPos = await prisma.purchaseOrder.deleteMany({});
  console.log(`   - purchase_orders deleted: ${delPos.count}`);

  const delStockTxns = await prisma.stockTransaction.deleteMany({});
  console.log(`   - stock_transactions deleted: ${delStockTxns.count}`);

  const delItems = await prisma.item.deleteMany({});
  console.log(`   - items deleted: ${delItems.count}`);

  console.log('\n2. Deleting demo Accounts & Financial records...');
  const delJournalLines = await prisma.journalEntryLine.deleteMany({});
  console.log(`   - journal_entry_lines deleted: ${delJournalLines.count}`);

  const delJournalEntries = await prisma.journalEntry.deleteMany({});
  console.log(`   - journal_entries deleted: ${delJournalEntries.count}`);

  const delAcctTxns = await prisma.accountingTransaction.deleteMany({});
  console.log(`   - accounting_transactions deleted: ${delAcctTxns.count}`);

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`   - payments deleted: ${delPayments.count}`);

  const delReceipts = await prisma.receipt.deleteMany({});
  console.log(`   - receipts deleted: ${delReceipts.count}`);

  const delExpenses = await prisma.expense.deleteMany({});
  console.log(`   - expenses deleted: ${delExpenses.count}`);

  const delIncome = await prisma.income.deleteMany({});
  console.log(`   - income deleted: ${delIncome.count}`);

  const delParties = await prisma.party.deleteMany({});
  console.log(`   - parties deleted: ${delParties.count}`);

  console.log('\n3. Cleaning legacy/demo users (Preserving Sakshi & Akhilesh)...');
  const allowedEmails = ['dubeysakshi618@gmail.com', 'dubeyakhilesh2005@gmail.com'];
  const legacyUsers = await prisma.user.findMany({
    where: { email: { notIn: allowedEmails } },
    select: { id: true, email: true },
  });

  for (const u of legacyUsers) {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: u.id } });
    await prisma.storeUser.deleteMany({ where: { userId: u.id } });
    await prisma.profile.deleteMany({ where: { userId: u.id } });
    await prisma.auditLog.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`   - Removed legacy/test user: ${u.email}`);
  }

  console.log('\n4. Verifying preserved system records...');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, jobTitle: true, workspace: true },
  });
  console.log('   - Preserved Users:', users);

  const profiles = await prisma.profile.findMany({
    select: { fullName: true, email: true, jobTitle: true, workspace: true },
  });
  console.log('   - Preserved Profiles:', profiles);

  const stores = await prisma.store.findMany({
    select: { code: true, name: true },
  });
  console.log('   - Preserved Stores:', stores);

  const accountCount = await prisma.ledgerAccount.count();
  console.log(`   - Preserved Chart of Accounts: ${accountCount} accounts`);

  console.log('\n=========================================================');
  console.log('✨ CLEANUP COMPLETE: DATABASE IS NOW 100% EMPTY OF DEMO DATA');
  console.log('=========================================================\n');
}

cleanDemoData().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});

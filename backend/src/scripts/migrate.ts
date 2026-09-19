import { initDatabase, prisma } from '../config/db';

async function runMigration() {
  console.log('🔄 Executing database migrations...');
  await initDatabase();
  console.log('✅ Database migration finished successfully.');
  await prisma.$disconnect();
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import net from 'net';
import env from './env';

// Determine whether to use native PostgreSQL (Production) vs local embedded PGlite (Development/Test)
export const isProduction = env.NODE_ENV === 'production';
export const usePgLite = !isProduction && process.env.USE_PGLITE !== 'false';

// Data directory for embedded PostgreSQL persistence in local development
const dataDir = path.resolve(__dirname, '../../prisma/pgdata');

declare global {
  // eslint-disable-next-line no-var
  var pgliteInstance: any | undefined;
  // eslint-disable-next-line no-var
  var prismaInstance: PrismaClient | undefined;
}

function initPGliteInstance(): any {
  if (global.pgliteInstance) return global.pgliteInstance;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Clean stale lock
  const pidPath = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidPath)) {
    try {
      fs.unlinkSync(pidPath);
    } catch {}
  }

  // Lazy-load PGlite so it is NEVER loaded into memory in production
  const { PGlite } = require('@electric-sql/pglite');

  try {
    return new PGlite(dataDir);
  } catch (err: any) {
    console.warn('⚠️ PGlite startup issue detected:', err.message || err);
    console.log('🔄 Re-initializing fresh storage engine directory...');
    const bakDir = path.resolve(__dirname, `../../prisma/pgdata_corrupt_${Date.now()}`);
    try {
      fs.renameSync(dataDir, bakDir);
    } catch {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {}
    }
    fs.mkdirSync(dataDir, { recursive: true });
    return new PGlite(dataDir);
  }
}

export let pglite: any = undefined;
export let pgliteAdapter: any = undefined;

let prismaClient: PrismaClient;

if (usePgLite) {
  pglite = initPGliteInstance();
  const { PrismaPGlite } = require('pglite-prisma-adapter');
  pgliteAdapter = new PrismaPGlite(pglite);

  prismaClient =
    global.prismaInstance ||
    new PrismaClient({
      adapter: pgliteAdapter as any,
      log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

  global.pgliteInstance = pglite;
  global.prismaInstance = prismaClient;
} else {
  // In production, connect directly via native PostgreSQL using DATABASE_URL
  // Zero WebAssembly memory overhead, stays well under 512MB RAM
  prismaClient =
    global.prismaInstance ||
    new PrismaClient({
      log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

  if (env.NODE_ENV !== 'production') {
    global.prismaInstance = prismaClient;
  }
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (prismaClient as any)[prop];
  },
});

/**
 * Check if the host and port in DATABASE_URL are listening
 */
export function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function splitSqlStatements(sql: string): string[] {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  const raw = cleanSql.split(';');
  const result: string[] = [];

  for (const chunk of raw) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('--'));
    const statement = lines.join(' ').trim();
    if (statement.length > 0) {
      result.push(statement);
    }
  }

  return result;
}

async function queryCount(sql: string): Promise<number> {
  if (usePgLite && pglite) {
    const res: any = await pglite.query(sql);
    return parseInt(res?.rows?.[0]?.count || '0', 10);
  } else {
    const res: any = await prismaClient.$queryRawUnsafe(sql);
    const countVal = res?.[0]?.count ?? res?.[0]?.['count(*)'] ?? 0;
    return parseInt(countVal.toString(), 10);
  }
}

async function executeSql(sql: string): Promise<void> {
  if (usePgLite && pglite) {
    await pglite.exec(sql);
  } else {
    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      try {
        await prismaClient.$executeRawUnsafe(stmt);
      } catch (err: any) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          // Benign idempotent DDL notices
        } else {
          console.warn('⚠️ Schema DDL notice on statement:', stmt.slice(0, 60), '->', err.message || err);
        }
      }
    }
  }
}

let isInitialized = false;

/**
 * Initialize database schema and verify connectivity
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    if (usePgLite) {
      console.log('📦 Using embedded PGlite storage engine (development/test mode)...');
      if (!pglite) {
        pglite = initPGliteInstance();
        const { PrismaPGlite } = require('pglite-prisma-adapter');
        pgliteAdapter = new PrismaPGlite(pglite);
        global.pgliteInstance = pglite;
      }

      try {
        await pglite.waitReady;
      } catch (e: any) {
        console.warn('⚠️ PGlite storage corruption detected, restoring fresh storage engine...');
        const bakDir = path.resolve(__dirname, `../../prisma/pgdata_corrupt_${Date.now()}`);
        try {
          fs.renameSync(dataDir, bakDir);
        } catch {
          try {
            fs.rmSync(dataDir, { recursive: true, force: true });
          } catch {}
        }
        fs.mkdirSync(dataDir, { recursive: true });
        pglite = new (require('@electric-sql/pglite').PGlite)(dataDir);
        await pglite.waitReady;
        const { PrismaPGlite } = require('pglite-prisma-adapter');
        pgliteAdapter = new PrismaPGlite(pglite);
        prismaClient = new PrismaClient({
          adapter: pgliteAdapter as any,
          log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
        global.pgliteInstance = pglite;
        global.prismaInstance = prismaClient;
      }
    } else {
      console.log('🔌 Initializing native PostgreSQL connection pool via DATABASE_URL...');
      await prismaClient.$connect();
      console.log('✅ Connected to PostgreSQL database successfully.');
    }

    console.log('🔍 Checking database connectivity and schema...');

    const userTableCount = await queryCount(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );

    if (userTableCount === 0) {
      console.log('📦 Executing initial PostgreSQL migration DDL...');
      const candidates = [
        path.resolve(__dirname, '../../prisma/migrations/20260919000000_init/migration.sql'),
        path.resolve(process.cwd(), 'prisma/migrations/20260919000000_init/migration.sql'),
      ];
      const migrationFile = candidates.find((p) => fs.existsSync(p));

      if (migrationFile) {
        let ddl = fs.readFileSync(migrationFile, 'utf-8');
        if (ddl.charCodeAt(0) === 0xfeff) {
          ddl = ddl.slice(1);
        }
        await executeSql(ddl);
        console.log('✅ PostgreSQL database schema and tables created successfully!');
      } else {
        console.warn('⚠️  Could not locate migration.sql file to bootstrap schema');
      }
    } else {
      console.log('✅ PostgreSQL database schema verified (tables present)');
    }

    // Check if Phase 3 columns exist
    const partyMobileColCount = await queryCount(
      "SELECT count(*) FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'mobile'"
    );

    if (partyMobileColCount === 0) {
      console.log('📦 Executing Phase 3 accounts migration...');
      const phase3Candidates = [
        path.resolve(__dirname, '../../prisma/migrations/20260919010000_phase3_accounts/migration.sql'),
        path.resolve(process.cwd(), 'prisma/migrations/20260919010000_phase3_accounts/migration.sql'),
      ];
      const phase3File = phase3Candidates.find((p) => fs.existsSync(p));

      if (phase3File) {
        let ddl = fs.readFileSync(phase3File, 'utf-8');
        if (ddl.charCodeAt(0) === 0xfeff) {
          ddl = ddl.slice(1);
        }
        await executeSql(ddl);
        console.log('✅ Phase 3 accounts migration applied successfully!');
      } else {
        console.warn('⚠️  Could not locate Phase 3 migration.sql file');
      }
    }

    // Phase 8: Ensure partyId and referenceNo columns exist on expenses and income
    try {
      await executeSql(`
        ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "partyId" TEXT REFERENCES "parties"("id");
        ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
        ALTER TABLE "income" ADD COLUMN IF NOT EXISTS "partyId" TEXT REFERENCES "parties"("id");
        ALTER TABLE "income" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
      `);
      console.log('✅ Phase 8 accounting operations schema verified (expenses & income columns)');
    } catch (e: any) {
      console.warn('Phase 8 schema column check:', e.message || e);
    }

    // Return Age Tracking & Damaged Stock Schema Evolution
    try {
      await executeSql(`
        ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "original_issue_id" TEXT REFERENCES "stock_transactions"("id");
        ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "return_date" TIMESTAMP(3);
        ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'Good';
        ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "return_reason" TEXT;
        ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "days_held" INTEGER;
        ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "damaged_stock" DOUBLE PRECISION DEFAULT 0;
      `);
      console.log('✅ Return Age Tracking & Damaged Stock schema columns verified.');
    } catch (e: any) {
      console.warn('Return Age schema evolution check:', e.message || e);
    }

    // Purchase Order Items: Ensure unit column exists
    try {
      await executeSql(`
        ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "unit" TEXT;
      `);
      console.log('✅ Purchase Order Items schema verified (unit column).');
    } catch (e: any) {
      console.warn('PO items unit column check:', e.message || e);
    }

    // Live Cash & Bank Position: Ensure storeId exists on journal_entries, payments, receipts
    try {
      await executeSql(`
        ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "storeId" TEXT REFERENCES "stores"("id");
        CREATE INDEX IF NOT EXISTS "journal_entries_storeId_idx" ON "journal_entries"("storeId");

        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "storeId" TEXT REFERENCES "stores"("id");
        CREATE INDEX IF NOT EXISTS "payments_storeId_idx" ON "payments"("storeId");

        ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "storeId" TEXT REFERENCES "stores"("id");
        CREATE INDEX IF NOT EXISTS "receipts_storeId_idx" ON "receipts"("storeId");

        -- Backfill journal_entries.storeId from accounting_transactions
        UPDATE "journal_entries" je
        SET "storeId" = at."storeId"
        FROM "accounting_transactions" at
        WHERE je."id" = at."journalEntryId" AND je."storeId" IS NULL;

        -- Backfill journal_entries.storeId from expenses
        UPDATE "journal_entries" je
        SET "storeId" = e."storeId"
        FROM "expenses" e
        WHERE (je."referenceId" = e."id" OR je."entryNumber" = 'JV-' || e."expenseNumber")
          AND je."storeId" IS NULL;

        -- Backfill journal_entries.storeId from income
        UPDATE "journal_entries" je
        SET "storeId" = i."storeId"
        FROM "income" i
        WHERE (je."referenceId" = i."id" OR je."entryNumber" = 'JV-' || i."incomeNumber")
          AND je."storeId" IS NULL;

        -- Backfill payments.storeId from accounting_transactions
        UPDATE "payments" p
        SET "storeId" = at."storeId"
        FROM "accounting_transactions" at
        WHERE p."transactionId" = at."id" AND p."storeId" IS NULL;

        -- Backfill payments & receipts storeId from parties if store-assigned
        UPDATE "payments" p
        SET "storeId" = prt."storeId"
        FROM "parties" prt
        WHERE p."partyId" = prt."id" AND p."storeId" IS NULL AND prt."storeId" IS NOT NULL;

        UPDATE "receipts" r
        SET "storeId" = prt."storeId"
        FROM "parties" prt
        WHERE r."partyId" = prt."id" AND r."storeId" IS NULL AND prt."storeId" IS NOT NULL;
      `);
      console.log('✅ Cash & Bank position schema verified (journal_entries, payments, receipts storeId columns).');
    } catch (e: any) {
      console.warn('Cash & Bank storeId schema check:', e.message || e);
    }

    // Notification System Schema
    try {
      await executeSql(`
        CREATE TABLE IF NOT EXISTS "notifications" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'SYSTEM',
          "reference_type" TEXT NOT NULL,
          "reference_id" TEXT,
          "is_read" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "read_at" TIMESTAMP(3)
        );
        CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
        CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
        CREATE INDEX IF NOT EXISTS "notifications_ref_idx" ON "notifications"("reference_type", "reference_id");
      `);
      console.log('✅ Notification system schema verified.');
    } catch (e: any) {
      console.warn('Notification schema check:', e.message || e);
    }

    // RBAC System: Ensure roles, permissions, role_permissions, user_roles tables exist
    try {
      const roleTableCount = await queryCount(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles'"
      );

      if (roleTableCount === 0) {
        console.log('📦 Executing RBAC migration...');
        const rbacCandidates = [
          path.resolve(__dirname, '../../prisma/migrations/20260920000000_rbac_system/migration.sql'),
          path.resolve(process.cwd(), 'prisma/migrations/20260920000000_rbac_system/migration.sql'),
        ];
        const rbacFile = rbacCandidates.find((p) => fs.existsSync(p));

        if (rbacFile) {
          let ddl = fs.readFileSync(rbacFile, 'utf-8');
          if (ddl.charCodeAt(0) === 0xfeff) {
            ddl = ddl.slice(1);
          }
          await executeSql(ddl);
          console.log('✅ RBAC schema (roles, permissions, role_permissions, user_roles) applied successfully!');
        } else {
          // Direct fallback execution
          await executeSql(`
            CREATE TABLE IF NOT EXISTS "roles" (
              "id" TEXT PRIMARY KEY,
              "name" TEXT NOT NULL UNIQUE,
              "description" TEXT,
              "isSystem" BOOLEAN NOT NULL DEFAULT false,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "permissions" (
              "id" TEXT PRIMARY KEY,
              "name" TEXT NOT NULL UNIQUE,
              "module" TEXT NOT NULL,
              "description" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "role_permissions" (
              "id" TEXT PRIMARY KEY,
              "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
              "permissionId" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE ("roleId", "permissionId")
            );
            CREATE TABLE IF NOT EXISTS "user_roles" (
              "id" TEXT PRIMARY KEY,
              "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE ("userId", "roleId")
            );
            ALTER TABLE "store_users" ADD COLUMN IF NOT EXISTS "accessLevel" TEXT NOT NULL DEFAULT 'FULL';
            ALTER TABLE "store_users" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace" TEXT;
            CREATE TABLE IF NOT EXISTS "profiles" (
              "id" TEXT PRIMARY KEY,
              "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
              "full_name" TEXT NOT NULL,
              "email" TEXT NOT NULL,
              "job_title" TEXT NOT NULL,
              "workspace" TEXT NOT NULL,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          console.log('✅ RBAC and Profile schema applied via DDL execution.');
        }
      }

      // Always ensure profile table and user profile columns exist
      await executeSql(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace" TEXT;
        CREATE TABLE IF NOT EXISTS "profiles" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
          "full_name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "job_title" TEXT NOT NULL,
          "workspace" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ User Profile schema (job_title, workspace, profiles) verified.');
    } catch (e: any) {
      console.warn('RBAC schema migration check:', e.message || e);
    }

    isInitialized = true;
  } catch (err: any) {
    console.error('❌ Database bootstrap error:', err.message || err);
    throw err;
  }
}

export default prisma;

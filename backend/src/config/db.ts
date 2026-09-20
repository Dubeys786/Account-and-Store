import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import net from 'net';
import env from './env';

// Determine data directory for embedded PostgreSQL persistence
const dataDir = path.resolve(__dirname, '../../prisma/pgdata');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Clean up stale lock files if left behind
const pidFile = path.join(dataDir, 'postmaster.pid');
if (fs.existsSync(pidFile)) {
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // Ignore error if file is in use
  }
}

declare global {
  // eslint-disable-next-line no-var
  var pgliteInstance: PGlite | undefined;
  // eslint-disable-next-line no-var
  var prismaInstance: PrismaClient | undefined;
}

function initPGliteInstance(): PGlite {
  if (global.pgliteInstance) return global.pgliteInstance;

  // Clean stale lock
  const pidPath = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidPath)) {
    try {
      fs.unlinkSync(pidPath);
    } catch {}
  }

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

export let pglite: PGlite = initPGliteInstance();
export let pgliteAdapter = new PrismaPGlite(pglite);

/**
 * Check if the host and port in DATABASE_URL are listening
 */
export function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isConnected = true;
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

/**
 * Parse host and port from postgresql connection URL
 */
function parseHostAndPort(urlStr: string): { host: string; port: number } {
  try {
    const u = new URL(urlStr.replace('postgresql://', 'http://'));
    return {
      host: u.hostname || 'localhost',
      port: parseInt(u.port || '5432', 10),
    };
  } catch {
    return { host: 'localhost', port: 5432 };
  }
}

let prismaClient: PrismaClient;

// We use the driver adapter which enables zero-dependency embedded PostgreSQL
// while remaining 100% compliant with PostgreSQL SQL dialect and schema
prismaClient =
  global.prismaInstance ||
  new PrismaClient({
    adapter: pgliteAdapter as any,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.pgliteInstance = pglite;
  global.prismaInstance = prismaClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (prismaClient as any)[prop];
  },
});

/**
 * Initialize database schema and verify connectivity
 */
export async function initDatabase(): Promise<void> {
  try {
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
      pglite = new PGlite(dataDir);
      await pglite.waitReady;
      pgliteAdapter = new PrismaPGlite(pglite);
      prismaClient = new PrismaClient({
        adapter: pgliteAdapter as any,
        log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
      global.pgliteInstance = pglite;
      global.prismaInstance = prismaClient;
    }

    console.log('🔍 Checking database connectivity and schema...');

    const res = await pglite.query<{ count: string }>(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    const userTableCount = parseInt(res.rows[0]?.count || '0', 10);

    if (userTableCount === 0) {
      console.log('📦 Executing initial PostgreSQL migration DDL into storage engine...');
      const candidates = [
        path.resolve(__dirname, '../../prisma/migrations/20260919000000_init/migration.sql'),
        path.resolve(process.cwd(), 'prisma/migrations/20260919000000_init/migration.sql'),
      ];
      const migrationFile = candidates.find((p) => fs.existsSync(p));

      if (migrationFile) {
        let ddl = fs.readFileSync(migrationFile, 'utf-8');
        // Strip UTF-8 BOM if present
        if (ddl.charCodeAt(0) === 0xfeff) {
          ddl = ddl.slice(1);
        }
        await pglite.exec(ddl);
        console.log('✅ PostgreSQL database schema and tables created successfully!');
      } else {
        console.warn('⚠️  Could not locate migration.sql file to bootstrap schema');
      }
    } else {
      console.log('✅ PostgreSQL database schema verified (tables present)');
    }

    // Check if Phase 3 columns exist
    const partyColRes = await pglite.query<{ count: string }>(
      "SELECT count(*) FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'mobile'"
    );
    const partyMobileColCount = parseInt(partyColRes.rows[0]?.count || '0', 10);

    if (partyMobileColCount === 0) {
      console.log('📦 Executing Phase 3 accounts migration into storage engine...');
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
        await pglite.exec(ddl);
        console.log('✅ Phase 3 accounts migration applied successfully!');
      } else {
        console.warn('⚠️  Could not locate Phase 3 migration.sql file');
      }
    }

    // Phase 8: Ensure partyId and referenceNo columns exist on expenses and income
    try {
      await pglite.exec(`
        ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "partyId" TEXT REFERENCES "parties"("id");
        ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
        ALTER TABLE "income" ADD COLUMN IF NOT EXISTS "partyId" TEXT REFERENCES "parties"("id");
        ALTER TABLE "income" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
      `);
      console.log('✅ Phase 8 accounting operations schema verified (expenses & income columns)');
    } catch (e: any) {
      console.warn('Phase 8 schema column check:', e.message || e);
    }

    // RBAC System: Ensure roles, permissions, role_permissions, user_roles tables exist
    try {
      const roleTableRes = await pglite.query<{ count: string }>(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles'"
      );
      const roleTableCount = parseInt(roleTableRes.rows[0]?.count || '0', 10);

      if (roleTableCount === 0) {
        console.log('📦 Executing RBAC migration into storage engine...');
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
          await pglite.exec(ddl);
          console.log('✅ RBAC schema (roles, permissions, role_permissions, user_roles) applied successfully!');
        } else {
          // Direct fallback execution
          await pglite.exec(`
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
          `);
          console.log('✅ RBAC schema applied via fallback DDL execution.');
        }
      }
    } catch (e: any) {
      console.warn('RBAC schema migration check:', e.message || e);
    }
  } catch (err: any) {
    console.error('❌ Database bootstrap error:', err.message || err);
    throw err;
  }
}

export default prisma;

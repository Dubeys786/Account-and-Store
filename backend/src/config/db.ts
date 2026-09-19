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

export const pglite: PGlite = global.pgliteInstance || new PGlite(dataDir);
export const pgliteAdapter = new PrismaPGlite(pglite);

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

export const prisma = prismaClient;

/**
 * Initialize database schema and verify connectivity
 */
export async function initDatabase(): Promise<void> {
  try {
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
  } catch (err: any) {
    console.error('❌ Database bootstrap error:', err.message || err);
    throw err;
  }
}

export default prisma;

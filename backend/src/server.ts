import app from './app';
import env from './config/env';
import { initDatabase, prisma } from './config/db';
import { seedDatabase } from './config/seed';
import logger from './utils/logger';

async function startServer() {
  try {
    logger.info('🚀 Starting STOCKLEDGER Store & Accounts Management Backend Server...');

    // 1. Initialize and verify PostgreSQL schema
    await initDatabase();

    // 2. Ensure essential stores, system accounts, and RBAC system exist
    await seedDatabase();

    // 3. Start Express HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`========================================================`);
      logger.info(`  STOCKLEDGER Store & Accounts API running at: http://localhost:${env.PORT}`);
      logger.info(`  Environment: ${env.NODE_ENV}`);
      logger.info(`  Health Check: http://localhost:${env.PORT}/api/v1/health`);
      logger.info(`========================================================`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully closing server and database connections...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server successfully shut down.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error: any) {
    logger.error('❌ Fatal error during server startup:', error);
    process.exit(1);
  }
}

startServer();

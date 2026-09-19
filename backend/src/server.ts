import app from './app';
import env from './config/env';
import { initDatabase, prisma } from './config/db';
import { seedDatabase } from './config/seed';
import logger from './utils/logger';

async function startServer() {
  try {
    logger.info('🚀 Starting PROZEN Store & Accounts Management Backend Server...');

    // 1. Initialize and verify PostgreSQL schema
    await initDatabase();

    // 2. Check if default admin user exists; if not, run automatic seed
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      logger.info('🌱 Empty database detected. Auto-seeding initial users and chart of accounts...');
      await seedDatabase();
    } else {
      logger.info(`✅ Database ready with ${userCount} registered system users.`);
    }

    // 3. Start Express HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`========================================================`);
      logger.info(`  PROZEN Store & Accounts API running at: http://localhost:${env.PORT}`);
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

import { Request, Response } from 'express';
import prisma from '../../config/db';

export class HealthController {
  static async check(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      // Test database connectivity
      const [userCount, storeCount, itemCount] = await Promise.all([
        prisma.user.count(),
        prisma.store.count(),
        prisma.item.count(),
      ]);

      const latencyMs = Date.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'PROZEN Store & Accounts Management API is healthy.',
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          environment: process.env.NODE_ENV || 'development',
          database: {
            status: 'connected',
            provider: 'PostgreSQL',
            latencyMs,
            counts: {
              users: userCount,
              stores: storeCount,
              items: itemCount,
            },
          },
        },
      });
    } catch (error: any) {
      res.status(503).json({
        success: false,
        message: 'Database connectivity health check failed.',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

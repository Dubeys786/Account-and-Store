import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import prisma from '../config/db';
import { AuthUser } from '../types';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid Bearer token.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        storeUsers: {
          select: { storeId: true, isDefault: true },
        },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account not found or is currently inactive.',
      });
      return;
    }

    const defaultStore = user.storeUsers.find((su) => su.isDefault);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      storeIds: user.storeUsers.map((su) => su.storeId),
      defaultStoreId: defaultStore ? defaultStore.storeId : user.storeUsers[0]?.storeId || null,
    };

    req.user = authUser;

    // Optional active store header
    const requestedStoreId = req.headers['x-store-id'] as string;
    if (requestedStoreId) {
      req.activeStoreId = requestedStoreId;
    } else if (authUser.defaultStoreId) {
      req.activeStoreId = authUser.defaultStoreId;
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication verification.',
      error: error.message,
    });
  }
}

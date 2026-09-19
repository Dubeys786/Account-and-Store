import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db';
import env from '../../config/env';
import { AuthUser } from '../../types';

export class AuthService {
  static async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        storeUsers: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated. Please contact your system administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    // Sign JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Record login audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } catch {
      // Non-blocking audit log failure
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

    const stores = user.storeUsers.map((su) => ({
      id: su.store.id,
      code: su.store.code,
      name: su.store.name,
      location: su.store.location,
      isDefault: su.isDefault,
    }));

    return {
      token,
      user: authUser,
      stores,
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        storeUsers: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const defaultStore = user.storeUsers.find((su) => su.isDefault);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        storeIds: user.storeUsers.map((su) => su.storeId),
        defaultStoreId: defaultStore ? defaultStore.storeId : user.storeUsers[0]?.storeId || null,
      },
      stores: user.storeUsers.map((su) => ({
        id: su.store.id,
        code: su.store.code,
        name: su.store.name,
        location: su.store.location,
        isDefault: su.isDefault,
      })),
    };
  }
}

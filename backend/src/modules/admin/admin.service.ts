import bcrypt from 'bcryptjs';
import prisma from '../../config/db';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../../services/rbac.service';

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  roles: string[];
  storeIds?: string[];
  defaultStoreId?: string;
}

export class AdminService {
  /**
   * List all users with their assigned roles and store access
   */
  static async getUsers() {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        storeUsers: {
          include: {
            store: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const assignedRoles = u.userRoles.length > 0 
        ? u.userRoles.map((ur) => ur.role.name)
        : [u.role];

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        legacyRole: u.role,
        roles: assignedRoles,
        stores: u.storeUsers.map((su) => ({
          id: su.store.id,
          name: su.store.name,
          code: su.store.code,
          isDefault: su.isDefault,
        })),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });
  }

  /**
   * Get single user details with full RBAC data
   */
  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
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

    const rbacData = await RbacService.getUserRbacData(user.id, user.role);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      legacyRole: user.role,
      roles: rbacData.roles,
      permissions: rbacData.permissions,
      accessibleWorkspaces: rbacData.accessibleWorkspaces,
      stores: user.storeUsers.map((su) => ({
        id: su.store.id,
        name: su.store.name,
        code: su.store.code,
        isDefault: su.isDefault,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Create a new user with roles and store assignments
   */
  static async createUser(data: CreateUserInput, adminUserId: string) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new Error(`User with email '${data.email}' already exists.`);
    }

    const rawPassword = data.password || 'Stockledger@123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // Map primary role for legacy compatibility
    let primaryLegacyRole = UserRole.STORE_USER;
    if (data.roles.includes('ADMIN')) {
      primaryLegacyRole = UserRole.ADMIN;
    } else if (data.roles.includes('ACCOUNT_MANAGER') || data.roles.includes('ACCOUNT_USER')) {
      primaryLegacyRole = UserRole.ACCOUNT_USER;
    }

    // Lookup role entities
    const dbRoles = await prisma.role.findMany({
      where: { name: { in: data.roles } },
    });

    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash,
        phone: data.phone || null,
        role: primaryLegacyRole,
        isActive: true,
      },
    });

    // Create role assignments
    if (dbRoles.length > 0) {
      await prisma.userRoleAssignment.createMany({
        data: dbRoles.map((role) => ({
          userId: newUser.id,
          roleId: role.id,
        })),
      });
    }

    // Create store assignments
    if (data.storeIds && data.storeIds.length > 0) {
      await prisma.storeUser.createMany({
        data: data.storeIds.map((storeId) => ({
          userId: newUser.id,
          storeId,
          isDefault: storeId === data.defaultStoreId || data.storeIds![0] === storeId,
        })),
      });
    }

    await AuditService.record({
      userId: adminUserId,
      action: 'CREATE',
      entity: 'User',
      entityId: newUser.id,
      newValues: {
        email: newUser.email,
        name: newUser.name,
        roles: data.roles,
        storeIds: data.storeIds,
      },
    });

    return this.getUserById(newUser.id);
  }

  /**
   * Update roles assigned to a user
   */
  static async updateUserRoles(userId: string, roleNames: string[], adminUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const previousRoles = user.userRoles.map((ur) => ur.role.name);

    // Lookup requested roles
    const dbRoles = await prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    if (roleNames.length > 0 && dbRoles.length !== roleNames.length) {
      const foundNames = dbRoles.map((r) => r.name);
      const missing = roleNames.filter((n) => !foundNames.includes(n));
      throw new Error(`Invalid roles specified: ${missing.join(', ')}`);
    }

    // Update assignments in transaction
    await prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: { userId },
      });

      if (dbRoles.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: dbRoles.map((role) => ({
            userId,
            roleId: role.id,
          })),
        });
      }

      // Sync legacy role enum
      let updatedLegacyRole = UserRole.STORE_USER;
      if (roleNames.includes('ADMIN')) {
        updatedLegacyRole = UserRole.ADMIN;
      } else if (roleNames.includes('ACCOUNT_MANAGER') || roleNames.includes('ACCOUNT_USER')) {
        updatedLegacyRole = UserRole.ACCOUNT_USER;
      } else if (roleNames.includes('STORE_MANAGER') || roleNames.includes('STORE_USER')) {
        updatedLegacyRole = UserRole.STORE_USER;
      }

      await tx.user.update({
        where: { id: userId },
        data: { role: updatedLegacyRole },
      });
    });

    await AuditService.record({
      userId: adminUserId,
      action: 'UPDATE',
      entity: 'UserRole',
      entityId: userId,
      oldValues: { roles: previousRoles },
      newValues: { roles: roleNames },
    });

    return this.getUserById(userId);
  }

  /**
   * Update store assignments for a user
   */
  static async updateUserStores(
    userId: string,
    storeIds: string[],
    defaultStoreId?: string,
    adminUserId?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { storeUsers: true },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const prevStores = user.storeUsers.map((su) => su.storeId);

    await prisma.$transaction(async (tx) => {
      await tx.storeUser.deleteMany({
        where: { userId },
      });

      if (storeIds.length > 0) {
        const effectiveDefault = defaultStoreId && storeIds.includes(defaultStoreId)
          ? defaultStoreId
          : storeIds[0];

        await tx.storeUser.createMany({
          data: storeIds.map((storeId) => ({
            userId,
            storeId,
            isDefault: storeId === effectiveDefault,
          })),
        });
      }
    });

    if (adminUserId) {
      await AuditService.record({
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'StoreUser',
        entityId: userId,
        oldValues: { storeIds: prevStores },
        newValues: { storeIds, defaultStoreId },
      });
    }

    return this.getUserById(userId);
  }

  /**
   * Toggle user active/inactive status
   */
  static async toggleUserStatus(userId: string, isActive: boolean, adminUserId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    await AuditService.record({
      userId: adminUserId,
      action: 'UPDATE',
      entity: 'UserStatus',
      entityId: userId,
      newValues: { isActive },
    });

    return { id: user.id, email: user.email, isActive: user.isActive };
  }

  /**
   * List all system roles and their assigned permissions
   */
  static async getRoles() {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissionCount: r.rolePermissions.length,
      permissions: r.rolePermissions.map((rp) => rp.permission.name),
    }));
  }

  /**
   * List all available permissions grouped by module
   */
  static async getPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) {
        grouped[p.module] = [];
      }
      grouped[p.module].push(p);
    }

    return {
      all: permissions,
      grouped,
    };
  }

  /**
   * Fetch recent audit logs
   */
  static async getAuditLogs(limit = 50, offset = 0) {
    const logs = await prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.auditLog.count();

    return {
      logs,
      total,
      limit,
      offset,
    };
  }
}

import prisma from '../../config/db';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: 'STORE' | 'ACCOUNTS' | 'SYSTEM' | 'INFO' | 'WARNING' | 'SUCCESS';
  referenceType: string;
  referenceId?: string | null;
}

export class NotificationService {
  /**
   * Create a single notification with idempotency and deduplication check.
   */
  static async createNotification(data: CreateNotificationInput) {
    // Deduplication check: prevent identical notification within recent window
    if (data.referenceId) {
      const recentWindow = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
      const existing = await prisma.notification.findFirst({
        where: {
          userId: data.userId,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          title: data.title,
          createdAt: { gte: recentWindow },
        },
      });
      if (existing) {
        return existing; // Skip duplicate
      }
    }

    return prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'SYSTEM',
        referenceType: data.referenceType,
        referenceId: data.referenceId || null,
        isRead: false,
      },
    });
  }

  /**
   * Notify all active users with Store access for a specific store.
   */
  static async notifyStoreUsers(storeId: string, event: Omit<CreateNotificationInput, 'userId'>) {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: 'ADMIN' },
            { role: 'STORE_USER' },
            { workspace: 'store' },
            { workspace: 'both' },
            { storeUsers: { some: { storeId } } },
          ],
        },
        select: { id: true },
      });

      const uniqueUserIds = Array.from(new Set(users.map((u) => u.id)));
      await Promise.all(
        uniqueUserIds.map((userId) =>
          this.createNotification({ ...event, userId, type: event.type || 'STORE' })
        )
      );
    } catch (err: any) {
      console.error('[NOTIFICATION_ERROR] Failed to notify store users:', err.message);
    }
  }

  /**
   * Notify all active users with Accounts access.
   */
  static async notifyAccountUsers(event: Omit<CreateNotificationInput, 'userId'>) {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: 'ADMIN' },
            { role: 'ACCOUNT_USER' },
            { workspace: 'accounts' },
            { workspace: 'both' },
          ],
        },
        select: { id: true },
      });

      const uniqueUserIds = Array.from(new Set(users.map((u) => u.id)));
      await Promise.all(
        uniqueUserIds.map((userId) =>
          this.createNotification({ ...event, userId, type: event.type || 'ACCOUNTS' })
        )
      );
    } catch (err: any) {
      console.error('[NOTIFICATION_ERROR] Failed to notify account users:', err.message);
    }
  }

  /**
   * Get paginated notifications for a user.
   */
  static async getUserNotifications(
    userId: string,
    options: { isRead?: boolean; type?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options.isRead !== undefined) {
      where.isRead = options.isRead;
    }
    if (options.type && options.type !== 'ALL') {
      where.type = options.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get exact unread count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read, verifying user ownership.
   */
  static async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or unauthorized.');
    }

    if (notification.isRead) {
      return notification;
    }

    return prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all unread notifications of a user as read.
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Trigger low stock alert if item is below or at reorder level and not alerted recently.
   */
  static async checkLowStockAlert(itemId: string, storeId: string) {
    try {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item) return;

      if (item.currentStock <= item.reorderLevel) {
        // Prevent duplicate low stock alert in last 24h for this item
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingAlert = await prisma.notification.findFirst({
          where: {
            referenceType: 'low_stock',
            referenceId: item.id,
            createdAt: { gte: oneDayAgo },
          },
        });

        if (!existingAlert) {
          await this.notifyStoreUsers(storeId, {
            title: 'Low Stock Alert',
            message: `${item.name} (${item.code}) is below its reorder level. Current stock: ${item.currentStock} ${item.unit} (Reorder level: ${item.reorderLevel}).`,
            type: 'WARNING',
            referenceType: 'low_stock',
            referenceId: item.id,
          });
        }
      }
    } catch (err: any) {
      console.error('[NOTIFICATION_ERROR] Low stock check failed:', err.message);
    }
  }
}

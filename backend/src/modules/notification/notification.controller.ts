import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * Retrieve current user's notifications.
   */
  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { isRead, type, page, limit } = req.query;

      let isReadFilter: boolean | undefined = undefined;
      if (isRead === 'true') isReadFilter = true;
      if (isRead === 'false') isReadFilter = false;

      const result = await NotificationService.getUserNotifications(user.id, {
        isRead: isReadFilter,
        type: type as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully.',
        data: result.notifications,
        pagination: result.pagination,
        unreadCount: result.unreadCount,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Quick endpoint for topbar bell badge.
   */
  static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const unreadCount = await NotificationService.getUnreadCount(user.id);

      res.status(200).json({
        success: true,
        message: 'Unread count retrieved.',
        unreadCount,
        data: { unreadCount },
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a specific notification as read.
   */
  static async markAsRead(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { id } = req.params;

      const updated = await NotificationService.markAsRead(id, user.id);
      const unreadCount = await NotificationService.getUnreadCount(user.id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: { notification: updated, unreadCount },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to mark notification as read.',
      });
    }
  }

  /**
   * POST /api/v1/notifications/mark-all-read
   * Mark all unread notifications as read for current user.
   */
  static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const count = await NotificationService.markAllAsRead(user.id);

      res.status(200).json({
        success: true,
        message: `${count} notifications marked as read.`,
        data: { markedCount: count, unreadCount: 0 },
      });
    } catch (error: any) {
      next(error);
    }
  }
}

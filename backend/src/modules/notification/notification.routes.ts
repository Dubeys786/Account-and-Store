import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { preventParameterTampering } from '../../middleware/security.middleware';
import { NotificationController } from './notification.controller';

const router = Router();

router.use(authenticate, preventParameterTampering);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.post('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);
router.post('/:id/read', NotificationController.markAsRead);

export default router;

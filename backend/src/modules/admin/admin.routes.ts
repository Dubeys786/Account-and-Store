import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { preventParameterTampering } from '../../middleware/security.middleware';
import { AdminController } from './admin.controller';

const router = Router();

// All admin routes strictly require authentication, security verification, and ADMIN role
router.use(authenticate, preventParameterTampering, requireRoles(['ADMIN']));

// Users management
router.get('/users', AdminController.getUsers);
router.post('/users', AdminController.createUser);
router.get('/users/:id', AdminController.getUserById);
router.put('/users/:id/roles', AdminController.updateUserRoles);
router.put('/users/:id/stores', AdminController.updateUserStores);
router.patch('/users/:id/status', AdminController.toggleUserStatus);

// Roles & Permissions inspection
router.get('/roles', AdminController.getRoles);
router.get('/permissions', AdminController.getPermissions);

// Audit trail inspection
router.get('/audit-logs', AdminController.getAuditLogs);

export default router;

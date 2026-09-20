import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { preventParameterTampering } from '../../middleware/security.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/me', authenticate, preventParameterTampering, AuthController.getMe);
router.post('/logout', authenticate, AuthController.logout);

export default router;

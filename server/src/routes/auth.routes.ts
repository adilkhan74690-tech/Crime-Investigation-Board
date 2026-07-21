import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate';
import { RequestOtpSchema, VerifyOtpSchema, ResendOtpSchema, ChangePasswordSchema } from '../validations/auth.validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', validateRequest(RequestOtpSchema), AuthController.login);
router.post('/request-otp', validateRequest(RequestOtpSchema), AuthController.login);
router.post('/change-password', validateRequest(ChangePasswordSchema), AuthController.changePassword);
router.post('/logout', authenticateToken, AuthController.logout);

export default router;

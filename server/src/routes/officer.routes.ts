import { Router } from 'express';
import { OfficerController } from '../controllers/officer.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Only SUPER_ADMIN role can manage officer profiles
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.listOfficers);
router.get('/audit-logs', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.getGlobalAuditLogs);
router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.getOfficer);
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.createOfficer);
router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.updateOfficer);
router.post('/:id/suspend', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.toggleSuspend);
router.post('/:id/reset-password', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.resetPassword);
router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.deleteOfficer);
router.get('/:id/logs', authenticateToken, authorizeRoles('SUPER_ADMIN'), OfficerController.getOfficerLogs);

export default router;

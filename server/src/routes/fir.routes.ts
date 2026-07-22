import { Router } from 'express';
import { FirController } from '../controllers/fir.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), FirController.createFir);
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR', 'SUPERINTENDENT'), FirController.listFirs);
router.patch('/:id/assign', authenticateToken, authorizeRoles('SUPER_ADMIN'), FirController.assignFir);
router.patch('/:id/status', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR', 'SUPERINTENDENT'), FirController.updateFirStatus);
router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), FirController.deleteFir);

export default router;

import { Router } from 'express';
import { FirController } from '../controllers/fir.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), FirController.createFir);
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR', 'SUPERINTENDENT'), FirController.listFirs);

export default router;

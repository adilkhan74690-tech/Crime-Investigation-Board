import { Router } from 'express';
import { CaseController } from '../controllers/case.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Endpoint permissions based on roles mapping:
// SUPER_ADMIN, INSPECTOR, SUB_INSPECTOR, SUPERINTENDENT can access case lists/details
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR', 'SUPERINTENDENT'), CaseController.listCases);
router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR', 'SUPERINTENDENT'), CaseController.getCase);

export default router;

import { Router } from 'express';
import { CaseController } from '../controllers/case.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR', 'SUPERINTENDENT'), CaseController.listCases);
router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR', 'SUPERINTENDENT'), CaseController.getCase);
router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), CaseController.deleteCase);

export default router;

import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Endpoint: Fetch immutable Audit Logs list (accessible by SUPER_ADMIN)
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), asyncHandler(async (req: any, res: any) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' }
  });
  res.json(formatResponse(logs));
}));

export default router;

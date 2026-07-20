import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';

const router = Router();

// Forensic Officer or Super Admin can upload and view forensic reports
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), asyncHandler(async (req: any, res: any) => {
  const list = await prisma.forensicReport.findMany();
  res.json(formatResponse(list));
}));

router.post('/', authenticateToken, authorizeRoles('FORENSIC_OFFICER'), asyncHandler(async (req: any, res: any) => {
  const { id, caseId, type, analyst, summary } = req.body;
  const rep = await prisma.forensicReport.create({
    data: {
      id,
      caseId,
      type,
      analyst,
      status: 'Pending Approval',
      summary,
      approvalDate: 'Awaiting Supervisor Approval'
    }
  });
  res.json(formatResponse(rep));
}));

export default router;

import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { logAudit } from '../utils/auditLogger';

const router = Router();

router.get('/', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const settings = await prisma.systemSetting.findMany();
  const sessionLifetime = settings.find(s => s.key === 'sessionLifetime')?.value || '15 Minutes (Recommended)';
  res.json(formatResponse({
    sessionLifetime,
    encryptionLevel: 'AES-GCM-256 Enabled',
    authorizedRoleMapping: 'BOARD_ADMINISTRATOR'
  }));
}));

router.post('/', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { sessionLifetime } = req.body;

  if (sessionLifetime) {
    await prisma.systemSetting.upsert({
      where: { key: 'sessionLifetime' },
      update: { value: sessionLifetime },
      create: { key: 'sessionLifetime', value: sessionLifetime }
    });

    await logAudit(
      req,
      req.user.officerId,
      req.user.role,
      'Settings Updated',
      `Session lifetime set to ${sessionLifetime}`
    ).catch(console.error);
  }

  res.json(formatResponse({ success: true, message: 'Settings saved successfully.' }));
}));

export default router;

import { Router } from 'express';
import { prisma } from '../config/database';
import { upload } from '../middleware/upload';
import { CloudinaryService } from '../services/cloudinary.service';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { NotificationService } from '../services/notification.service';
import { logAudit } from '../utils/auditLogger';

const router = Router();

// 1. List Forensic Reports
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER', 'INSPECTOR', 'SUB_INSPECTOR', 'SUPERINTENDENT'), asyncHandler(async (_req: any, res: any) => {
  const list = await prisma.forensicReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: { case: true }
  });
  res.json(formatResponse(list));
}));

// 2. Upload Forensic Report (Forensic Officer or Super Admin)
router.post('/upload', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), upload.single('file'), asyncHandler(async (req: any, res: any) => {
  const { caseId, reportTitle, type, summary, observations } = req.body;

  if (!caseId) {
    throw new ApiError(400, 'Missing target caseId for forensic report.');
  }

  let reportFileUrl = null;
  let cloudinaryPublicId = null;

  if (req.file) {
    const uploadResult = await CloudinaryService.uploadFile(req.file.buffer, req.file.originalname, 'reports');
    reportFileUrl = uploadResult.secure_url;
    cloudinaryPublicId = uploadResult.public_id;
  }

  const reportId = `REP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const forensicRecord = await prisma.forensicReport.create({
    data: {
      id: reportId,
      caseId,
      type: type || 'Forensic Lab Analysis',
      analyst: req.user.name,
      forensicOfficerId: req.user.officerId,
      reportTitle: reportTitle || (req.file ? req.file.originalname : 'Forensic Analysis Report'),
      status: 'Forensic Report Submitted',
      summary: summary || observations || 'Forensic evidence analysis completed.',
      observations: observations || summary || 'Report verified by forensic department.',
      reportFileUrl,
      cloudinaryPublicId,
      approvalDate: 'Submitted for Review'
    }
  });

  // Log Timeline entry
  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Forensic Report Submitted',
      completed: true,
      details: `Forensic report submitted by ${req.user.name}`
    }
  }).catch(() => {});

  // Update FIR / Case status automatically
  await prisma.fir.updateMany({
    where: { OR: [{ id: caseId }, { case: { id: caseId } }] },
    data: { status: 'Forensic Report Submitted' }
  }).catch(() => {});

  // Audit Log & Notification
  await logAudit(req, req.user.officerId, req.user.role, 'Forensic Report Uploaded', `Uploaded forensic report for case ${caseId}`, caseId).catch(console.error);
  await NotificationService.notifyAll(`Forensic report submitted for ${caseId} by Forensic Specialist ${req.user.name}.`, 'Info').catch(console.error);

  res.json(formatResponse(forensicRecord, 'Forensic report submitted and saved to PostgreSQL successfully.'));
}));

// Also alias POST / to /upload when file is present
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), upload.single('file'), asyncHandler(async (req: any, res: any) => {
  const { caseId, reportTitle, type, summary, observations } = req.body;
  if (req.file) {
    const uploadResult = await CloudinaryService.uploadFile(req.file.buffer, req.file.originalname, 'reports');
    const reportId = `REP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const record = await prisma.forensicReport.create({
      data: {
        id: reportId,
        caseId: caseId || 'CASE-GENERAL',
        type: type || 'Forensic Analysis',
        analyst: req.user.name,
        forensicOfficerId: req.user.officerId,
        reportTitle: reportTitle || req.file.originalname,
        status: 'Forensic Report Submitted',
        summary: summary || 'Forensic analysis completed.',
        observations: observations || summary || null,
        reportFileUrl: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id
      }
    });
    return res.json(formatResponse(record, 'Forensic report uploaded successfully.'));
  }
  const rep = await prisma.forensicReport.create({
    data: {
      id: `REP-${Math.floor(100000 + Math.random() * 900000)}`,
      caseId: caseId || 'CASE-GENERAL',
      type: type || 'General Analysis',
      analyst: req.user.name,
      status: 'Pending Approval',
      summary: summary || 'Pending report'
    }
  });
  res.json(formatResponse(rep));
}));

export default router;

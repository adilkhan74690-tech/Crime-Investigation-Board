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
import fs from 'fs';

const router = Router();

// Handler function for Forensic Report Upload
const handleForensicReportUpload = async (req: any, res: any) => {
  const { caseId, reportId, reportTitle, type, summary, findings, recommendation, observations, remarks } = req.body;

  if (!caseId) {
    throw new ApiError(400, 'Missing target caseId for forensic report.');
  }

  // Upload file to Cloudinary if available
  let reportFileUrl = null;
  let cloudinaryPublicId = null;

  if (req.file) {
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const cloudinaryResult = await CloudinaryService.uploadFile(
        fileBuffer,
        req.file.originalname,
        'forensics'
      );
      reportFileUrl = cloudinaryResult.secure_url;
      cloudinaryPublicId = cloudinaryResult.public_id;
    } catch (cloudinaryErr) {
      console.error('[DEBUG FORENSICS] Cloudinary upload failed fallback to local:', cloudinaryErr);
      reportFileUrl = `/uploads/${req.file.filename}`;
    }
  }

  const resolvedReportId = reportId || `REP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const finalTitle = reportTitle || (req.file ? req.file.originalname : 'Forensic Analysis Report');
  const finalFindings = findings || summary || 'Forensic lab analysis completed successfully.';
  const finalObservations = [
    recommendation ? `Recommendation: ${recommendation}` : null,
    observations ? `Observations: ${observations}` : null,
    remarks ? `Remarks: ${remarks}` : null
  ].filter(Boolean).join('\n') || 'Report verified by forensic department.';

  // Check if report record already exists (e.g. pending request)
  const existingReport = await prisma.forensicReport.findUnique({
    where: { id: resolvedReportId }
  });

  let forensicRecord;
  if (existingReport) {
    forensicRecord = await prisma.forensicReport.update({
      where: { id: resolvedReportId },
      data: {
        reportTitle: finalTitle,
        type: type || existingReport.type,
        analyst: req.user.name,
        forensicOfficerId: req.user.officerId,
        status: 'Forensic Report Submitted',
        summary: finalFindings,
        observations: finalObservations,
        reportFileUrl: reportFileUrl || existingReport.reportFileUrl,
        cloudinaryPublicId: cloudinaryPublicId || existingReport.cloudinaryPublicId,
        approvalDate: 'Submitted for Inspector Review'
      }
    });
  } else {
    forensicRecord = await prisma.forensicReport.create({
      data: {
        id: resolvedReportId,
        caseId,
        type: type || 'Forensic Lab Analysis',
        analyst: req.user.name,
        forensicOfficerId: req.user.officerId,
        reportTitle: finalTitle,
        status: 'Forensic Report Submitted',
        summary: finalFindings,
        observations: finalObservations,
        reportFileUrl,
        cloudinaryPublicId,
        approvalDate: 'Submitted for Inspector Review'
      }
    });
  }

  // Find linked Case & notify Inspector directly
  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, { firId: caseId }] }
  });

  const resolvedCaseId = targetCase ? targetCase.id : caseId;

  if (targetCase && targetCase.officerId) {
    await prisma.notification.create({
      data: {
        userId: targetCase.officerId,
        message: `Forensic Specialist ${req.user.name} uploaded report "${finalTitle}" for Case ${targetCase.id}.`,
        type: 'Alert'
      }
    }).catch(console.error);
  }

  // Update Evidence status to Verified Integrity & Completed
  await prisma.evidence.updateMany({
    where: { caseId: resolvedCaseId },
    data: { 
      verificationStatus: 'Verified Integrity',
      chainOfCustodyStatus: 'Forensic Analysis Completed & Verified'
    }
  }).catch(console.error);

  // Log Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: resolvedCaseId,
      step: 'Forensic Report Uploaded',
      completed: true,
      details: `Forensic report "${finalTitle}" uploaded by ${req.user.name}. Findings & recommendations submitted.`
    }
  }).catch(console.error);

  // Update FIR / Case status automatically
  await prisma.fir.updateMany({
    where: { OR: [{ id: resolvedCaseId }, { case: { id: resolvedCaseId } }] },
    data: { status: 'Forensic Report Submitted' }
  }).catch(console.error);

  // Audit Log & Role Notification
  await logAudit(req, req.user.officerId, req.user.role, 'Forensic Report Uploaded', `Uploaded forensic report ${resolvedReportId} for case ${resolvedCaseId}`, resolvedCaseId).catch(console.error);
  await NotificationService.notifyRole('SUB_INSPECTOR', `Forensic report submitted for Case ${resolvedCaseId} by Forensic Specialist ${req.user.name}.`, 'Alert').catch(console.error);

  res.json(formatResponse(forensicRecord, 'Forensic report submitted, saved in PostgreSQL, and Sub Inspector notified successfully.'));
};

// 1. List Forensic Reports
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER', 'SUB_INSPECTOR', 'SUPERINTENDENT'), asyncHandler(async (_req: any, res: any) => {
  const list = await prisma.forensicReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: { case: true }
  });
  res.json(formatResponse(list));
}));

// 2. Upload Forensic Report Routes (Forensic Officer or Super Admin)
router.post('/upload', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), upload.single('file'), asyncHandler(handleForensicReportUpload));
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), upload.single('file'), asyncHandler(handleForensicReportUpload));

export default router;

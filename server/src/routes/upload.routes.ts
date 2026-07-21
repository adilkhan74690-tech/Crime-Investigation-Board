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

// Handler function for Evidence File Upload
const handleEvidenceUpload = asyncHandler(async (req: any, res: any) => {
  if (!req.file) {
    throw new ApiError(400, 'No file attached to upload request.');
  }

  const { caseId, category, title, remarks } = req.body;
  if (!caseId) {
    throw new ApiError(400, 'Missing target caseId or firId parameter.');
  }

  const userRole = req.user.role;
  const officerId = req.user.officerId;

  // Security Check: If SUB_INSPECTOR, verify officer is assigned to target FIR/Case
  if (userRole === 'SUB_INSPECTOR') {
    const fir = await prisma.fir.findFirst({
      where: {
        OR: [
          { id: caseId },
          { case: { id: caseId } }
        ]
      }
    });
    if (fir && fir.officerId && fir.officerId !== officerId) {
      throw new ApiError(403, 'Security Clearance Denied: You can only upload evidence for your assigned FIR/Case.');
    }
  }

  // Upload to Cloudinary cib/evidence folder
  const uploadResult = await CloudinaryService.uploadFile(req.file.buffer, req.file.originalname, 'evidence');

  const evidenceId = `EVID-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const validCategory = (category || 'Other') as any;

  // Save Evidence metadata record in PostgreSQL
  const evidenceRecord = await prisma.evidence.create({
    data: {
      id: evidenceId,
      caseId,
      name: title || req.file.originalname,
      category: validCategory,
      collectionDate: new Date(),
      collectedBy: req.user.name,
      uploadedByOfficerId: officerId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      remarks: remarks || null,
      chainOfCustodyStatus: 'Secured in Vault',
      verificationStatus: 'Verified',
      previewType: req.file.mimetype.split('/')[0] || 'file',
      previewData: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryFormat: uploadResult.format,
      cloudinaryResourceType: uploadResult.resource_type,
      transfers: {
        create: [
          {
            action: 'Evidence Ingested & Uploaded',
            handler: req.user.name,
            date: new Date()
          }
        ]
      }
    },
    include: {
      transfers: true
    }
  });

  // Log Timeline step
  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Evidence Uploaded',
      completed: true,
      details: `File "${req.file.originalname}" (${(req.file.size / 1024).toFixed(1)} KB) uploaded by ${req.user.name}`
    }
  }).catch(() => {});

  // Update FIR / Case status automatically
  await prisma.fir.updateMany({
    where: { OR: [{ id: caseId }, { case: { id: caseId } }] },
    data: { status: 'Evidence Uploaded' }
  }).catch(() => {});

  // Audit Log & Notification
  await logAudit(req, officerId, userRole, 'Evidence Uploaded', `Uploaded file ${req.file.originalname} for case ${caseId}`, caseId).catch(console.error);
  await NotificationService.notifyAll(`Evidence uploaded for ${caseId}: "${title || req.file.originalname}" by ${req.user.name}.`, 'Info').catch(console.error);

  res.json(formatResponse(evidenceRecord, 'Evidence uploaded and indexed in PostgreSQL successfully.'));
});

// 1. Evidence File Upload Routes
router.post('/upload', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), upload.single('file'), handleEvidenceUpload);
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), upload.single('file'), handleEvidenceUpload);

// 2. Delete Evidence File (Uploader or Super Admin)
router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const evidenceId = req.params.id;

  const existing = await prisma.evidence.findUnique({
    where: { id: evidenceId }
  });

  if (!existing) {
    throw new ApiError(404, 'Evidence record not found.');
  }

  // Security Check: Only uploader or Super Admin can delete
  if (req.user.role === 'SUB_INSPECTOR' && existing.uploadedByOfficerId && existing.uploadedByOfficerId !== req.user.officerId) {
    throw new ApiError(403, 'Permission Denied: Only the uploader officer or Super Admin can delete this evidence file.');
  }

  // Delete from Cloudinary if public ID exists
  if (existing.cloudinaryPublicId) {
    await CloudinaryService.deleteFile(existing.cloudinaryPublicId).catch(console.error);
  }

  // Delete transfers and evidence record from PostgreSQL
  await prisma.evidenceTransfer.deleteMany({ where: { evidenceId } });
  await prisma.evidence.delete({ where: { id: evidenceId } });

  await logAudit(req, req.user.officerId, req.user.role, 'Evidence Deleted', `Deleted evidence ${evidenceId}`, existing.caseId).catch(console.error);

  res.json(formatResponse(null, `Evidence ${evidenceId} permanently deleted.`));
}));

// 3. List Evidence & Chain of Custody for a case
router.get('/case/:caseId', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { caseId } = req.params;
  const list = await prisma.evidence.findMany({
    where: {
      OR: [
        { caseId },
        { case: { firId: caseId } }
      ]
    },
    include: {
      transfers: true
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(formatResponse(list));
}));

export default router;

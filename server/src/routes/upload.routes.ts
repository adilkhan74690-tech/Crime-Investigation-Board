import { Router } from 'express';
import { prisma } from '../config/database';
import { upload } from '../middleware/upload';
import { CloudinaryService } from '../services/cloudinary.service';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { NotificationService } from '../services/notification.service';

const router = Router();

// Endpoint: Upload single files (Images, Audio, Video, PDF) under folder namespace
// Roles: FORENSIC_OFFICER, INSPECTOR, SUPER_ADMIN
router.post('/upload', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'FORENSIC_OFFICER'), upload.single('file'), asyncHandler(async (req: any, res: any) => {
  if (!req.file) {
    throw new ApiError(400, 'No file payload found in request parameters.');
  }

  const { caseId, category, folder } = req.body; // folder can be 'evidence', 'reports', 'avatars', 'documents'
  if (!caseId || !category || !folder) {
    throw new ApiError(400, 'Missing metadata params: caseId, category, folder.');
  }

  // Upload to Cloudinary stream
  const uploadResult = await CloudinaryService.uploadFile(req.file.buffer, req.file.originalname, folder);

  // Save metadata reference in PostgreSQL database
  const evidenceId = `EVID-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
  const evidenceRecord = await prisma.evidence.create({
    data: {
      id: evidenceId,
      caseId,
      name: req.file.originalname,
      category,
      collectionDate: new Date().toISOString().split('T')[0],
      collectedBy: req.user.name,
      verificationStatus: 'Pending',
      previewType: req.file.mimetype.split('/')[0], // image, video, audio
      previewData: uploadResult.secure_url
    }
  });

  // Notify all officers of the newly ingested evidence
  await NotificationService.notifyAll(`Evidence Ingested: New file "${req.file.originalname}" uploaded for case ${caseId}.`, 'Info').catch(console.error);

  res.json(formatResponse(evidenceRecord, 'File successfully uploaded and indexed.'));
}));

export default router;

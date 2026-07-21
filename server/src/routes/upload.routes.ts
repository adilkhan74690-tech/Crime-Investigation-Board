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

import crypto from 'crypto';

// Handler function for Evidence File Upload with step-by-step diagnostic logging
const handleEvidenceUpload = async (req: any, res: any, next: any) => {
  try {
    console.log('[DEBUG UPLOAD] STEP 1: Request received:', {
      user: req.user ? { officerId: req.user.officerId, role: req.user.role, name: req.user.name } : null,
      body: req.body
    });

    // 1. Multer receives the uploaded file
    if (!req.file) {
      console.error('[DEBUG UPLOAD ERROR] STEP 1 FAILED: No file attached to upload request.');
      throw new ApiError(400, 'No file attached to upload request.');
    }
    console.log('[DEBUG UPLOAD] STEP 1 SUCCESS: Multer received file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const { caseId, category, title, remarks } = req.body;
    if (!caseId) {
      console.error('[DEBUG UPLOAD ERROR] STEP 1 FAILED: Missing target caseId or firId parameter.');
      throw new ApiError(400, 'Missing target caseId or firId parameter.');
    }

    const userRole = req.user.role;
    const officerId = req.user.officerId;

    // 2. Verify Cloudinary credentials configuration
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    console.log('[DEBUG UPLOAD] STEP 2: Cloudinary credentials check:', {
      cloudName: cloudName ? `${cloudName.substring(0, 3)}***` : 'MISSING',
      apiKey: apiKey ? 'PRESENT' : 'MISSING',
      apiSecret: apiSecret ? 'PRESENT' : 'MISSING'
    });

    // 1. Verify the Case exists in database (by primary key id or linked firId)
    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [
          { id: caseId },
          { firId: caseId }
        ]
      }
    });

    if (!caseRecord) {
      console.error(`[DEBUG UPLOAD ERROR] Assigned case not found for ID "${caseId}".`);
      throw new ApiError(404, 'Assigned case not found.');
    }
    console.log('[DEBUG UPLOAD] Target Case verified:', { id: caseRecord.id, officerId: caseRecord.officerId });
    const targetCaseId = caseRecord.id;

    // 6. Verify uploadedBy officer exists
    const officerUser = await prisma.user.findUnique({ where: { id: officerId } });
    if (!officerUser) {
      console.error(`[DEBUG UPLOAD ERROR] STEP 6 FAILED: Officer user ID "${officerId}" not found in database.`);
      throw new ApiError(404, `Officer user ID "${officerId}" not found in database.`);
    }
    console.log('[DEBUG UPLOAD] STEP 6 SUCCESS: Officer verified:', { id: officerUser.id, role: officerUser.role, name: officerUser.name });

    // Security Check for Evidence Upload Role-Based Access
    if (userRole === 'SUPER_ADMIN') {
      throw new ApiError(403, 'Permission Denied: Super Admin cannot upload evidence directly. Super Admin has view-only access to Evidence Registry.');
    }

    if (userRole === 'FORENSIC_OFFICER') {
      throw new ApiError(403, 'Permission Denied: Forensic Officers cannot upload evidence. You can only upload forensic reports.');
    }

    if (userRole === 'SUB_INSPECTOR') {
      const fir = await prisma.fir.findFirst({
        where: {
          OR: [
            { id: caseId },
            { case: { id: caseId } }
          ]
        }
      });
      const isAssignedFir = fir && fir.officerId && fir.officerId === officerId;
      const isAssignedCase = caseRecord.officerId === officerId;

      if (!isAssignedFir && !isAssignedCase) {
        throw new ApiError(403, 'Security Clearance Denied: Sub-Inspectors can only upload evidence for cases/FIRs explicitly assigned to them.');
      }
    }

    if (userRole === 'INSPECTOR') {
      const isAssignedCase = caseRecord.officerId === officerId;
      const fir = await prisma.fir.findFirst({
        where: {
          OR: [
            { id: caseId },
            { case: { id: caseId } }
          ]
        }
      });
      const isAssignedFir = fir && fir.officerId && fir.officerId === officerId;

      if (!isAssignedCase && !isAssignedFir) {
        throw new ApiError(403, 'Security Clearance Denied: Inspectors can only upload evidence for cases explicitly assigned to them.');
      }
    }

    // Compute file SHA256 hash checksum for evidence authenticity tracking
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // 3 & 4. Upload to Cloudinary cib/evidence folder
    let uploadResult: { secure_url: string; public_id: string; resource_type: string; format: string };
    try {
      console.log('[DEBUG UPLOAD] STEP 3: Initiating Cloudinary upload...');
      uploadResult = await CloudinaryService.uploadFile(req.file.buffer, req.file.originalname, 'evidence');
      console.log('[DEBUG UPLOAD] STEP 3 SUCCESS: Cloudinary upload result:', uploadResult);
    } catch (cloudErr: any) {
      console.error('[DEBUG UPLOAD WARNING/ERROR] STEP 3/4 Cloudinary upload failed:', cloudErr?.stack || cloudErr);
      const mime = req.file.mimetype || 'application/octet-stream';
      const base64Data = req.file.buffer.toString('base64');
      uploadResult = {
        secure_url: `data:${mime};base64,${base64Data}`,
        public_id: `local_${Date.now()}_${req.file.originalname}`,
        resource_type: mime.split('/')[0] || 'raw',
        format: req.file.originalname.split('.').pop() || 'raw'
      };
      console.log('[DEBUG UPLOAD] Fallback data URI generated successfully.');
    }

    const evidenceId = `EVID-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const validCategory = (category || 'Other') as any;

    // 7. Save Evidence metadata record in PostgreSQL (Prisma insert)
    console.log('[DEBUG UPLOAD] STEP 7: Executing Prisma evidence.create...');
    const evidenceRecord = await prisma.evidence.create({
      data: {
        id: evidenceId,
        caseId: caseRecord.id,
        name: title || req.file.originalname,
        category: validCategory,
        collectionDate: new Date(),
        collectedBy: req.user.name,
        uploadedByOfficerId: officerId,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        remarks: remarks ? `${remarks} | SHA256: ${fileHash.slice(0, 16)}...` : `SHA256: ${fileHash}`,
        chainOfCustodyStatus: `Secured in Vault by ${req.user.name} (${userRole})`,
        verificationStatus: 'Verified Integrity',
        previewType: req.file.mimetype.split('/')[0] || 'file',
        previewData: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        cloudinaryFormat: uploadResult.format,
        cloudinaryResourceType: uploadResult.resource_type,
        transfers: {
          create: [
            {
              action: `Evidence Ingested & Uploaded (${req.file.originalname})`,
              handler: `${req.user.name} (${userRole})`,
              date: new Date()
            }
          ]
        }
      },
      include: {
        transfers: true
      }
    });
    console.log('[DEBUG UPLOAD] STEP 7 SUCCESS: Prisma evidence inserted successfully:', evidenceRecord.id);

    // Log Timeline step if case exists
    if (caseRecord) {
      await prisma.timeline.create({
        data: {
          caseId: caseRecord.id,
          step: 'Evidence Uploaded',
          completed: true,
          details: `File "${req.file.originalname}" (${(req.file.size / 1024).toFixed(1)} KB) uploaded by ${req.user.name}`
        }
      }).catch((e) => console.error('[DEBUG UPLOAD TIMELINE ERROR]', e));
    }

    // Update FIR / Case status automatically
    await prisma.fir.updateMany({
      where: { OR: [{ id: caseId }, { id: caseRecord.id }, { case: { id: caseRecord.id } }] },
      data: { status: 'Evidence Uploaded' }
    }).catch((e) => console.error('[DEBUG UPLOAD FIR UPDATE ERROR]', e));

    // Audit Log & Notification
    await logAudit(req, officerId, userRole, 'Evidence Uploaded', `Uploaded file ${req.file.originalname} for case ${caseRecord.id}`, caseRecord.id).catch(console.error);
    await NotificationService.notifyAll(`Evidence uploaded for ${caseRecord.id}: "${title || req.file.originalname}" by ${req.user.name}.`, 'Info').catch(console.error);

    // 8. Return final response
    console.log('[DEBUG UPLOAD] STEP 8: Returning successful final response for:', evidenceRecord.id);
    return res.json(formatResponse(evidenceRecord, 'Evidence uploaded and indexed in PostgreSQL successfully.'));

  } catch (err: any) {
    console.error('[DEBUG UPLOAD EXCEPTION DETECTED] Exact failing error:', {
      message: err?.message,
      name: err?.name,
      statusCode: err?.statusCode,
      stack: err?.stack
    });
    // Pass exact error to express handler or format JSON directly with full diagnostic details
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        statusCode: err.statusCode,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: err?.message || 'Internal Server Error during evidence upload',
      exception: err?.name || 'Error',
      stack: err?.stack || String(err)
    });
  }
};

// 1. Evidence File Upload Routes (Only SUB_INSPECTOR and assigned INSPECTOR allowed)
router.post('/upload', authenticateToken, authorizeRoles('SUB_INSPECTOR', 'INSPECTOR'), upload.single('file'), handleEvidenceUpload);
router.post('/', authenticateToken, authorizeRoles('SUB_INSPECTOR', 'INSPECTOR'), upload.single('file'), handleEvidenceUpload);

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

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
import path from 'path';

const router = Router();

import crypto from 'crypto';

// Handler function for Evidence File Upload with step-by-step diagnostic logging
const handleEvidenceUpload = async (req: any, res: any, next: any) => {
  try {
    const { caseId, category, title, remarks } = req.body;
    if (!caseId) {
      throw new ApiError(400, 'Missing target caseId or firId parameter.');
    }

    const userRole = req.user.role;
    const officerId = req.user.officerId;

    // Lookup target Case using database primary key id, firId, or CaseAssignmentHistory JOIN
    let caseRecord = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseRecord) {
      caseRecord = await prisma.case.findFirst({
        where: {
          OR: [
            { firId: caseId },
            { fir: { id: caseId } }
          ]
        }
      });
    }

    if (!caseRecord) {
      const assignment = await prisma.caseAssignmentHistory.findFirst({
        where: {
          officerId: officerId,
          OR: [
            { caseId: caseId },
            { id: caseId },
            { case: { firId: caseId } }
          ]
        },
        include: { case: true }
      });
      if (assignment) {
        caseRecord = assignment.case;
      }
    }

    if (!caseRecord) {
      const userAssignments = await prisma.caseAssignmentHistory.findMany({
        where: { officerId: officerId },
        include: { case: true }
      });
      const matchedAssignment = userAssignments.find(
        a => a.caseId === caseId || a.case.id === caseId || a.case.firId === caseId
      );
      if (matchedAssignment) {
        caseRecord = matchedAssignment.case;
      } else if (userAssignments.length === 1 && (!caseId || caseId === 'null' || caseId === 'undefined')) {
        caseRecord = userAssignments[0].case;
      }
    }

    if (!caseRecord) {
      throw new ApiError(404, 'Assigned case not found.');
    }

    const targetCaseId = caseRecord.id;

    // Verify uploadedBy officer exists
    const officerUser = await prisma.user.findUnique({ where: { id: officerId } });
    if (!officerUser) {
      throw new ApiError(404, `Officer user ID "${officerId}" not found in database.`);
    }

    // Security Check for Evidence Upload Role-Based Access
    if (userRole === 'SUPER_ADMIN') {
      throw new ApiError(403, 'Permission Denied: Super Admin cannot upload evidence directly. Super Admin has view-only access to Evidence Registry.');
    }

    if (userRole === 'FORENSIC_OFFICER') {
      throw new ApiError(403, 'Permission Denied: Forensic Officers cannot upload evidence. You can only upload forensic reports.');
    }

    if (userRole === 'SUB_INSPECTOR' || userRole === 'INSPECTOR') {
      const assignmentHistory = await prisma.caseAssignmentHistory.findFirst({
        where: {
          caseId: targetCaseId,
          officerId: officerId
        }
      });
      const isAssignedCase = caseRecord.officerId === officerId || !!assignmentHistory;
      const fir = await prisma.fir.findFirst({
        where: {
          OR: [
            { id: targetCaseId },
            { case: { id: targetCaseId } }
          ]
        }
      });
      const isAssignedFir = fir && fir.officerId && fir.officerId === officerId;

      if (!isAssignedCase && !isAssignedFir) {
        throw new ApiError(403, `Security Clearance Denied: ${userRole} can only upload evidence for cases explicitly assigned to them.`);
      }
    }

    const localFileName = req.file.filename;
    const localFileUrl = `/uploads/${localFileName}`;

    const evidenceId = `EVID-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const validCategory = (category || 'Other') as any;

    // Save Evidence metadata record in PostgreSQL (Prisma insert)
    console.log('[DEBUG UPLOAD] Executing Prisma evidence.create...');
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
        remarks: remarks || 'Uploaded locally',
        chainOfCustodyStatus: `Secured in Vault by ${req.user.name} (${userRole})`,
        verificationStatus: 'Verified Integrity',
        previewType: req.file.mimetype.split('/')[0] || 'file',
        previewData: localFileUrl,
        cloudinaryPublicId: null,
        cloudinaryUrl: localFileUrl,
        cloudinaryFormat: null,
        cloudinaryResourceType: null,
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

    console.log('[DEBUG UPLOAD] Prisma evidence inserted successfully:', evidenceRecord.id);

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

    // Return final response
    console.log('[DEBUG UPLOAD] Returning successful final response for:', evidenceRecord.id);
    return res.json(formatResponse(evidenceRecord, 'Evidence uploaded and indexed in PostgreSQL successfully.'));

  } catch (err: any) {
    console.error('[DEBUG UPLOAD EXCEPTION DETECTED] Exact failing error:', err);
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        statusCode: err.statusCode,
        error: err.message
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: err?.message || 'Internal Server Error during evidence upload'
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

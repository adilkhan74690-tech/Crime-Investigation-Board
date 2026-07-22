import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { MailService } from '../services/mail.service';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

const router = Router();

// Onboard New Officer (restricted to SUPER_ADMIN)
router.post('/onboard-officer', authenticateToken, authorizeRoles('SUPER_ADMIN'), asyncHandler(async (req: any, res: any) => {
  const { officerId, email, name, role, department, rank } = req.body;

  if (!officerId || !email || !name || !role || !department || !rank) {
    throw new ApiError(400, 'Missing officer onboarding details: officerId, email, name, role, department, rank.');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new ApiError(400, 'Officer email already registered.');
  }

  const existingOfficer = await prisma.officer.findUnique({
    where: { id: officerId }
  });
  if (existingOfficer) {
    throw new ApiError(400, 'Officer ID already registered.');
  }

  // Generate a temporary random password
  const temporaryPassword = crypto.randomBytes(6).toString('hex');

  // Hash the password using bcrypt before storing it
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  // Save the officer's email, role, and department
  const user = await prisma.user.create({
    data: {
      id: officerId,
      email,
      name,
      password: hashedPassword,
      role,
      department,
      passwordChangeRequired: true
    }
  });

  const officer = await prisma.officer.create({
    data: {
      id: officerId,
      rank,
      avatar: `https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120`
    }
  });

  // Send a welcome email containing credentials
  await MailService.sendWelcomeEmail(email, name, officerId, temporaryPassword);

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Officer Onboarded', `Onboarded Officer ID: ${officerId} (${name}).`);

  await NotificationService.notifyAll(`Officer Onboarded: New official ${name} added under ID ${officerId}.`, 'System').catch(console.error);

  res.json(formatResponse({ officerId, email, name, role, department, rank, temporaryPassword }, 'Officer onboarded successfully. Credentials emailed.'));
}));

// Helper: Log workflow actions globally with role and IP address mapping
async function logWorkflowAction(req: any, userId: string, role: string, action: string, details: string, caseId?: string) {
  await logAudit(req, userId, role, action, details, caseId);
}

// 1. Register FIR (Sub Inspector)
router.post('/register-fir', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { id, title, description, reporter } = req.body;
  if (!id || !title || !description || !reporter) {
    throw new ApiError(400, 'Missing FIR param details.');
  }

  const fir = await prisma.fir.create({
    data: {
      id,
      title,
      description,
      reporter,
      date: new Date(),
      officerId: req.user.officerId
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'FIR Registered', `FIR ID: ${id} registered by Sub Inspector.`);
  
  await NotificationService.notifyAll(`New FIR Registered: Reference "${title}" (ID: ${id}) logged by SI.`, 'Info').catch(console.error);

  res.json(formatResponse(fir, 'FIR registered successfully.'));
}));

// 2. Create Case (Sub Inspector)
router.post('/create-case', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { id, title, crimeType, priority, location, firId, assignedOfficerId, victimName, suspectName } = req.body;

  if (!id || !title || !crimeType || !priority || !location || !firId || !assignedOfficerId || !victimName || !suspectName) {
    throw new ApiError(400, 'Missing required case initialization parameters.');
  }

  // Ensure FIR exists
  const targetFir = await prisma.fir.findUnique({ where: { id: firId } });
  if (!targetFir) {
    throw new ApiError(404, `Target FIR ID "${firId}" not found.`);
  }

  const targetOfficerId = assignedOfficerId || req.user.officerId;
  const prismaPriority = (priority === 'Critical' ? 'High' : priority) as any;

  const newCase = await prisma.case.create({
    data: {
      id,
      title,
      crimeType,
      priority: prismaPriority,
      officerId: targetOfficerId,
      location,
      status: 'Active',
      createdBy: req.user.officerId,
      victims: {
        create: [
          { name: victimName }
        ]
      },
      suspects: {
        create: [
          { name: suspectName }
        ]
      },
      timeline: {
        create: [
          { step: 'FIR Registered', completed: true, details: `Registered under reference ID: ${firId}` },
          { step: 'Case Created', completed: true, details: `Case file ${id} generated from FIR ${firId}.` },
          { step: 'Assigned', completed: true, details: `Case assigned to Officer ID: ${targetOfficerId}` }
        ]
      },
      caseNotes: {
        create: [
          { note: `Case initialized from FIR. Assigned Officer ID: ${targetOfficerId}. Victim: ${victimName}. Suspect: ${suspectName}.`, author: req.user.name }
        ]
      },
      assignmentHistory: {
        create: {
          officerId: targetOfficerId,
          assignedBy: req.user.officerId
        }
      },
      firId
    }
  });

  // Update FIR status to CASE_CREATED and ensure assigned officer is set
  await prisma.fir.update({
    where: { id: firId },
    data: {
      status: 'CASE_CREATED',
      officerId: targetOfficerId
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Case Created', `Case ${id} created from FIR ${firId} and assigned to ${targetOfficerId}.`, id);
  
  await NotificationService.createNotification(targetOfficerId, `Case Assigned: You have been assigned to case ${id}.`, 'Assignment').catch(console.error);
  await NotificationService.notifyAll(`Case Opened: New criminal case "${title}" (ID: ${id}) initialized and assigned to Officer ID ${targetOfficerId}.`, 'Info').catch(console.error);

  res.json(formatResponse(newCase, 'Case file created successfully.'));
}));


// Helper: Block modifications on CLOSED cases
async function ensureCaseNotClosed(caseId: string) {
  if (!caseId) return;
  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, { firId: caseId }] }
  });
  if (targetCase && (targetCase.status === 'CLOSED' || targetCase.status === 'Solved')) {
    throw new ApiError(400, `Cannot modify CLOSED Case "${targetCase.id}". Case file is locked in permanent read-only status.`);
  }
}

// 3. Request Forensic Analysis (Sub Inspector)

// 5. Submit Forensic Report Findings (Forensic Specialist)
router.post('/submit-forensic', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), asyncHandler(async (req: any, res: any) => {
  const { caseId, reportTitle, findings, analystName } = req.body;
  if (!caseId || !findings) throw new ApiError(400, 'Missing caseId or findings content.');
  await ensureCaseNotClosed(caseId);

  const report = await prisma.forensicReport.create({
    data: {
      id: `FOR-${Date.now().toString().slice(-6)}`,
      caseId,
      type: 'Laboratory Examination',
      analyst: analystName || req.user.name,
      reportTitle: reportTitle || 'Forensic Findings Report',
      status: 'Forensic Report Submitted',
      summary: findings,
      observations: 'Forensic examination complete.'
    }
  });

  await prisma.fir.updateMany({
    where: { OR: [{ id: caseId }, { case: { id: caseId } }] },
    data: { status: 'Forensic Report Submitted' }
  }).catch(console.error);

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Forensic Report Uploaded',
      completed: true,
      details: `Report "${reportTitle || 'Forensic Findings'}" uploaded by ${req.user.name}.`
    }
  }).catch(console.error);

  await NotificationService.notifyRole('SUB_INSPECTOR', `Forensic Report uploaded for Case ${caseId} by Specialist ${req.user.name}.`, 'Alert').catch(console.error);

  res.json(formatResponse(report, 'Forensic findings submitted for review.'));
}));

// 6. Complete Investigation (Sub Inspector)
router.post('/complete-investigation', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { caseId } = req.body;
  if (!caseId) throw new ApiError(400, 'Missing caseId.');
  await ensureCaseNotClosed(caseId);

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Investigation Completed', 'Investigation completed and submitted for Superintendent review.', caseId);

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Investigation Logged as Complete',
      completed: true,
      details: 'Sub Inspector submitted case file to Superintendent for final chargesheet sign-off.'
    }
  });

  await NotificationService.notifyRole('SUPERINTENDENT', `Case Investigation Complete: Case ${caseId} awaiting SP review.`, 'Alert').catch(console.error);

  res.json(formatResponse({ caseId, status: 'READY_FOR_CHARGESHEET' }, 'Investigation marked as complete and sent to Superintendent.'));
}));

// 7. Review Case (Superintendent / SP)
router.post('/review-case', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId, notes } = req.body;
  if (!caseId || !notes) throw new ApiError(400, 'Missing caseId or review notes.');
  await ensureCaseNotClosed(caseId);

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Superintendent Review',
      completed: true,
      details: `SP ${req.user.name} logged review notes: "${notes}"`
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Case Reviewed', `SP logged review notes for case ${caseId}`, caseId);
  await NotificationService.notifyRole('SUB_INSPECTOR', `Case ${caseId} reviewed by Superintendent ${req.user.name}.`, 'Info').catch(console.error);

  res.json(formatResponse({ caseId, notes }, 'Case review notes recorded successfully.'));
}));

// 8. Chargesheet Approval / Approve / Reject (Superintendent)
router.post('/approve-chargesheet', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(handleApproveChargesheet));
router.post('/sp/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(handleApproveChargesheet));

async function handleApproveChargesheet(req: any, res: any) {
  const { caseId } = req.body;
  if (!caseId) throw new ApiError(400, 'Missing caseId in approval request.');

  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, ...(caseId ? [{ firId: caseId }] : [])] }
  });

  if (!targetCase) throw new ApiError(404, `Case file ${caseId} not found in database.`);

  const currentStatus = targetCase.status;
  const newStatus = 'CLOSED';

  // 1. Update Case Status in PostgreSQL using valid CaseStatus enum value CLOSED
  const updatedCase = await prisma.case.update({
    where: { id: targetCase.id },
    data: { status: newStatus as any }
  });

  // 2. Update FIR Status if linked
  if (targetCase.firId || targetCase.id) {
    await prisma.fir.updateMany({
      where: { OR: [{ id: targetCase.id }, ...(targetCase.firId ? [{ id: targetCase.firId }] : [])] },
      data: { status: 'Closed' }
    }).catch(console.error);
  }

  // 3. Record Timeline Step
  await prisma.timeline.create({
    data: {
      caseId: targetCase.id,
      step: 'Chargesheet Approved',
      completed: true,
      details: `Chargesheet approved by Superintendent ${req.user?.name || 'Officer'}. Status updated from ${currentStatus} to ${newStatus}.`
    }
  }).catch(console.error);

  // 4. Record Audit Log
  const activeUserId = req.user?.officerId || req.user?.id || null;
  const activeRole = req.user?.role || 'SUPERINTENDENT';
  await logWorkflowAction(req, activeUserId, activeRole, 'Chargesheet Approved', `Superintendent approved chargesheet for Case ${targetCase.id}. Status: ${newStatus}`, targetCase.id).catch(console.error);

  // 5. Broadcast Socket.IO Realtime Events & Role Notifications
  await NotificationService.notifyRole('SUB_INSPECTOR', `Case ${targetCase.id} approved by Superintendent. Status: ${newStatus}.`, 'Info').catch(console.error);
  await NotificationService.notifyAll(`Case ${targetCase.id} chargesheet approved and moved to ${newStatus}.`, 'Info').catch(console.error);

  res.json(formatResponse(updatedCase, 'Chargesheet approved and case status updated successfully.'));
}

router.post('/sp/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId, reason } = req.body;
  if (!caseId || !reason) throw new ApiError(400, 'Missing caseId or rejection reason.');

  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, ...(caseId ? [{ firId: caseId }] : [])] }
  });

  if (!targetCase) throw new ApiError(404, `Case ${caseId} not found.`);

  const updatedCase = await prisma.case.update({
    where: { id: targetCase.id },
    data: { status: 'REJECTED_BY_SP' }
  });

  await prisma.fir.updateMany({
    where: { OR: [{ id: targetCase.id }, ...(targetCase.firId ? [{ id: targetCase.firId }] : [])] },
    data: { status: 'Rejected by SP' }
  }).catch(console.error);

  await prisma.timeline.create({
    data: {
      caseId: targetCase.id,
      step: 'Investigation Rejected',
      completed: true,
      details: `Superintendent ${req.user.name} rejected case file. Reason: "${reason}"`
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Case Rejected', `SP rejected case ${targetCase.id}: ${reason}`, targetCase.id);
  await NotificationService.notifyRole('SUB_INSPECTOR', `Case ${targetCase.id} rejected by Superintendent. Reason: ${reason}`, 'Alert').catch(console.error);

  res.json(formatResponse(updatedCase, 'Case investigation rejected and returned to active state.'));
}));

router.post('/sp/request-changes', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId, instructions } = req.body;
  if (!caseId || !instructions) throw new ApiError(400, 'Missing caseId or change instructions.');

  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, ...(caseId ? [{ firId: caseId }] : [])] }
  });

  if (!targetCase) throw new ApiError(404, `Case ${caseId} not found.`);

  const updatedCase = await prisma.case.update({
    where: { id: targetCase.id },
    data: { status: 'ADDITIONAL_INVESTIGATION_REQUIRED' }
  });

  await prisma.timeline.create({
    data: {
      caseId: targetCase.id,
      step: 'Change Request Issued',
      completed: true,
      details: `Superintendent ${req.user.name} requested changes: "${instructions}"`
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Changes Requested', `SP requested changes for case ${targetCase.id}: ${instructions}`, targetCase.id);
  await NotificationService.notifyRole('SUB_INSPECTOR', `Superintendent requested changes for Case ${targetCase.id}: ${instructions}`, 'Alert').catch(console.error);

  res.json(formatResponse(updatedCase, 'Change request sent to investigating officer successfully.'));
}));

// 9. Add Investigation Note (Sub Inspector / Super Admin)
router.post('/notes', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { caseId, note } = req.body;
  if (!caseId || !note) throw new ApiError(400, 'Missing caseId or note content.');

  const createdNote = await prisma.caseNote.create({
    data: {
      caseId,
      note,
      author: `${req.user.name} (${req.user.role})`
    }
  });

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Investigation Note Added',
      completed: true,
      details: `Note added by ${req.user.name}: "${note.length > 50 ? note.slice(0, 50) + '...' : note}"`
    }
  }).catch(console.error);

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Note Added', `Added investigation note for case ${caseId}`, caseId).catch(console.error);

  res.json(formatResponse(createdNote, 'Investigation note recorded in PostgreSQL successfully.'));
}));

// 10. Accept Forensic Report (Sub Inspector / Super Admin)
router.post('/accept-forensic-report', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { reportId, caseId } = req.body;
  if (!reportId) throw new ApiError(400, 'Missing reportId.');

  const updatedReport = await prisma.forensicReport.update({
    where: { id: reportId },
    data: {
      status: 'Approved',
      approvalDate: `Accepted by Sub Inspector ${req.user.name} on ${new Date().toLocaleDateString()}`
    }
  });

  const targetCaseId = caseId || updatedReport.caseId;

  // Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: targetCaseId,
      step: 'Forensic Report Accepted',
      completed: true,
      details: `Sub Inspector ${req.user.name} accepted forensic report "${updatedReport.reportTitle}".`
    }
  }).catch(console.error);

  await NotificationService.notifyRole('FORENSIC_OFFICER', `Forensic Report ${reportId} accepted by Sub Inspector ${req.user.name}.`, 'Info').catch(console.error);

  res.json(formatResponse(updatedReport, 'Forensic report accepted and evidence verified successfully.'));
}));

// 11. Return Forensic Report for Revision (Sub Inspector / Super Admin)
router.post('/return-forensic-report', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { reportId, caseId, remarks } = req.body;
  if (!reportId || !remarks) throw new ApiError(400, 'Missing reportId or revision remarks.');

  const existing = await prisma.forensicReport.findUnique({ where: { id: reportId } });
  if (!existing) throw new ApiError(404, 'Forensic report not found.');

  const updatedReport = await prisma.forensicReport.update({
    where: { id: reportId },
    data: {
      status: 'Returned for Revision',
      observations: `${existing.observations || ''}\n[Sub Inspector Revision Note]: ${remarks}`,
      approvalDate: 'Returned for Revision'
    }
  });

  const targetCaseId = caseId || existing.caseId;

  // Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: targetCaseId,
      step: 'Forensic Report Returned for Revision',
      completed: true,
      details: `Sub Inspector ${req.user.name} returned report "${existing.reportTitle}" for revision. Remarks: "${remarks}"`
    }
  }).catch(console.error);

  await NotificationService.notifyRole('FORENSIC_OFFICER', `Forensic Report ${reportId} returned for revision by Sub Inspector ${req.user.name}. Remarks: ${remarks}`, 'Alert').catch(console.error);

  res.json(formatResponse(updatedReport, 'Forensic report returned for revision successfully.'));
}));

export default router;
export { logWorkflowAction };

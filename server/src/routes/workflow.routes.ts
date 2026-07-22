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
          { step: 'First Information Report (FIR) Filed', completed: true, details: `Registered under reference ID: ${firId}` },
          { step: 'Investigation Case File Opened', completed: true, details: 'Case file generated by Sub Inspector.' },
          { step: 'Officer Assignment & Briefing', completed: true, details: `Assigned to Officer ID: ${targetOfficerId}` },
          { step: 'Investigation Underway', completed: true, details: 'Officer briefed on initial FIR findings.' }
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

// 3. Assign Inspector (Superintendent / SP)
router.post('/assign-inspector', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId, inspectorId } = req.body;

  const updatedCase = await prisma.case.update({
    where: { id: caseId },
    data: {
      officerId: inspectorId,
      assignmentHistory: {
        create: {
          officerId: inspectorId,
          assignedBy: req.user.officerId
        }
      }
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Case Assigned', `Case assigned to Inspector ID ${inspectorId}.`, caseId);
  
  // Update timeline
  await prisma.timeline.updateMany({
    where: { caseId, step: 'Officer Assignment & Briefing' },
    data: { completed: true, details: `Assigned to Inspector ID: ${inspectorId}` }
  });

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Investigation Underway',
      completed: true,
      details: `Inspector assigned by SP. Officer ID: ${inspectorId}`
    }
  });

  // Notify assigned inspector via DB & Socket
  await NotificationService.createNotification(inspectorId, `Case Assigned: You have been assigned to case ${caseId}.`, 'Assignment').catch(console.error);
  await NotificationService.notifyAll(`Case Assignment: Case ${caseId} assigned to Officer ID ${inspectorId}.`, 'Info').catch(console.error);

  res.json(formatResponse(updatedCase, 'Inspector assigned successfully.'));
}));

// 4. Request Forensic Analysis (Inspector & Sub Inspector)
router.post('/request-forensic', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { caseId } = req.body;
  const officerId = req.user.officerId;

  console.log('[DEBUG WORKFLOW] Send to Forensics request body received by backend:', req.body);
  console.log('[DEBUG WORKFLOW] Send to Forensics logged in officerId:', officerId);

  let targetCase = await prisma.case.findUnique({
    where: { id: caseId }
  });

  if (!targetCase) {
    targetCase = await prisma.case.findFirst({
      where: {
        OR: [
          { firId: caseId },
          { fir: { id: caseId } }
        ]
      }
    });
  }

  if (!targetCase) {
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
      targetCase = assignment.case;
    }
  }

  if (!targetCase) {
    const userAssignments = await prisma.caseAssignmentHistory.findMany({
      where: { officerId: officerId },
      include: { case: true }
    });
    const matchedAssignment = userAssignments.find(
      a => a.caseId === caseId || a.case.id === caseId || a.case.firId === caseId
    );
    if (matchedAssignment) {
      targetCase = matchedAssignment.case;
    } else if (userAssignments.length === 1 && (!caseId || caseId === 'null' || caseId === 'undefined')) {
      targetCase = userAssignments[0].case;
    }
  }

  if (!targetCase) {
    throw new ApiError(404, 'Assigned case not found.');
  }

  console.log('[DEBUG WORKFLOW] Send to Forensics resolved Case.id:', targetCase.id);

  const { reportId, type, summary } = req.body;

  const updatedCase = await prisma.case.update({
    where: { id: targetCase.id },
    data: { status: 'UNDER_FORENSIC_REVIEW' }
  });

  // Also update corresponding FIR status for compatibility
  await prisma.fir.updateMany({
    where: {
      OR: [
        { id: targetCase.id },
        { case: { id: targetCase.id } }
      ]
    },
    data: { status: 'UNDER_FORENSIC_REVIEW' }
  }).catch(console.error);

  // Assign Forensic Officer if available in database
  const forensicUser = await prisma.user.findFirst({
    where: { role: 'FORENSIC_OFFICER' }
  });

  const forensicReportId = reportId || `FOR-2026-${Math.floor(100 + Math.random() * 900)}`;
  const forensicReport = await prisma.forensicReport.create({
    data: {
      id: forensicReportId,
      caseId: targetCase.id,
      type: type || 'Digital Forensics',
      analyst: forensicUser ? forensicUser.name : 'Pending Assignment',
      forensicOfficerId: forensicUser ? forensicUser.id : null,
      reportTitle: `Forensic Analysis Request - ${type || 'Digital Forensics'}`,
      summary: summary || 'Forensic laboratory analysis requested by investigating officer.',
      status: 'Pending Analysis'
    }
  }).catch((e: any) => console.log('[DEBUG WORKFLOW] Forensic report note:', e.message));

  // Update Evidence Status & Chain of Custody
  await prisma.evidence.updateMany({
    where: { caseId: targetCase.id },
    data: { 
      chainOfCustodyStatus: 'Transferred to Digital Forensics Unit for Lab Analysis',
      verificationStatus: 'Under Forensic Review'
    }
  }).catch(console.error);

  const caseEvidences = await prisma.evidence.findMany({ where: { caseId: targetCase.id } });
  for (const ev of caseEvidences) {
    await prisma.evidenceTransfer.create({
      data: {
        evidenceId: ev.id,
        action: 'Transferred to Digital Forensics Unit for Analysis',
        handler: `${req.user.name} (${req.user.role})`
      }
    }).catch(() => {});
  }

  // Create Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: targetCase.id,
      step: 'Sent to Forensics',
      completed: true,
      details: `Case transferred to Digital Forensics Unit by ${req.user.name} (${req.user.role}). Request ID: ${forensicReportId}`
    }
  }).catch(console.error);

  // Generate Notifications
  await NotificationService.notifyRole('FORENSIC_OFFICER', `New Forensic Analysis requested for Case ${targetCase.id}: ${summary || type}`, 'Alert').catch(console.error);
  await NotificationService.notifyRole('INSPECTOR', `Case ${targetCase.id} sent to Digital Forensics Lab by ${req.user.name}.`, 'Info').catch(console.error);

  console.log('[DEBUG WORKFLOW] Forensic report created:', forensicReportId);

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Sent to Forensics', `Case status updated to UNDER_FORENSIC_REVIEW and forensic report ${forensicReportId} created.`, targetCase.id);

  res.json(formatResponse({ case: updatedCase, forensicReport }, 'Case status updated to UNDER_FORENSIC_REVIEW and Forensic Report created successfully.'));
}));

// 5. Submit Forensic Findings (Forensic Officer)
router.post('/submit-forensic', authenticateToken, authorizeRoles('SUPER_ADMIN', 'FORENSIC_OFFICER'), asyncHandler(async (req: any, res: any) => {
  const { reportId, summary } = req.body;

  const report = await prisma.forensicReport.update({
    where: { id: reportId },
    data: {
      summary,
      status: 'Pending Approval',
      approvalDate: 'Awaiting Superintendent Approval'
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Forensic Findings Submitted', `Findings submitted for report ${reportId}.`, report.caseId);
  
  await prisma.timeline.create({
    data: {
      caseId: report.caseId,
      step: 'Forensic Findings Ingested',
      completed: true,
      details: `Report ID: ${reportId}. Status: Pending SP Review.`
    }
  });

  await NotificationService.notifyRole('SUPERINTENDENT', `Forensic Report Submitted: Analysis complete for report ${reportId}.`, 'Alert').catch(console.error);

  res.json(formatResponse(report, 'Forensic findings submitted for review.'));
}));

// 6. Complete Investigation (Inspector)
router.post('/complete-investigation', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { caseId } = req.body;
  if (!caseId) throw new ApiError(400, 'Missing caseId.');
  
  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Investigation Completed', 'Investigation completed and submitted for Superintendent review.', caseId);

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Investigation Logged as Complete',
      completed: true,
      details: 'Inspector submitted case file to Superintendent for final chargesheet sign-off.'
    }
  });

  await NotificationService.notifyRole('SUPERINTENDENT', `Case Investigation Complete: Case ${caseId} awaiting SP review.`, 'Alert').catch(console.error);

  res.json(formatResponse({ caseId }, 'Investigation marked as completed and submitted for review.'));
}));

// 7. Review Case (Superintendent)
router.post('/review-case', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId, notes } = req.body;
  if (!caseId || !notes) throw new ApiError(400, 'Missing caseId or notes.');
  
  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Case Reviewed', `Case reviewed by Superintendent. Notes: ${notes}`, caseId);

  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Superintendent Review Logged',
      completed: true,
      details: `Review Note Excerpt: "${notes.slice(0, 50)}..."`
    }
  });

  await NotificationService.notifyAll(`Case Reviewed: Superintendent logged review notes for Case ${caseId}.`, 'Info').catch(console.error);

  res.json(formatResponse({ caseId }, 'Case review completed and logged.'));
}));

// 8. Approve Chargesheet & Close Case (Superintendent)
router.post('/approve-chargesheet', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SUPERINTENDENT'), asyncHandler(async (req: any, res: any) => {
  const { caseId } = req.body;

  const closedCase = await prisma.case.update({
    where: { id: caseId },
    data: {
      status: 'Solved'
    }
  });

  await logWorkflowAction(req, req.user.officerId, req.user.role, 'Chargesheet Approved', `Chargesheet approved and Case ${caseId} marked SOLVED.`, caseId);
  
  await prisma.timeline.create({
    data: {
      caseId,
      step: 'Case Closed & Resolved',
      completed: true,
      details: 'Chargesheet approved by Superintendent. Status: SOLVED.'
    }
  });

  await NotificationService.notifyAll(`Case Closed: Superintendent approved chargesheet. Case ${caseId} marked SOLVED.`, 'System').catch(console.error);

  res.json(formatResponse(closedCase, 'Chargesheet approved and case closed successfully.'));
}));

// 9. Add Investigation Note (Inspector / Sub Inspector / Super Admin)
router.post('/notes', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
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

// 10. Edit Investigation Note
router.put('/notes/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const noteId = parseInt(req.params.id);
  const { note } = req.body;

  if (!note) throw new ApiError(400, 'Missing note content.');

  const updatedNote = await prisma.caseNote.update({
    where: { id: noteId },
    data: { note }
  });

  await prisma.timeline.create({
    data: {
      caseId: updatedNote.caseId,
      step: 'Investigation Note Updated',
      completed: true,
      details: `Note ID ${noteId} edited by ${req.user.name}.`
    }
  }).catch(console.error);

  res.json(formatResponse(updatedNote, 'Investigation note updated successfully.'));
}));

// 11. Delete Investigation Note
router.delete('/notes/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR', 'SUB_INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const noteId = parseInt(req.params.id);

  const existing = await prisma.caseNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new ApiError(404, 'Case note not found.');

  await prisma.caseNote.delete({ where: { id: noteId } });

  await prisma.timeline.create({
    data: {
      caseId: existing.caseId,
      step: 'Investigation Note Deleted',
      completed: true,
      details: `Note ID ${noteId} deleted by ${req.user.name}.`
    }
  }).catch(console.error);

  res.json(formatResponse(null, 'Investigation note deleted successfully.'));
}));

// 12. Accept Forensic Report (Inspector / Super Admin)
router.post('/accept-forensic-report', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { reportId, caseId } = req.body;
  if (!reportId) throw new ApiError(400, 'Missing reportId.');

  const updatedReport = await prisma.forensicReport.update({
    where: { id: reportId },
    data: {
      status: 'Approved',
      approvalDate: `Accepted by Inspector ${req.user.name} on ${new Date().toLocaleDateString()}`
    }
  });

  const targetCaseId = caseId || updatedReport.caseId;

  // Update linked evidence
  await prisma.evidence.updateMany({
    where: { caseId: targetCaseId },
    data: {
      verificationStatus: 'Verified Integrity',
      chainOfCustodyStatus: 'Forensic Report Approved & Verified'
    }
  }).catch(console.error);

  // Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: targetCaseId,
      step: 'Forensic Report Accepted',
      completed: true,
      details: `Inspector ${req.user.name} accepted forensic report "${updatedReport.reportTitle}".`
    }
  }).catch(console.error);

  await NotificationService.notifyRole('FORENSIC_OFFICER', `Forensic Report ${reportId} accepted by Inspector ${req.user.name}.`, 'Info').catch(console.error);

  res.json(formatResponse(updatedReport, 'Forensic report accepted and evidence verified successfully.'));
}));

// 13. Return Forensic Report for Revision (Inspector / Super Admin)
router.post('/return-forensic-report', authenticateToken, authorizeRoles('SUPER_ADMIN', 'INSPECTOR'), asyncHandler(async (req: any, res: any) => {
  const { reportId, caseId, remarks } = req.body;
  if (!reportId || !remarks) throw new ApiError(400, 'Missing reportId or revision remarks.');

  const existing = await prisma.forensicReport.findUnique({ where: { id: reportId } });
  if (!existing) throw new ApiError(404, 'Forensic report not found.');

  const updatedReport = await prisma.forensicReport.update({
    where: { id: reportId },
    data: {
      status: 'Returned for Revision',
      observations: `${existing.observations || ''}\n[Inspector Revision Note]: ${remarks}`,
      approvalDate: 'Returned for Revision'
    }
  });

  const targetCaseId = caseId || existing.caseId;

  // Timeline entry
  await prisma.timeline.create({
    data: {
      caseId: targetCaseId,
      step: 'Forensic Report Returned',
      completed: true,
      details: `Inspector ${req.user.name} returned report "${existing.reportTitle}" for revision. Remarks: "${remarks}"`
    }
  }).catch(console.error);

  await NotificationService.notifyRole('FORENSIC_OFFICER', `Forensic Report ${reportId} returned for revision by Inspector ${req.user.name}. Remarks: ${remarks}`, 'Alert').catch(console.error);

  res.json(formatResponse(updatedReport, 'Forensic report returned for revision.'));
}));

export default router;
export { logWorkflowAction };

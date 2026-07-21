import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CaseService } from '../services/case.service';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { prisma } from '../config/database';
import { logAudit } from '../utils/auditLogger';

export class CaseController {
  public static listCases = asyncHandler(async (req: AuthRequest, res: Response) => {
    let list = await CaseService.getCases();
    if (req.user?.role === 'INSPECTOR' || req.user?.role === 'SUB_INSPECTOR') {
      list = list.filter((c: any) => c.officerId === req.user?.officerId);
    }
    const formatted = list.map((c: any) => ({
      id: c.id,
      caseNumber: c.id,
      title: c.title,
      assignedOfficerId: c.officerId,
      officerId: c.officerId,
      status: c.status,
      priority: c.priority,
      crimeType: c.crimeType,
      location: c.location,
      createdDate: c.createdDate,
      createdAt: c.createdAt,
      firId: c.firId,
      witnesses: c.witnesses,
      timeline: c.timeline,
      evidence: c.evidence,
      forensics: c.forensics,
      victims: c.victims,
      suspects: c.suspects,
      assignedOfficer: c.assignedOfficer ? {
        id: c.assignedOfficer.id,
        rank: c.assignedOfficer.rank,
        name: c.assignedOfficer.user?.name,
        email: c.assignedOfficer.user?.email
      } : null
    }));
    res.json(formatResponse(formatted));
  });

  public static getCase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const item = await CaseService.getCaseById(id as string);
    if (req.user?.role === 'INSPECTOR' || req.user?.role === 'SUB_INSPECTOR') {
      if (item.officerId !== req.user?.officerId) {
        throw new ApiError(403, 'Insufficient security level clearance for access.');
      }
    }
    res.json(formatResponse(item));
  });

  public static deleteCase = asyncHandler(async (req: Request, res: Response) => {
    const caseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      throw new ApiError(404, 'Case record not found.');
    }

    await prisma.timeline.deleteMany({ where: { caseId } });
    await prisma.caseNote.deleteMany({ where: { caseId } });
    await prisma.forensicReport.deleteMany({ where: { caseId } });

    const evidences = await prisma.evidence.findMany({ where: { caseId }, select: { id: true } });
    const evidenceIds = evidences.map(e => e.id);
    if (evidenceIds.length > 0) {
      await prisma.evidenceTransfer.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
      await prisma.evidence.deleteMany({ where: { caseId } });
    }

    await prisma.witness.deleteMany({ where: { caseId } });
    await prisma.suspect.deleteMany({ where: { caseId } });
    await prisma.victim.deleteMany({ where: { caseId } });
    await prisma.caseAssignmentHistory.deleteMany({ where: { caseId } });
    await prisma.workflowStep.deleteMany({ where: { caseId } });

    await prisma.notification.deleteMany({
      where: { message: { contains: caseId } }
    });

    await prisma.case.delete({ where: { id: caseId } });

    await logAudit(
      req,
      (req as any).user.officerId,
      (req as any).user.role,
      'Case Deleted',
      `Permanently deleted Case ${caseId}.`
    ).catch(console.error);

    res.json(formatResponse(null, `Case ${caseId} permanently deleted.`));
  });
}

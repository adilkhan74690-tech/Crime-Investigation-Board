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
    let list;
    if (req.user?.role === 'SUB_INSPECTOR') {
      list = await prisma.case.findMany({
        where: {
          OR: [
            { officerId: req.user.officerId },
            { createdBy: req.user.officerId },
            { assignmentHistory: { some: { officerId: req.user.officerId } } },
            { fir: { officerId: req.user.officerId } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedOfficer: {
            include: {
              user: true
            }
          },
          fir: true,
          witnesses: true,
          timeline: { orderBy: { createdAt: 'desc' } },
          evidence: true,
          forensics: true,
          victims: true,
          suspects: true,
          caseNotes: { orderBy: { createdAt: 'desc' } },
          assignmentHistory: true
        }
      });
    } else {
      list = await prisma.case.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          assignedOfficer: {
            include: {
              user: true
            }
          },
          fir: true,
          witnesses: true,
          timeline: { orderBy: { createdAt: 'desc' } },
          evidence: true,
          forensics: true,
          victims: true,
          suspects: true,
          caseNotes: { orderBy: { createdAt: 'desc' } },
          assignmentHistory: true
        }
      });
    }
    const formatted = list.map((c: any) => {
      const isClosed = c.status === 'CLOSED' || c.status === 'Closed' || c.status === 'Solved';
      const hasForensic = c.forensics && c.forensics.length > 0;
      const isUnderForensicReview = !isClosed && (c.status === 'UNDER_FORENSIC_REVIEW' || (c.fir && c.fir.status === 'UNDER_FORENSIC_REVIEW'));
      
      const resolvedStatus = isClosed ? 'CLOSED' : (isUnderForensicReview ? 'UNDER_FORENSIC_REVIEW' : c.status);
      
      return {
        id: c.id,
        caseNumber: c.id,
        title: c.title,
        assignedOfficerId: c.officerId,
        officerId: c.officerId,
        status: resolvedStatus,
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
        caseNotes: c.caseNotes,
        assignmentHistory: c.assignmentHistory,
        assignedOfficer: c.assignedOfficer ? {
          id: c.assignedOfficer.id,
          rank: c.assignedOfficer.rank,
          name: c.assignedOfficer.user?.name,
          email: c.assignedOfficer.user?.email
        } : null
      };
    });

    console.log(`[CASES API AUDIT] Total cases returned from PostgreSQL: ${formatted.length}`);
    console.log(`[CASES API AUDIT] Case statuses:`, formatted.map((c: any) => `${c.id}:${c.status}`));

    res.json(formatResponse(formatted));
  });

  public static getCase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const item = await prisma.case.findFirst({
      where: {
        OR: [
          { id: id as string },
          { firId: id as string }
        ]
      },
      include: {
        assignedOfficer: {
          include: {
            user: true
          }
        },
        fir: true,
        witnesses: true,
        timeline: { orderBy: { createdAt: 'desc' } },
        evidence: true,
        forensics: true,
        victims: true,
        suspects: true,
        caseNotes: { orderBy: { createdAt: 'desc' } },
        assignmentHistory: true
      }
    }) as any;

    if (!item) {
      throw new ApiError(404, 'Case record not found.');
    }

    const isClosed = item.status === 'CLOSED' || item.status === 'Closed' || item.status === 'Solved';
    const hasForensic = item.forensics && item.forensics.length > 0;
    const isUnderForensicReview = !isClosed && (item.status === 'UNDER_FORENSIC_REVIEW' || (item.fir && item.fir.status === 'UNDER_FORENSIC_REVIEW'));
    if (isClosed) {
      item.status = 'CLOSED';
    } else if (isUnderForensicReview) {
      item.status = 'UNDER_FORENSIC_REVIEW';
    }
    res.json(formatResponse(item));
  });

  public static deleteCase = asyncHandler(async (req: Request, res: Response) => {
    const caseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      throw new ApiError(404, 'Case record not found.');
    }

    if (existingCase.status === 'CLOSED' || (existingCase as any).status === 'Closed' || (existingCase as any).status === 'Solved') {
      throw new ApiError(400, 'Cannot delete a CLOSED case file. Closed cases are locked permanently for audit and history compliance.');
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

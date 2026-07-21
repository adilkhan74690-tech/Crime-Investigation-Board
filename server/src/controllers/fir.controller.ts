import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { formatResponse } from '../utils/apiResponse';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

export class FirController {
  public static createFir = asyncHandler(async (req: Request, res: Response) => {
    const { title, description, reporter, complainantContact, incidentDate, incidentTime, crimeCategory, location } = req.body;

    if (!title || !description || !reporter) {
      throw new ApiError(400, 'Title, description, and reporter complainant name are required.');
    }

    const currentYear = new Date().getFullYear();
    const prefix = `FIR-${currentYear}-`;

    let generatedId = '';
    
    // Auto-generate a unique FIR Number: FIR-YYYY-000001
    const lastFir = await prisma.fir.findFirst({
      where: {
        id: {
          startsWith: prefix
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    let nextNumber = 1;
    if (lastFir) {
      const parts = lastFir.id.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const padZero = (num: number, size: number) => {
      let s = num + "";
      while (s.length < size) s = "0" + s;
      return s;
    };

    generatedId = `${prefix}${padZero(nextNumber, 6)}`;

    // Double check uniqueness to prevent collision
    const existing = await prisma.fir.findUnique({
      where: { id: generatedId }
    });
    if (existing) {
      let uniqueFound = false;
      let count = nextNumber + 1;
      while (!uniqueFound) {
        generatedId = `${prefix}${padZero(count, 6)}`;
        const dup = await prisma.fir.findUnique({ where: { id: generatedId } });
        if (!dup) {
          uniqueFound = true;
        } else {
          count++;
        }
      }
    }

    const creatorOfficerId = (req as any).user.officerId;
    const parsedDate = incidentDate ? new Date(incidentDate) : new Date();

    // 1. REAL INVESTIGATION WORKFLOW: Status = Registered, assignedOfficer = null
    const fir = await prisma.fir.create({
      data: {
        id: generatedId,
        title,
        description,
        reporter,
        complainantContact: complainantContact || null,
        incidentTime: incidentTime || null,
        crimeCategory: crimeCategory || null,
        location: location || null,
        status: 'Registered',
        remarks: null,
        date: parsedDate,
        officerId: null
      },
      include: {
        officer: {
          include: {
            user: true
          }
        },
        case: true
      }
    });

    await logAudit(
      req,
      creatorOfficerId,
      (req as any).user.role,
      'FIR Registered',
      `Registered FIR ${generatedId}`
    ).catch(console.error);

    await NotificationService.notifyAll(
      `New FIR Registered: Reference "${title}" (ID: ${generatedId}) logged in system. Status: Registered.`,
      'Info'
    ).catch(console.error);

    res.json(formatResponse(fir, 'FIR registered successfully.'));
  });

  public static listFirs = asyncHandler(async (req: Request, res: Response) => {
    const userRole = (req as any).user.role;
    const officerId = (req as any).user.officerId;

    let whereCondition: any = {};

    if (userRole === 'SUB_INSPECTOR') {
      whereCondition = {
        officerId: officerId
      };
    } else if (userRole === 'FORENSIC_OFFICER') {
      whereCondition = {
        status: {
          in: ['Sent to Forensics', 'Under Forensic Review', 'Forensic Report Submitted']
        }
      };
    } else if (userRole === 'INSPECTOR') {
      whereCondition = {
        status: {
          in: ['Under Investigation', 'Forensic Report Submitted', 'Inspector Review', 'Pending Approval']
        }
      };
    } else if (userRole === 'SUPERINTENDENT') {
      whereCondition = {
        status: {
          in: ['Inspector Review', 'Superintendent Approval', 'Chargesheet Ready', 'Pending Approval', 'Solved', 'Closed']
        }
      };
    }

    const firs = await prisma.fir.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      include: {
        officer: {
          include: {
            user: true
          }
        },
        case: true
      }
    });
    res.json(formatResponse(firs));
  });

  // 2. SUPER ADMIN: Assign SI to FIR
  public static assignFir = asyncHandler(async (req: Request, res: Response) => {
    const firId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { officerId, remarks } = req.body;

    if (!officerId) {
      throw new ApiError(400, 'Officer ID is required for assignment.');
    }

    const targetOfficer = await prisma.officer.findUnique({
      where: { id: officerId },
      include: { user: true }
    });

    if (!targetOfficer || targetOfficer.user.role !== 'SUB_INSPECTOR') {
      throw new ApiError(400, 'Assigned officer must exist and hold the role of SUB_INSPECTOR.');
    }

    const existingFir = await prisma.fir.findUnique({ where: { id: firId } });
    if (!existingFir) {
      throw new ApiError(404, 'FIR not found.');
    }

    const updatedFir = await prisma.fir.update({
      where: { id: firId },
      data: {
        officerId,
        status: 'Assigned to SI',
        remarks: remarks || null
      },
      include: {
        officer: {
          include: {
            user: true
          }
        },
        case: true
      }
    });

    const officerName = targetOfficer.user.name;

    await logAudit(
      req,
      (req as any).user.officerId,
      (req as any).user.role,
      'FIR Assigned to SI',
      `FIR ${firId} assigned to SI ${officerName} (${officerId})`
    ).catch(console.error);

    // Create notification: "FIR FIR-XXXXX assigned to SI <Officer Name>"
    const notificationMsg = `FIR ${firId} assigned to SI ${officerName}`;
    await NotificationService.createNotification(officerId, notificationMsg, 'Assignment').catch(console.error);
    await NotificationService.notifyAll(`FIR ${firId} status updated to Assigned to SI (${officerName}).`, 'Info').catch(console.error);

    res.json(formatResponse(updatedFir, `FIR successfully assigned to SI ${officerName}.`));
  });

  // Update FIR status (Start Investigation, Forward, etc.)
  public static updateFirStatus = asyncHandler(async (req: Request, res: Response) => {
    const firId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status, remarks } = req.body;

    if (!status) {
      throw new ApiError(400, 'Status is required.');
    }

    const updatedFir = await prisma.fir.update({
      where: { id: firId },
      data: {
        status,
        remarks: remarks !== undefined ? remarks : undefined
      },
      include: {
        officer: {
          include: {
            user: true
          }
        },
        case: true
      }
    });

    await logAudit(
      req,
      (req as any).user.officerId,
      (req as any).user.role,
      'FIR Status Updated',
      `FIR ${firId} status changed to ${status}`
    ).catch(console.error);

    res.json(formatResponse(updatedFir, `FIR status updated to ${status}.`));
  });

  // Delete FIR and linked case records safely
  public static deleteFir = asyncHandler(async (req: Request, res: Response) => {
    const firId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existingFir = await prisma.fir.findUnique({
      where: { id: firId },
      include: { case: true }
    });

    if (!existingFir) {
      throw new ApiError(404, 'FIR record not found.');
    }

    const linkedCaseId = existingFir.case?.id;

    if (linkedCaseId) {
      await prisma.timeline.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.caseNote.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.forensicReport.deleteMany({ where: { caseId: linkedCaseId } });

      const evidences = await prisma.evidence.findMany({ where: { caseId: linkedCaseId }, select: { id: true } });
      const evidenceIds = evidences.map(e => e.id);
      if (evidenceIds.length > 0) {
        await prisma.evidenceTransfer.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
        await prisma.evidence.deleteMany({ where: { caseId: linkedCaseId } });
      }

      await prisma.witness.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.suspect.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.victim.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.caseAssignmentHistory.deleteMany({ where: { caseId: linkedCaseId } });
      await prisma.workflowStep.deleteMany({ where: { caseId: linkedCaseId } });

      await prisma.notification.deleteMany({
        where: {
          OR: [
            { message: { contains: linkedCaseId } },
            { message: { contains: firId } }
          ]
        }
      });

      await prisma.case.delete({ where: { id: linkedCaseId } });
    }

    await prisma.notification.deleteMany({
      where: { message: { contains: firId } }
    });

    await prisma.fir.delete({ where: { id: firId } });

    await logAudit(
      req,
      (req as any).user.officerId,
      (req as any).user.role,
      'FIR Deleted',
      `Permanently deleted FIR ${firId} and linked case records.`
    ).catch(console.error);

    res.json(formatResponse(null, `FIR ${firId} and associated records permanently deleted.`));
  });
}

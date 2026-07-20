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
    // Fetch last registered FIR for the year
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

    const officerId = (req as any).user.officerId;
    const parsedDate = incidentDate ? new Date(incidentDate) : new Date();

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
        date: parsedDate,
        officerId
      }
    });

    await logAudit(
      req,
      officerId,
      (req as any).user.role,
      'FIR Registered',
      `Registered FIR ${generatedId} by Officer ID ${officerId}`
    ).catch(console.error);

    await NotificationService.notifyAll(
      `New FIR Registered: Reference "${title}" (ID: ${generatedId}) logged.`,
      'Info'
    ).catch(console.error);

    res.json(formatResponse(fir, 'FIR registered successfully.'));
  });

  public static listFirs = asyncHandler(async (req: Request, res: Response) => {
    const firs = await prisma.fir.findMany({
      orderBy: { createdAt: 'desc' },
      include: { case: true }
    });
    res.json(formatResponse(firs));
  });
}

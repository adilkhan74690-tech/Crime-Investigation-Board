import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Endpoint: Global Search across Officers, Cases, FIRs, Evidence, Victims, Suspects, Witnesses
router.get('/', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json(formatResponse({ cases: [], officers: [], evidence: [], firs: [] }));
  }

  // 1. Search Cases (including nested victim/suspect/witness queries)
  const cases = await prisma.case.findMany({
    where: {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { crimeType: { contains: query, mode: 'insensitive' } },
        { location: { contains: query, mode: 'insensitive' } },
        {
          victims: {
            some: { name: { contains: query, mode: 'insensitive' } }
          }
        },
        {
          suspects: {
            some: { name: { contains: query, mode: 'insensitive' } }
          }
        },
        {
          witnesses: {
            some: { name: { contains: query, mode: 'insensitive' } }
          }
        }
      ]
    },
    include: {
      victims: true,
      suspects: true,
      witnesses: true
    }
  });

  // 2. Search Officers
  const officers = await prisma.officer.findMany({
    where: {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } }
            ]
          }
        }
      ]
    },
    include: {
      user: true
    }
  });

  // 3. Search Evidence
  const evidence = await prisma.evidence.findMany({
    where: {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { collectedBy: { contains: query, mode: 'insensitive' } }
      ]
    }
  });

  // 4. Search FIRs
  const firs = await prisma.fir.findMany({
    where: {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { reporter: { contains: query, mode: 'insensitive' } }
      ]
    }
  });

  res.json(formatResponse({
    cases,
    officers: officers.map(o => ({
      id: o.id,
      name: o.user.name,
      email: o.user.email,
      role: o.user.role,
      department: o.user.department,
      rank: o.rank
    })),
    evidence,
    firs
  }));
}));

export default router;

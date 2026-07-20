import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Endpoint: Fetch comprehensive platform payload for dashboard view
router.get('/dashboard-payload', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const role = req.user.role;
  const officerId = req.user.officerId;

  // Filter cases by role
  let caseWhereClause: any = {};
  if (role === 'INSPECTOR' || role === 'SUB_INSPECTOR') {
    caseWhereClause.officerId = officerId;
  }

  const cases = await prisma.case.findMany({
    where: caseWhereClause,
    include: { witnesses: true, timeline: true, evidence: true, forensics: true, victims: true, suspects: true }
  });

  const officers = await prisma.officer.findMany({
    include: { user: true }
  });

  // Filter evidence by role
  let evidenceWhereClause: any = {};
  if (role === 'INSPECTOR' || role === 'SUB_INSPECTOR') {
    evidenceWhereClause.case = { officerId };
  } else if (role === 'FORENSIC_OFFICER') {
    evidenceWhereClause.collectedBy = officerId;
  }

  const evidence = await prisma.evidence.findMany({
    where: evidenceWhereClause,
    include: { transfers: true }
  });

  // Filter forensics by role
  let forensicWhereClause: any = {};
  if (role === 'INSPECTOR') {
    forensicWhereClause.case = { officerId };
  } else if (role === 'FORENSIC_OFFICER') {
    forensicWhereClause.analyst = req.user.name;
  }

  const forensics = await prisma.forensicReport.findMany({
    where: forensicWhereClause
  });
  
  const activities = await prisma.activityLog.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
    include: { user: true }
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.officerId },
    orderBy: { timestamp: 'desc' }
  });

  // Calculate dynamic department metrics
  const uniqueDepts = await prisma.user.groupBy({
    by: ['department']
  });

  const activeOfficersCount = await prisma.user.count({
    where: { isActive: true }
  });

  const activeCasesCount = await prisma.case.count({
    where: { status: 'Active' }
  });

  const solvedCasesCount = await prisma.case.count({
    where: { status: 'Solved' }
  });

  const totalFirsCount = await prisma.fir.count();
  const pendingReviewsCount = await prisma.forensicReport.count({
    where: { status: { in: ['Pending Analysis', 'Pending Approval'] } }
  });

  const formattedOfficers = officers.map(o => ({
    id: o.id,
    name: o.user.name,
    rank: o.rank,
    department: o.user.department,
    assignedCases: o.assignedCases,
    solvedCases: o.solvedCases,
    performanceScore: o.performanceScore,
    availability: o.availability,
    avatar: o.avatar || null
  }));

  const formattedActivities = activities.map(a => ({
    id: a.id,
    officer: a.user ? a.user.name : 'System',
    action: a.action,
    target: 'Platform',
    time: new Date(a.timestamp).toLocaleTimeString()
  }));

  res.json(formatResponse({
    cases,
    officers: formattedOfficers,
    evidence,
    forensics,
    activities: formattedActivities,
    notifications,
    kpis: {
      totalOfficers: officers.length,
      activeOfficers: activeOfficersCount,
      departments: uniqueDepts.length,
      activeCases: activeCasesCount,
      closedCases: solvedCasesCount,
      evidenceFiles: evidence.length,
      openFirs: totalFirsCount,
      pendingReviews: pendingReviewsCount
    }
  }));
}));

// Endpoint: Mark notification as read
router.post('/notifications/:id/read', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const notif = await prisma.notification.update({
    where: { id: parseInt(id) },
    data: { isRead: true }
  });
  res.json(formatResponse(notif));
}));

// Endpoint: Mark all notifications as read
router.post('/notifications/read-all', authenticateToken, asyncHandler(async (req: any, res: any) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.officerId, isRead: false },
    data: { isRead: true }
  });
  res.json(formatResponse({ success: true }));
}));

// Endpoint: Delete a notification
router.delete('/notifications/:id', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  await prisma.notification.delete({
    where: { id: parseInt(id) }
  });
  res.json(formatResponse({ success: true }, 'Notification deleted successfully.'));
}));

export default router;

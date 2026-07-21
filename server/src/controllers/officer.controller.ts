import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import bcrypt from 'bcrypt';
import { MailService } from '../services/mail.service';
import { ApiError } from '../utils/apiError';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

export class OfficerController {
  public static listOfficers = asyncHandler(async (req: Request, res: Response) => {
    const { search, role, department, status, sortBy, sortOrder, page, limit } = req.query;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (role) {
      whereClause.role = role as any;
    }

    if (department) {
      whereClause.department = department as any;
    }

    if (status) {
      whereClause.isActive = status === 'active';
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = limit ? parseInt(limit as string) : 100;
    const skipNum = (pageNum - 1) * limitNum;

    const sortField = (sortBy as string) || 'createdAt';
    const direction = (sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const orderBy: any = {};
    if (sortField === 'rank') {
      orderBy.officer = { rank: direction };
    } else {
      orderBy[sortField] = direction;
    }

    const total = await prisma.user.count({ where: whereClause });
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        officer: true
      },
      orderBy,
      skip: skipNum,
      take: limitNum
    });

    const officers = users.map(u => ({
      id: u.id,
      name: u.name,
      badgeNumber: u.id,
      email: u.email,
      phone: u.phone,
      policeStation: u.policeStation,
      role: u.role,
      department: u.department,
      isActive: u.isActive,
      passwordChangeRequired: u.passwordChangeRequired,
      createdAt: u.createdAt,
      rank: u.officer?.rank || null,
      availability: u.officer?.availability || null,
      avatar: u.officer?.avatar || null,
      user: u,
      officer: u.officer
    }));

    console.log(`[GET /api/officers] Database officer count: ${total} | API returned count: ${officers.length}`);

    res.json(formatResponse({ officers, total }, 'Officers list fetched.'));
  });

  public static getOfficer = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user: any = await prisma.user.findUnique({
      where: { id },
      include: { officer: true }
    });

    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    res.json(formatResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      policeStation: user.policeStation,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      passwordChangeRequired: user.passwordChangeRequired,
      createdAt: user.createdAt,
      rank: user.officer?.rank || null,
      availability: user.officer?.availability || null,
      avatar: user.officer?.avatar || null
    }));
  });

  public static createOfficer = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, phone, rank, department, policeStation, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(400, 'An officer with this email already exists.');
    }

    // Auto-generate Officer ID
    const rolePrefixes: Record<string, string> = {
      SUPER_ADMIN: 'SA',
      SUB_INSPECTOR: 'SI',
      INSPECTOR: 'DET',
      FORENSIC_OFFICER: 'FOR',
      SUPERINTENDENT: 'SP'
    };
    const prefix = rolePrefixes[role] || 'OFF';
    let id = '';
    let exists = true;
    while (exists) {
      const num = Math.floor(100 + Math.random() * 900);
      id = `${prefix}-${num}`;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        exists = false;
      }
    }

    // Auto-generate Strong Temporary Password (10-12 characters)
    const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
    const numChars = '23456789';
    const specialChars = '!@#$%^&*';
    const allChars = upperChars + lowerChars + numChars + specialChars;
    let tempPassword = upperChars[Math.floor(Math.random() * upperChars.length)] +
                       lowerChars[Math.floor(Math.random() * lowerChars.length)] +
                       numChars[Math.floor(Math.random() * numChars.length)] +
                       specialChars[Math.floor(Math.random() * specialChars.length)];
    for (let i = 4; i < 11; i++) {
      tempPassword += allChars[Math.floor(Math.random() * allChars.length)];
    }
    tempPassword = tempPassword.split('').sort(() => 0.5 - Math.random()).join('');

    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          id,
          name,
          email,
          phone,
          policeStation,
          role,
          department,
          password: hashedPassword,
          passwordChangeRequired: true,
          passwordChanged: false,
          isActive: true
        }
      });

      await tx.officer.create({
        data: {
          id,
          rank,
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
        }
      });

      return newUser;
    });

    console.log(`[POST /api/officers] Created new officer inserted into PostgreSQL with ID: ${id} | Name: ${name} | Email: ${email}`);

    // Write to audit log
    await logAudit(
      req,
      (req as any).user?.officerId || null,
      (req as any).user?.role || null,
      'Officer Created',
      `Created new officer ${name} (ID: ${id}, Role: ${role})`
    ).catch(console.error);

    await NotificationService.notifyAll(`Officer Onboarded: New official ${name} added under ID ${id}.`, 'System').catch(console.error);

    // Return tempPassword ONCE in response for Super Admin one-time credential modal
    res.json(formatResponse({
      id,
      name,
      email,
      phone,
      role,
      rank,
      department,
      policeStation,
      isActive: true,
      passwordChangeRequired: true,
      passwordChanged: false,
      createdAt: user.createdAt,
      badgeNumber: id,
      tempPassword
    }, 'Officer created successfully. Credentials generated.'));
  });

  public static updateOfficer = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name, email, phone, rank, department, policeStation, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    if (email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ApiError(400, 'An officer with this email already exists.');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name,
          email,
          phone,
          policeStation,
          role,
          department
        }
      });

      await tx.officer.update({
        where: { id },
        data: {
          rank
        }
      });
    });

    // Write to audit log
    await logAudit(
      req,
      (req as any).user?.officerId || null,
      (req as any).user?.role || null,
      'Officer Updated',
      `Updated officer profile for ${name} (ID: ${id})`
    ).catch(console.error);

    if (role !== user.role) {
      await NotificationService.createNotification(id, `Role Changed: Your clearance level has been updated to ${role}.`, 'Alert').catch(console.error);
    }
    await NotificationService.notifyAll(`Officer Updated: Security credentials modified for ${name} (${id}).`, 'System').catch(console.error);

    res.json(formatResponse({ message: 'Officer profile updated successfully.' }));
  });

  public static toggleSuspend = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { suspend } = req.body; // boolean

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: !suspend
      }
    });

    // Write to audit log
    await logAudit(
      req,
      (req as any).user?.officerId || null,
      (req as any).user?.role || null,
      suspend ? 'SUSPEND_OFFICER' : 'ACTIVATE_OFFICER',
      `${suspend ? 'Suspended' : 'Activated'} officer ${user.name} (ID: ${id})`
    ).catch(console.error);

    await NotificationService.createNotification(id, `Role Changed: Your account has been ${suspend ? 'suspended' : 'activated'}.`, 'Alert').catch(console.error);
    await NotificationService.notifyAll(`Officer Suspended/Activated: Access control toggled for ${user.name} (${id}).`, 'Alert').catch(console.error);

    res.json(formatResponse({ message: `Officer successfully ${suspend ? 'suspended' : 'activated'}.` }));
  });

  public static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    // Auto-generate Temporary Password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordChangeRequired: true
      }
    });

    // Write to audit log
    await logAudit(
      req,
      (req as any).user?.officerId || null,
      (req as any).user?.role || null,
      'Password Reset',
      `Reset password for officer ${user.name} (ID: ${id})`
    ).catch(console.error);

    // Send password reset email
    try {
      await MailService.sendWelcomeEmail(user.email, user.name, user.id, tempPassword);
    } catch (error) {
      console.error('Password reset email dispatch failed:', error);
    }

    res.json(formatResponse({ message: 'Password successfully reset and credentials dispatched.' }));
  });

  public static deleteOfficer = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    if (id === 'SA-001') {
      throw new ApiError(400, 'Cannot delete the system root Super Admin account.');
    }

    await prisma.user.delete({
      where: { id }
    });

    // Write to audit log
    await logAudit(
      req,
      (req as any).user?.officerId || null,
      (req as any).user?.role || null,
      'DELETE_OFFICER',
      `Deleted officer ${user.name} (ID: ${id})`
    ).catch(console.error);

    res.json(formatResponse({ message: 'Officer successfully removed from system database.' }));
  });

  public static getOfficerLogs = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'Officer not found.');
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { timestamp: 'desc' }
    });

    const activityLogs = await prisma.activityLog.findMany({
      where: { userId: id },
      orderBy: { timestamp: 'desc' }
    });

    res.json(formatResponse({
      auditLogs,
      activityLogs
    }));
  });

  public static getGlobalAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const { search, action, role, browser, device, page, limit } = req.query;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { userId: { contains: search as string, mode: 'insensitive' } },
        { details: { contains: search as string, mode: 'insensitive' } },
        { ipAddress: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (action) {
      whereClause.action = action as string;
    }

    if (role) {
      whereClause.role = role as string;
    }

    if (browser) {
      whereClause.browser = browser as string;
    }

    if (device) {
      whereClause.device = device as string;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    const total = await prisma.auditLog.count({ where: whereClause });
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      skip: skipNum,
      take: limitNum,
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    res.json(formatResponse({
      logs,
      total,
      page: pageNum,
      limit: limitNum
    }));
  });
}

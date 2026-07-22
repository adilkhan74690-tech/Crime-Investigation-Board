import { prisma } from '../config/database';

export function parseUserAgent(userAgentString: string) {
  let browser = 'Unknown Browser';
  let device = 'Unknown Device';

  const ua = (userAgentString || '').toLowerCase();

  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edge')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer';
  }

  if (ua.includes('iphone')) {
    device = 'iPhone';
  } else if (ua.includes('ipad')) {
    device = 'iPad';
  } else if (ua.includes('android')) {
    device = 'Android Device';
  } else if (ua.includes('windows')) {
    device = 'Windows PC';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    device = 'Macintosh';
  } else if (ua.includes('linux')) {
    device = 'Linux PC';
  }

  return { browser, device };
}

export async function logAudit(
  req: any,
  userId: string | null,
  role: string | null,
  action: string,
  details: string,
  caseId?: string
) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(userAgent);

    let validUserId: string | null = null;
    if (userId) {
      const uExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }).catch(() => null);
      if (uExists) validUserId = userId;
    }

    // 1. Audit Log (Never editable / Only insert allowed)
    await prisma.auditLog.create({
      data: {
        userId: validUserId,
        role,
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        action,
        details,
        browser,
        device
      }
    }).catch(err => console.error('[logAudit] AuditLog error:', err.message));

    // 2. Activity Log
    if (validUserId) {
      await prisma.activityLog.create({
        data: { userId: validUserId, action }
      }).catch(err => console.error('[logAudit] ActivityLog error:', err.message));
    }

    // 3. Notification
    if (validUserId) {
      await prisma.notification.create({
        data: { userId: validUserId, message: `${action}: ${details}` }
      }).catch(err => console.error('[logAudit] Notification error:', err.message));
    }

    // 4. Case Timeline (if caseId is provided)
    if (caseId) {
      await prisma.timeline.create({
        data: {
          caseId,
          step: action,
          date: new Date(),
          completed: true,
          details
        }
      }).catch(err => console.error('[logAudit] Timeline error:', err.message));
    }
  } catch (err: any) {
    console.error('[logAudit] System exception:', err.message);
  }
}

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
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';
  const { browser, device } = parseUserAgent(userAgent);

  // 1. Audit Log (Never editable / Only insert allowed)
  await prisma.auditLog.create({
    data: {
      userId,
      role,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      action,
      details,
      browser,
      device
    }
  });

  // 2. Activity Log
  if (userId) {
    await prisma.activityLog.create({
      data: { userId, action }
    }).catch(console.error);
  }

  // 3. Notification
  if (userId) {
    await prisma.notification.create({
      data: { userId, message: `${action}: ${details}` }
    }).catch(console.error);
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
    }).catch(console.error);
  }
}

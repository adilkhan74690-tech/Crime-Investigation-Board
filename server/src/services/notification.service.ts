import { prisma } from '../config/database';
import { emitToUser, emitToAll } from './socket.service';

export class NotificationService {
  public static async createNotification(
    userId: string,
    message: string,
    type: 'Info' | 'Alert' | 'Assignment' | 'System' = 'Info'
  ) {
    try {
      const notif = await prisma.notification.create({
        data: {
          userId,
          message,
          type
        }
      });

      // Emit to that user
      emitToUser(userId, 'notification', notif);
      return notif;
    } catch (err) {
      console.error('[NotificationService] Failed to create notification:', err);
    }
  }

  public static async notifyAll(
    message: string,
    type: 'Info' | 'Alert' | 'Assignment' | 'System' = 'Info'
  ) {
    try {
      // Find all active users to store notifications for them
      const users = await prisma.user.findMany({ where: { isActive: true } });
      
      const creations = users.map(u => 
        prisma.notification.create({
          data: {
            userId: u.id,
            message,
            type
          }
        })
      );
      
      await Promise.all(creations);

      // Emit to all sockets
      emitToAll('global-notification', { message, type });
    } catch (err) {
      console.error('[NotificationService] Failed to broadcast notification:', err);
    }
  }

  public static async notifyRole(
    role: 'SUPER_ADMIN' | 'INSPECTOR' | 'SUB_INSPECTOR' | 'FORENSIC_OFFICER' | 'SUPERINTENDENT',
    message: string,
    type: 'Info' | 'Alert' | 'Assignment' | 'System' = 'Info'
  ) {
    try {
      const users = await prisma.user.findMany({ where: { role, isActive: true } });
      
      const creations = users.map(u => 
        prisma.notification.create({
          data: {
            userId: u.id,
            message,
            type
          }
        })
      );
      
      await Promise.all(creations);

      // Emit to all sockets (the client filter who receives what, or just emit to all since it has role scope)
      emitToAll('role-notification', { role, message, type });
    } catch (err) {
      console.error('[NotificationService] Failed to emit role notification:', err);
    }
  }
}

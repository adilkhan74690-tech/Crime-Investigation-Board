import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { formatResponse, formatError } from '../utils/apiResponse';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

export class AuthController {
  public static login = async (req: AuthRequest, res: Response) => {
    const { officerId, password } = req.body;
    console.log(`[AUTH LOG] login initiated for Officer ID: ${officerId}`);
    try {
      const result = await AuthService.login(officerId, password);

      if (!result.firstLogin && result.role) {
        await logAudit(
          req,
          officerId,
          result.role,
          'Officer Login',
          'Officer authenticated successfully.'
        ).catch(console.error);
        await NotificationService.createNotification(officerId, 'Login Success: Secure session initiated.', 'Info').catch(console.error);
      }

      console.log(`[AUTH LOG] login SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse(result));
    } catch (err: any) {
      console.error(`[AUTH LOG] login FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'Authentication failed.'));
    }
  };

  public static changePassword = async (req: AuthRequest, res: Response) => {
    const { officerId, oldPassword, newPassword } = req.body;
    console.log(`[AUTH LOG] changePassword initiated for Officer ID: ${officerId}`);
    try {
      const result = await AuthService.changePassword(officerId, oldPassword, newPassword);
      await NotificationService.createNotification(officerId, 'Password Updated: Security credentials established.', 'Alert').catch(console.error);
      console.log(`[AUTH LOG] changePassword SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse(result));
    } catch (err: any) {
      console.error(`[AUTH LOG] changePassword FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'Password update failed.'));
    }
  };

  public static logout = async (req: AuthRequest, res: Response) => {
    const officerId = req.user?.officerId;
    const role = req.user?.role;
    console.log(`[AUTH LOG] logout initiated for Officer ID: ${officerId}`);
    try {
      if (officerId) {
        await logAudit(
          req,
          officerId,
          role || null,
          'Logout',
          'Officer logged out.'
        ).catch(console.error);
      }
      console.log(`[AUTH LOG] logout SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse({ message: 'Session locked and logged out.' }));
    } catch (err: any) {
      console.error(`[AUTH LOG] logout FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'Logout failed.'));
    }
  };
}

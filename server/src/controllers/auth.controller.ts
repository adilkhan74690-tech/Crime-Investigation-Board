import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { formatResponse, formatError } from '../utils/apiResponse';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

export class AuthController {
  public static requestOtp = async (req: AuthRequest, res: Response) => {
    const { officerId, password } = req.body;
    console.log(`[AUTH LOG] requestOtp initiated for Officer ID: ${officerId}`);
    try {
      const result = await AuthService.requestOtp(officerId, password);
      console.log(`[AUTH LOG] requestOtp SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse(result));
    } catch (err: any) {
      console.error(`[AUTH LOG] requestOtp FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'OTP dispatch failed.'));
    }
  };

  public static changePassword = async (req: AuthRequest, res: Response) => {
    const { officerId, oldPassword, newPassword } = req.body;
    console.log(`[AUTH LOG] changePassword initiated for Officer ID: ${officerId}`);
    try {
      const msg = await AuthService.changePassword(officerId, oldPassword, newPassword);
      await NotificationService.createNotification(officerId, 'Password Changed: Security credentials updated.', 'Alert').catch(console.error);
      console.log(`[AUTH LOG] changePassword SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse({ message: msg }));
    } catch (err: any) {
      console.error(`[AUTH LOG] changePassword FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'Password update failed.'));
    }
  };

  public static verifyOtp = async (req: AuthRequest, res: Response) => {
    const { officerId, code } = req.body;
    console.log(`[AUTH LOG] verifyOtp initiated for Officer ID: ${officerId}`);
    try {
      const result = await AuthService.verifyOtp(officerId, code);
      
      // Write login audit log with browser/device info
      await logAudit(
        req,
        officerId,
        result.role,
        'Officer Login',
        'Officer logged in successfully via secure 2FA OTP.'
      ).catch(console.error);

      // Trigger dynamic notification
      await NotificationService.createNotification(officerId, 'OTP Login Success: Secure session initiated.', 'Info').catch(console.error);

      console.log(`[AUTH LOG] verifyOtp SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse(result));
    } catch (err: any) {
      console.error(`[AUTH LOG] verifyOtp FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      
      await logAudit(
        req,
        officerId,
        'UNKNOWN',
        'OTP Failed',
        `Failed OTP verification attempt. Details: ${err.message}`
      ).catch(console.error);

      await NotificationService.createNotification(officerId, 'OTP Failed: Dynamic code validation failed.', 'Alert').catch(console.error);
      
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'OTP verification failed.'));
    }
  };

  public static resendOtp = async (req: AuthRequest, res: Response) => {
    const { officerId } = req.body;
    console.log(`[AUTH LOG] resendOtp initiated for Officer ID: ${officerId}`);
    try {
      const msg = await AuthService.resendOtp(officerId);
      console.log(`[AUTH LOG] resendOtp SUCCESS for Officer ID: ${officerId}`);
      return res.json(formatResponse({ message: msg }));
    } catch (err: any) {
      console.error(`[AUTH LOG] resendOtp FAILED for Officer ID: ${officerId}. Error: ${err.stack || err.message}`);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json(formatError(err.message || 'OTP resend failed.'));
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

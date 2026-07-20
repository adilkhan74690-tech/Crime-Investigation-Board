import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { logAudit } from '../utils/auditLogger';
import { NotificationService } from '../services/notification.service';

export class AuthController {
  public static requestOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { officerId, password } = req.body;
    const result = await AuthService.requestOtp(officerId, password);
    res.json(formatResponse(result));
  });

  public static changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { officerId, oldPassword, newPassword } = req.body;
    const msg = await AuthService.changePassword(officerId, oldPassword, newPassword);
    
    await NotificationService.createNotification(officerId, 'Password Changed: Security credentials updated.', 'Alert').catch(console.error);
    
    res.json(formatResponse({ message: msg }));
  });

  public static verifyOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { officerId, code } = req.body;
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

      res.json(formatResponse(result));
    } catch (err: any) {
      await logAudit(
        req,
        officerId,
        'UNKNOWN',
        'OTP Failed',
        `Failed OTP verification attempt. Details: ${err.message}`
      ).catch(console.error);

      await NotificationService.createNotification(officerId, 'OTP Failed: Dynamic code validation failed.', 'Alert').catch(console.error);
      throw err;
    }
  });

  public static resendOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { officerId } = req.body;
    const msg = await AuthService.resendOtp(officerId);
    res.json(formatResponse({ message: msg }));
  });

  public static logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const officerId = req.user?.officerId;
    const role = req.user?.role;
    
    if (officerId) {
      await logAudit(
        req,
        officerId,
        role || null,
        'Logout',
        'Officer locked session / logged out.'
      ).catch(console.error);
    }
    
    res.json(formatResponse({ message: 'Session locked and logged out.' }));
  });
}

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OfficerRepository } from '../repositories/officer.repository';
import { MailService } from './mail.service';
import { ApiError } from '../utils/apiError';
import { prisma } from '../config/database';

export class AuthService {
  public static async requestOtp(officerId: string, password: string): Promise<{ message: string; passwordChangeRequired?: boolean; bypassOtp?: boolean; token?: string; refreshToken?: string; role?: string; name?: string }> {
    if (!process.env.DATABASE_URL) {
      throw new ApiError(500, 'Render Server Configuration Error: DATABASE_URL is not set.');
    }
    if (!process.env.JWT_SECRET) {
      throw new ApiError(500, 'Render Server Configuration Error: JWT_SECRET is not set.');
    }

    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(401, 'Officer ID validation failure.');
    }

    const matches = await bcrypt.compare(password, officer.password).catch(() => password === officer.password);
    if (!matches && password !== officer.password) {
      throw new ApiError(401, 'Password validation failure.');
    }

    if (officer.passwordChangeRequired) {
      return {
        message: 'First-time login: Password change required.',
        passwordChangeRequired: true
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save hashed OTP with expiry
    const hashedOtp = await bcrypt.hash(otp, 10);
    await prisma.otpVerification.upsert({
      where: { userId: officer.id },
      update: {
        code: hashedOtp,
        expires
      },
      create: {
        userId: officer.id,
        code: hashedOtp,
        expires
      }
    });

    let mailSuccess = true;
    try {
      await MailService.sendOtpEmail(officer.email, officer.name, otp);
      console.log(`[AUTH LOG] OTP email successfully dispatched to ${officer.email}`);
    } catch (mailErr: any) {
      mailSuccess = false;
      console.error(`[AUTH LOG/WARNING] Failed to dispatch OTP email to ${officer.email}. Error: ${mailErr.message}`);
      console.log(`[AUTH LOG/ALERT] RENDER STARTUP OTP FALLBACK CODE FOR ${officer.id}: ${otp}`);
    }

    return { 
      message: mailSuccess 
        ? 'OTP successfully dispatched.' 
        : 'OTP email dispatch failed. Dynamic fallback OTP logged to server logs.' 
    };
  }

  public static async changePassword(officerId: string, oldPassword: string, newPassword: string): Promise<string> {
    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(404, 'Officer ID validation failure.');
    }

    const matches = await bcrypt.compare(oldPassword, officer.password).catch(() => oldPassword === officer.password);
    if (!matches && oldPassword !== officer.password) {
      throw new ApiError(401, 'Current password validation failure.');
    }

    if (!officer.passwordChangeRequired) {
      throw new ApiError(400, 'Password change not required for this account.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: officerId },
      data: {
        password: hashedPassword,
        passwordChangeRequired: false
      }
    });

    return 'Password successfully updated. Proceed with OTP verification login.';
  }

  public static async verifyOtp(officerId: string, code: string): Promise<{ token: string; refreshToken: string; role: string; name: string }> {
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { userId: officerId }
    });

    if (!otpRecord) {
      throw new ApiError(400, 'Authentication session expired or not initialized.');
    }

    if (new Date() > otpRecord.expires) {
      await prisma.otpVerification.delete({ where: { userId: officerId } }).catch(() => {});
      throw new ApiError(401, 'OTP verification code has expired.');
    }

    const matches = await bcrypt.compare(code, otpRecord.code);
    if (!matches) {
      throw new ApiError(401, 'Verification code mismatch.');
    }

    // Delete verification record after successful verify
    await prisma.otpVerification.delete({ where: { userId: officerId } }).catch(() => {});

    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(404, 'Officer profile database mismatch.');
    }

    const secret = process.env.JWT_SECRET || 'CIB_DEFAULT_CLASSIFIED_SECRET';
    
    // Access Token (short-lived)
    const token = jwt.sign(
      { officerId: officer.id, role: officer.role, name: officer.name },
      secret,
      { expiresIn: '15m' }
    );

    // Refresh Token (long-lived)
    const refreshToken = jwt.sign(
      { officerId: officer.id, role: officer.role, name: officer.name },
      secret,
      { expiresIn: '7d' }
    );

    return {
      token,
      refreshToken,
      role: officer.role,
      name: officer.name
    };
  }

  public static async resendOtp(officerId: string): Promise<string> {
    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(404, 'Officer profile not found.');
    }

    const otpRecord = await prisma.otpVerification.findUnique({
      where: { userId: officerId }
    });

    if (!otpRecord) {
      throw new ApiError(400, 'No active OTP verification session found.');
    }

    const now = Date.now();
    const cooldown = new Date(otpRecord.updatedAt).getTime() + 30 * 1000;
    if (now < cooldown) {
      const remaining = Math.ceil((cooldown - now) / 1000);
      throw new ApiError(429, `Resend threshold lock active. Retry in ${remaining} seconds.`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const hashedOtp = await bcrypt.hash(otp, 10);
    await prisma.otpVerification.update({
      where: { userId: officerId },
      data: {
        code: hashedOtp,
        expires
      }
    });

    let mailSuccess = true;
    try {
      await MailService.sendOtpEmail(officer.email, officer.name, otp);
      console.log(`[AUTH LOG] Resent OTP email successfully to ${officer.email}`);
    } catch (mailErr: any) {
      mailSuccess = false;
      console.error(`[AUTH LOG/WARNING] Failed to resend OTP email to ${officer.email}. Error: ${mailErr.message}`);
      console.log(`[AUTH LOG/ALERT] RENDER STARTUP OTP FALLBACK CODE FOR ${officer.id}: ${otp}`);
    }

    return mailSuccess 
      ? 'OTP verification code resent successfully.' 
      : 'OTP resend email dispatch failed. Dynamic fallback OTP logged to server logs.';
  }
}

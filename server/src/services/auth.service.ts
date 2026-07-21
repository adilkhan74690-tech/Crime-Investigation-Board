import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OfficerRepository } from '../repositories/officer.repository';
import { MailService } from './mail.service';
import { ApiError } from '../utils/apiError';
import { prisma } from '../config/database';

export class AuthService {
  public static async login(officerId: string, password: string): Promise<{ token?: string; refreshToken?: string; role?: string; name?: string; firstLogin?: boolean; passwordChangeRequired?: boolean; message?: string }> {
    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(401, 'Officer ID validation failure. Account not found.');
    }

    if (!officer.isActive) {
      throw new ApiError(403, 'Account suspended. Contact Super Admin for clearance.');
    }

    const matches = await bcrypt.compare(password, officer.password).catch(() => password === officer.password);
    if (!matches && password !== officer.password) {
      throw new ApiError(401, 'Password validation failure. Invalid credentials.');
    }

    if (officer.firstLogin || officer.passwordChangeRequired || !officer.passwordChanged) {
      return {
        message: 'First-time login: Temporary password detected. Password change required.',
        firstLogin: true,
        passwordChangeRequired: true,
        role: officer.role,
        name: officer.name
      };
    }

    const secret = process.env.JWT_SECRET || 'CIB_DEFAULT_CLASSIFIED_SECRET';
    const token = jwt.sign(
      { officerId: officer.id, role: officer.role, name: officer.name },
      secret,
      { expiresIn: '12h' }
    );
    const refreshToken = jwt.sign(
      { officerId: officer.id, role: officer.role, name: officer.name },
      secret,
      { expiresIn: '7d' }
    );

    await prisma.user.update({
      where: { id: officer.id },
      data: { lastLogin: new Date() }
    });

    return {
      message: 'Authentication successful.',
      firstLogin: false,
      passwordChangeRequired: false,
      token,
      refreshToken,
      role: officer.role,
      name: officer.name
    };
  }

  public static async changePassword(officerId: string, oldPassword: string, newPassword: string): Promise<{ token: string; refreshToken: string; role: string; name: string }> {
    const officer = await OfficerRepository.findById(officerId);
    if (!officer) {
      throw new ApiError(404, 'Officer ID validation failure.');
    }

    const matches = await bcrypt.compare(oldPassword, officer.password).catch(() => oldPassword === officer.password);
    if (!matches && oldPassword !== officer.password) {
      throw new ApiError(401, 'Current temporary password validation failure.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new ApiError(400, 'New password must be at least 6 characters long.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: officerId },
      data: {
        password: hashedPassword,
        firstLogin: false,
        passwordChangeRequired: false,
        passwordChanged: true,
        passwordChangedAt: new Date()
      } as any
    });

    const secret = process.env.JWT_SECRET || 'CIB_DEFAULT_CLASSIFIED_SECRET';
    const token = jwt.sign(
      { officerId: officer.id, role: officer.role, name: officer.name },
      secret,
      { expiresIn: '12h' }
    );
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
}

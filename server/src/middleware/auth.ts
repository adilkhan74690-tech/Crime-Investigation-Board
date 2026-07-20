import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError';

export interface AuthRequest extends Request {
  user?: {
    officerId: string;
    role: string;
    name: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Classified Session Access Token required.');
  }

  const secret = process.env.JWT_SECRET || 'CIB_DEFAULT_CLASSIFIED_SECRET';
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Session credentials expired. Please refresh.');
      }
      throw new ApiError(403, 'Invalid token or security credentials expired.');
    }
    req.user = user as any;
    next();
  });
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Insufficient security level clearance for access.');
    }
    next();
  };
};

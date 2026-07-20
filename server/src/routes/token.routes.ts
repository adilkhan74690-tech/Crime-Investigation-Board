import { Router } from 'express';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import jwt from 'jsonwebtoken';

const router = Router();

// Endpoint: Refresh expired Access Token using Refresh Token
router.post('/refresh-token', asyncHandler(async (req: any, res: any) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, 'Refresh Token is required.');
  }

  const secret = process.env.JWT_SECRET || 'CIB_DEFAULT_CLASSIFIED_SECRET';
  
  try {
    const payload = jwt.verify(refreshToken, secret) as any;
    
    // Generate a fresh Access Token
    const accessToken = jwt.sign(
      { officerId: payload.officerId, role: payload.role, name: payload.name },
      secret,
      { expiresIn: '15m' } // Short-lived Access Token
    );

    res.json(formatResponse({ accessToken }));
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired Refresh Token. Re-authenticate.');
  }
}));

export default router;

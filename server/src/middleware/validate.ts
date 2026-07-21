import { Request, Response, NextFunction } from 'express';
import { ZodObject } from 'zod';
import { ApiError } from '../utils/apiError';

export const validateRequest = (schema: ZodObject<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error: any) {
      const msg = error.errors && error.errors.length > 0 ? error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : 'Request parameter verification failed.';
      next(new ApiError(400, msg));
    }
  };
};

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
      next(new ApiError(400, error.errors ? error.errors[0].message : 'Request parameter verification failed.'));
    }
  };
};

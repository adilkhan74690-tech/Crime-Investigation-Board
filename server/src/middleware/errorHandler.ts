import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { formatError } from '../utils/apiResponse';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error Log]: ${err.stack || err.message}`);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(formatError(err.message));
  }

  // Zod Validation Exceptions mapping
  if (err.name === 'ZodError') {
    return res.status(400).json(formatError('Data validation parameters parsing exception.'));
  }

  return res.status(500).json(formatError('Internal Server Error. Security system audit logged.'));
};

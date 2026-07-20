import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CaseService } from '../services/case.service';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export class CaseController {
  public static listCases = asyncHandler(async (req: AuthRequest, res: Response) => {
    const list = await CaseService.getCases();
    res.json(formatResponse(list));
  });

  public static getCase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const item = await CaseService.getCaseById(id as string);
    res.json(formatResponse(item));
  });
}

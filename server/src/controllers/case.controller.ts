import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CaseService } from '../services/case.service';
import { formatResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';

export class CaseController {
  public static listCases = asyncHandler(async (req: AuthRequest, res: Response) => {
    let list = await CaseService.getCases();
    if (req.user?.role === 'INSPECTOR' || req.user?.role === 'SUB_INSPECTOR') {
      list = list.filter((c: any) => c.officerId === req.user?.officerId);
    }
    res.json(formatResponse(list));
  });

  public static getCase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const item = await CaseService.getCaseById(id as string);
    if (req.user?.role === 'INSPECTOR' || req.user?.role === 'SUB_INSPECTOR') {
      if (item.officerId !== req.user?.officerId) {
        throw new ApiError(403, 'Insufficient security level clearance for access.');
      }
    }
    res.json(formatResponse(item));
  });
}

import { CaseRepository } from '../repositories/case.repository';
import { ApiError } from '../utils/apiError';

export class CaseService {
  public static async getCases() {
    return CaseRepository.getAll();
  }

  public static async getCaseById(id: string) {
    const target = await CaseRepository.findById(id);
    if (!target) {
      throw new ApiError(404, 'Case file database query mismatch.');
    }
    return target;
  }
}

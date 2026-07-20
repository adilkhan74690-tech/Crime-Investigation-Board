import { prisma } from '../config/database';

export class CaseRepository {
  public static async getAll() {
    return prisma.case.findMany({
      include: {
        witnesses: true,
        timeline: true,
        evidence: true,
        forensics: true,
        victims: true,
        suspects: true
      }
    });
  }

  public static async findById(id: string) {
    return prisma.case.findUnique({
      where: { id },
      include: {
        witnesses: true,
        timeline: true,
        evidence: true,
        forensics: true,
        victims: true,
        suspects: true
      }
    });
  }

  public static async create(data: any) {
    return prisma.case.create({
      data
    });
  }
}

import { prisma } from '../config/database';

export class OfficerRepository {
  public static async findById(id: string) {
    const officer = await prisma.officer.findUnique({
      where: { id },
      include: {
        user: true
      }
    });

    if (!officer) return null;

    return {
      id: officer.id,
      rank: officer.rank,
      assignedCases: officer.assignedCases,
      solvedCases: officer.solvedCases,
      performanceScore: officer.performanceScore,
      availability: officer.availability,
      avatar: officer.avatar,
      email: officer.user.email,
      name: officer.user.name,
      password: officer.user.password,
      role: officer.user.role,
      isActive: officer.user.isActive,
      firstLogin: officer.user.firstLogin,
      passwordChangeRequired: officer.user.passwordChangeRequired,
      passwordChanged: officer.user.passwordChanged,
      passwordChangedAt: officer.user.passwordChangedAt
    };
  }

  public static async getAll() {
    return prisma.officer.findMany();
  }
}

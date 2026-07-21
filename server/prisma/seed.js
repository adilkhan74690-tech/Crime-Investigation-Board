const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database tables...');

  // Delete all existing data first to satisfy clean state
  await prisma.otpVerification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.caseNote.deleteMany({});
  await prisma.timeline.deleteMany({});
  await prisma.forensicReport.deleteMany({});
  await prisma.evidenceTransfer.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.witness.deleteMany({});
  await prisma.suspect.deleteMany({});
  await prisma.victim.deleteMany({});
  await prisma.caseAssignmentHistory.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.fir.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.officer.deleteMany({});
  await prisma.user.deleteMany({});

  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  // Seed Super Admin user
  await prisma.user.create({
    data: {
      id: 'SA-001',
      email: 'adilkh468@gmail.com',
      name: 'Adil Khan',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      department: 'MAJOR_CRIMES_DIVISION',
      passwordChangeRequired: false
    }
  });

  await prisma.officer.create({
    data: {
      id: 'SA-001',
      rank: 'SUPERVISORY_SPECIAL_AGENT',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
    }
  });

  console.log('Database tables seeded successfully with Super Admin user.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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

  // 1. Seed Super Admin user
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

  // 2. Seed Demo Sub Inspector (SI) Users & Officers
  const demoSis = [
    {
      id: 'SI-101',
      email: 'si.rajesh@cib.gov',
      name: 'Sub-Inspector Rajesh Verma',
      role: 'SUB_INSPECTOR',
      rank: 'DETECTIVE',
      department: 'MAJOR_CRIMES_DIVISION'
    },
    {
      id: 'SI-102',
      email: 'si.vikram@cib.gov',
      name: 'Sub-Inspector Vikram Singh',
      role: 'SUB_INSPECTOR',
      rank: 'DETECTIVE',
      department: 'HOMICIDE_UNIT'
    },
    {
      id: 'SI-103',
      email: 'si.ananya@cib.gov',
      name: 'Sub-Inspector Ananya Sharma',
      role: 'SUB_INSPECTOR',
      rank: 'CYBER_SPECIALIST',
      department: 'DIGITAL_FORENSICS_UNIT'
    }
  ];

  for (const si of demoSis) {
    await prisma.user.create({
      data: {
        id: si.id,
        email: si.email,
        name: si.name,
        password: hashedPassword,
        role: si.role,
        department: si.department,
        passwordChangeRequired: false
      }
    });

    await prisma.officer.create({
      data: {
        id: si.id,
        rank: si.rank,
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120'
      }
    });
  }

  console.log('Database seeded successfully with Super Admin and 3 Sub Inspector officers.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function finalCleanup() {
  console.log('=====================================================');
  console.log('STARTING FINAL PRODUCTION DATABASE CLEANUP');
  console.log('=====================================================\n');

  // 1. Fetch all users
  const users = await prisma.user.findMany();
  console.log(`Total users currently in DB: ${users.length}`);

  // Identify users to keep (Adil and Mohit)
  const keepUsers = users.filter(u => {
    const nameLower = u.name.toLowerCase();
    const isAdil = nameLower.includes('adil') && u.role === 'SUPER_ADMIN';
    const isMohit = nameLower.includes('mohit') && u.role === 'SUB_INSPECTOR';
    return isAdil || isMohit;
  });

  const keepUserIds = keepUsers.map(u => u.id);
  const deleteUsers = users.filter(u => !keepUserIds.includes(u.id));
  const deleteUserIds = deleteUsers.map(u => u.id);

  console.log(`Keep users: ${keepUsers.map(u => `${u.name} (${u.role})`).join(', ')}`);
  console.log(`Delete users count: ${deleteUsers.length}`);

  // 2. Delete ALL dummy / auto-generated data across all tables
  console.log('Purging notifications, activity logs, and audit logs...');
  await prisma.notification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('Purging case notes, timelines, forensic reports, evidence, transfers, witnesses, suspects, victims, workflow steps, assignment history...');
  await prisma.caseNote.deleteMany({});
  await prisma.timeline.deleteMany({});
  await prisma.forensicReport.deleteMany({});
  await prisma.evidenceTransfer.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.witness.deleteMany({});
  await prisma.suspect.deleteMany({});
  await prisma.victim.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.caseAssignmentHistory.deleteMany({});

  console.log('Purging cases and FIRs...');
  await prisma.case.deleteMany({});
  await prisma.fir.deleteMany({});

  if (deleteUserIds.length > 0) {
    console.log('Purging non-essential officers and users...');
    await prisma.officer.deleteMany({ where: { id: { in: deleteUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: deleteUserIds } } });
  }

  // 3. Ensure Adil (SUPER_ADMIN) and Mohit (SUB_INSPECTOR) exist cleanly
  const adilUser = keepUsers.find(u => u.name.toLowerCase().includes('adil'));
  if (!adilUser) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await prisma.user.create({
      data: {
        id: 'SA-001',
        email: 'adilkh468@gmail.com',
        name: 'Adil',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        department: 'MAJOR_CRIMES_DIVISION',
        firstLogin: false,
        passwordChangeRequired: false,
        passwordChanged: true
      }
    });
    await prisma.officer.create({
      data: {
        id: 'SA-001',
        rank: 'SUPERVISORY_SPECIAL_AGENT',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
      }
    });
  }

  const mohitUser = keepUsers.find(u => u.name.toLowerCase().includes('mohit'));
  if (!mohitUser) {
    const hashedPassword = await bcrypt.hash('Mohit123!', 10);
    await prisma.user.create({
      data: {
        id: 'SI-MOHIT-001',
        email: 'mohit@cib.gov',
        name: 'Mohit',
        password: hashedPassword,
        role: 'SUB_INSPECTOR',
        department: 'MAJOR_CRIMES_DIVISION',
        firstLogin: false,
        passwordChangeRequired: false,
        passwordChanged: true
      }
    });
    await prisma.officer.create({
      data: {
        id: 'SI-MOHIT-001',
        rank: 'DETECTIVE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'
      }
    });
  }

  // 4. Verify Final State Counts
  const finalOfficers = await prisma.user.findMany({ include: { officer: true } });
  const finalCases = await prisma.case.count();
  const finalFirs = await prisma.fir.count();
  const finalNotifications = await prisma.notification.count();
  const finalAuditLogs = await prisma.auditLog.count();

  console.log('\n=====================================================');
  console.log('FINAL DATABASE CLEANUP REPORT');
  console.log('=====================================================');
  console.log(`- Officers remaining: ${finalOfficers.length} (${finalOfficers.map(u => `${u.name} [${u.role}]`).join(', ')})`);
  console.log(`- Cases remaining: ${finalCases}`);
  console.log(`- FIRs remaining: ${finalFirs}`);
  console.log(`- Notifications remaining: ${finalNotifications}`);
  console.log(`- Audit logs remaining: ${finalAuditLogs}`);
  console.log('=====================================================\n');
}

finalCleanup()
  .catch(err => {
    console.error('Final cleanup error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

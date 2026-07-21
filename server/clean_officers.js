const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function cleanOfficers() {
  console.log('Starting officer module database cleanup...');

  // 1. Fetch all users
  const allUsers = await prisma.user.findMany();
  console.log(`Total users before cleanup: ${allUsers.length}`);

  // Identify users to KEEP (Adil - SUPER_ADMIN, Mohit - SUB_INSPECTOR)
  // Or users with role SUPER_ADMIN named Adil, or SUB_INSPECTOR named Mohit
  const keepUsers = allUsers.filter(u => {
    const nameLower = u.name.toLowerCase();
    const isAdil = nameLower.includes('adil') && u.role === 'SUPER_ADMIN';
    const isMohit = nameLower.includes('mohit') && u.role === 'SUB_INSPECTOR';
    return isAdil || isMohit;
  });

  console.log('Users retained:');
  keepUsers.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Email: ${u.email}`));

  const keepUserIds = keepUsers.map(u => u.id);
  const deleteUsers = allUsers.filter(u => !keepUserIds.includes(u.id));
  const deleteUserIds = deleteUsers.map(u => u.id);

  console.log(`Total dummy/generated users to delete: ${deleteUsers.length}`);
  deleteUsers.forEach(u => console.log(`- DELETING: ID: ${u.id}, Name: ${u.name}, Role: ${u.role}`));

  if (deleteUserIds.length > 0) {
    // Re-assign or delete cases assigned to deleted officers, or re-assign to Mohit or Adil
    const mohitUser = keepUsers.find(u => u.name.toLowerCase().includes('mohit')) || keepUsers[0];

    // Re-assign cases assigned to deleted officers to Mohit
    if (mohitUser) {
      await prisma.case.updateMany({
        where: { officerId: { in: deleteUserIds } },
        data: { officerId: mohitUser.id }
      });
      await prisma.fir.updateMany({
        where: { officerId: { in: deleteUserIds } },
        data: { officerId: mohitUser.id }
      });
    }

    // Delete orphaned records linked to deleted users
    await prisma.notification.deleteMany({ where: { userId: { in: deleteUserIds } } });
    await prisma.activityLog.deleteMany({ where: { userId: { in: deleteUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: deleteUserIds } } });
    await prisma.caseAssignmentHistory.deleteMany({ where: { officerId: { in: deleteUserIds } } });

    // Delete Officer records and User records
    await prisma.officer.deleteMany({ where: { id: { in: deleteUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: deleteUserIds } } });
  }

  // Check if Mohit exists. If not, create Mohit (SUB_INSPECTOR)
  const hasMohit = keepUsers.some(u => u.name.toLowerCase().includes('mohit'));
  if (!hasMohit) {
    console.log('Creating Mohit (SUB_INSPECTOR)...');
    const hashedPassword = await bcrypt.hash('Mohit123!', 10);
    const mohitId = 'SI-MOHIT-001';
    await prisma.user.create({
      data: {
        id: mohitId,
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
        id: mohitId,
        rank: 'DETECTIVE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'
      }
    });
    console.log('Mohit (SUB_INSPECTOR) created successfully.');
  }

  // Ensure Adil exists with SUPER_ADMIN
  const hasAdil = keepUsers.some(u => u.name.toLowerCase().includes('adil'));
  if (!hasAdil) {
    console.log('Creating Adil (SUPER_ADMIN)...');
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    const adilId = 'SA-001';
    await prisma.user.create({
      data: {
        id: adilId,
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
        id: adilId,
        rank: 'SUPERVISORY_SPECIAL_AGENT',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
      }
    });
    console.log('Adil (SUPER_ADMIN) created successfully.');
  }

  const finalUsers = await prisma.user.findMany({ include: { officer: true } });
  console.log(`Cleanup completed. Total active officers in database: ${finalUsers.length}`);
  finalUsers.forEach(u => console.log(`Active Officer -> ID: ${u.id} | Name: ${u.name} | Role: ${u.role} | Email: ${u.email}`));
}

cleanOfficers()
  .catch(err => {
    console.error('Cleanup error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Verifying standard real officers...');

  const hashedPasswordAdil = await bcrypt.hash('Admin123!', 10);
  const hashedPasswordMohit = await bcrypt.hash('Mohit123!', 10);

  // Ensure Super Admin user Adil exists
  await prisma.user.upsert({
    where: { id: 'SA-001' },
    update: {
      name: 'Adil',
      role: 'SUPER_ADMIN'
    },
    create: {
      id: 'SA-001',
      email: 'adilkh468@gmail.com',
      name: 'Adil',
      password: hashedPasswordAdil,
      role: 'SUPER_ADMIN',
      department: 'MAJOR_CRIMES_DIVISION',
      firstLogin: false,
      passwordChangeRequired: false,
      passwordChanged: true
    }
  });

  await prisma.officer.upsert({
    where: { id: 'SA-001' },
    update: {},
    create: {
      id: 'SA-001',
      rank: 'SUPERVISORY_SPECIAL_AGENT',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
    }
  });

  // Ensure Sub Inspector user Mohit exists
  await prisma.user.upsert({
    where: { id: 'SI-MOHIT-001' },
    update: {
      name: 'Mohit',
      role: 'SUB_INSPECTOR'
    },
    create: {
      id: 'SI-MOHIT-001',
      email: 'mohit@cib.gov',
      name: 'Mohit',
      password: hashedPasswordMohit,
      role: 'SUB_INSPECTOR',
      department: 'MAJOR_CRIMES_DIVISION',
      firstLogin: false,
      passwordChangeRequired: false,
      passwordChanged: true
    }
  });

  await prisma.officer.upsert({
    where: { id: 'SI-MOHIT-001' },
    update: {},
    create: {
      id: 'SI-MOHIT-001',
      rank: 'DETECTIVE',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'
    }
  });

  console.log('Database verified with real officers: Adil (SUPER_ADMIN) and Mohit (SUB_INSPECTOR).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

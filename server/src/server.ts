import 'dotenv/config';
import app from './app';
import { initSocket } from './services/socket.service';
import { prisma } from './config/database';

const PORT = process.env.PORT || 5000;

// Env var validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingEnvVars: string[] = [];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
});

if (missingEnvVars.length > 0) {
  console.error(`[ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const server = app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);
  console.log('Server started');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  
  // JWT loaded status
  console.log(`JWT loaded: ${process.env.JWT_SECRET ? 'SUCCESS' : 'FAILED'}`);
  
  // SMTP loaded status
  const smtpLoaded = !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(`SMTP loaded: ${smtpLoaded ? 'SUCCESS' : 'FAILED'}`);

  // Database / Prisma connection check
  try {
    await prisma.$connect();
    console.log('Database connection status: SUCCESS');
    console.log('Prisma connection status: SUCCESS');
  } catch (err: any) {
    console.error(`Database connection status: FAILED (${err.message})`);
    console.error('Prisma connection status: FAILED');
  }
});

initSocket(server);

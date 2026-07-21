import 'dotenv/config';

console.log("Loading environment...");
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM'
];

const missingEnvVars: string[] = [];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
});

if (missingEnvVars.length > 0) {
  console.warn(`[WARNING] Missing environment variables: ${missingEnvVars.join(', ')}`);
}

async function startServer() {
  try {
    console.log("Initializing Prisma...");
    const { prisma } = await import('./config/database');

    console.log("Connecting PostgreSQL...");
    try {
      await prisma.$connect();
      console.log("Database connection status: SUCCESS");
      console.log("Prisma connection status: SUCCESS");
    } catch (dbErr: any) {
      console.error("Database connection status: FAILED");
      console.error("Prisma connection status: FAILED");
      console.error(dbErr);
    }

    console.log("Registering routes...");
    console.log("Starting Express...");
    const app = (await import('./app')).default;
    const { initSocket } = await import('./services/socket.service');

    const PORT = Number(process.env.PORT) || 5000;
    console.log("Listening on PORT...");

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on ${PORT}`);
      console.log("Server started");
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Port: ${PORT}`);
      console.log(`JWT loaded: ${process.env.JWT_SECRET ? 'SUCCESS' : 'FAILED'}`);
      
      const smtpLoaded = !!(process.env.SMTP_HOST && process.env.SMTP_PORT && (process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS));
      console.log(`SMTP loaded: ${smtpLoaded ? 'SUCCESS' : 'FAILED'}`);
    });

    initSocket(server);
  } catch (err: any) {
    console.error("CRITICAL STARTUP ERROR DETECTED:");
    console.error(err.stack || err);
  }
}

startServer();

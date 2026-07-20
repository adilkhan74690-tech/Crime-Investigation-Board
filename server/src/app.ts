import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import caseRoutes from './routes/case.routes';
import forensicsRoutes from './routes/forensics.routes';
import tokenRoutes from './routes/token.routes';
import uploadRoutes from './routes/upload.routes';
import workflowRoutes from './routes/workflow.routes';
import auditRoutes from './routes/audit.routes';
import dashboardRoutes from './routes/dashboard.routes';
import officerRoutes from './routes/officer.routes';
import settingsRoutes from './routes/settings.routes';
import searchRoutes from './routes/search.routes';
import firRoutes from './routes/fir.routes';
import { errorHandler } from './middleware/errorHandler';

import path from 'path';

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false // Allow loading CDNs like RemixIcon / ApexCharts
}));
app.use(morgan('dev'));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../../')));

// Secure REST Endpoint routers integration
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/forensics', forensicsRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/files', uploadRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/firs', firRoutes);

// Centralized error recovery middleware
app.use(errorHandler);

export default app;
export { app };

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './src/server/routes/auth.routes.ts';
import { leadsRouter } from './src/server/routes/leads.routes.ts';
import { crmRouter } from './src/server/routes/crm.routes.ts';
import { dashboardRouter } from './src/server/routes/dashboard.routes.ts';
import { teamRouter } from './src/server/routes/team.routes.ts';
import { integrationsRouter } from './src/server/routes/integrations.routes.ts';
import { webhooksRouter } from './src/server/routes/webhooks.routes.ts';
import { auditRouter } from './src/server/routes/audit.routes.ts';
import { publicRouter } from './src/server/routes/public.routes.ts';
import { startEscalationWorker } from './src/server/worker/escalation-worker.ts';
import { db } from './src/server/db/store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Needed for Twilio webhook POST data

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Unified Business Management Platform API',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'connected',
      workspacesCount: db.getData().workspaces.length,
    });
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/crm', crmRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/team', teamRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/public', publicRouter);

  // Start background escalation worker (checks every 5s)
  startEscalationWorker(5000);

  // In development, mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Unified Platform] Server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Unified Platform] Fatal bootstrap failure:', err);
  process.exit(1);
});

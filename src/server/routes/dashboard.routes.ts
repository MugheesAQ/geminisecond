import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { DashboardService } from '../services/dashboard.service.ts';
import { db } from '../db/store.ts';

export const dashboardRouter = Router();

// GET /api/dashboard/metrics
dashboardRouter.get('/metrics', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const metrics = DashboardService.getMetrics(wsId, req.membership!);
  res.json(metrics);
});

// GET /api/dashboard/preferences
dashboardRouter.get('/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const pref = db.getDashboardPreferences(wsId, req.user!.id);
  res.json(pref);
});

// POST /api/dashboard/preferences
dashboardRouter.post('/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const { hiddenCardKeys } = req.body;
  const pref = {
    workspaceId: wsId,
    userId: req.user!.id,
    hiddenCardKeys: Array.isArray(hiddenCardKeys) ? hiddenCardKeys : [],
  };
  db.saveDashboardPreferences(pref);
  res.json(pref);
});

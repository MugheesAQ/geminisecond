import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { RbacService } from '../services/rbac.service.ts';
import { AuditService } from '../services/audit.service.ts';

export const auditRouter = Router();

// GET /api/audit - List immutable audit history
auditRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const canView = RbacService.hasPermission(req.membership!, 'audit:view');
  if (!canView) {
    return res.status(403).json({ error: 'Permission denied: audit:view required' });
  }

  const { eventType, userId, dateFrom, dateTo, limit } = req.query;

  const events = AuditService.query(wsId, {
    eventType: eventType as string,
    userId: userId as string,
    dateFrom: dateFrom as string,
    dateTo: dateTo as string,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });

  res.json(events);
});

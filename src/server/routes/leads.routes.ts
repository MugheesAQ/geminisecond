import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { LeadEngineService } from '../services/lead-engine.service.ts';
import { db } from '../db/store.ts';
import { RbacService } from '../services/rbac.service.ts';
import { AvailabilityStatus } from '../db/types.ts';

export const leadsRouter = Router();

// GET /api/leads - List workspace leads
leadsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const { status, assignedTo, source, search } = req.query;

  let leads = db.getLeads(wsId);

  // If user is a basic user without 'leads:manage', they can view assigned leads or workspace leads
  if (status) {
    leads = leads.filter((l) => l.status === status);
  }
  if (assignedTo) {
    leads = leads.filter((l) => l.assignedToUserId === assignedTo);
  }
  if (source) {
    leads = leads.filter((l) => l.source === source);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    leads = leads.filter((l) => l.title.toLowerCase().includes(q));
  }

  // Attach contact details to lead items for frontend ease
  const contacts = db.getContacts(wsId);
  const contactsMap = new Map(contacts.map((c) => [c.id, c]));

  const enriched = leads.map((l) => ({
    ...l,
    contact: contactsMap.get(l.contactId),
  }));

  res.json(enriched);
});

// POST /api/leads - Create manual lead
leadsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { title, contactId, companyId, manualAssigneeId, customFields, notes } = req.body;

    if (!title || !contactId) {
      return res.status(400).json({ error: 'Title and contactId are required' });
    }

    const lead = LeadEngineService.assignLead(wsId, {
      title,
      source: 'manual',
      contactId,
      companyId,
      manualAssigneeId,
      customFields,
      notes,
      actorUserId: req.user!.id,
    });

    res.status(201).json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create lead' });
  }
});

// POST /api/leads/:id/acknowledge - Explicit acknowledgement
leadsRouter.post('/:id/acknowledge', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const leadId = req.params.id;
    const qualifyingAction = req.body.qualifyingAction || 'manual_button';

    const lead = LeadEngineService.acknowledgeLead(wsId, leadId, req.user!.id, qualifyingAction);
    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to acknowledge lead' });
  }
});

// POST /api/leads/:id/reassign - Manual reassignment
leadsRouter.post('/:id/reassign', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const leadId = req.params.id;
    const { newAssigneeId, reason } = req.body;

    if (!newAssigneeId || !reason) {
      return res.status(400).json({ error: 'newAssigneeId and reason are required' });
    }

    const lead = LeadEngineService.reassignLead(wsId, leadId, newAssigneeId, req.user!.id, reason);
    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reassign lead' });
  }
});

// GET /api/leads/recovery-queue - Get overdue & escalated recovery queue
leadsRouter.get('/recovery-queue', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const items = LeadEngineService.getRecoveryQueue(wsId);
  const contacts = db.getContacts(wsId);
  const contactsMap = new Map(contacts.map((c) => [c.id, c]));

  const enriched = items.map((item) => ({
    ...item,
    contact: contactsMap.get(item.lead.contactId),
  }));

  res.json(enriched);
});

// GET /api/leads/assignment-rules
leadsRouter.get('/assignment-rules', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const config = db.getAssignmentConfig(wsId);
  res.json(config);
});

// PUT /api/leads/assignment-rules
leadsRouter.put('/assignment-rules', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const canConfig = RbacService.hasPermission(req.membership!, 'leads:rules:configure');
  if (!canConfig) {
    return res.status(403).json({ error: 'Permission denied: leads:rules:configure required' });
  }

  const { roundRobinEnabled, maxOpenLeadsPerUser, ackDeadlineMinutes, backupUserId, escalationManagerUserId, reassignOnUnavailable } = req.body;

  const current = db.getAssignmentConfig(wsId);
  const updated = {
    ...current,
    roundRobinEnabled: roundRobinEnabled ?? current.roundRobinEnabled,
    maxOpenLeadsPerUser: Number(maxOpenLeadsPerUser) || current.maxOpenLeadsPerUser,
    ackDeadlineMinutes: Number(ackDeadlineMinutes) || current.ackDeadlineMinutes,
    backupUserId: backupUserId ?? current.backupUserId,
    escalationManagerUserId: escalationManagerUserId ?? current.escalationManagerUserId,
    reassignOnUnavailable: reassignOnUnavailable ?? current.reassignOnUnavailable,
  };

  db.saveAssignmentConfig(updated);

  db.appendAudit({
    workspaceId: wsId,
    actorUserId: req.user!.id,
    actorType: 'user',
    actorName: req.user!.fullName,
    eventType: 'ASSIGNMENT_RULES_CONFIGURED',
    targetEntity: 'AssignmentRules',
    targetId: wsId,
    details: updated,
  });

  res.json(updated);
});

// GET /api/leads/availability
leadsRouter.get('/availability', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const memberships = db.listMemberships(wsId);
  const statuses = memberships.map((m) => ({
    userId: m.userId,
    fullName: m.user.fullName,
    email: m.user.email,
    role: m.role,
    availability: db.getAvailability(wsId, m.userId),
  }));
  res.json(statuses);
});

// POST /api/leads/availability - Toggle or update status
leadsRouter.post('/availability', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const { status, note, targetUserId } = req.body;
  const userId = targetUserId || req.user!.id;

  if (!['available', 'busy', 'on_leave', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Invalid availability status' });
  }

  const updated = db.setAvailability(wsId, userId, status as AvailabilityStatus, note);

  // Trigger immediate handling of unacknowledged leads if becoming unavailable
  const rerouteResult = LeadEngineService.handleUserAvailabilityTransition(wsId, userId, status as AvailabilityStatus);

  db.appendAudit({
    workspaceId: wsId,
    actorUserId: req.user!.id,
    actorType: 'user',
    actorName: req.user!.fullName,
    eventType: 'EMPLOYEE_AVAILABILITY_CHANGED',
    targetEntity: 'UserAvailability',
    targetId: updated.id,
    details: { status, note, reallocatedLeads: rerouteResult.reallocatedLeads },
  });

  res.json({ availability: updated, reallocatedLeads: rerouteResult.reallocatedLeads });
});

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { db } from '../db/store.ts';
import { RbacService } from '../services/rbac.service.ts';
import { IntegrationsService } from '../services/integrations.service.ts';

export const integrationsRouter = Router();

// GET /api/integrations - List integrations status & safe configuration
integrationsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const config = db.getIntegrationConfig(wsId);

  // Return masked/sanitized config so raw secret keys are never exposed in UI
  const sanitized = {
    twilio: {
      accountSid: config.twilio.accountSid ? `${config.twilio.accountSid.slice(0, 6)}...` : '',
      whatsappNumber: config.twilio.whatsappNumber,
      enabled: config.twilio.enabled,
      lastSyncAt: config.twilio.lastSyncAt,
      lastError: config.twilio.lastError,
    },
    stripe: {
      publishableKey: config.stripe.publishableKey ? `${config.stripe.publishableKey.slice(0, 8)}...` : '',
      enabled: config.stripe.enabled,
      lastSyncAt: config.stripe.lastSyncAt,
      lastError: config.stripe.lastError,
    },
    googleCalendar: {
      clientId: config.googleCalendar.clientId ? `${config.googleCalendar.clientId.slice(0, 10)}...` : '',
      connectedUsers: config.googleCalendar.connectedUsers,
      enabled: config.googleCalendar.enabled,
      lastSyncAt: config.googleCalendar.lastSyncAt,
      lastError: config.googleCalendar.lastError,
    },
    telegram: {
      chatId: config.telegram.chatId,
      hasToken: Boolean(config.telegram.botToken),
      enabled: config.telegram.enabled,
      lastSyncAt: config.telegram.lastSyncAt,
      lastError: config.telegram.lastError,
    },
  };

  res.json(sanitized);
});

// PUT /api/integrations/:provider - Update provider configuration
integrationsRouter.put('/:provider', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const canConfig = RbacService.hasPermission(req.membership!, 'integrations:configure');
    if (!canConfig) {
      return res.status(403).json({ error: 'Permission denied: integrations:configure required' });
    }

    const { provider } = req.params;
    const config = db.getIntegrationConfig(wsId);
    const body = req.body;

    if (provider === 'twilio') {
      config.twilio = { ...config.twilio, ...body, enabled: body.enabled ?? config.twilio.enabled };
    } else if (provider === 'stripe') {
      config.stripe = { ...config.stripe, ...body, enabled: body.enabled ?? config.stripe.enabled };
    } else if (provider === 'google-calendar') {
      config.googleCalendar = { ...config.googleCalendar, ...body, enabled: body.enabled ?? config.googleCalendar.enabled };
    } else if (provider === 'telegram') {
      config.telegram = { ...config.telegram, ...body, enabled: body.enabled ?? config.telegram.enabled };
    } else {
      return res.status(400).json({ error: 'Unknown provider' });
    }

    db.saveIntegrationConfig(config);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'INTEGRATION_CONFIGURED',
      targetEntity: 'IntegrationConfig',
      targetId: provider,
      details: { provider, enabled: body.enabled },
    });

    res.json({ success: true, provider });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/integrations/twilio/reply - Send outbound reply
integrationsRouter.post('/twilio/reply', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { contactId, body } = req.body;
    if (!contactId || !body) {
      return res.status(400).json({ error: 'contactId and body are required' });
    }

    const result = IntegrationsService.sendWhatsAppReply(wsId, contactId, body, req.user!.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/integrations/stripe/payment-request
integrationsRouter.post('/stripe/payment-request', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { contactId, opportunityId, amountCents, currency, description } = req.body;

    if (!contactId || !amountCents || !description) {
      return res.status(400).json({ error: 'contactId, amountCents, and description are required' });
    }

    const payment = IntegrationsService.createStripePaymentRequest(wsId, {
      contactId,
      opportunityId,
      amountCents: Number(amountCents),
      currency,
      description,
      actorUserId: req.user!.id,
    });

    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/integrations/google-calendar/book
integrationsRouter.post('/google-calendar/book', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { contactId, userId, title, startTime, endTime, timezone } = req.body;

    if (!contactId || !startTime || !endTime || !title) {
      return res.status(400).json({ error: 'contactId, title, startTime, and endTime are required' });
    }

    const apt = IntegrationsService.bookAppointment(wsId, {
      contactId,
      userId: userId || req.user!.id,
      title,
      startTime,
      endTime,
      timezone: timezone || 'UTC',
      actorUserId: req.user!.id,
    });

    res.status(201).json(apt);
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

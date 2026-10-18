import { Router } from 'express';
import { db } from '../db/store.ts';
import { IntegrationsService } from '../services/integrations.service.ts';
import { LeadEngineService } from '../services/lead-engine.service.ts';

export const webhooksRouter = Router();

// POST /api/webhooks/twilio - Inbound Twilio WhatsApp / SMS Webhook
webhooksRouter.post('/twilio', (req, res) => {
  try {
    const { From, To, Body, MessageSid, AccountSid } = req.body;
    if (!From || !Body) {
      return res.status(400).send('<Response><Message>Missing required parameters</Message></Response>');
    }

    // Identify target workspace from accountSid or default first workspace
    const workspaces = db.getData().workspaces;
    let targetWsId = workspaces[0]?.id;

    for (const ws of workspaces) {
      const cfg = db.getIntegrationConfig(ws.id);
      if (cfg.twilio.accountSid && cfg.twilio.accountSid === AccountSid) {
        targetWsId = ws.id;
        break;
      }
    }

    if (!targetWsId) {
      return res.status(404).send('<Response></Response>');
    }

    // Process inbound message
    const { contact, isOptOut } = IntegrationsService.handleInboundWhatsApp(targetWsId, {
      from: From,
      to: To || 'whatsapp:+14155238886',
      body: Body,
      messageSid: MessageSid,
    });

    // If new contact / no existing open leads, ingest as lead
    const existingOpenLeads = db
      .getLeads(targetWsId)
      .filter((l) => l.contactId === contact.id && l.status === 'open');

    if (existingOpenLeads.length === 0 && !isOptOut) {
      LeadEngineService.assignLead(targetWsId, {
        title: `WhatsApp Inquiry: ${Body.substring(0, 40)}...`,
        source: 'twilio_whatsapp',
        contactId: contact.id,
        notes: [`Inbound message received: "${Body}"`],
      });
    }

    // TwiML response
    res.type('text/xml').send('<Response></Response>');
  } catch (err: any) {
    console.error('Twilio webhook processing error:', err);
    res.status(500).send('<Response></Response>');
  }
});

// POST /api/webhooks/stripe - Inbound Stripe Webhook
webhooksRouter.post('/stripe', (req, res) => {
  try {
    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid Stripe event payload' });
    }

    const workspaces = db.getData().workspaces;
    let targetWsId = workspaces[0]?.id;

    // Optional metadata workspaceId
    if (event.data?.object?.metadata?.workspaceId) {
      targetWsId = event.data.object.metadata.workspaceId;
    }

    if (!targetWsId) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const result = IntegrationsService.handleStripeWebhook(targetWsId, event);
    res.json({ received: true, processed: result.processed });
  } catch (err: any) {
    console.error('Stripe webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

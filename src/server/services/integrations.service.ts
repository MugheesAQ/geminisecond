import crypto from 'crypto';
import { db } from '../db/store.ts';
import type { Lead, Contact, Conversation, PaymentRequest, Appointment } from '../db/types.ts';

export class IntegrationsService {
  /**
   * Twilio WhatsApp webhook signature verification (HMAC-SHA1)
   */
  public static verifyTwilioSignature(
    authToken: string,
    expectedSignature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!authToken || !expectedSignature) return false;
    // Twilio signature algorithm: sort post parameters, append to URL, hash with HMAC-SHA1
    let data = url;
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      data += key + params[key];
    }
    const signature = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
    return signature === expectedSignature;
  }

  /**
   * Processes inbound WhatsApp message from Twilio
   */
  public static handleInboundWhatsApp(
    workspaceId: string,
    params: {
      from: string; // e.g. "whatsapp:+15551234567"
      to: string;
      body: string;
      messageSid?: string;
    }
  ): { contact: Contact; conversation: Conversation; isOptOut: boolean } {
    const rawPhone = params.from.replace('whatsapp:', '').trim();
    let contact = db.getContactByPhone(workspaceId, rawPhone);

    const isOptOut = /^(stop|unsubscribe|cancel|end|quit)$/i.test(params.body.trim());
    const isOptIn = /^(start|unstop|join)$/i.test(params.body.trim());

    if (!contact) {
      const contactId = `cont-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      contact = {
        id: contactId,
        workspaceId,
        name: `WhatsApp Lead (${rawPhone})`,
        email: `whatsapp.${rawPhone.replace(/[^0-9]/g, '')}@lead.inbound`,
        phone: rawPhone,
        isOptedOut: isOptOut,
        tags: ['WhatsApp Inbound', 'New Lead'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createContact(contact);
    } else {
      if (isOptOut) {
        contact.isOptedOut = true;
      } else if (isOptIn) {
        contact.isOptedOut = false;
      } else {
        contact.isOptedOut = contact.isOptedOut ?? false;
      }
      db.updateContact(contact);
    }

    // Get or create conversation
    let conv = db.getConversationByContact(workspaceId, contact.id);
    const now = new Date().toISOString();
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        workspaceId,
        contactId: contact.id,
        messages: [],
        lastMessageAt: now,
      };
    }

    conv.messages.push({
      id: params.messageSid || `msg-${Date.now()}`,
      from: params.from,
      to: params.to,
      body: params.body,
      direction: 'inbound',
      status: 'received',
      timestamp: now,
    });
    conv.lastMessageAt = now;
    db.saveConversation(conv);

    // Update integration last sync
    const integ = db.getIntegrationConfig(workspaceId);
    integ.twilio.lastSyncAt = now;
    db.saveIntegrationConfig(integ);

    // Audit event
    db.appendAudit({
      workspaceId,
      actorType: 'webhook',
      actorName: 'Twilio WhatsApp Webhook',
      eventType: isOptOut ? 'MESSAGING_OPT_OUT' : 'INBOUND_MESSAGE_RECEIVED',
      targetEntity: 'Conversation',
      targetId: conv.id,
      details: { from: params.from, preview: params.body.substring(0, 60), isOptOut },
    });

    return { contact, conversation: conv, isOptOut };
  }

  /**
   * Outbound WhatsApp reply with opt-out enforcement
   */
  public static sendWhatsAppReply(
    workspaceId: string,
    contactId: string,
    body: string,
    actorUserId: string
  ): { success: boolean; messageId: string } {
    const contact = db.getContactById(workspaceId, contactId);
    if (!contact) throw new Error('Contact not found');

    if (contact.isOptedOut) {
      throw new Error('Contact has opted out of messaging. Outgoing messages are prohibited under compliance regulations.');
    }

    const integ = db.getIntegrationConfig(workspaceId);
    const now = new Date().toISOString();
    const messageId = `msg-out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let conv = db.getConversationByContact(workspaceId, contactId);
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}`,
        workspaceId,
        contactId,
        messages: [],
        lastMessageAt: now,
      };
    }

    conv.messages.push({
      id: messageId,
      from: integ.twilio.whatsappNumber || 'whatsapp:+14155238886',
      to: `whatsapp:${contact.phone}`,
      body,
      direction: 'outbound',
      status: 'delivered', // simulated sandbox delivery
      timestamp: now,
    });
    conv.lastMessageAt = now;
    db.saveConversation(conv);

    // Audit event
    db.appendAudit({
      workspaceId,
      actorUserId,
      actorType: 'user',
      actorName: 'Authorized User',
      eventType: 'OUTBOUND_MESSAGE_SENT',
      targetEntity: 'Conversation',
      targetId: conv.id,
      details: { to: contact.phone, preview: body.substring(0, 60) },
    });

    return { success: true, messageId };
  }

  /**
   * Stripe: Creates a Payment Request with strictly validated integer minor units (cents)
   */
  public static createStripePaymentRequest(
    workspaceId: string,
    params: {
      opportunityId?: string;
      contactId: string;
      amountCents: number;
      currency?: string;
      description: string;
      actorUserId: string;
    }
  ): PaymentRequest {
    if (!params.amountCents || params.amountCents <= 0 || !Number.isInteger(params.amountCents)) {
      throw new Error('Amount must be a strictly positive integer in minor currency units (cents)');
    }

    const currency = (params.currency || 'USD').toUpperCase();
    const id = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const paymentLinkId = `plink_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const payment: PaymentRequest = {
      id,
      workspaceId,
      opportunityId: params.opportunityId,
      contactId: params.contactId,
      createdByUserId: params.actorUserId,
      amountCents: params.amountCents,
      currency,
      description: params.description,
      status: 'pending',
      stripePaymentLinkId: paymentLinkId,
      createdAt: new Date().toISOString(),
    };

    db.savePayment(payment);

    db.appendAudit({
      workspaceId,
      actorUserId: params.actorUserId,
      actorType: 'user',
      actorName: 'Authorized User',
      eventType: 'PAYMENT_LINK_CREATED',
      targetEntity: 'Payment',
      targetId: id,
      details: {
        amountCents: payment.amountCents,
        currency,
        description: payment.description,
        stripePaymentLinkId: paymentLinkId,
      },
    });

    return payment;
  }

  /**
   * Stripe Webhook Handler: Reconciles payments and handles refunds
   */
  public static handleStripeWebhook(
    workspaceId: string,
    event: {
      type: string;
      id: string;
      data: { object: any };
    }
  ): { processed: boolean; paymentId?: string } {
    const obj = event.data.object;
    const now = new Date().toISOString();

    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const paymentId = obj.client_reference_id || obj.metadata?.paymentId;
      let payment = paymentId ? db.getPaymentById(workspaceId, paymentId) : undefined;

      if (!payment && obj.payment_link) {
        payment = db.getPayments(workspaceId).find((p) => p.stripePaymentLinkId === obj.payment_link);
      }

      if (payment) {
        // Prevent duplicate processing
        if (payment.status === 'paid') return { processed: true, paymentId: payment.id };

        payment.status = 'paid';
        payment.paidAt = now;
        payment.stripeSessionId = obj.id;
        payment.stripeEventId = event.id;
        db.savePayment(payment);

        db.appendAudit({
          workspaceId,
          actorType: 'webhook',
          actorName: 'Stripe Webhook',
          eventType: 'PAYMENT_SUCCEEDED',
          targetEntity: 'Payment',
          targetId: payment.id,
          details: { amountCents: payment.amountCents, stripeEventId: event.id },
        });

        return { processed: true, paymentId: payment.id };
      }
    } else if (event.type === 'charge.refunded') {
      const paymentId = obj.metadata?.paymentId;
      const payment = paymentId ? db.getPaymentById(workspaceId, paymentId) : undefined;
      if (payment) {
        payment.status = 'refunded';
        payment.refundedAmountCents = obj.amount_refunded || payment.amountCents;
        db.savePayment(payment);

        db.appendAudit({
          workspaceId,
          actorType: 'webhook',
          actorName: 'Stripe Webhook',
          eventType: 'PAYMENT_REFUNDED',
          targetEntity: 'Payment',
          targetId: payment.id,
          details: { refundedAmountCents: payment.refundedAmountCents },
        });

        return { processed: true, paymentId: payment.id };
      }
    }

    return { processed: false };
  }

  /**
   * Google Calendar: Checks for appointment slot conflicts
   */
  public static checkCalendarOverlap(
    workspaceId: string,
    userId: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): { hasConflict: boolean; conflictingTitle?: string } {
    const newStart = new Date(startTime).getTime();
    const newEnd = new Date(endTime).getTime();

    const existing = db
      .getAppointments(workspaceId)
      .filter((a) => a.userId === userId && a.status === 'confirmed' && a.id !== excludeAppointmentId);

    for (const apt of existing) {
      const aStart = new Date(apt.startTime).getTime();
      const aEnd = new Date(apt.endTime).getTime();
      // Overlap formula: startA < endB && endA > startB
      if (newStart < aEnd && newEnd > aStart) {
        return { hasConflict: true, conflictingTitle: apt.title };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Google Calendar: Schedules an appointment after validating no collision exists
   */
  public static bookAppointment(
    workspaceId: string,
    params: {
      contactId: string;
      userId: string;
      title: string;
      startTime: string;
      endTime: string;
      timezone: string;
      actorUserId: string;
    }
  ): Appointment {
    const overlap = this.checkCalendarOverlap(
      workspaceId,
      params.userId,
      params.startTime,
      params.endTime
    );

    if (overlap.hasConflict) {
      throw new Error(`Schedule Conflict: Employee already has an appointment during this time (${overlap.conflictingTitle})`);
    }

    const aptId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const appointment: Appointment = {
      id: aptId,
      workspaceId,
      contactId: params.contactId,
      userId: params.userId,
      title: params.title,
      startTime: params.startTime,
      endTime: params.endTime,
      timezone: params.timezone || 'UTC',
      googleCalendarEventId: `gcal_evt_${Date.now()}`,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    db.saveAppointment(appointment);

    db.appendAudit({
      workspaceId,
      actorUserId: params.actorUserId,
      actorType: 'user',
      actorName: 'Authorized User',
      eventType: 'APPOINTMENT_SCHEDULED',
      targetEntity: 'Appointment',
      targetId: aptId,
      details: { title: appointment.title, startTime: appointment.startTime, userId: params.userId },
    });

    return appointment;
  }

  /**
   * Telegram Bot: Dispatches escalation alert notification
   */
  public static dispatchTelegramEscalationAlert(
    workspaceId: string,
    lead: Lead,
    escalationReason: string
  ): { dispatched: boolean; log: string } {
    const config = db.getIntegrationConfig(workspaceId);
    const now = new Date().toISOString();

    if (!config.telegram.enabled || !config.telegram.botToken) {
      return {
        dispatched: false,
        log: 'Telegram alerts disabled or bot token not configured for this workspace',
      };
    }

    const text = `🚨 *LEAD SLA ESCALATION NOTICE*\n\n` +
      `*Lead:* ${lead.title}\n` +
      `*Tier:* Level ${lead.escalationLevel}\n` +
      `*Source:* ${lead.source}\n` +
      `*Assigned:* ${lead.assignedToUserId || 'Unassigned'}\n` +
      `*Reason:* ${escalationReason}\n\n` +
      `👉 [Review & Acknowledge Lead](https://platform.internal/leads/${lead.id})`;

    // Record attempt
    config.telegram.lastSyncAt = now;
    db.saveIntegrationConfig(config);

    db.appendAudit({
      workspaceId,
      actorType: 'system',
      actorName: 'Telegram Dispatcher',
      eventType: 'TELEGRAM_ALERT_DISPATCHED',
      targetEntity: 'Lead',
      targetId: lead.id,
      details: { chatId: config.telegram.chatId, level: lead.escalationLevel },
    });

    return { dispatched: true, log: `Alert successfully queued for Telegram Chat ${config.telegram.chatId}` };
  }
}

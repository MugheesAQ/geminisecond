import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { db } from '../db/store.ts';
import { IntegrationsService } from '../services/integrations.service.ts';

const WS_ID = 'ws-apex-01';
const USER_ID = 'usr-sarah-owner';

beforeEach(() => {
  db.reset();
});

test('Twilio: HMAC-SHA1 signature verification correctly validates authentic webhooks', () => {
  const authToken = 'test_auth_token_secret_123';
  const url = 'https://api.apexservices.com/api/webhooks/twilio/whatsapp';
  const params = {
    Body: 'Hello, I need pricing information for your enterprise tier',
    From: 'whatsapp:+15559876543',
    To: 'whatsapp:+14155238886',
  };

  // Compute authentic signature
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + (params as any)[key];
  }
  const validSignature = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');

  const isValid = IntegrationsService.verifyTwilioSignature(authToken, validSignature, url, params);
  assert.equal(isValid, true, 'Valid signature should pass verification');

  const isInvalid = IntegrationsService.verifyTwilioSignature(authToken, 'forged_signature_xyz', url, params);
  assert.equal(isInvalid, false, 'Forged signature must be rejected');
});

test('Twilio WhatsApp: Inbound message creates contact and conversation, and enforces opt-out', () => {
  const phone = '+15552345678';

  // 1. Inbound greeting
  const res1 = IntegrationsService.handleInboundWhatsApp(WS_ID, {
    from: `whatsapp:${phone}`,
    to: 'whatsapp:+14155238886',
    body: 'Hi, I need assistance with pipeline setup',
    messageSid: 'SM_test_01',
  });

  assert.equal(res1.isOptOut, false);
  assert.equal(res1.contact.phone, phone);
  assert.equal(res1.conversation.messages.length, 1);
  assert.equal(res1.contact.isOptedOut, false);

  // Outbound message to active contact succeeds
  const reply = IntegrationsService.sendWhatsAppReply(
    WS_ID,
    res1.contact.id,
    'Hi! Our team is on it.',
    USER_ID
  );
  assert.equal(reply.success, true);

  // 2. Opt-out keyword STOP
  const res2 = IntegrationsService.handleInboundWhatsApp(WS_ID, {
    from: `whatsapp:${phone}`,
    to: 'whatsapp:+14155238886',
    body: 'STOP',
    messageSid: 'SM_test_02',
  });
  assert.equal(res2.isOptOut, true);
  assert.equal(res2.contact.isOptedOut, true);

  // 3. Attempting to send outbound message to opted-out contact throws compliance error
  assert.throws(
    () => {
      IntegrationsService.sendWhatsAppReply(
        WS_ID,
        res1.contact.id,
        'Trying to send message anyway',
        USER_ID
      );
    },
    /opted out of messaging/i,
    'Should block outgoing messages to opted-out contacts'
  );
});

test('Stripe: Validates integer minor currency units and handles payments & refunds', () => {
  const contact = db.getContacts(WS_ID)[0];
  assert.ok(contact, 'Seed should have at least one contact');

  // 1. Rejects non-integer or zero cents
  assert.throws(
    () => {
      IntegrationsService.createStripePaymentRequest(WS_ID, {
        contactId: contact.id,
        amountCents: 49.99, // Floating point invalid
        description: 'Invalid fractional cents',
        actorUserId: USER_ID,
      });
    },
    /strictly positive integer/i
  );

  assert.throws(
    () => {
      IntegrationsService.createStripePaymentRequest(WS_ID, {
        contactId: contact.id,
        amountCents: -500, // Negative invalid
        description: 'Negative cents',
        actorUserId: USER_ID,
      });
    },
    /strictly positive integer/i
  );

  // 2. Creates valid payment in integer cents ($250.00 = 25000 cents)
  const payment = IntegrationsService.createStripePaymentRequest(WS_ID, {
    contactId: contact.id,
    amountCents: 25000,
    currency: 'USD',
    description: 'Onboarding Fee',
    actorUserId: USER_ID,
  });

  assert.equal(payment.amountCents, 25000);
  assert.equal(payment.status, 'pending');

  // 3. Stripe Webhook: checkout.session.completed marks payment as paid
  const webhookResult = IntegrationsService.handleStripeWebhook(WS_ID, {
    type: 'checkout.session.completed',
    id: 'evt_stripe_test_123',
    data: {
      object: {
        id: 'cs_test_session_123',
        client_reference_id: payment.id,
      },
    },
  });

  assert.equal(webhookResult.processed, true);
  const updatedPayment = db.getPaymentById(WS_ID, payment.id);
  assert.equal(updatedPayment?.status, 'paid');
  assert.ok(updatedPayment?.paidAt);

  // 4. Stripe Webhook: charge.refunded updates status to refunded
  const refundResult = IntegrationsService.handleStripeWebhook(WS_ID, {
    type: 'charge.refunded',
    id: 'evt_stripe_refund_123',
    data: {
      object: {
        metadata: { paymentId: payment.id },
        amount_refunded: 25000,
      },
    },
  });

  assert.equal(refundResult.processed, true);
  const refundedPayment = db.getPaymentById(WS_ID, payment.id);
  assert.equal(refundedPayment?.status, 'refunded');
  assert.equal(refundedPayment?.refundedAmountCents, 25000);
});

test('Google Calendar: Detects scheduling conflicts and books non-conflicting appointments', () => {
  const contact = db.getContacts(WS_ID)[0];

  const startTime = '2026-11-01T14:00:00.000Z';
  const endTime = '2026-11-01T15:00:00.000Z';

  // 1. Initial booking succeeds
  const apt = IntegrationsService.bookAppointment(WS_ID, {
    contactId: contact.id,
    userId: USER_ID,
    title: 'Enterprise Architecture Review',
    startTime,
    endTime,
    timezone: 'UTC',
    actorUserId: USER_ID,
  });

  assert.equal(apt.status, 'confirmed');

  // 2. Overlapping appointment for same employee fails
  const overlappingStart = '2026-11-01T14:30:00.000Z';
  const overlappingEnd = '2026-11-01T15:30:00.000Z';

  const conflictCheck = IntegrationsService.checkCalendarOverlap(
    WS_ID,
    USER_ID,
    overlappingStart,
    overlappingEnd
  );
  assert.equal(conflictCheck.hasConflict, true);

  assert.throws(
    () => {
      IntegrationsService.bookAppointment(WS_ID, {
        contactId: contact.id,
        userId: USER_ID,
        title: 'Conflicting Discovery Call',
        startTime: overlappingStart,
        endTime: overlappingEnd,
        timezone: 'UTC',
        actorUserId: USER_ID,
      });
    },
    /Schedule Conflict/i
  );

  // 3. Non-overlapping appointment on same day succeeds
  const nonConflictStart = '2026-11-01T16:00:00.000Z';
  const nonConflictEnd = '2026-11-01T17:00:00.000Z';

  const apt2 = IntegrationsService.bookAppointment(WS_ID, {
    contactId: contact.id,
    userId: USER_ID,
    title: 'Post-Implementation Briefing',
    startTime: nonConflictStart,
    endTime: nonConflictEnd,
    timezone: 'UTC',
    actorUserId: USER_ID,
  });

  assert.equal(apt2.status, 'confirmed');
});

test('Telegram: Formats escalation alert payload and logs dispatch attempt safely', () => {
  const lead = db.getLeads(WS_ID)[0];
  assert.ok(lead);

  const result = IntegrationsService.dispatchTelegramEscalationAlert(
    WS_ID,
    lead,
    'SLA acknowledgement overdue by 35 minutes'
  );

  assert.equal(typeof result.dispatched, 'boolean');
  assert.ok(result.log.length > 0);
});

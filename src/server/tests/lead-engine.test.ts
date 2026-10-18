import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/store.ts';
import { LeadEngineService } from '../services/lead-engine.service.ts';

beforeEach(() => {
  db.reset();
});

test('Lead Engine: Round-robin assigns to available agent with lowest open lead count', () => {
  const wsId = 'ws-apex-01';

  // Seed data has agents:
  // owner@apexservices.com (usr-sarah-owner)
  // admin@apexservices.com (usr-marcus-admin)
  // manager@apexservices.com (usr-david-manager)
  // agent@apexservices.com (usr-elena-agent)

  // Ensure all are available
  db.setAvailability(wsId, 'usr-sarah-owner', 'available');
  db.setAvailability(wsId, 'usr-marcus-admin', 'available');
  db.setAvailability(wsId, 'usr-david-manager', 'available');
  db.setAvailability(wsId, 'usr-elena-agent', 'available');

  const eligible = LeadEngineService.getEligibleAssignees(wsId);
  assert.ok(eligible.length > 0, 'Should have eligible agents');

  // Assign a lead
  const lead = LeadEngineService.assignLead(wsId, {
    title: 'Test Round Robin Lead',
    source: 'web_form',
    contactId: 'cont-01',
  });

  assert.ok(lead.id.startsWith('lead-'));
  assert.ok(lead.assignedToUserId, 'Lead must have an assigned owner');
  assert.equal(lead.acknowledged, false, 'New lead starts unacknowledged');
  assert.ok(new Date(lead.ackDeadline) > new Date(), 'Deadline must be in the future');
});

test('Lead Engine: Excludes busy, on_leave, and offline employees from assignment', () => {
  const wsId = 'ws-apex-01';

  // Mark all unavailable except Elena
  db.setAvailability(wsId, 'usr-sarah-owner', 'busy');
  db.setAvailability(wsId, 'usr-marcus-admin', 'on_leave');
  db.setAvailability(wsId, 'usr-david-manager', 'offline');
  db.setAvailability(wsId, 'usr-elena-agent', 'available');

  const eligible = LeadEngineService.getEligibleAssignees(wsId);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].userId, 'usr-elena-agent');

  // Reset statuses back to available for subsequent tests
  db.setAvailability(wsId, 'usr-sarah-owner', 'available');
  db.setAvailability(wsId, 'usr-marcus-admin', 'available');
  db.setAvailability(wsId, 'usr-david-manager', 'available');
});

test('Lead Engine: Excludes employees at maximum open lead capacity', () => {
  const wsId = 'ws-apex-01';
  const config = db.getAssignmentConfig(wsId);
  const maxCapacity = config.maxOpenLeadsPerUser;

  // Let's create enough open leads for Elena to reach capacity
  const targetUser = 'usr-elena-agent';
  const existingOpen = db.getLeads(wsId).filter((l) => l.assignedToUserId === targetUser && l.status === 'open').length;

  for (let i = 0; i < maxCapacity - existingOpen; i++) {
    db.createLead({
      id: `lead-cap-fill-${i}-${Date.now()}`,
      workspaceId: wsId,
      title: `Capacity Lead ${i}`,
      source: 'manual',
      contactId: 'cont-01',
      assignedToUserId: targetUser,
      acknowledged: true,
      ackDeadline: new Date(Date.now() + 600000).toISOString(),
      escalationLevel: 0,
      status: 'open',
      customFields: {},
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const eligible = LeadEngineService.getEligibleAssignees(wsId);
  const foundElena = eligible.some((e) => e.userId === targetUser);
  assert.equal(foundElena, false, 'Elena should be excluded from eligible pool once at max open lead capacity');
});

test('Lead Engine: Explicit acknowledgement works and is idempotent', () => {
  const wsId = 'ws-apex-01';
  const lead = LeadEngineService.assignLead(wsId, {
    title: 'Acknowledgement Verification Lead',
    source: 'manual',
    contactId: 'cont-01',
  });

  assert.equal(lead.acknowledged, false);

  const acked = LeadEngineService.acknowledgeLead(wsId, lead.id, 'usr-sarah-owner', 'manual_button');
  assert.equal(acked.acknowledged, true);
  assert.ok(acked.acknowledgedAt);
  assert.equal(acked.acknowledgedByUserId, 'usr-sarah-owner');

  // Calling again returns same acknowledged state without error
  const ackedAgain = LeadEngineService.acknowledgeLead(wsId, lead.id, 'usr-sarah-owner');
  assert.equal(ackedAgain.acknowledged, true);
});

test('Lead Engine: Qualifying action automatically triggers acknowledgement', () => {
  const wsId = 'ws-apex-01';
  const lead = LeadEngineService.assignLead(wsId, {
    title: 'Qualifying Action Test Lead',
    source: 'web_form',
    contactId: 'cont-02',
  });

  assert.equal(lead.acknowledged, false);

  LeadEngineService.triggerQualifyingAction(wsId, lead.id, 'usr-elena-agent', 'WhatsApp reply sent to customer');

  const refreshed = db.getLeadById(wsId, lead.id)!;
  assert.equal(refreshed.acknowledged, true);
  assert.ok(refreshed.notes.some((n) => n.includes('WhatsApp reply sent to customer')));
});

test('Lead Engine: Immediate reallocation when employee transitions to unavailable', () => {
  const wsId = 'ws-apex-01';
  // Create an unacknowledged lead for Elena
  const lead = LeadEngineService.assignLead(wsId, {
    title: 'Urgent Unacknowledged Inbound',
    source: 'twilio_whatsapp',
    contactId: 'cont-03',
    manualAssigneeId: 'usr-elena-agent',
  });

  assert.equal(lead.assignedToUserId, 'usr-elena-agent');
  assert.equal(lead.acknowledged, false);

  // Elena switches to 'on_leave'
  db.setAvailability(wsId, 'usr-elena-agent', 'on_leave');
  const reroute = LeadEngineService.handleUserAvailabilityTransition(wsId, 'usr-elena-agent', 'on_leave');

  assert.ok(reroute.reallocatedLeads >= 1, 'Should have reallocated unacknowledged lead');

  const updatedLead = db.getLeadById(wsId, lead.id)!;
  assert.notEqual(updatedLead.assignedToUserId, 'usr-elena-agent', 'Lead must no longer be assigned to on-leave agent');

  // Reset Elena back to available
  db.setAvailability(wsId, 'usr-elena-agent', 'available');
});

test('Lead Engine: SLA deadline expiration escalates to backup / manager chain', () => {
  const wsId = 'ws-apex-01';
  const pastDeadline = new Date(Date.now() - 5000).toISOString();

  // Create an overdue unacknowledged lead
  const leadId = `lead-overdue-${Date.now()}`;
  db.createLead({
    id: leadId,
    workspaceId: wsId,
    title: 'Critical Overdue RFQ',
    source: 'web_form',
    contactId: 'cont-01',
    assignedToUserId: 'usr-elena-agent',
    acknowledged: false,
    ackDeadline: pastDeadline,
    escalationLevel: 0,
    status: 'open',
    customFields: {},
    notes: [],
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  });

  const escalated = LeadEngineService.processEscalation(wsId, leadId);
  assert.ok(escalated, 'Escalation must trigger for past-deadline lead');
  assert.equal(escalated!.escalationLevel, 1, 'Escalation level must increment');
  assert.notEqual(escalated!.assignedToUserId, 'usr-elena-agent', 'Lead must be transferred to backup/escalation chain');
  assert.ok(new Date(escalated!.ackDeadline) > new Date(), 'New deadline must be extended');
});

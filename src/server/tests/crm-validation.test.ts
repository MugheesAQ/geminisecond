import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/store.ts';
import { CrmService } from '../services/crm.service.ts';
import type { Opportunity } from '../db/types.ts';

beforeEach(() => {
  db.reset();
});

test('CRM Validation: Moving to a stage with required custom fields rejects when fields are missing', () => {
  const wsId = 'ws-apex-01';

  // In seed data:
  // stage-discovery requires: 'budget_range'
  // stage-proposal requires: 'budget_range', 'implementation_timeline'
  // stage-negotiation requires: 'budget_range', 'implementation_timeline', 'decision_maker_confirmed'

  const opp: Opportunity = {
    id: `opp-test-${Date.now()}`,
    workspaceId: wsId,
    contactId: 'cont-01',
    pipelineId: 'pipe-enterprise-01',
    stageId: 'stage-lead', // initial stage
    title: 'New Service Project',
    valueCents: 1000000,
    currency: 'USD',
    expectedCloseDate: '2026-12-01',
    customFields: {}, // Empty custom fields
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createOpportunity(opp);

  // Attempt to move to 'stage-discovery' without 'budget_range'
  const validationResult = CrmService.validateStageTransition(wsId, opp, 'stage-discovery');
  assert.equal(validationResult.valid, false, 'Transition should be invalid when required fields are missing');
  assert.ok(validationResult.missingFields.includes('Budget Range'));

  // Attempting moveOpportunityStage should throw
  assert.throws(
    () => {
      CrmService.moveOpportunityStage(wsId, opp.id, 'stage-discovery', 'usr-sarah-owner');
    },
    /Missing required fields/,
    'Should throw missing required fields error'
  );
});

test('CRM Validation: Stage transition succeeds when all required custom fields are present', () => {
  const wsId = 'ws-apex-01';

  const oppId = `opp-valid-${Date.now()}`;
  const opp: Opportunity = {
    id: oppId,
    workspaceId: wsId,
    contactId: 'cont-01',
    pipelineId: 'pipe-enterprise-01',
    stageId: 'stage-lead',
    title: 'Fully Qualified Deal',
    valueCents: 2500000,
    currency: 'USD',
    expectedCloseDate: '2026-12-01',
    customFields: {
      budget_range: '$25k - $50k',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createOpportunity(opp);

  // Now move to 'stage-discovery' (requires 'budget_range', which is present)
  const updated = CrmService.moveOpportunityStage(wsId, oppId, 'stage-discovery', 'usr-sarah-owner');
  assert.equal(updated.stageId, 'stage-discovery');

  // Verify transition to proposal fails if missing implementation_timeline
  assert.throws(() => {
    CrmService.moveOpportunityStage(wsId, oppId, 'stage-proposal', 'usr-sarah-owner');
  });

  // Supply implementation_timeline and succeed
  const movedToProposal = CrmService.moveOpportunityStage(
    wsId,
    oppId,
    'stage-proposal',
    'usr-sarah-owner',
    { implementation_timeline: '1 - 3 Months' }
  );
  assert.equal(movedToProposal.stageId, 'stage-proposal');
});

test('CRM 360: Aggregates contact profile, associated company, opportunities, conversations, payments, and calendar', () => {
  const wsId = 'ws-apex-01';
  const c360 = CrmService.getCustomer360(wsId, 'cont-01');

  assert.equal(c360.contact.id, 'cont-01');
  assert.equal(c360.contact.name, 'Robert Hastings');
  assert.ok(c360.company, 'Associated company should be resolved');
  assert.equal(c360.company?.name, 'Vanguard Logistics Corp');
  assert.ok(Array.isArray(c360.opportunities));
  assert.ok(Array.isArray(c360.conversations));
  assert.ok(Array.isArray(c360.payments));
  assert.ok(Array.isArray(c360.appointments));
});


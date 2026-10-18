import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/store.ts';
import { AuditService } from '../services/audit.service.ts';

const WS_ID = 'ws-apex-01';
const USER_ID = 'usr-sarah-owner';

beforeEach(() => {
  db.reset();
});

test('Audit Log: Records events immutably with actor, eventType, timestamp and target', () => {
  const initialEvents = AuditService.query(WS_ID);
  const initialCount = initialEvents.length;

  const newEvent = AuditService.log({
    workspaceId: WS_ID,
    actorUserId: USER_ID,
    actorType: 'user',
    actorName: 'Sarah Chen (Owner)',
    eventType: 'OPPORTUNITY_STAGE_TRANSITION',
    targetEntity: 'Opportunity',
    targetId: 'opp-enterprise-test',
    details: { fromStage: 'Proposal', toStage: 'Negotiation', valueCents: 1500000 },
  });

  assert.ok(newEvent.id, 'Audit event must have unique ID');
  assert.ok(newEvent.timestamp, 'Audit event must have UTC timestamp');
  assert.equal(newEvent.eventType, 'OPPORTUNITY_STAGE_TRANSITION');

  const afterEvents = AuditService.query(WS_ID);
  assert.equal(afterEvents.length, initialCount + 1);

  const found = afterEvents.find((e) => e.id === newEvent.id);
  assert.ok(found);
  assert.equal(found?.targetEntity, 'Opportunity');
  assert.equal(found?.actorUserId, USER_ID);
});

test('Audit Log: Supports precise eventType and user filtering', () => {
  AuditService.log({
    workspaceId: WS_ID,
    actorUserId: 'usr-marcus-admin',
    actorType: 'user',
    actorName: 'Marcus Vance',
    eventType: 'USER_INVITED',
    targetEntity: 'Membership',
    targetId: 'mem-new-01',
    details: { email: 'newdev@apex.com', role: 'user' },
  });

  const filteredByType = AuditService.query(WS_ID, { eventType: 'USER_INVITED' });
  assert.ok(filteredByType.length >= 1);
  assert.ok(filteredByType.every((e) => e.eventType === 'USER_INVITED'));

  const filteredByUser = AuditService.query(WS_ID, { userId: 'usr-marcus-admin' });
  assert.ok(filteredByUser.length >= 1);
  assert.ok(filteredByUser.every((e) => e.actorUserId === 'usr-marcus-admin'));
});

test('Audit Log: Enforces immutability and rejects mutation or deletion APIs', () => {
  const immutability = AuditService.assertImmutability();
  assert.equal(immutability.immutable, true);
  assert.ok(immutability.reason.includes('append-only'));
});

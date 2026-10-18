import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/store.ts';
import { RbacService } from '../services/rbac.service.ts';
import type { Opportunity, Membership } from '../db/types.ts';

test('RBAC: Owner has full system permissions', () => {
  const ownerMem = db.findMembership('ws-apex-01', 'usr-sarah-owner')!;
  assert.equal(RbacService.hasPermission(ownerMem, 'crm:contacts:view'), true);
  assert.equal(RbacService.hasPermission(ownerMem, 'crm:sensitive_values:view'), true);
  assert.equal(RbacService.hasPermission(ownerMem, 'workspace:members:manage'), true);
  assert.equal(RbacService.hasPermission(ownerMem, 'audit:view'), true);
});

test('RBAC: Managers are configurable permission combinations, not a hardcoded 4th role', () => {
  const managerMem = db.findMembership('ws-apex-01', 'usr-david-manager')!;
  assert.equal(managerMem.role, 'user', 'Base role is user');
  assert.ok(managerMem.customPermissions && managerMem.customPermissions.length > 0, 'Uses custom permissions array');

  // Manager has elevated permissions
  assert.equal(RbacService.hasPermission(managerMem, 'crm:sensitive_values:view'), true);
  assert.equal(RbacService.hasPermission(managerMem, 'leads:rules:configure'), true);
  assert.equal(RbacService.hasPermission(managerMem, 'audit:view'), true);

  // Compare to a standard user
  const regularUserMem = db.findMembership('ws-apex-01', 'usr-elena-agent')!;
  assert.equal(RbacService.hasPermission(regularUserMem, 'crm:sensitive_values:view'), false);
  assert.equal(RbacService.hasPermission(regularUserMem, 'leads:rules:configure'), false);
  assert.equal(RbacService.hasPermission(regularUserMem, 'audit:view'), false);
});

test('RBAC: Admins cannot modify Owner account or bypass Owner protections', () => {
  const adminMem = db.findMembership('ws-apex-01', 'usr-marcus-admin')!;
  const ownerMem = db.findMembership('ws-apex-01', 'usr-sarah-owner')!;

  const check = RbacService.canModifyMember(adminMem, ownerMem);
  assert.equal(check.allowed, false, 'Admin must not be allowed to modify Owner account');
  assert.ok(check.reason?.includes('Owner'));

  // Owner CAN modify Admin
  const ownerCheck = RbacService.canModifyMember(ownerMem, adminMem);
  assert.equal(ownerCheck.allowed, true, 'Owner can modify Admin');
});

test('Field-Level Authorization: Sensitive deal values are masked for unprivileged users', () => {
  const sampleOpp: Opportunity = {
    id: 'opp-mask-test',
    workspaceId: 'ws-apex-01',
    contactId: 'cont-01',
    pipelineId: 'pipe-enterprise-01',
    stageId: 'stage-proposal',
    title: 'High Value Contract',
    valueCents: 50000000, // $500,000.00
    currency: 'USD',
    expectedCloseDate: '2026-12-31',
    customFields: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const regularUserMem = db.findMembership('ws-apex-01', 'usr-elena-agent')!;
  const ownerMem = db.findMembership('ws-apex-01', 'usr-sarah-owner')!;

  // Masked for regular user
  const maskedForUser = RbacService.maskOpportunitySensitiveFields(sampleOpp, regularUserMem);
  assert.equal(maskedForUser.valueCents, -1, 'Monetary value must be redacted with sentinel value');

  // Visible for Owner
  const visibleForOwner = RbacService.maskOpportunitySensitiveFields(sampleOpp, ownerMem);
  assert.equal(visibleForOwner.valueCents, 50000000, 'Monetary value visible to authorized role');
});

test('Multi-Tenancy Isolation: Cross-tenant data access is strictly segregated', () => {
  const apexWsId = 'ws-apex-01';
  const betaWsId = 'ws-cross-tenant-test';

  // Seed data has contacts and opportunities for ws-apex-01
  const apexContacts = db.getContacts(apexWsId);
  const betaContacts = db.getContacts(betaWsId);

  assert.ok(apexContacts.length > 0, 'Apex workspace has contacts');
  assert.equal(betaContacts.length, 0, 'Beta workspace has zero Apex contacts');

  // Attempting to query an Apex contact with Beta workspace ID returns undefined
  const apexContactId = apexContacts[0].id;
  const crossQuery = db.getContactById(betaWsId, apexContactId);
  assert.equal(crossQuery, undefined, 'Negative test: cross-tenant direct object lookup must fail');

  // Attempting cross-workspace member modification is rejected
  const apexMem = db.findMembership(apexWsId, 'usr-sarah-owner')!;
  const fakeBetaMem: Membership = {
    id: 'mem-beta-fake',
    workspaceId: betaWsId,
    userId: 'usr-beta-user',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  const crossMemCheck = RbacService.canModifyMember(apexMem, fakeBetaMem);
  assert.equal(crossMemCheck.allowed, false, 'Cross-workspace membership edit must be forbidden');
});

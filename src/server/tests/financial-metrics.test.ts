import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/store.ts';
import { DashboardService } from '../services/dashboard.service.ts';
import type { PaymentRequest } from '../db/types.ts';

test('Financial Calculations: Unpaid payment requests never count toward collected revenue', () => {
  const wsId = 'ws-apex-01';
  const ownerMem = db.findMembership(wsId, 'usr-sarah-owner')!;

  const metricsBefore = DashboardService.getMetrics(wsId, ownerMem);
  const collectedBefore = metricsBefore.collectedRevenueThisMonth.collectedCents;

  // Create an unpaid pending payment request of $100,000 (10,000,000 cents)
  const pendingPayment: PaymentRequest = {
    id: `pay-test-pending-${Date.now()}`,
    workspaceId: wsId,
    contactId: 'cont-01',
    createdByUserId: 'usr-sarah-owner',
    amountCents: 10000000, // $100,000
    currency: 'USD',
    description: 'Huge Pending Unpaid Request',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.savePayment(pendingPayment);

  const metricsAfter = DashboardService.getMetrics(wsId, ownerMem);
  assert.equal(
    metricsAfter.collectedRevenueThisMonth.collectedCents,
    collectedBefore,
    'Collected revenue must remain identical when unpaid payment requests are created'
  );
  assert.ok(
    metricsAfter.collectedRevenueThisMonth.unpaidPendingCents >= 10000000,
    'Unpaid amount must be tracked separately'
  );
});

test('Financial Calculations: Confirmed refunds reduce net collected revenue', () => {
  const wsId = 'ws-apex-01';
  const ownerMem = db.findMembership(wsId, 'usr-sarah-owner')!;

  // Create a settled payment of $1,000 (100,000 cents)
  const paidPayment: PaymentRequest = {
    id: `pay-settled-${Date.now()}`,
    workspaceId: wsId,
    contactId: 'cont-01',
    createdByUserId: 'usr-sarah-owner',
    amountCents: 100000,
    currency: 'USD',
    description: 'Pilot Phase Fee',
    status: 'paid',
    paidAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.savePayment(paidPayment);

  const metrics1 = DashboardService.getMetrics(wsId, ownerMem);
  const net1 = metrics1.collectedRevenueThisMonth.netCents;

  // Now simulate a refund of $400 (40,000 cents)
  paidPayment.refundedAmountCents = 40000;
  db.savePayment(paidPayment);

  const metrics2 = DashboardService.getMetrics(wsId, ownerMem);
  const net2 = metrics2.collectedRevenueThisMonth.netCents;

  assert.equal(net1 - net2, 40000, 'Net collected revenue must decrease by the exact refund amount in minor units');
});

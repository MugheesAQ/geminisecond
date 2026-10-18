import { db } from '../db/store.ts';
import type { Membership } from '../db/types.ts';
import { LeadEngineService } from './lead-engine.service.ts';
import { RbacService } from './rbac.service.ts';

export interface DashboardMetrics {
  newLeadsToday: {
    count: number;
    drillDownFilter: { dateRange: 'today'; status?: string };
  };
  openPipelineValue: {
    totalValueCents: number;
    projectedValueCents: number;
    byStage: { stageId: string; stageName: string; count: number; valueCents: number }[];
    drillDownFilter: { pipelineStatus: 'open' };
  };
  avgTimeToFirstResponseMinutes: number;
  recoveryQueueCount: {
    count: number;
    drillDownFilter: { queue: 'recovery' };
  };
  escalationsLast24h: {
    count: number;
    drillDownFilter: { escalated: true };
  };
  employeeAvailability: {
    available: number;
    busy: number;
    onLeave: number;
    offline: number;
  };
  upcomingAppointments: {
    count: number;
    nextAppointment?: { id: string; title: string; startTime: string };
    drillDownFilter: { time: 'upcoming' };
  };
  collectedRevenueThisMonth: {
    collectedCents: number;
    refundedCents: number;
    netCents: number;
    unpaidPendingCents: number; // Disclosed separately, NOT included in collected revenue!
    drillDownFilter: { month: 'current' };
  };
}

export class DashboardService {
  public static getMetrics(workspaceId: string, membership: Membership): DashboardMetrics {
    const isRestrictedUser = membership.role === 'user';
    const currentUserId = membership.userId;
    const canViewSensitive = RbacService.hasPermission(membership, 'crm:sensitive_values:view');

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
    const past24h = now.getTime() - 24 * 3600 * 1000;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();

    // Leads
    let leads = db.getLeads(workspaceId);
    if (isRestrictedUser) {
      leads = leads.filter((l) => l.assignedToUserId === currentUserId);
    }

    const newLeadsToday = leads.filter((l) => new Date(l.createdAt).getTime() >= todayStart).length;

    // Time to first response calculation
    const acknowledgedWithDuration = leads
      .filter((l) => l.acknowledged && l.acknowledgedAt)
      .map((l) => {
        const created = new Date(l.createdAt).getTime();
        const acked = new Date(l.acknowledgedAt!).getTime();
        return Math.max(0, (acked - created) / (60 * 1000)); // in minutes
      });

    const avgResponseMinutes =
      acknowledgedWithDuration.length > 0
        ? Math.round(acknowledgedWithDuration.reduce((acc, curr) => acc + curr, 0) / acknowledgedWithDuration.length)
        : 0;

    // Recovery queue
    const recoveryItems = LeadEngineService.getRecoveryQueue(workspaceId);
    const recoveryCount = isRestrictedUser
      ? recoveryItems.filter((item) => item.lead.assignedToUserId === currentUserId).length
      : recoveryItems.length;

    // Escalations in last 24h
    const escalations24h = leads.filter((l) => {
      if (l.escalationLevel <= 0) return false;
      const escalatedAt = l.lastEscalatedAt ? new Date(l.lastEscalatedAt).getTime() : new Date(l.updatedAt).getTime();
      return escalatedAt >= past24h;
    }).length;

    // Opportunities & Pipeline Value
    let opportunities = db.getOpportunities(workspaceId);
    if (isRestrictedUser) {
      opportunities = opportunities.filter((o) => o.assignedToUserId === currentUserId);
    }

    const pipelines = db.getPipelines(workspaceId);
    const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];
    const stages = defaultPipeline ? defaultPipeline.stages : [];

    const byStage = stages.map((stg) => {
      const oppsInStage = opportunities.filter((o) => o.stageId === stg.id);
      const stageValue = oppsInStage.reduce((sum, o) => sum + (canViewSensitive ? o.valueCents : 0), 0);
      return {
        stageId: stg.id,
        stageName: stg.name,
        count: oppsInStage.length,
        valueCents: stageValue,
      };
    });

    // Closed lost is excluded from projected value
    const nonLostOpps = opportunities.filter((o) => !o.stageId.includes('closed-lost'));
    const totalPipelineValue = canViewSensitive
      ? nonLostOpps.reduce((sum, o) => sum + o.valueCents, 0)
      : 0;

    // Employee availability breakdown
    const allMembers = db.listMemberships(workspaceId);
    let availCount = 0;
    let busyCount = 0;
    let leaveCount = 0;
    let offlineCount = 0;

    for (const m of allMembers) {
      const status = db.getAvailability(workspaceId, m.userId).status;
      if (status === 'available') availCount++;
      else if (status === 'busy') busyCount++;
      else if (status === 'on_leave') leaveCount++;
      else if (status === 'offline') offlineCount++;
    }

    // Appointments
    let appointments = db.getAppointments(workspaceId);
    if (isRestrictedUser) {
      appointments = appointments.filter((a) => a.userId === currentUserId);
    }
    const upcoming = appointments
      .filter((a) => a.status === 'confirmed' && new Date(a.startTime).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Payments: Strictly distinguishing collected vs projected vs pending
    let payments = db.getPayments(workspaceId);
    if (isRestrictedUser) {
      payments = payments.filter((p) => p.createdByUserId === currentUserId);
    }

    let collectedThisMonth = 0;
    let refundsThisMonth = 0;
    let pendingThisMonth = 0;

    for (const p of payments) {
      const paymentTime = new Date(p.createdAt).getTime();
      if (paymentTime >= monthStart) {
        if (p.status === 'paid') {
          collectedThisMonth += p.amountCents;
          if (p.refundedAmountCents) {
            refundsThisMonth += p.refundedAmountCents;
          }
        } else if (p.status === 'refunded') {
          refundsThisMonth += p.refundedAmountCents || p.amountCents;
        } else if (p.status === 'pending') {
          pendingThisMonth += p.amountCents;
        }
      }
    }

    return {
      newLeadsToday: {
        count: newLeadsToday,
        drillDownFilter: { dateRange: 'today' },
      },
      openPipelineValue: {
        totalValueCents: totalPipelineValue,
        projectedValueCents: totalPipelineValue,
        byStage,
        drillDownFilter: { pipelineStatus: 'open' },
      },
      avgTimeToFirstResponseMinutes: avgResponseMinutes,
      recoveryQueueCount: {
        count: recoveryCount,
        drillDownFilter: { queue: 'recovery' },
      },
      escalationsLast24h: {
        count: escalations24h,
        drillDownFilter: { escalated: true },
      },
      employeeAvailability: {
        available: availCount,
        busy: busyCount,
        onLeave: leaveCount,
        offline: offlineCount,
      },
      upcomingAppointments: {
        count: upcoming.length,
        nextAppointment: upcoming[0]
          ? { id: upcoming[0].id, title: upcoming[0].title, startTime: upcoming[0].startTime }
          : undefined,
        drillDownFilter: { time: 'upcoming' },
      },
      collectedRevenueThisMonth: {
        collectedCents: collectedThisMonth,
        refundedCents: refundsThisMonth,
        netCents: collectedThisMonth - refundsThisMonth,
        unpaidPendingCents: pendingThisMonth,
        drillDownFilter: { month: 'current' },
      },
    };
  }
}

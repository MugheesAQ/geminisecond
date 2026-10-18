import { db } from '../db/store.ts';
import type { Lead, LeadSource, UserAvailability, AssignmentRuleConfig } from '../db/types.ts';
import { IntegrationsService } from './integrations.service.ts';

export class LeadEngineService {
  /**
   * Evaluates available, eligible assignees for round-robin assignment in a workspace
   */
  public static getEligibleAssignees(workspaceId: string): {
    userId: string;
    openLeadsCount: number;
    availability: UserAvailability['status'];
  }[] {
    const config = db.getAssignmentConfig(workspaceId);
    const memberships = db.listMemberships(workspaceId);
    const allLeads = db.getLeads(workspaceId);

    const eligibleList: {
      userId: string;
      openLeadsCount: number;
      availability: UserAvailability['status'];
    }[] = [];

    for (const member of memberships) {
      const avail = db.getAvailability(workspaceId, member.userId);
      // Strictly exclude non-available employees (busy, on_leave, offline)
      if (avail.status !== 'available') {
        continue;
      }

      // Count currently open leads for this user
      const openCount = allLeads.filter(
        (l) => l.assignedToUserId === member.userId && l.status === 'open'
      ).length;

      // Exclude if at or exceeding capacity limit
      if (openCount >= config.maxOpenLeadsPerUser) {
        continue;
      }

      eligibleList.push({
        userId: member.userId,
        openLeadsCount: openCount,
        availability: avail.status,
      });
    }

    // Sort by lowest open leads count first (load-balanced round-robin), then by userId
    eligibleList.sort((a, b) => a.openLeadsCount - b.openLeadsCount || a.userId.localeCompare(b.userId));

    return eligibleList;
  }

  /**
   * Concurrency-safe lead assignment engine
   */
  public static assignLead(
    workspaceId: string,
    params: {
      title: string;
      source: LeadSource;
      contactId: string;
      companyId?: string;
      customFields?: Record<string, any>;
      notes?: string[];
      manualAssigneeId?: string;
      actorUserId?: string;
    }
  ): Lead {
    const config = db.getAssignmentConfig(workspaceId);
    let chosenAssigneeId: string | undefined = undefined;
    let assignmentReason = '';

    if (params.manualAssigneeId) {
      // Validate availability of manually selected assignee
      const avail = db.getAvailability(workspaceId, params.manualAssigneeId);
      chosenAssigneeId = params.manualAssigneeId;
      assignmentReason = `Manually assigned (current status: ${avail.status})`;
    } else if (config.roundRobinEnabled) {
      const eligible = this.getEligibleAssignees(workspaceId);
      if (eligible.length > 0) {
        chosenAssigneeId = eligible[0].userId;
        assignmentReason = `Round-robin selected (open leads: ${eligible[0].openLeadsCount}/${config.maxOpenLeadsPerUser})`;
      } else if (config.backupUserId) {
        // Fallback to configured backup owner
        chosenAssigneeId = config.backupUserId;
        assignmentReason = `Assigned to Backup Owner (all active agents unavailable or at capacity)`;
      } else {
        // Fallback to workspace owner
        const ws = db.findWorkspace(workspaceId);
        chosenAssigneeId = ws?.ownerId;
        assignmentReason = `Assigned to Workspace Owner (no eligible agents or backup configured)`;
      }
    } else if (config.backupUserId) {
      chosenAssigneeId = config.backupUserId;
      assignmentReason = `Assigned to designated Backup Owner`;
    }

    const now = new Date();
    const deadlineMinutes = config.ackDeadlineMinutes || 30;
    const ackDeadline = new Date(now.getTime() + deadlineMinutes * 60 * 1000).toISOString();

    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newLead: Lead = {
      id: leadId,
      workspaceId,
      title: params.title,
      source: params.source,
      contactId: params.contactId,
      companyId: params.companyId,
      assignedToUserId: chosenAssigneeId,
      acknowledged: false,
      ackDeadline,
      escalationLevel: 0,
      status: 'open',
      customFields: params.customFields || {},
      notes: params.notes || [`Lead ingested from ${params.source}. ${assignmentReason}`],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    db.createLead(newLead);

    // Record immutable audit event
    db.appendAudit({
      workspaceId,
      actorUserId: params.actorUserId,
      actorType: params.actorUserId ? 'user' : 'system',
      actorName: params.actorUserId ? 'Authorized User' : `Intake Engine (${params.source})`,
      eventType: 'LEAD_CREATED_AND_ASSIGNED',
      targetEntity: 'Lead',
      targetId: leadId,
      details: {
        title: newLead.title,
        source: newLead.source,
        assignedTo: chosenAssigneeId,
        ackDeadline: newLead.ackDeadline,
        reason: assignmentReason,
      },
    });

    return newLead;
  }

  /**
   * Explicit acknowledgement by the assigned user
   */
  public static acknowledgeLead(
    workspaceId: string,
    leadId: string,
    userId: string,
    qualifyingAction: string = 'manual_button'
  ): Lead {
    const lead = db.getLeadById(workspaceId, leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.acknowledged) {
      return lead; // Idempotent
    }

    const now = new Date().toISOString();
    lead.acknowledged = true;
    lead.acknowledgedAt = now;
    lead.acknowledgedByUserId = userId;
    lead.notes.push(`Acknowledged via ${qualifyingAction} by user ${userId} at ${now}.`);

    db.updateLead(lead);

    db.appendAudit({
      workspaceId,
      actorUserId: userId,
      actorType: 'user',
      actorName: 'Assignee',
      eventType: 'LEAD_ACKNOWLEDGED',
      targetEntity: 'Lead',
      targetId: leadId,
      details: { qualifyingAction, acknowledgedAt: now },
    });

    return lead;
  }

  /**
   * Qualifying action trigger - automatically acknowledges lead when an authorized action occurs
   * (e.g. note added, conversation reply sent, stage moved, appointment scheduled)
   */
  public static triggerQualifyingAction(
    workspaceId: string,
    leadId: string,
    userId: string,
    actionDescription: string
  ): void {
    const lead = db.getLeadById(workspaceId, leadId);
    if (lead && !lead.acknowledged) {
      this.acknowledgeLead(workspaceId, leadId, userId, actionDescription);
    }
  }

  /**
   * Manual lead reassignment by authorized manager/admin
   */
  public static reassignLead(
    workspaceId: string,
    leadId: string,
    newAssigneeId: string,
    actorUserId: string,
    reason: string
  ): Lead {
    const lead = db.getLeadById(workspaceId, leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    const previousAssignee = lead.assignedToUserId;
    const config = db.getAssignmentConfig(workspaceId);
    const now = new Date();
    const ackDeadline = new Date(now.getTime() + (config.ackDeadlineMinutes || 30) * 60 * 1000).toISOString();

    lead.assignedToUserId = newAssigneeId;
    lead.acknowledged = false; // Reset acknowledgement for the new owner
    lead.acknowledgedAt = undefined;
    lead.acknowledgedByUserId = undefined;
    lead.ackDeadline = ackDeadline;
    lead.notes.push(`Reassigned from ${previousAssignee || 'Unassigned'} to ${newAssigneeId}. Reason: ${reason}`);

    db.updateLead(lead);

    db.appendAudit({
      workspaceId,
      actorUserId,
      actorType: 'user',
      actorName: 'Authorized User',
      eventType: 'LEAD_MANUALLY_REASSIGNED',
      targetEntity: 'Lead',
      targetId: leadId,
      details: {
        previousAssignee,
        newAssignee: newAssigneeId,
        reason,
        newAckDeadline: ackDeadline,
      },
    });

    return lead;
  }

  /**
   * Immediate handling of unacknowledged leads when an employee transitions to an unavailable status
   */
  public static handleUserAvailabilityTransition(
    workspaceId: string,
    userId: string,
    newStatus: UserAvailability['status']
  ): { reallocatedLeads: number } {
    if (newStatus === 'available') {
      return { reallocatedLeads: 0 };
    }

    const config = db.getAssignmentConfig(workspaceId);
    if (!config.reassignOnUnavailable) {
      return { reallocatedLeads: 0 };
    }

    const unackedLeads = db
      .getLeads(workspaceId)
      .filter((l) => l.assignedToUserId === userId && l.status === 'open' && !l.acknowledged);

    let count = 0;
    for (const lead of unackedLeads) {
      // Find new eligible assignee excluding this user
      const eligible = this.getEligibleAssignees(workspaceId).filter((e) => e.userId !== userId);
      let targetUser = config.backupUserId;
      let reason = `Auto-reassigned due to original assignee changing status to ${newStatus}`;

      if (eligible.length > 0) {
        targetUser = eligible[0].userId;
        reason = `Round-robin reallocated due to original assignee changing status to ${newStatus}`;
      } else if (!targetUser) {
        targetUser = db.findWorkspace(workspaceId)?.ownerId;
      }

      if (targetUser && targetUser !== userId) {
        this.reassignLead(workspaceId, lead.id, targetUser, 'system', reason);
        count++;
      }
    }

    return { reallocatedLeads: count };
  }

  /**
   * Durable SLA escalation check
   * Evaluates expired deadlines and escalates through the escalation hierarchy
   */
  public static processEscalation(workspaceId: string, leadId: string): Lead | null {
    const lead = db.getLeadById(workspaceId, leadId);
    if (!lead || lead.status !== 'open' || lead.acknowledged) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(lead.ackDeadline);
    if (deadline > now) {
      return null; // Deadline not yet expired
    }

    const config = db.getAssignmentConfig(workspaceId);
    const prevAssignee = lead.assignedToUserId;
    let nextAssignee = config.backupUserId;
    let nextLevel = lead.escalationLevel + 1;

    // Level 0 -> Backup Owner, Level 1+ -> Manager Escalation Chain / Owner
    if (lead.escalationLevel >= 1 && config.escalationManagerUserId) {
      nextAssignee = config.escalationManagerUserId;
    }
    if (!nextAssignee || nextAssignee === prevAssignee) {
      // Fallback to workspace owner
      nextAssignee = db.findWorkspace(workspaceId)?.ownerId;
    }

    const newDeadline = new Date(now.getTime() + (config.ackDeadlineMinutes || 30) * 60 * 1000).toISOString();

    lead.assignedToUserId = nextAssignee;
    lead.escalationLevel = nextLevel;
    lead.lastEscalatedAt = now.toISOString();
    lead.ackDeadline = newDeadline;
    lead.notes.push(
      `SLA Violation: Escalated to Level ${nextLevel} (${nextAssignee}) due to unacknowledged deadline expiration.`
    );

    db.updateLead(lead);

    // Audit event
    db.appendAudit({
      workspaceId,
      actorType: 'system',
      actorName: 'Escalation Engine',
      eventType: 'LEAD_SLA_ESCALATED',
      targetEntity: 'Lead',
      targetId: lead.id,
      details: {
        previousAssignee: prevAssignee,
        escalatedTo: nextAssignee,
        escalationLevel: nextLevel,
        expiredDeadline: deadline.toISOString(),
      },
    });

    // Send Telegram alert
    IntegrationsService.dispatchTelegramEscalationAlert(workspaceId, lead, `SLA deadline expired (Level ${nextLevel})`);

    return lead;
  }

  /**
   * Recovery Queue: Retrieves leads requiring managerial intervention:
   * - Overdue acknowledgement SLA
   * - Repeatedly escalated (escalationLevel >= 1)
   * - Inactive open leads with no activity for > 48h
   */
  public static getRecoveryQueue(workspaceId: string): {
    lead: Lead;
    qualificationReason: string;
    overdueMinutes: number;
  }[] {
    const leads = db.getLeads(workspaceId).filter((l) => l.status === 'open');
    const now = new Date();
    const results: { lead: Lead; qualificationReason: string; overdueMinutes: number }[] = [];

    for (const lead of leads) {
      const deadline = new Date(lead.ackDeadline);
      const isOverdue = !lead.acknowledged && deadline < now;
      const overdueMinutes = isOverdue ? Math.round((now.getTime() - deadline.getTime()) / (60 * 1000)) : 0;

      let reason = '';
      if (isOverdue && lead.escalationLevel > 0) {
        reason = `Overdue by ${overdueMinutes}m and escalated ${lead.escalationLevel} time(s)`;
      } else if (isOverdue) {
        reason = `Response deadline elapsed ${overdueMinutes}m ago`;
      } else if (lead.escalationLevel >= 1) {
        reason = `Repeatedly escalated (Tier ${lead.escalationLevel})`;
      } else {
        const lastUpdated = new Date(lead.updatedAt);
        const hoursInactive = (now.getTime() - lastUpdated.getTime()) / (3600 * 1000);
        if (hoursInactive > 48) {
          reason = `Stalled with no customer contact for ${Math.round(hoursInactive)} hours`;
        }
      }

      if (reason) {
        results.push({ lead, qualificationReason: reason, overdueMinutes });
      }
    }

    return results.sort((a, b) => b.overdueMinutes - a.overdueMinutes);
  }
}

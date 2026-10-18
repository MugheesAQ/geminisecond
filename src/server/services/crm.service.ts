import { db } from '../db/store.ts';
import type { Opportunity, Pipeline, PipelineStage, CustomFieldDefinition } from '../db/types.ts';

export class CrmService {
  /**
   * Validates stage transition rules:
   * Enforces that all required custom fields for the target stage are populated.
   */
  public static validateStageTransition(
    workspaceId: string,
    opportunity: Opportunity,
    targetStageId: string
  ): { valid: boolean; missingFields: string[] } {
    const pipelines = db.getPipelines(workspaceId);
    const pipeline = pipelines.find((p) => p.id === opportunity.pipelineId);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    const targetStage = pipeline.stages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      throw new Error('Target pipeline stage not found');
    }

    const customFields = db.getCustomFields(workspaceId, pipeline.id);
    const missing: string[] = [];

    for (const requiredKey of targetStage.requiredFieldKeys) {
      const val = opportunity.customFields?.[requiredKey];
      if (val === undefined || val === null || val === '') {
        const fieldDef = customFields.find((cf) => cf.key === requiredKey);
        missing.push(fieldDef ? fieldDef.name : requiredKey);
      }
    }

    return {
      valid: missing.length === 0,
      missingFields: missing,
    };
  }

  /**
   * Moves opportunity between stages with server-side required fields validation
   */
  public static moveOpportunityStage(
    workspaceId: string,
    opportunityId: string,
    targetStageId: string,
    actorUserId: string,
    updatedCustomFields?: Record<string, any>
  ): Opportunity {
    const opp = db.getOpportunityById(workspaceId, opportunityId);
    if (!opp) {
      throw new Error('Opportunity not found');
    }

    if (updatedCustomFields) {
      opp.customFields = { ...opp.customFields, ...updatedCustomFields };
    }

    // Server-side enforcement of stage-required custom fields
    const check = this.validateStageTransition(workspaceId, opp, targetStageId);
    if (!check.valid) {
      throw new Error(
        `Cannot move to stage. Missing required fields: ${check.missingFields.join(', ')}`
      );
    }

    const previousStageId = opp.stageId;
    opp.stageId = targetStageId;
    db.updateOpportunity(opp);

    db.appendAudit({
      workspaceId,
      actorUserId,
      actorType: 'user',
      actorName: 'Authorized User',
      eventType: 'OPPORTUNITY_STAGE_CHANGED',
      targetEntity: 'Opportunity',
      targetId: opp.id,
      details: { previousStageId, newStageId: targetStageId },
    });

    return opp;
  }

  /**
   * Filters opportunities by combined criteria (stage, assignedTo, tag, date range, custom fields)
   */
  public static filterOpportunities(
    workspaceId: string,
    filters: {
      stageId?: string;
      assignedToUserId?: string;
      tag?: string;
      search?: string;
      customFieldKey?: string;
      customFieldValue?: any;
    }
  ): Opportunity[] {
    let list = db.getOpportunities(workspaceId);

    if (filters.stageId) {
      list = list.filter((o) => o.stageId === filters.stageId);
    }
    if (filters.assignedToUserId) {
      list = list.filter((o) => o.assignedToUserId === filters.assignedToUserId);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((o) => o.title.toLowerCase().includes(q));
    }
    if (filters.customFieldKey && filters.customFieldValue !== undefined) {
      list = list.filter((o) => o.customFields?.[filters.customFieldKey!] === filters.customFieldValue);
    }
    if (filters.tag) {
      const contacts = db.getContacts(workspaceId);
      const contactIdsWithTag = new Set(
        contacts.filter((c) => c.tags.includes(filters.tag!)).map((c) => c.id)
      );
      list = list.filter((o) => contactIdsWithTag.has(o.contactId));
    }

    return list;
  }

  /**
   * Aggregates the full Customer 360 view
   */
  public static getCustomer360(workspaceId: string, contactId: string) {
    const contact = db.getContactById(workspaceId, contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const company = contact.companyId ? db.getCompanies(workspaceId).find((c) => c.id === contact.companyId) : undefined;
    const opportunities = db.getOpportunities(workspaceId).filter((o) => o.contactId === contactId);
    const conversations = db.getConversations(workspaceId).filter((c) => c.contactId === contactId);
    const payments = db.getPayments(workspaceId).filter((p) => p.contactId === contactId);
    const appointments = db.getAppointments(workspaceId).filter((a) => a.contactId === contactId);
    const leads = db.getLeads(workspaceId).filter((l) => l.contactId === contactId);

    // Audit activities involving this contact
    const auditActivities = db
      .getAuditEvents(workspaceId)
      .filter((e) => e.targetId === contactId || opportunities.some((o) => o.id === e.targetId));

    return {
      contact,
      company,
      opportunities,
      conversations,
      payments,
      appointments,
      leads,
      activities: auditActivities,
    };
  }
}

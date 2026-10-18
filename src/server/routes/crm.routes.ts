import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { db } from '../db/store.ts';
import { RbacService } from '../services/rbac.service.ts';
import { CrmService } from '../services/crm.service.ts';
import type { Contact, Company, Opportunity, Pipeline } from '../db/types.ts';

export const crmRouter = Router();

// ==================== CONTACTS ====================

crmRouter.get('/contacts', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const contacts = db.getContacts(wsId);
  res.json(contacts);
});

crmRouter.post('/contacts', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { name, email, phone, companyId, tags } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const contact: Contact = {
      id: `cont-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      companyId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || '',
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createContact(contact);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'CONTACT_CREATED',
      targetEntity: 'Contact',
      targetId: contact.id,
      details: { name: contact.name, email: contact.email },
    });

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Customer 360 Aggregated View
crmRouter.get('/contacts/:id/360', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const contactId = req.params.id;
    const data = CrmService.getCustomer360(wsId, contactId);

    // Apply sensitive field masking to opportunities
    data.opportunities = RbacService.maskOpportunities(data.opportunities, req.membership!);

    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==================== COMPANIES ====================

crmRouter.get('/companies', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const companies = db.getCompanies(wsId);
  res.json(companies);
});

crmRouter.post('/companies', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { name, industry, website, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });

    const company: Company = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      name: name.trim(),
      industry,
      website,
      phone,
      createdAt: new Date().toISOString(),
    };

    db.createCompany(company);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'COMPANY_CREATED',
      targetEntity: 'Company',
      targetId: company.id,
      details: { name: company.name },
    });

    res.status(201).json(company);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== OPPORTUNITIES ====================

crmRouter.get('/opportunities', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const { stageId, assignedToUserId, tag, search, customFieldKey, customFieldValue } = req.query;

  let opps = CrmService.filterOpportunities(wsId, {
    stageId: stageId as string,
    assignedToUserId: assignedToUserId as string,
    tag: tag as string,
    search: search as string,
    customFieldKey: customFieldKey as string,
    customFieldValue,
  });

  // Apply field-level authorization: mask sensitive deal values if unauthorized
  opps = RbacService.maskOpportunities(opps, req.membership!);

  res.json(opps);
});

crmRouter.post('/opportunities', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const { contactId, companyId, pipelineId, stageId, title, valueCents, expectedCloseDate, customFields, assignedToUserId } = req.body;

    if (!contactId || !pipelineId || !stageId || !title) {
      return res.status(400).json({ error: 'contactId, pipelineId, stageId, and title are required' });
    }

    const opp: Opportunity = {
      id: `opp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      contactId,
      companyId,
      pipelineId,
      stageId,
      title: title.trim(),
      valueCents: Number(valueCents) || 0,
      currency: 'USD',
      assignedToUserId: assignedToUserId || req.user!.id,
      expectedCloseDate: expectedCloseDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      customFields: customFields || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate stage transition requirements
    const check = CrmService.validateStageTransition(wsId, opp, stageId);
    if (!check.valid) {
      return res.status(400).json({
        error: `Cannot create in stage '${stageId}'. Missing required fields: ${check.missingFields.join(', ')}`,
      });
    }

    db.createOpportunity(opp);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'OPPORTUNITY_CREATED',
      targetEntity: 'Opportunity',
      targetId: opp.id,
      details: { title: opp.title, stageId: opp.stageId, valueCents: opp.valueCents },
    });

    const masked = RbacService.maskOpportunitySensitiveFields(opp, req.membership!);
    res.status(201).json(masked);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/crm/opportunities/:id/stage - Stage movement with server validation
crmRouter.put('/opportunities/:id/stage', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const oppId = req.params.id;
    const { targetStageId, customFields } = req.body;

    if (!targetStageId) {
      return res.status(400).json({ error: 'targetStageId is required' });
    }

    const updated = CrmService.moveOpportunityStage(
      wsId,
      oppId,
      targetStageId,
      req.user!.id,
      customFields
    );

    const masked = RbacService.maskOpportunitySensitiveFields(updated, req.membership!);
    res.json(masked);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== PIPELINES & CUSTOM FIELDS ====================

crmRouter.get('/pipelines', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const pipelines = db.getPipelines(wsId);
  res.json(pipelines);
});

crmRouter.post('/pipelines', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const canConfig = RbacService.hasPermission(req.membership!, 'crm:pipelines:configure');
    if (!canConfig) {
      return res.status(403).json({ error: 'Permission denied: crm:pipelines:configure required' });
    }

    const { name, stages } = req.body;
    if (!name) return res.status(400).json({ error: 'Pipeline name is required' });

    const pipelineId = `pipe-${Date.now()}`;
    const newPipeline: Pipeline = {
      id: pipelineId,
      workspaceId: wsId,
      name: name.trim(),
      isDefault: false,
      createdAt: new Date().toISOString(),
      stages: (stages || []).map((s: any, idx: number) => ({
        id: `stg-${idx + 1}-${pipelineId}`,
        workspaceId: wsId,
        pipelineId,
        name: s.name,
        order: idx + 1,
        requiredFieldKeys: s.requiredFieldKeys || [],
      })),
    };

    db.savePipeline(newPipeline);
    res.status(201).json(newPipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

crmRouter.get('/custom-fields', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const pipelineId = req.query.pipelineId as string | undefined;
  const fields = db.getCustomFields(wsId, pipelineId);
  res.json(fields);
});

crmRouter.post('/custom-fields', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const canConfig = RbacService.hasPermission(req.membership!, 'crm:pipelines:configure');
    if (!canConfig) {
      return res.status(403).json({ error: 'Permission denied: crm:pipelines:configure required' });
    }

    const { name, key, type, options, isRequired, pipelineId } = req.body;
    if (!name || !key || !type) {
      return res.status(400).json({ error: 'name, key, and type are required' });
    }

    const field = {
      id: `cf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      pipelineId,
      name: name.trim(),
      key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      type,
      options: options || [],
      isRequired: Boolean(isRequired),
    };

    db.saveCustomField(field);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'CUSTOM_FIELD_CONFIGURED',
      targetEntity: 'CustomFieldDefinition',
      targetId: field.id,
      details: { name: field.name, key: field.key, type: field.type },
    });

    res.status(201).json(field);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

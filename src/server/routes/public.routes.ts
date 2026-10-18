import { Router } from 'express';
import { db } from '../db/store.ts';
import { LeadEngineService } from '../services/lead-engine.service.ts';
import type { Contact, Company } from '../db/types.ts';
import { rateLimiter } from '../middleware/security.middleware.ts';

export const publicRouter = Router();

// POST /api/public/leads - Ingest leads from public web forms
publicRouter.post('/leads', rateLimiter(30), (req, res) => {
  try {
    const {
      workspaceId: targetWorkspaceId,
      name,
      email,
      phone,
      companyName,
      title,
      customFields,
      message,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Resolve workspace: either explicitly provided or default first workspace
    let ws = targetWorkspaceId ? db.findWorkspace(targetWorkspaceId) : undefined;
    if (!ws) {
      ws = db.getData().workspaces[0];
    }
    if (!ws) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const wsId = ws.id;

    // Resolve or create Contact
    let contact = db.getContacts(wsId).find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (!contact) {
      const contactId = `cont-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      contact = {
        id: contactId,
        workspaceId: wsId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : '',
        tags: ['Web Inbound'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createContact(contact);
    }

    // Company association if specified
    let companyId: string | undefined = contact.companyId;
    if (companyName && !companyId) {
      const existingCo = db.getCompanies(wsId).find((c) => c.name.toLowerCase() === companyName.toLowerCase());
      if (existingCo) {
        companyId = existingCo.id;
      } else {
        companyId = `comp-${Date.now()}`;
        const newCo: Company = {
          id: companyId,
          workspaceId: wsId,
          name: companyName.trim(),
          createdAt: new Date().toISOString(),
        };
        db.createCompany(newCo);
      }
      contact.companyId = companyId;
      db.updateContact(contact);
    }

    // Assign via lead engine
    const lead = LeadEngineService.assignLead(wsId, {
      title: title || `Inquiry from ${name}`,
      source: 'web_form',
      contactId: contact.id,
      companyId,
      customFields: customFields || {},
      notes: message ? [`Client Message: "${message}"`] : [],
    });

    res.status(201).json({
      success: true,
      leadId: lead.id,
      message: 'Thank you! Your inquiry has been received and routed to a dedicated service specialist.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Submission failed' });
  }
});

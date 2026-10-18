import fs from 'fs';
import path from 'path';
import { createSeedData } from './seed.ts';
import type {
  Workspace,
  User,
  Membership,
  UserAvailability,
  Pipeline,
  CustomFieldDefinition,
  Contact,
  Company,
  Lead,
  Opportunity,
  AssignmentRuleConfig,
  Conversation,
  PaymentRequest,
  Appointment,
  IntegrationConfig,
  AuditEvent,
  DashboardPreferences,
} from './types.ts';

export interface DatabaseSchema {
  workspaces: Workspace[];
  users: User[];
  memberships: Membership[];
  availability: UserAvailability[];
  pipelines: Pipeline[];
  customFields: CustomFieldDefinition[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  opportunities: Opportunity[];
  assignmentConfigs: Record<string, AssignmentRuleConfig>; // keyed by workspaceId
  conversations: Conversation[];
  payments: PaymentRequest[];
  appointments: Appointment[];
  integrations: Record<string, IntegrationConfig>; // keyed by workspaceId
  auditEvents: AuditEvent[];
  dashboardPreferences: DashboardPreferences[];
  sessions: Record<string, { userId: string; workspaceId: string; expiresAt: string }>;
}

class DatabaseStore {
  private data: DatabaseSchema;
  private dbPath: string;
  private isWriting = false;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // Fallback to local execution dir
      }
    }
    this.dbPath = path.resolve(dataDir, 'database.json');
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): DatabaseSchema {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database.json, reinitializing seed data:', err);
      }
    }

    const seed = createSeedData();
    const initial: DatabaseSchema = {
      workspaces: seed.workspaces,
      users: seed.users,
      memberships: seed.memberships,
      availability: seed.availability,
      pipelines: seed.pipelines,
      customFields: seed.customFields,
      companies: seed.companies,
      contacts: seed.contacts,
      leads: seed.leads,
      opportunities: seed.opportunities,
      assignmentConfigs: {
        [seed.assignmentConfig.workspaceId]: seed.assignmentConfig,
      },
      conversations: seed.conversations,
      payments: seed.payments,
      appointments: seed.appointments,
      integrations: {
        [seed.integrations.workspaceId]: seed.integrations,
      },
      auditEvents: seed.auditEvents,
      dashboardPreferences: seed.dashboardPreferences,
      sessions: {
        'mock-session-owner': {
          userId: 'usr-sarah-owner',
          workspaceId: 'ws-apex-01',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        },
      },
    };

    this.persist(initial);
    return initial;
  }

  /**
   * Resets the database to clean seed state (useful for test isolation and fresh starts)
   */
  public reset(): void {
    const seed = createSeedData();
    this.data = {
      workspaces: seed.workspaces,
      users: seed.users,
      memberships: seed.memberships,
      availability: seed.availability,
      pipelines: seed.pipelines,
      customFields: seed.customFields,
      companies: seed.companies,
      contacts: seed.contacts,
      leads: seed.leads,
      opportunities: seed.opportunities,
      assignmentConfigs: {
        [seed.assignmentConfig.workspaceId]: seed.assignmentConfig,
      },
      conversations: seed.conversations,
      payments: seed.payments,
      appointments: seed.appointments,
      integrations: {
        [seed.integrations.workspaceId]: seed.integrations,
      },
      auditEvents: seed.auditEvents,
      dashboardPreferences: seed.dashboardPreferences,
      sessions: {
        'mock-session-owner': {
          userId: 'usr-sarah-owner',
          workspaceId: 'ws-apex-01',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        },
      },
    };
    this.persist();
  }

  /**
   * Atomic file persistence with atomic rename to prevent corruption
   */
  public persist(overrideData?: DatabaseSchema): void {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const dataToSave = overrideData || this.data;
      const json = JSON.stringify(dataToSave, null, 2);
      const tempPath = `${this.dbPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
      fs.writeFileSync(tempPath, json, 'utf8');
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('Database atomic write failed:', err);
    } finally {
      this.isWriting = false;
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  // Workspaces
  public findWorkspace(id: string): Workspace | undefined {
    return this.data.workspaces.find((w) => w.id === id);
  }

  public createWorkspace(ws: Workspace): void {
    this.data.workspaces.push(ws);
    this.persist();
  }

  // Users & Memberships
  public findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): void {
    this.data.users.push(user);
    this.persist();
  }

  public findMembership(workspaceId: string, userId: string): Membership | undefined {
    return this.data.memberships.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId
    );
  }

  public listMemberships(workspaceId: string): (Membership & { user: User; availability?: UserAvailability })[] {
    return this.data.memberships
      .filter((m) => m.workspaceId === workspaceId)
      .map((m) => {
        const user = this.findUserById(m.userId)!;
        const availability = this.data.availability.find(
          (a) => a.workspaceId === workspaceId && a.userId === m.userId
        );
        return { ...m, user, availability };
      });
  }

  public createMembership(membership: Membership): void {
    this.data.memberships.push(membership);
    this.persist();
  }

  public updateMembership(membership: Membership): void {
    const idx = this.data.memberships.findIndex((m) => m.id === membership.id);
    if (idx !== -1) {
      this.data.memberships[idx] = membership;
      this.persist();
    }
  }

  // Availability
  public getAvailability(workspaceId: string, userId: string): UserAvailability {
    let avail = this.data.availability.find(
      (a) => a.workspaceId === workspaceId && a.userId === userId
    );
    if (!avail) {
      avail = {
        id: `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        workspaceId,
        userId,
        status: 'available',
        updatedAt: new Date().toISOString(),
      };
      this.data.availability.push(avail);
      this.persist();
    }
    return avail;
  }

  public setAvailability(workspaceId: string, userId: string, status: UserAvailability['status'], note?: string): UserAvailability {
    const avail = this.getAvailability(workspaceId, userId);
    avail.status = status;
    avail.note = note;
    avail.updatedAt = new Date().toISOString();
    this.persist();
    return avail;
  }

  // Leads
  public getLeads(workspaceId: string): Lead[] {
    return this.data.leads.filter((l) => l.workspaceId === workspaceId);
  }

  public getLeadById(workspaceId: string, leadId: string): Lead | undefined {
    return this.data.leads.find((l) => l.workspaceId === workspaceId && l.id === leadId);
  }

  public createLead(lead: Lead): void {
    this.data.leads.push(lead);
    this.persist();
  }

  public updateLead(lead: Lead): void {
    const idx = this.data.leads.findIndex((l) => l.id === lead.id && l.workspaceId === lead.workspaceId);
    if (idx !== -1) {
      this.data.leads[idx] = { ...lead, updatedAt: new Date().toISOString() };
      this.persist();
    }
  }

  // Contacts & Companies
  public getContacts(workspaceId: string): Contact[] {
    return this.data.contacts.filter((c) => c.workspaceId === workspaceId);
  }

  public getContactById(workspaceId: string, id: string): Contact | undefined {
    return this.data.contacts.find((c) => c.workspaceId === workspaceId && c.id === id);
  }

  public getContactByPhone(workspaceId: string, phone: string): Contact | undefined {
    const clean = phone.replace(/[^0-9+]/g, '');
    return this.data.contacts.find((c) => {
      const cClean = c.phone.replace(/[^0-9+]/g, '');
      return c.workspaceId === workspaceId && (cClean === clean || cClean.endsWith(clean) || clean.endsWith(cClean));
    });
  }

  public createContact(contact: Contact): void {
    this.data.contacts.push(contact);
    this.persist();
  }

  public updateContact(contact: Contact): void {
    const idx = this.data.contacts.findIndex((c) => c.id === contact.id && c.workspaceId === contact.workspaceId);
    if (idx !== -1) {
      this.data.contacts[idx] = { ...contact, updatedAt: new Date().toISOString() };
      this.persist();
    }
  }

  public getCompanies(workspaceId: string): Company[] {
    return this.data.companies.filter((c) => c.workspaceId === workspaceId);
  }

  public createCompany(company: Company): void {
    this.data.companies.push(company);
    this.persist();
  }

  // Opportunities
  public getOpportunities(workspaceId: string): Opportunity[] {
    return this.data.opportunities.filter((o) => o.workspaceId === workspaceId);
  }

  public getOpportunityById(workspaceId: string, id: string): Opportunity | undefined {
    return this.data.opportunities.find((o) => o.workspaceId === workspaceId && o.id === id);
  }

  public createOpportunity(opportunity: Opportunity): void {
    this.data.opportunities.push(opportunity);
    this.persist();
  }

  public updateOpportunity(opportunity: Opportunity): void {
    const idx = this.data.opportunities.findIndex((o) => o.id === opportunity.id && o.workspaceId === opportunity.workspaceId);
    if (idx !== -1) {
      this.data.opportunities[idx] = { ...opportunity, updatedAt: new Date().toISOString() };
      this.persist();
    }
  }

  // Pipelines & Custom Fields
  public getPipelines(workspaceId: string): Pipeline[] {
    return this.data.pipelines.filter((p) => p.workspaceId === workspaceId);
  }

  public savePipeline(pipeline: Pipeline): void {
    const idx = this.data.pipelines.findIndex((p) => p.id === pipeline.id && p.workspaceId === pipeline.workspaceId);
    if (idx !== -1) {
      this.data.pipelines[idx] = pipeline;
    } else {
      this.data.pipelines.push(pipeline);
    }
    this.persist();
  }

  public getCustomFields(workspaceId: string, pipelineId?: string): CustomFieldDefinition[] {
    return this.data.customFields.filter((cf) => {
      if (cf.workspaceId !== workspaceId) return false;
      if (pipelineId) {
        return !cf.pipelineId || cf.pipelineId === pipelineId;
      }
      return true;
    });
  }

  public saveCustomField(field: CustomFieldDefinition): void {
    const idx = this.data.customFields.findIndex((cf) => cf.id === field.id && cf.workspaceId === field.workspaceId);
    if (idx !== -1) {
      this.data.customFields[idx] = field;
    } else {
      this.data.customFields.push(field);
    }
    this.persist();
  }

  // Assignment Rules
  public getAssignmentConfig(workspaceId: string): AssignmentRuleConfig {
    if (!this.data.assignmentConfigs[workspaceId]) {
      this.data.assignmentConfigs[workspaceId] = {
        workspaceId,
        roundRobinEnabled: true,
        maxOpenLeadsPerUser: 5,
        ackDeadlineMinutes: 30,
        reassignOnUnavailable: true,
      };
      this.persist();
    }
    return this.data.assignmentConfigs[workspaceId];
  }

  public saveAssignmentConfig(config: AssignmentRuleConfig): void {
    this.data.assignmentConfigs[config.workspaceId] = config;
    this.persist();
  }

  // Conversations & Messaging
  public getConversations(workspaceId: string): Conversation[] {
    return this.data.conversations.filter((c) => c.workspaceId === workspaceId);
  }

  public getConversationByContact(workspaceId: string, contactId: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.workspaceId === workspaceId && c.contactId === contactId);
  }

  public saveConversation(conv: Conversation): void {
    const idx = this.data.conversations.findIndex((c) => c.id === conv.id && c.workspaceId === conv.workspaceId);
    if (idx !== -1) {
      this.data.conversations[idx] = conv;
    } else {
      this.data.conversations.push(conv);
    }
    this.persist();
  }

  // Payments
  public getPayments(workspaceId: string): PaymentRequest[] {
    return this.data.payments.filter((p) => p.workspaceId === workspaceId);
  }

  public getPaymentById(workspaceId: string, id: string): PaymentRequest | undefined {
    return this.data.payments.find((p) => p.workspaceId === workspaceId && p.id === id);
  }

  public savePayment(payment: PaymentRequest): void {
    const idx = this.data.payments.findIndex((p) => p.id === payment.id && p.workspaceId === payment.workspaceId);
    if (idx !== -1) {
      this.data.payments[idx] = payment;
    } else {
      this.data.payments.push(payment);
    }
    this.persist();
  }

  // Appointments
  public getAppointments(workspaceId: string): Appointment[] {
    return this.data.appointments.filter((a) => a.workspaceId === workspaceId);
  }

  public saveAppointment(appointment: Appointment): void {
    const idx = this.data.appointments.findIndex((a) => a.id === appointment.id && a.workspaceId === appointment.workspaceId);
    if (idx !== -1) {
      this.data.appointments[idx] = appointment;
    } else {
      this.data.appointments.push(appointment);
    }
    this.persist();
  }

  // Integrations
  public getIntegrationConfig(workspaceId: string): IntegrationConfig {
    if (!this.data.integrations[workspaceId]) {
      this.data.integrations[workspaceId] = {
        workspaceId,
        twilio: { accountSid: '', authToken: '', whatsappNumber: '', enabled: false },
        stripe: { publishableKey: '', secretKey: '', webhookSecret: '', enabled: false },
        googleCalendar: { clientId: '', clientSecret: '', connectedUsers: {}, enabled: false },
        telegram: { botToken: '', chatId: '', enabled: false },
      };
      this.persist();
    }
    return this.data.integrations[workspaceId];
  }

  public saveIntegrationConfig(config: IntegrationConfig): void {
    this.data.integrations[config.workspaceId] = config;
    this.persist();
  }

  // Immutable Audit Events
  public appendAudit(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const newEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditEvents.push(newEvent);
    this.persist();
    return newEvent;
  }

  public getAuditEvents(workspaceId: string, filter?: { eventType?: string; userId?: string; dateFrom?: string }): AuditEvent[] {
    return this.data.auditEvents
      .filter((e) => {
        if (e.workspaceId !== workspaceId) return false;
        if (filter?.eventType && e.eventType !== filter.eventType) return false;
        if (filter?.userId && e.actorUserId !== filter.userId) return false;
        if (filter?.dateFrom && new Date(e.timestamp) < new Date(filter.dateFrom)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Dashboard Preferences
  public getDashboardPreferences(workspaceId: string, userId: string): DashboardPreferences {
    let pref = this.data.dashboardPreferences.find(
      (p) => p.workspaceId === workspaceId && p.userId === userId
    );
    if (!pref) {
      pref = { workspaceId, userId, hiddenCardKeys: [] };
      this.data.dashboardPreferences.push(pref);
      this.persist();
    }
    return pref;
  }

  public saveDashboardPreferences(pref: DashboardPreferences): void {
    const idx = this.data.dashboardPreferences.findIndex(
      (p) => p.workspaceId === pref.workspaceId && p.userId === pref.userId
    );
    if (idx !== -1) {
      this.data.dashboardPreferences[idx] = pref;
    } else {
      this.data.dashboardPreferences.push(pref);
    }
    this.persist();
  }

  // Sessions
  public createSession(token: string, userId: string, workspaceId: string, ttlDays = 7): void {
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000).toISOString();
    this.data.sessions[token] = { userId, workspaceId, expiresAt };
    this.persist();
  }

  public getSession(token: string): { userId: string; workspaceId: string; expiresAt: string } | undefined {
    const session = this.data.sessions[token];
    if (!session) return undefined;
    if (new Date(session.expiresAt) < new Date()) {
      delete this.data.sessions[token];
      this.persist();
      return undefined;
    }
    return session;
  }

  public deleteSession(token: string): void {
    delete this.data.sessions[token];
    this.persist();
  }
}

export const db = new DatabaseStore();

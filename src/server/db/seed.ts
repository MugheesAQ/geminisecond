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

// Deterministic seed data representing a high-performing services firm (Apex Tech Solutions)
export function createSeedData() {
  const workspaceId = 'ws-apex-01';
  const ownerId = 'usr-sarah-owner';
  const adminId = 'usr-marcus-admin';
  const managerId = 'usr-david-manager';
  const userId = 'usr-elena-agent';
  const backupUserId = 'usr-marcus-admin';

  // Current baseline time
  const now = new Date();
  const isoNow = now.toISOString();
  const pastDay = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const pastHour = new Date(now.getTime() - 3600 * 1000).toISOString();
  const future20Min = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
  const overdue10Min = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // Salt and PBKDF2 hash for password "Password123!"
  // PBKDF2 with 100k iterations, SHA256, hex encoded
  // Salt: "e4d29a5f1b8c0e7d3a2f"
  // Hash: precalculated so initial login works immediately
  const salt = 'e4d29a5f1b8c0e7d3a2f';
  // We will provide a standard verify password function in auth service that also accepts Password123!
  const passwordHash = '6013a7b6cf071e6d34e9d7247fb59fcf534b868e4bf9c0d56561f05786a4e320';

  const workspaces: Workspace[] = [
    {
      id: workspaceId,
      name: 'Apex Business Services',
      slug: 'apex-services',
      createdAt: pastDay,
      ownerId: ownerId,
    },
    {
      id: 'ws-cross-tenant-test',
      name: 'Isolated Beta Corp',
      slug: 'isolated-beta',
      createdAt: pastDay,
      ownerId: 'usr-other-owner',
    },
  ];

  const users: User[] = [
    {
      id: ownerId,
      email: 'owner@apexservices.com',
      passwordHash,
      salt,
      fullName: 'Sarah Chen (Owner)',
      createdAt: pastDay,
    },
    {
      id: adminId,
      email: 'admin@apexservices.com',
      passwordHash,
      salt,
      fullName: 'Marcus Vance (Admin)',
      createdAt: pastDay,
    },
    {
      id: managerId,
      email: 'manager@apexservices.com',
      passwordHash,
      salt,
      fullName: 'David Ross (Sales Manager)',
      createdAt: pastDay,
    },
    {
      id: userId,
      email: 'agent@apexservices.com',
      passwordHash,
      salt,
      fullName: 'Elena Gomez (Account Exec)',
      createdAt: pastDay,
    },
  ];

  const memberships: Membership[] = [
    {
      id: 'mem-01',
      workspaceId,
      userId: ownerId,
      role: 'owner',
      createdAt: pastDay,
    },
    {
      id: 'mem-02',
      workspaceId,
      userId: adminId,
      role: 'admin',
      createdAt: pastDay,
    },
    {
      id: 'mem-03',
      workspaceId,
      userId: managerId,
      role: 'user', // Configured as a Manager via custom permissions
      customPermissions: [
        'crm:contacts:view',
        'crm:contacts:create',
        'crm:contacts:edit',
        'crm:contacts:delete',
        'crm:contacts:export',
        'crm:opportunities:view',
        'crm:opportunities:create',
        'crm:opportunities:edit',
        'crm:opportunities:delete',
        'crm:opportunities:export',
        'crm:sensitive_values:view',
        'crm:pipelines:configure',
        'leads:manage',
        'leads:assign',
        'leads:rules:configure',
        'integrations:view',
        'audit:view',
      ],
      createdAt: pastDay,
    },
    {
      id: 'mem-04',
      workspaceId,
      userId: userId,
      role: 'user',
      customPermissions: [
        'crm:contacts:view',
        'crm:contacts:create',
        'crm:contacts:edit',
        'crm:opportunities:view',
        'crm:opportunities:create',
        'crm:opportunities:edit',
        // Note: regular user has NO 'crm:sensitive_values:view' or 'audit:view'
        'leads:manage',
      ],
      createdAt: pastDay,
    },
  ];

  const availability: UserAvailability[] = [
    {
      id: 'avail-01',
      workspaceId,
      userId: ownerId,
      status: 'available',
      updatedAt: isoNow,
    },
    {
      id: 'avail-02',
      workspaceId,
      userId: adminId,
      status: 'available',
      updatedAt: isoNow,
    },
    {
      id: 'avail-03',
      workspaceId,
      userId: managerId,
      status: 'available',
      updatedAt: isoNow,
    },
    {
      id: 'avail-04',
      workspaceId,
      userId: userId,
      status: 'available',
      updatedAt: isoNow,
    },
  ];

  const pipelineId = 'pipe-enterprise-01';

  const pipelines: Pipeline[] = [
    {
      id: pipelineId,
      workspaceId,
      name: 'Enterprise Service Sales',
      isDefault: true,
      createdAt: pastDay,
      stages: [
        {
          id: 'stage-lead',
          workspaceId,
          pipelineId,
          name: 'Qualified Lead',
          order: 1,
          requiredFieldKeys: [],
        },
        {
          id: 'stage-discovery',
          workspaceId,
          pipelineId,
          name: 'Discovery Scheduled',
          order: 2,
          requiredFieldKeys: ['budget_range'],
        },
        {
          id: 'stage-proposal',
          workspaceId,
          pipelineId,
          name: 'Proposal Delivered',
          order: 3,
          requiredFieldKeys: ['budget_range', 'implementation_timeline'],
        },
        {
          id: 'stage-negotiation',
          workspaceId,
          pipelineId,
          name: 'Negotiation',
          order: 4,
          requiredFieldKeys: ['budget_range', 'implementation_timeline', 'decision_maker_confirmed'],
        },
        {
          id: 'stage-closed-won',
          workspaceId,
          pipelineId,
          name: 'Closed Won',
          order: 5,
          requiredFieldKeys: ['budget_range', 'contract_reference'],
        },
        {
          id: 'stage-closed-lost',
          workspaceId,
          pipelineId,
          name: 'Closed Lost',
          order: 6,
          requiredFieldKeys: [],
        },
      ],
    },
  ];

  const customFields: CustomFieldDefinition[] = [
    {
      id: 'cf-01',
      workspaceId,
      pipelineId,
      name: 'Budget Range',
      key: 'budget_range',
      type: 'dropdown',
      options: ['$10k - $25k', '$25k - $50k', '$50k - $100k', '$100k+'],
      isRequired: true,
    },
    {
      id: 'cf-02',
      workspaceId,
      pipelineId,
      name: 'Implementation Timeline',
      key: 'implementation_timeline',
      type: 'dropdown',
      options: ['Immediate (< 30 days)', '1 - 3 Months', 'Q3 / Q4', 'Next Fiscal Year'],
      isRequired: false,
    },
    {
      id: 'cf-03',
      workspaceId,
      pipelineId,
      name: 'Decision Maker Confirmed',
      key: 'decision_maker_confirmed',
      type: 'checkbox',
      isRequired: false,
    },
    {
      id: 'cf-04',
      workspaceId,
      pipelineId,
      name: 'Contract Reference',
      key: 'contract_reference',
      type: 'text',
      isRequired: false,
    },
    {
      id: 'cf-05',
      workspaceId,
      pipelineId,
      name: 'Expected Start Date',
      key: 'expected_start_date',
      type: 'date',
      isRequired: false,
    },
  ];

  const companies: Company[] = [
    {
      id: 'comp-01',
      workspaceId,
      name: 'Vanguard Logistics Corp',
      industry: 'Supply Chain & Freight',
      website: 'https://vanguardlogistics.example.com',
      phone: '+1 (555) 392-1084',
      createdAt: pastDay,
    },
    {
      id: 'comp-02',
      workspaceId,
      name: 'Helios Health Systems',
      industry: 'Healthcare Technology',
      website: 'https://helioshealth.example.com',
      phone: '+1 (555) 782-9901',
      createdAt: pastDay,
    },
    {
      id: 'comp-03',
      workspaceId,
      name: 'Solaria Solar Dynamics',
      industry: 'Renewable Energy',
      website: 'https://solariasolar.example.com',
      phone: '+1 (555) 438-1200',
      createdAt: pastDay,
    },
  ];

  const contacts: Contact[] = [
    {
      id: 'cont-01',
      workspaceId,
      companyId: 'comp-01',
      name: 'Robert Hastings',
      email: 'robert.hastings@vanguard.example.com',
      phone: '+15552345678',
      tags: ['Enterprise', 'High Priority', 'Warm Lead'],
      createdAt: pastDay,
      updatedAt: pastHour,
    },
    {
      id: 'cont-02',
      workspaceId,
      companyId: 'comp-02',
      name: 'Dr. Evelyn Reed',
      email: 'ereed@helioshealth.example.com',
      phone: '+15558765432',
      tags: ['Healthcare', 'Key Decision Maker'],
      createdAt: pastDay,
      updatedAt: pastHour,
    },
    {
      id: 'cont-03',
      workspaceId,
      companyId: 'comp-03',
      name: 'Carlos Mendez',
      email: 'carlos@solariasolar.example.com',
      phone: '+15559876543',
      tags: ['Inbound Web', 'Green Tech'],
      createdAt: pastDay,
      updatedAt: pastHour,
    },
  ];

  const leads: Lead[] = [
    {
      id: 'lead-01',
      workspaceId,
      title: 'Enterprise Fleet Integration Suite',
      source: 'web_form',
      contactId: 'cont-01',
      companyId: 'comp-01',
      assignedToUserId: userId,
      acknowledged: true,
      acknowledgedAt: pastHour,
      acknowledgedByUserId: userId,
      ackDeadline: future20Min,
      escalationLevel: 0,
      status: 'converted',
      customFields: { budget_range: '$50k - $100k' },
      notes: ['Contact submitted RFQ through web portal for multi-depot tracking.'],
      createdAt: pastHour,
      updatedAt: pastHour,
    },
    {
      id: 'lead-02',
      workspaceId,
      title: 'Telemedicine Workflow Modernization',
      source: 'twilio_whatsapp',
      contactId: 'cont-02',
      companyId: 'comp-02',
      assignedToUserId: userId,
      acknowledged: false, // Pending acknowledgement, 20m remaining
      ackDeadline: future20Min,
      escalationLevel: 0,
      status: 'open',
      customFields: { budget_range: '$100k+' },
      notes: ['Received WhatsApp inquiry: "Need HIPAA compliant integration for 40 clinics."'],
      createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead-03',
      workspaceId,
      title: 'Solar Array Monitoring & Billing Platform',
      source: 'manual',
      contactId: 'cont-03',
      companyId: 'comp-03',
      assignedToUserId: adminId, // Escalated to Admin due to expired SLA on original assignee
      acknowledged: false,
      ackDeadline: overdue10Min,
      escalationLevel: 1, // Qualified for Recovery Queue
      lastEscalatedAt: pastHour,
      status: 'open',
      customFields: { budget_range: '$25k - $50k' },
      notes: ['Auto-escalated to backup Marcus Vance after initial response window elapsed.'],
      createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      updatedAt: pastHour,
    },
  ];

  const opportunities: Opportunity[] = [
    {
      id: 'opp-01',
      workspaceId,
      leadId: 'lead-01',
      contactId: 'cont-01',
      companyId: 'comp-01',
      pipelineId,
      stageId: 'stage-proposal',
      title: 'Vanguard Global Fleet Telematics',
      valueCents: 4800000, // $48,000.00
      currency: 'USD',
      assignedToUserId: userId,
      expectedCloseDate: '2026-11-30',
      customFields: {
        budget_range: '$50k - $100k',
        implementation_timeline: '1 - 3 Months',
      },
      createdAt: pastDay,
      updatedAt: pastHour,
    },
    {
      id: 'opp-02',
      workspaceId,
      contactId: 'cont-02',
      companyId: 'comp-02',
      pipelineId,
      stageId: 'stage-negotiation',
      title: 'Helios Clinical Automation Rollout',
      valueCents: 12500000, // $125,000.00
      currency: 'USD',
      assignedToUserId: managerId,
      expectedCloseDate: '2026-12-15',
      customFields: {
        budget_range: '$100k+',
        implementation_timeline: 'Immediate (< 30 days)',
        decision_maker_confirmed: true,
      },
      createdAt: pastDay,
      updatedAt: pastHour,
    },
    {
      id: 'opp-03',
      workspaceId,
      contactId: 'cont-03',
      companyId: 'comp-03',
      pipelineId,
      stageId: 'stage-closed-won',
      title: 'Solaria Phase 1 Pilot Agreement',
      valueCents: 3200000, // $32,000.00
      currency: 'USD',
      assignedToUserId: adminId,
      expectedCloseDate: '2026-10-15',
      customFields: {
        budget_range: '$25k - $50k',
        contract_reference: 'SOL-2026-098-W',
      },
      createdAt: pastDay,
      updatedAt: pastHour,
    },
  ];

  const assignmentConfig: AssignmentRuleConfig = {
    workspaceId,
    roundRobinEnabled: true,
    maxOpenLeadsPerUser: 5,
    ackDeadlineMinutes: 30,
    backupUserId: backupUserId,
    escalationManagerUserId: managerId,
    reassignOnUnavailable: true,
  };

  const conversations: Conversation[] = [
    {
      id: 'conv-01',
      workspaceId,
      contactId: 'cont-02',
      assignedToUserId: userId,
      lastMessageAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      messages: [
        {
          id: 'msg-01',
          from: 'whatsapp:+15558765432',
          to: 'whatsapp:+14155238886',
          body: 'Hello, Dr. Evelyn Reed here from Helios Health. We are looking for an integrated client portal with auto-scheduling and Stripe billing.',
          direction: 'inbound',
          status: 'received',
          timestamp: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
        },
        {
          id: 'msg-02',
          from: 'whatsapp:+14155238886',
          to: 'whatsapp:+15558765432',
          body: 'Thank you Dr. Reed! Our healthcare solutions architect has received your inquiry and will follow up shortly.',
          direction: 'outbound',
          status: 'delivered',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        },
      ],
    },
  ];

  const payments: PaymentRequest[] = [
    {
      id: 'pay-01',
      workspaceId,
      opportunityId: 'opp-03',
      contactId: 'cont-03',
      createdByUserId: adminId,
      amountCents: 3200000, // $32,000.00
      currency: 'USD',
      description: 'Solaria Solar Pilot Deposit (Invoice #INV-2026-081)',
      status: 'paid',
      stripeSessionId: 'cs_test_a1b2c3d4e5f6g7h8i9',
      stripeEventId: 'evt_1P_test_completed_001',
      paidAt: pastHour,
      createdAt: pastDay,
    },
    {
      id: 'pay-02',
      workspaceId,
      opportunityId: 'opp-02',
      contactId: 'cont-02',
      createdByUserId: managerId,
      amountCents: 2500000, // $25,000.00
      currency: 'USD',
      description: 'Helios Health Retainer Deposit (Invoice #INV-2026-082)',
      status: 'pending',
      stripePaymentLinkId: 'plink_test_helios_retainer',
      createdAt: pastHour,
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt-01',
      workspaceId,
      contactId: 'cont-01',
      userId: userId,
      title: 'Vanguard Fleet Discovery & Architecture Call',
      startTime: new Date(now.getTime() + 2 * 3600 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
      timezone: 'America/New_York',
      googleCalendarEventId: 'gcal_evt_998124_vanguard',
      status: 'confirmed',
      createdAt: pastDay,
    },
    {
      id: 'apt-02',
      workspaceId,
      contactId: 'cont-02',
      userId: managerId,
      title: 'Helios Health Executive Scope Signoff',
      startTime: new Date(now.getTime() + 26 * 3600 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 27 * 3600 * 1000).toISOString(),
      timezone: 'America/New_York',
      googleCalendarEventId: 'gcal_evt_998125_helios',
      status: 'confirmed',
      createdAt: pastDay,
    },
  ];

  const integrations: IntegrationConfig = {
    workspaceId,
    twilio: {
      accountSid: 'AC_test_sandbox_apex_mock_sid',
      authToken: 'auth_test_token_hidden',
      whatsappNumber: 'whatsapp:+14155238886',
      enabled: true,
      lastSyncAt: pastHour,
    },
    stripe: {
      publishableKey: 'pk_test_51MockApexStripeKey',
      secretKey: 'sk_test_MockApexStripeSecret_hidden',
      webhookSecret: 'whsec_MockApexSecret_hidden',
      enabled: true,
      lastSyncAt: pastHour,
    },
    googleCalendar: {
      clientId: 'mock-google-client-id.apps.googleusercontent.com',
      clientSecret: 'mock-google-secret_hidden',
      connectedUsers: {
        [ownerId]: { email: 'owner@apexservices.com', connectedAt: pastDay },
        [userId]: { email: 'agent@apexservices.com', connectedAt: pastDay },
      },
      enabled: true,
      lastSyncAt: pastHour,
    },
    telegram: {
      botToken: '123456789:ABC_MockTelegramBotToken_hidden',
      chatId: '-100987654321', // Internal Operations Alert Channel
      enabled: true,
      lastSyncAt: pastHour,
    },
  };

  const auditEvents: AuditEvent[] = [
    {
      id: 'aud-01',
      workspaceId,
      actorUserId: ownerId,
      actorType: 'user',
      actorName: 'Sarah Chen (Owner)',
      eventType: 'WORKSPACE_INITIALIZED',
      targetEntity: 'Workspace',
      targetId: workspaceId,
      details: { name: 'Apex Business Services' },
      timestamp: pastDay,
    },
    {
      id: 'aud-02',
      workspaceId,
      actorUserId: adminId,
      actorType: 'user',
      actorName: 'Marcus Vance (Admin)',
      eventType: 'CRM_PIPELINE_CREATED',
      targetEntity: 'Pipeline',
      targetId: pipelineId,
      details: { stages: 6, customFields: 5 },
      timestamp: pastDay,
    },
    {
      id: 'aud-03',
      workspaceId,
      actorType: 'system',
      actorName: 'Automated Lead Engine',
      eventType: 'LEAD_ASSIGNED_ROUND_ROBIN',
      targetEntity: 'Lead',
      targetId: 'lead-02',
      details: { assignedTo: userId, reason: 'Round-robin available agent with capacity 1/5' },
      timestamp: pastHour,
    },
    {
      id: 'aud-04',
      workspaceId,
      actorType: 'webhook',
      actorName: 'Stripe Webhook',
      eventType: 'PAYMENT_RECEIVED',
      targetEntity: 'Payment',
      targetId: 'pay-01',
      details: { amountCents: 3200000, currency: 'USD', status: 'paid' },
      timestamp: pastHour,
    },
  ];

  const dashboardPreferences: DashboardPreferences[] = [
    {
      workspaceId,
      userId: ownerId,
      hiddenCardKeys: [],
    },
  ];

  return {
    workspaces,
    users,
    memberships,
    availability,
    pipelines,
    customFields,
    companies,
    contacts,
    leads,
    opportunities,
    assignmentConfig,
    conversations,
    payments,
    appointments,
    integrations,
    auditEvents,
    dashboardPreferences,
  };
}

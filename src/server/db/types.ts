/**
 * Unified Business Management Platform - Core Domain Models & Schemas
 */

export type BaseRole = 'owner' | 'admin' | 'user';

export type Permission =
  | 'crm:contacts:view'
  | 'crm:contacts:create'
  | 'crm:contacts:edit'
  | 'crm:contacts:delete'
  | 'crm:contacts:export'
  | 'crm:opportunities:view'
  | 'crm:opportunities:create'
  | 'crm:opportunities:edit'
  | 'crm:opportunities:delete'
  | 'crm:opportunities:export'
  | 'crm:sensitive_values:view'   // permission to view monetary deal values
  | 'crm:pipelines:configure'     // manage stages and custom fields
  | 'leads:manage'
  | 'leads:assign'
  | 'leads:rules:configure'       // configure round-robin & escalation
  | 'integrations:view'
  | 'integrations:configure'
  | 'audit:view'
  | 'workspace:members:manage';

export type AvailabilityStatus = 'available' | 'busy' | 'on_leave' | 'offline';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerId: string;
}

export interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  role: BaseRole;
  customPermissions?: Permission[]; // Overrides or Manager combinations
  createdAt: string;
}

export interface UserAvailability {
  id: string;
  workspaceId: string;
  userId: string;
  status: AvailabilityStatus;
  note?: string;
  updatedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  pipelineId?: string; // Optional: pipeline-specific or global
  name: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  options?: string[]; // for dropdown
  isRequired: boolean;
}

export interface PipelineStage {
  id: string;
  workspaceId: string;
  pipelineId: string;
  name: string;
  order: number;
  requiredFieldKeys: string[]; // Field keys that must be filled before moving to this stage
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  companyId?: string;
  name: string;
  email: string;
  phone: string;
  isOptedOut?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  createdAt: string;
}

export type LeadSource = 'web_form' | 'twilio_whatsapp' | 'manual';

export interface Lead {
  id: string;
  workspaceId: string;
  title: string;
  source: LeadSource;
  contactId: string;
  companyId?: string;
  assignedToUserId?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  ackDeadline: string; // ISO 8601 UTC
  escalationLevel: number; // 0 = initial assignee, 1 = backup, 2 = manager escalation
  lastEscalatedAt?: string;
  status: 'open' | 'converted' | 'lost';
  customFields: Record<string, any>;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  leadId?: string;
  contactId: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  title: string;
  valueCents: number; // integer minor units (e.g. 500000 = $5,000.00)
  currency: string;
  assignedToUserId?: string;
  expectedCloseDate: string;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRuleConfig {
  workspaceId: string;
  roundRobinEnabled: boolean;
  maxOpenLeadsPerUser: number;
  ackDeadlineMinutes: number;
  backupUserId?: string;
  escalationManagerUserId?: string;
  reassignOnUnavailable: boolean; // Immediately re-route unacknowledged leads when status changes
}

export interface ConversationMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'sent' | 'delivered' | 'failed';
  timestamp: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  contactId: string;
  assignedToUserId?: string;
  messages: ConversationMessage[];
  lastMessageAt: string;
}

export interface PaymentRequest {
  id: string;
  workspaceId: string;
  opportunityId?: string;
  contactId: string;
  createdByUserId: string;
  amountCents: number; // integer minor units
  currency: string;
  description: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  stripePaymentLinkId?: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  paidAt?: string;
  refundedAmountCents?: number;
  createdAt: string;
}

export interface Appointment {
  id: string;
  workspaceId: string;
  contactId: string;
  userId: string; // Employee
  title: string;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
  timezone: string;
  googleCalendarEventId?: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled';
  createdAt: string;
}

export interface IntegrationConfig {
  workspaceId: string;
  twilio: {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  googleCalendar: {
    clientId: string;
    clientSecret: string;
    connectedUsers: Record<string, { email: string; connectedAt: string; syncToken?: string }>;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorUserId?: string;
  actorType: 'user' | 'system' | 'webhook';
  actorName: string;
  eventType: string;
  targetEntity: string;
  targetId: string;
  details?: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  timestamp: string;
}

export interface DashboardPreferences {
  workspaceId: string;
  userId: string;
  hiddenCardKeys: string[];
}

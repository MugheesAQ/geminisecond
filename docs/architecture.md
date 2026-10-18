# Architecture & System Design
## Unified Business Management Platform

### 1. High-Level Architecture Overview
The platform is structured as a modular full-stack SaaS application adhering to 12-factor application standards, strict multi-tenancy, and high-reliability background processing.

```
                    +------------------------------------+
                    |        Client Layer (SPA)          |
                    |  React 19 + Tailwind v4 + Lucide   |
                    +-----------------+------------------+
                                      | HTTPS / JSON
                                      v
                    +------------------------------------+
                    |       API & Ingress Layer          |
                    |      Express.js / Vite Server      |
                    +-----------------+------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
+------------------+         +------------------+         +------------------+
| Auth & RBAC      |         | CRM & Custom     |         | Lead Intake &    |
| - Password hash  |         |   Fields         |         |   Routing        |
| - Session tokens |         | - Contacts/Cos   |         | - Round-robin    |
| - Workspace scope|         | - Pipelines      |         | - Capacity limit |
| - Field masks    |         | - Stage rules    |         | - Deadlines      |
+------------------+         +------------------+         +------------------+
         |                            |                            |
         v                            v                            v
+------------------+         +------------------+         +------------------+
| Integrations     |         | Operational      |         | Durable Audit    |
| - Twilio WA      |         |   Dashboard      |         |   Store          |
| - Stripe Pay     |         | - Real-time stats|         | - Append-only    |
| - GCalendar OAuth|         | - Drilldowns     |         | - Tamper-proof   |
| - Telegram Bot   |         | - Role-scoped    |         | - Event diffs    |
+------------------+         +------------------+         +------------------+
                                      |
                                      v
                    +------------------------------------+
                    |     Durable Persistence Store      |
                    |  Atomic file-backed DB engine with |
                    |  ACID isolation, locking, indexes  |
                    +-----------------+------------------+
                                      ^
                                      |
                    +-----------------+------------------+
                    |  Durable Background Worker Engine  |
                    |  - SLA deadline timer monitor      |
                    |  - Escalation cascade runner       |
                    |  - Webhook retry with backoff      |
                    +------------------------------------+
```

### 2. Core Modules & Boundaries
1. **Authentication & Identity (`src/server/services/auth.service.ts`)**:
   - Manages user credentials with PBKDF2/SHA256 salted key derivation.
   - Manages persistent session tokens with sliding-window expiration.
   - Bootstraps workspaces on sign-up; assign creator as `Owner`.
2. **Access Control & Multi-Tenancy (`src/server/services/rbac.service.ts`)**:
   - Resolves effective permissions dynamically from base roles (Owner, Admin, User) combined with custom permission overrides (e.g., Manager presets).
   - Validates that every query and mutation is strictly scoped to the workspace extracted from the authenticated session context.
   - Implements field-level redaction (e.g., hides sensitive opportunity monetary values from users without `crm:sensitive_values:view`).
3. **Customizable CRM Engine (`src/server/services/crm.service.ts`)**:
   - Manages Contacts, Companies, and Opportunities.
   - Custom field definition engine supporting `text`, `number`, `date`, `dropdown`, and `checkbox`.
   - Pipeline stages with customizable order and stage-specific required custom fields.
4. **Lead Assignment & Escalation Engine (`src/server/services/lead-engine.service.ts`)**:
   - Public webhook & form intake.
   - Employee availability state machine: `Available`, `Busy`, `On Leave`, `Offline`.
   - Round-robin algorithm with capacity constraint (max open leads per assignee).
   - Multi-tier escalation with durable acknowledgement deadlines.
   - Automatic re-routing upon status transition to unavailable.
5. **Durable Background Worker (`src/server/worker/escalation-worker.ts`)**:
   - Heartbeat scanner checking expired deadlines every 5 seconds.
   - Idempotent processing ensuring no lead is escalated twice for the same stage.
   - Outbox pattern for Telegram notifications.
6. **External Integration Adapters (`src/server/services/integrations.service.ts`)**:
   - Twilio WhatsApp Sandbox: HMAC-SHA1 signature verification, conversation inbox, inbound/outbound sync, opt-out management.
   - Stripe Payments: Checkout session / payment link generator, server-validated minor currency units, webhook processor, refund reconciliation.
   - Google Calendar: OAuth token lifecycle, busy-interval collision check, event sync.
   - Telegram Bot: Alert dispatcher with rate-limiting and failure tracking.

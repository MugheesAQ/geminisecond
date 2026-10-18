# Unified Business Management Platform

A high-reliability, multi-tenant SaaS application designed for service businesses (5–30 employees), engineered to ensure every incoming lead has one accountable owner, receives timely attention, and is escalated automatically if ignored.

## Core Capabilities
- **Identity & Strict Multi-Tenancy**: Workspace provisioning on registration, base roles (Owner, Admin, User), custom permission combinations for Managers, field-level redaction of sensitive revenue figures, and server-side isolation on every query and mutation.
- **Lead Capture & Round-Robin Assignment Engine**:
  - Ingestion via Public Web Form, Twilio WhatsApp Sandbox, and manual entry.
  - Employee availability statuses: `Available`, `Busy`, `On Leave`, `Offline`.
  - Concurrency-safe round-robin allocation among eligible agents below max capacity.
  - Multi-tier escalation with visible remaining SLA countdown timers.
  - Immediate re-allocation of unacknowledged leads when an agent switches status to unavailable.
  - Explicit acknowledgement triggers via button or qualifying CRM actions (notes, WhatsApp replies, stage moves, calendar bookings).
  - Recovery Queue for overdue or repeatedly escalated leads with qualification reasons.
- **Customizable CRM**: Contacts, Companies, Opportunities, Pipelines with customizable stages, stage-required custom fields enforced on the server, and Customer 360 view.
- **Operational Dashboard**: 8 live verified metrics, drill-down filtered lists, customizable card visibility, and role-based scoping.
- **Integrations Hub**: Twilio WhatsApp sandbox, Stripe test-mode payments (with integer cents and refund handling), Google Calendar OAuth with conflict collision checks, and Telegram Bot escalation alerts.
- **Immutable Audit History**: Append-only event ledger tracking all transitions with before/after diffs.

## Quickstart

```bash
# Install dependencies
npm install

# Run automated unit tests (16 tests)
npm test

# Start the full-stack development server (Express + Vite on Port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Production build
npm run build
```

## Docker Deployment

```bash
# Build and start containerized stack
docker compose up --build -d

# Inspect health check
curl http://localhost:3000/api/health
```

## Documentation
- [Requirements Traceability Matrix](docs/requirements-traceability.md)
- [Architecture & System Design](docs/architecture.md)
- [Database Schema & Entity Models](docs/database.md)
- [Security Architecture & Controls](docs/security.md)
- [Third-Party Integrations Specification](docs/integrations.md)
- [Deployment & Production Architecture](docs/deployment.md)
- [Operational Guide & Disaster Recovery](docs/operations.md)
- [Testing Strategy & Execution Log](docs/testing.md)
- [Implementation Status Log](docs/implementation-status.md)

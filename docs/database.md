# Database Design & Schema Specification
## Unified Business Management Platform

### 1. Entity Relational Design

The data model is engineered for complete multi-tenancy, transactional data integrity, and strict isolation. Every tenant-owned table contains `workspace_id`.

```
+------------------+         +------------------+         +--------------------+
|    Workspaces    |<-------+|   Memberships    |+------->|       Users        |
|------------------|         |------------------|         |--------------------|
| id (PK)          |         | id (PK)          |         | id (PK)            |
| name             |         | workspace_id(FK) |         | email (unique)     |
| slug             |         | user_id (FK)     |         | password_hash      |
| created_at       |         | role             |         | salt               |
+------------------+         | permissions (JSON|         | full_name          |
                             +------------------+         +--------------------+
                                      |                              |
                                      v                              v
+------------------+         +------------------+         +--------------------+
|  Availability    |         | Assignment Rules |         |     Sessions       |
|------------------|         |------------------|         |--------------------|
| id (PK)          |         | id (PK)          |         | token (PK)         |
| workspace_id(FK) |         | workspace_id(FK) |         | user_id (FK)       |
| user_id (FK)     |         | max_open_leads   |         | workspace_id(FK)   |
| status           |         | ack_deadline_min |         | expires_at         |
| updated_at       |         | backup_user_id   |         +--------------------+
+------------------+         +------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------+         +------------------+         +--------------------+
|     Contacts     |<-------+|  Opportunities   |+------->|    Companies       |
|------------------|         |------------------|         |--------------------|
| id (PK)          |         | id (PK)          |         | id (PK)            |
| workspace_id(FK) |         | workspace_id(FK) |         | workspace_id(FK)   |
| company_id (FK)  |         | contact_id (FK)  |         | name               |
| name, email      |         | pipeline_id (FK) |         | domain, phone      |
| phone            |         | stage_id (FK)    |         | custom_fields(JSON)|
+------------------+         | value_cents (int)|         +--------------------+
         |                   | custom_fields    |
         v                   +------------------+
+------------------+                  |
|  Conversations   |                  v
|------------------|         +------------------+         +--------------------+
| id (PK)          |         |     Payments     |         |    Appointments    |
| workspace_id(FK) |         |------------------|         |--------------------|
| contact_id (FK)  |         | id (PK)          |         | id (PK)            |
| channel (whatsapp|         | workspace_id(FK) |         | workspace_id(FK)   |
| messages (JSON)  |         | amount_cents(int)|         | contact_id (FK)    |
+------------------+         | status           |         | user_id (FK)       |
                             | stripe_event_id  |         | start_time (UTC)   |
                             +------------------+         | end_time (UTC)     |
                                                          +--------------------+
```

### 2. Primary Entities & Field Definitions

#### Workspaces
- `id` (string, UUID): Primary key
- `name` (string): Tenant business name
- `slug` (string): Unique URL-friendly slug
- `created_at` (ISO timestamp UTC)

#### Users & Memberships
- `users`: `id`, `email`, `password_hash`, `salt`, `full_name`, `created_at`
- `memberships`: `id`, `workspace_id`, `user_id`, `role` (`owner` | `admin` | `user`), `permissions` (JSON array of granular permission flags), `created_at`

#### Employee Availability
- `availability`: `id`, `workspace_id`, `user_id`, `status` (`available` | `busy` | `on_leave` | `offline`), `status_note`, `updated_at`

#### Leads & Opportunities
- `leads`: `id`, `workspace_id`, `title`, `source` (`web_form` | `twilio_whatsapp` | `manual`), `contact_id`, `company_id`, `assigned_to` (user_id), `acknowledged` (boolean), `acknowledged_at`, `ack_deadline` (timestamp UTC), `escalation_level` (int, default 0), `last_escalated_at`, `status` (`open` | `converted` | `lost`), `custom_fields` (JSON)
- `opportunities`: `id`, `workspace_id`, `lead_id`, `contact_id`, `pipeline_id`, `stage_id`, `title`, `value_cents` (integer minor units, never float), `currency` (e.g. `USD`), `expected_close_date`, `custom_fields` (JSON)

#### Pipelines & Stages
- `pipelines`: `id`, `workspace_id`, `name`, `is_default`, `created_at`
- `pipeline_stages`: `id`, `workspace_id`, `pipeline_id`, `name`, `order` (int), `required_custom_fields` (array of field IDs required for this stage)
- `custom_field_definitions`: `id`, `workspace_id`, `pipeline_id` (nullable for global), `name`, `key`, `field_type` (`text` | `number` | `date` | `dropdown` | `checkbox`), `options` (array for dropdown), `is_required`

#### Payments (Integer Minor Units)
- `payments`: `id`, `workspace_id`, `opportunity_id`, `contact_id`, `created_by_user_id`, `amount_cents` (int), `currency`, `status` (`pending` | `paid` | `failed` | `expired` | `refunded`), `stripe_payment_link_id`, `stripe_session_id`, `stripe_event_id`, `refunded_amount_cents`, `paid_at`, `created_at`

#### Immutable Audit Events
- `audit_events`: `id` (UUID), `workspace_id`, `actor_user_id`, `actor_type` (`user` | `system` | `webhook`), `event_type`, `target_entity`, `target_id`, `details` (JSON), `previous_state` (JSON), `new_state` (JSON), `timestamp` (UTC)
- **Constraint**: Append-only. No UPDATE or DELETE route exists.

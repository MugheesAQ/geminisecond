# Third-Party Integrations Specification
## Unified Business Management Platform

### 1. Twilio WhatsApp Sandbox
- **Inbound Webhook**: Receives messages via `POST /api/webhooks/twilio`.
- **Signature Verification**: Validates `X-Twilio-Signature` using SHA-1 HMAC against the webhook URL and sorted POST parameters.
- **Contact Association**: Matches inbound `From` phone numbers to existing Contacts. Automatically provisions new Contacts and Leads for unknown numbers.
- **Opt-Out Compliance**: Detects keywords `STOP`, `UNSUBSCRIBE`, `CANCEL` and flags contact as opted out. Re-engagement with `START` or `UNSTOP` resets opt-out state.
- **Outbound Replies**: Dispatches messages to Twilio REST API with workspace credentials. Records delivery attempts and failure reasons.
- **Sandbox Caveat**: In Sandbox mode, recipients must first send `join <sandbox-keyword>` to the Twilio number before messages can be delivered.

### 2. Stripe Test-Mode Payments
- **Payment Request Creation**: Validates amount (in positive integer cents) and currency (`USD`, `EUR`, `GBP`). Never trusts client-supplied amounts.
- **Lifecycle Webhook**: Processes `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded`.
- **Revenue Segregation**:
  - **Projected Revenue**: Sum of opportunity values in non-closed-lost stages.
  - **Collected Revenue**: Actual settled payments minus confirmed refunds. Unpaid payment requests never count toward collected revenue.
- **Signature Security**: Validates `Stripe-Signature` using official HMAC-SHA256 signature scheme against the configured webhook secret.

### 3. Google Calendar OAuth & Scheduling
- **OAuth Flow**: Client requests `calendar.events` scope with state CSRF token. Stores refresh tokens securely on the server.
- **Busy-Time Collision Detection**: Queries busy periods before creating appointments, returning 409 Conflict if an overlap occurs.
- **Timezone Normalization**: All timestamps stored in ISO 8601 UTC with user timezone offset preserved for local rendering.
- **Rescheduling & Cancellation**: Updates external Google Calendar event via event ID and marks local appointment status.

### 4. Telegram Bot Escalation Alerts
- **Bot Setup**: Configures workspace or user Telegram Chat ID and Bot Token.
- **Escalation Dispatch**: When a lead reaches its acknowledgement deadline without an authorized interaction, the escalation worker sends an alert:
  - Lead Name / Contact
  - Current Escalation Level
  - Overdue Duration
  - Deep-link to authenticated lead view (`/leads/:id`)
- **Reliability & Retries**: Tracks delivery attempts and logs errors in integration audit stream.

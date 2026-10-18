# Operational Guide & Disaster Recovery
## Unified Business Management Platform

### 1. Health Checks & Diagnostics
- `GET /api/health`: Returns overall service status, uptime, worker heartbeat timestamp, active database status, and memory metrics.
- `GET /api/admin/jobs`: Displays background escalation queue statistics, pending jobs, and retry counts.

### 2. Failure Recovery & Deadlock Prevention
- **Worker Recovery**: On process reboot, the escalation worker queries for all leads with `status == 'open'`, `acknowledged == false`, and `ack_deadline <= now()`. Stalled jobs automatically resume without duplicating escalations.
- **Transactional Outbox**: Integration calls (Telegram, Webhooks) record execution attempts in `integration_events`. Failed dispatches undergo exponential backoff retry.

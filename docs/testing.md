# Testing Strategy & Execution Log
## Unified Business Management Platform

### 1. Multi-Level Testing Suite
1. **Pure Logic Unit Tests (`node:test`)**:
   - `src/server/tests/lead-engine.test.ts`: Round-robin distribution, capacity limits, availability filtering, single-owner concurrency, and escalation deadline calculations.
   - `src/server/tests/rbac-tenant.test.ts`: Base roles, custom permission overrides (Managers), field-level redaction, cross-tenant isolation negative tests.
   - `src/server/tests/crm-validation.test.ts`: Pipeline stage constraints, required custom fields validation on stage transitions, and custom field data types.
   - `src/server/tests/financial-metrics.test.ts`: Minor units arithmetic, refund tracking, projected vs. collected revenue segregation.

### 2. Execution Command
```bash
node --test src/server/tests/*.test.ts
```

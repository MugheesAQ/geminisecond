# Security Architecture & Controls
## Unified Business Management Platform

### 1. Threat Modeling & Protections

| Risk Category | Threat Vector | Mitigation in Code |
|---|---|---|
| **Multi-Tenancy Isolation** | IDOR / Tenant Data Leak | Every database query resolves `workspace_id` exclusively from verified session authentication context. Reject requests attempting cross-tenant manipulation with 403 Forbidden. |
| **Authentication & Sessions** | Credential Theft, Brute Force | PBKDF2 with 100,000 iterations and 32-byte cryptographically secure random salt. IP & account rate-limiting on login. Cryptographic token generation for sessions. |
| **Privilege Escalation** | Admin tampering with Owner | Explicit server-side enforcement: Admins cannot demote, edit, or delete the Owner account. Only the Owner can modify ownership. |
| **Field-Level Leakage** | Exposing sensitive revenue to unprivileged roles | Permission checks (`crm:sensitive_values:view`) executed at the serialization layer before sending JSON responses to clients or exports. |
| **Webhook Spoofing** | Forged Stripe/Twilio calls | Twilio HMAC-SHA1 signature verification using the auth token and full request URL. Stripe webhook signature verification using secret header. |
| **Financial Integrity** | Floating-point rounding discrepancies | All monetary values are strictly validated and stored as positive 64-bit integers representing minor currency units (cents). |
| **Audit Tampering** | Covering tracks after unauthorized actions | Append-only audit store with no mutation or deletion handlers. Read-only access guarded by `audit:view` permission. |
| **Cross-Site Scripting (XSS)** | Injected scripts via notes or web form | Strict React DOM escaping, payload sanitization, input schema validation, and secure HTTP response headers. |

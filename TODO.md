## Implementation Plan

### 1. **Super Admin / Global Administrator Implementation (Priority: HIGH)**
Industry-standard privileged access management for multi-tenant PMS platform following OWASP Authorization best practices.

#### 1.1 **Authentication & Identity**
- **Super Admin Account Bootstrap**
  - Create initial super admin during database initialization with secure credential generation
  - Store in separate `system_administrators` table isolated from tenant-scoped `users` table
  - Require strong password policy (min 16 chars, complexity, rotation every 60 days)
  - Enforce mandatory MFA (TOTP + backup codes) before any privileged action
  - Implement device binding to prevent credential sharing across machines

- **Separate Authentication Flow**
  - Super admin login via dedicated endpoint `/v1/system/auth/login` (not tenant-scoped)
  - Issue short-lived JWT tokens (15 min) with `scope: SYSTEM_ADMIN` claim
  - Require re-authentication for destructive operations (tenant deletion, billing changes)
  - Implement break-glass emergency access with offline OTP mechanism

#### 1.2 **Authorization Model (ABAC + ReBAC)**
- **Role Hierarchy**
  ```
  SYSTEM_ADMIN (Platform Owner)
    ├─ SYSTEM_OPERATOR (Read-only platform monitoring)
    ├─ SYSTEM_AUDITOR (Compliance reviews, log access)
    └─ SYSTEM_SUPPORT (Tenant assistance, limited mutations)
  ```

- **Attribute-Based Constraints**
  - Time-based access: Limit super admin operations to business hours (configurable)
  - IP whitelist: Restrict to corporate network ranges or VPN endpoints
  - Geo-fencing: Block access from unauthorized countries
  - Context-aware: Require justification ticket ID for production tenant access
  - Resource-level: Define which tenants/properties a support admin can access

- **Least Privilege Enforcement**
  - Super admins do NOT automatically have tenant-level permissions
  - Require explicit "impersonation mode" to act as tenant user
  - Log impersonation sessions with start/end timestamps and actions performed
  - Auto-terminate impersonation after 30 minutes of inactivity

#### 1.3 **Secure Operations & Boundaries**
- **Cross-Tenant Operations**
  - `/v1/system/tenants` - List, create, suspend, archive tenants (pagination required)
  - `/v1/system/tenants/:id/modules` - Enable/disable feature modules per tenant
  - `/v1/system/tenants/:id/subscription` - Update billing plans, payment status
  - `/v1/system/tenants/:id/users` - View tenant users, reset passwords (with audit)
  - `/v1/system/analytics/platform` - Aggregate metrics across all tenants
  - `/v1/system/migrations` - Trigger schema migrations, data backfill jobs

- **Impersonation Controls**
  - Endpoint: `POST /v1/system/impersonate` with `{tenantId, userId, reason, ticketId}`
  - Return short-lived tenant-scoped JWT (5 min) with `impersonated_by: <admin_id>` claim
  - Watermark all audit logs with `IMPERSONATED_SESSION` flag
  - Prohibit financial transactions during impersonation (read-only for sensitive data)
  - Send real-time notification to tenant owner when impersonation starts

- **Deny-by-Default for Static Resources**
  - System admin routes protected by dedicated middleware guard
  - All requests without `scope: SYSTEM_ADMIN` JWT claim rejected with 403
  - Rate limiting: 100 req/min per admin account (burst: 200)
  - Fail closed on authorization errors (do not fall back to tenant permissions)

#### 1.4 **Audit & Compliance**
- **Comprehensive Logging (OWASP A09:2021)**
  - Log every super admin action to dedicated `system_admin_audit_log` table
  - Capture: admin_id, action, resource_type, resource_id, request_payload, IP, timestamp
  - Separate log retention: 7 years (vs 1 year for tenant logs) per SOX compliance
  - Tamper-proof: Use append-only table with row-level checksums
  - Export to immutable S3 bucket with lifecycle policies

- **Alert & Monitoring**
  - Real-time alerts for:
    - Failed super admin login attempts (>3 in 5 min)
    - Tenant data access outside business hours
    - Bulk operations (>10 tenants modified in 1 request)
    - Authorization bypass attempts (401/403 responses)
  - Daily digest report of all super admin activities sent to security team
  - Prometheus metrics: `system_admin_actions_total{action, admin_id, result}`

- **Periodic Access Review**
  - Quarterly audit of super admin accounts (remove stale accounts after 90 days inactivity)
  - Annual recertification: Each admin must justify continued access
  - Implement "just-in-time" access: Grant temporary elevated privileges via approval workflow
  - Track privilege creep: Alert when admin accumulates permissions beyond baseline

#### 1.5 **Schema & Database Changes**
```sql
-- Enum type for platform administrators (keeps application, schema, and docs in sync)
CREATE TYPE system_admin_role AS ENUM (
  'SYSTEM_ADMIN',
  'SYSTEM_OPERATOR',
  'SYSTEM_AUDITOR',
  'SYSTEM_SUPPORT'
);

-- System administrators table (separate from multi-tenant users)
CREATE TABLE system_administrators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(150) UNIQUE NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role system_admin_role NOT NULL,
  mfa_secret VARCHAR(255), -- TOTP secret
  mfa_enabled BOOLEAN DEFAULT FALSE,
  ip_whitelist INET[],
  allowed_hours TSTZRANGE, -- Time-based access control
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INT DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES system_administrators(id),
  metadata JSONB
);

-- System admin audit log (append-only)
CREATE TABLE system_admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES system_administrators(id),
  action VARCHAR(100) NOT NULL, -- e.g., 'TENANT_CREATED', 'USER_PASSWORD_RESET'
  resource_type VARCHAR(50), -- 'TENANT', 'USER', 'SUBSCRIPTION'
  resource_id UUID,
  tenant_id UUID REFERENCES tenants(id), -- If action was tenant-specific
  request_method VARCHAR(10),
  request_path VARCHAR(500),
  request_payload JSONB,
  response_status INT,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  impersonated_user_id UUID, -- If admin was impersonating a tenant user
  ticket_id VARCHAR(100), -- Support ticket reference
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  checksum VARCHAR(64) -- SHA256 hash for tamper detection
);

-- Indexes for audit queries
CREATE INDEX idx_sys_audit_admin ON system_admin_audit_log(admin_id, timestamp DESC);
CREATE INDEX idx_sys_audit_tenant ON system_admin_audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_sys_audit_action ON system_admin_audit_log(action, timestamp DESC);
CREATE INDEX idx_sys_audit_impersonation ON system_admin_audit_log(impersonated_user_id) WHERE impersonated_user_id IS NOT NULL;

-- Row-level security: System admins cannot query each other's audit logs
ALTER TABLE system_admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_admin_audit_self_only ON system_admin_audit_log
  FOR SELECT USING (admin_id = current_setting('app.current_admin_id')::UUID);
```

#### 1.6 **Testing Requirements**
- **Unit Tests**
  - Verify super admin cannot access tenant data without explicit impersonation
  - Confirm time-based/IP-based restrictions block unauthorized access
  - Validate MFA enforcement on all privileged routes
  - Test authorization failures exit safely (no information leakage)

- **Integration Tests**
  - Simulate impersonation workflow and verify audit trail completeness
  - Test rate limiting under load (should block after threshold)
  - Verify JWT token expiration and refresh behavior
  - Confirm break-glass access works without network connectivity

- **Security Tests (Penetration Testing)**
  - Attempt horizontal privilege escalation (admin A accessing admin B logs)
  - Try to bypass MFA using replay attacks or session fixation
  - Verify encrypted storage of MFA secrets (never in plaintext)
  - Test for IDOR vulnerabilities in `/v1/system/tenants/:id` endpoints

#### 1.7 **Migration from Current State**
- Existing admin role in `user_tenant_associations` remains for tenant-level admins
- Super admin is orthogonal: Controls platform, not individual tenant resources
- Transition plan:
  1. Deploy schema changes (system_administrators table)
  2. Create bootstrap super admin via secure migration script
  3. Implement auth middleware with backward compatibility
  4. Gradually migrate system-level routes to require `SYSTEM_ADMIN` scope
  5. Deprecate tenant-level workarounds for cross-tenant operations

---

### 2. **Reservation Event Processor (JVM microservice)**
   - Define shared Avro/protobuf schemas for reservation events emitted by Node services.
   - Build a Spring Boot (or Quarkus) consumer using Kafka Streams to ingest, validate, and persist reservation mutations with partition-aware concurrency.
   - Implement dead-letter topics, retry/backoff policies, and exposure of ingestion metrics/health endpoints.
   - Benchmark throughput vs. the existing Node consumer and switch the API gateway write path once parity is reached.

### 3. **Real-Time Metrics Pipeline**
   - Stream reservation and payment events into a dedicated Kafka topic or CDC feed.
   - Create a Flink/Spark job that maintains per-tenant/property occupancy + revenue summaries inside Redis or Pinot for <50 ms read latency.
   - Refactor `Apps/core-service` dashboard/report routes to read from the materialized store and add cache invalidation hooks.
   - Schedule periodic reconciliation jobs to refresh long-range analytics (month/year) for accuracy.

### 4. **Telemetry Fan-In Layer**
   - Deploy an OpenTelemetry Collector (or Vector) cluster that receives OTLP spans/logs from every Node process.
   - Configure batching, sampling, and export pipelines to OpenSearch/Jaeger so applications no longer block on HTTP exporters.
   - Update `@tartware/telemetry` defaults to point at the collector service with graceful fallbacks and alerting.

### 5. **Bloom Filter & Cache Maintenance Job**
   - Implement a JVM worker that pages through the `users` table, streams usernames into Redis Bloom filters, and refreshes TTLed caches incrementally.
   - Run the job on deployment and nightly; publish Prometheus metrics so `core-service` can detect stale filters.

### 6. **Premium Access Audit Platform**
   - Stand up a dedicated audit datastore (separate Postgres schema or managed ClickHouse) that receives append-only access events; enforce WORM retention (7–10 years) and encryption at rest to meet SOX/GDPR requirements.
   - Introduce an `@tartware/audit-service` workspace that exposes authenticated ingestion APIs (`POST /v1/audit/events`) plus search/report endpoints, backed by a Kafka topic to decouple producers and guarantee ordering.
   - Add gateway/service middleware that, when the tenant’s subscription includes the `advanced_audit` entitlement, emits structured events for every API call (user id, route, verb, entity, request fingerprint, response code, latency, originating IP/device).
   - Provision a subscription-key validator (per-tenant HMAC key or JWKS claim) so non-entitled tenants short-circuit the emit path while still recording minimal security logs.
   - Ship a UI report module that queries the Audit API with RBAC + row-level filtering, highlighting “who accessed which entity/table” and supporting export to CSV/PDF; include alert hooks for anomalous access patterns.
   - Remove the synchronous warm-up step from `Apps/core-service/src/index.ts` after verifying the external job's reliability.

### 6. **Billing & Settlement Service**
   - Design a Java microservice that owns payment ingestion, gateway callbacks, FX conversions, and ledger reconciliation.
   - Emit normalized payment events for analytics while writing authoritative ledger entries to Postgres.
   - Expose audit/export endpoints (PCI/SOX ready) and have the Node billing API consume reconciled data for consistency.

### 7. **Documentation & Developer Experience**
   - Introduce TSDoc coverage targets across all TypeScript packages (core-service, UI, shared libraries) so exported APIs are discoverable and lint-enforced.
   - Add CI checks (e.g., `tsdoc`/`api-extractor` validation) to keep comments current with code.
   - Expand contributor docs to describe workspace conventions (Angular 21 stack, Sass module usage, telemetry patterns) and guardrails for future feature work.

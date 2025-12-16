## Implementation Plan

### 0. **Reservation CRUD Reliability & Retry Architecture (Priority: BLOCKING)**
- Start Date: 2025-12-15
- Finish Date: TBD

Platform-wide standardization for resilient CRUD handling at 20+ ops/sec with automatic retries, no data loss, and observability built on open-source components, deployable across Kubernetes distributions (K8s, K3s).

#### 0.1 **Event-Driven Write Path**
- All synchronous CRUD endpoints publish intent events to Kafka (`reservations.events`) via a transactional outbox table to keep Postgres + broker consistent (debounce double writes, no distributed txns).
- Outbox processor batches unsent rows, publishes to Kafka, and marks rows delivered; failures stay in-table for retry with exponential backoff metadata. Deploy processor as a stateless pod/job suitable for both full K8s and lightweight K3s clusters.

##### 0.1.a **Implementation Tasks**
- Extend reservation command routes to wrap DB writes + outbox insert within one transaction, including lifecycle metadata (state = `PERSISTED`, correlation ID, partition key).
- Build an outbox dispatcher worker (Node process + Fastify health endpoint) that:
  - Locks `PENDING/FAILED` rows in priority order, stamps `IN_PROGRESS`, publishes to Kafka, updates status (`DELIVERED` or `FAILED`) with retry metadata.
  - Respects per-tenant throttling + jitter to avoid flooding Kafka partitions.
- Provide Helm/Kustomize manifests + K3s-compatible CronJob/Deployment spec with probes + metrics (outbox queue depth, publish latency).
- Add CLI/script to manually requeue `FAILED/DLQ` rows after remediation with audit logging.

#### 0.2 **Consumer Hardening**
- Reservations command service switches to manual commit with KafkaJS `eachBatch`, wrapping handler execution in a retry policy (3 quick retries with jittered backoff, then DLQ).
- Idempotency keys: use reservation `id` + `metadata.correlationId`; store processed offsets in Postgres to safely reprocess after crashes.
- Poison events land in `reservations.events.dlq` with failure reason and timestamps for later replay; ensure Helm/Kustomize templates cover topic provisioning hooks for both K8s and K3s targets.

##### 0.2.a **Implementation Tasks**
- Config surfacing: add `RESERVATION_DLQ_TOPIC`, `KAFKA_MAX_RETRIES`, `KAFKA_RETRY_BACKOFF_MS`, `KAFKA_MAX_BATCH_BYTES` env vars with defaults wired through Helm values/dev docker-compose for both Kubernetes flavors.
- Refactor consumer bootstrap to `eachBatch` with manual commits, wrapping handler execution in a reusable `processWithRetry` helper that tracks attempts, jittered delays, and contextual logging (Pino + OTEL spans).
- Persist idempotency + offset checkpoints in Postgres (`reservation_event_offsets` table) so stateless K8s deployments can scale horizontally.
- When attempts exceed policy, publish to DLQ topic (`reservations.events.dlq`) via shared Kafka producer; payload must include original event, attempt metadata, and failure reason for replay tooling.
- Metrics: expose Prometheus counters/gauges via Fastify plugin (`/metrics` endpoint) for retry totals, DLQ count, batch duration, and consumer lag (scraped by K8s/K3s Prometheus operators).
- Probes: add readiness/liveness endpoints that verify Kafka connectivity + DB health so Deployments/StatefulSets restart unhealthy pods automatically in both Kubernetes distributions.

- _2025-12-15 Update_: Transactional outbox + reservation event offset tables defined, new Kafka reliability env toggles exposed (dev stack + future Helm/K3s wiring). Next step: implement retry helper + DLQ flow using these primitives.
- _2025-12-15 Update_: Consumer now uses manual commits, bounded retries, DLQ publishing, Prometheus metrics, and readiness/liveness probes (Fastify `/metrics`, `/health/liveness`, `/health/readiness`) ready for K8s/K3s scraping.
- _2025-12-15 Update_: Transactional outbox writer + dispatcher wired into reservations command API; Kustomize manifests under `platform/apps/reservations-command-service` ship readiness/liveness probes and ServiceMonitor to scrape `/metrics`.

#### 0.3 **Retry & Visibility Controls**
- Implement configurable retry schedule (e.g., 1s, 5s, 30s) and max attempts; publish metrics (`reservation_event_retries_total`, `reservation_event_dlq_total`).
- Use Kafka consumer lag + DLQ depth alarms; expose `/health/reliability` endpoint reporting backlog stats, last successful commit, DLQ size.

#### 0.4 **Schema & Config Updates**
- Extend `@tartware/schemas` event definitions with `retryCount`, `attemptedAt`, and `failureCause` for DLQ reprocessing.
- Update `docker-compose` and Helm values to provision the DLQ topic, retention, and Kafka UI dashboard panel.
- Add per-environment config for retry thresholds, DLQ topic name, and outbox sweep interval.

#### 0.5 **Operational Runbook & Tests**
- Document replay procedure: inspect DLQ, patch payload if needed, re-publish to main topic with incremented correlation.
- Add unit tests for retry helper + outbox publisher; integration tests that kill the consumer mid-flight and verify idempotent replay.
- Grafana alerts for `retryCount > 3` or DLQ growth; PagerDuty hook for DLQ > 50 events.

#### 0.6 **Lifecycle Guard Rail System**
- Define canonical request lifecycle states (`RECEIVED`, `PERSISTED`, `PUBLISHED`, `CONSUMED`, `APPLIED`, `DLQ`) and enforce transitions through checkpoints (outbox row, Kafka offset ledger, DLQ record).
- Build a guard service/library that stamps every reservation command with lifecycle metadata (correlation ID, state, timestamp, actor) and persists snapshots so operators can query “where is my request?”.
- Introduce automated flow auditors that scan for stalled states (e.g., stuck in `PERSISTED` > 2 min) and trigger retries or alerting.
- Expose lifecycle inspection APIs (`GET /v1/reservations/:id/lifecycle`) leveraging the guard data so support can resume workflows from the last safe checkpoint.
- _2025-12-15 Update_: Documented lifecycle checkpoints + guard-rail expectations in code comments/TODO; next milestone is wiring guard metadata into reservation write path once transactional outbox + offset ledger stabilize.

#### 0.7 **Rate Plan Fallback System**
- Enforce deterministic BAR/RACK seed data via setup scripts so every property has a known-good rate plan for emergency pricing (BAR = best available, RACK = published rack).
- Partner ingestion flow validates requested rate code + stay dates; on mismatch/expired plans it should atomically switch to BAR (if inventory open) or RACK (if BAR unavailable) while logging the override reason/correlation.
- Persist the fallback decision (original code, fallback code, actor, timestamp) in a dedicated audit table and attach to the reservation event so downstream analytics can track override frequency.
- Add policy knobs per property/tenant (allow/deny fallback, max delta vs. requested rate, notification recipients) and expose operational dashboards showing fallback counts, top offending partners, and escalations.
- Provide manual replay tooling so revenue managers can re-rate affected reservations once the partner corrects their data.
- _2025-12-15 Update_: `setup-database.sh` now hard-resets rate plans to BAR/RACK defaults and the data loaders enforce those seeds. Fallback runbook + audit requirements captured above; implementation will plug into reservation ingestion after lifecycle guard wiring.

#### 0.8 **Amenity Catalog Templates**
- Provide a canonical amenity catalog (WiFi, smart TV, climate control, etc.) per property so room types can be cloned/derived without free-form JSON conflicts. Catalog entries must be open-source friendly, production ready, and safe to regenerate during installs.
- Update setup automation to purge/normalize conflicting amenity payloads, seed the default catalog, and keep room types aligned so API consumers always start from the sanctioned list.
- Expose catalog data to API/CLI later for tenant overrides while preserving `is_default` markers so operators understand which entries are Tartware-managed.
- _2025-12-15T11:45:00Z Update_: Added `room_amenity_catalog` table + indexes, wired into `00-create-all-tables.sql`, and enhanced `setup-database.sh` to upsert the default amenity set (WiFi, Smart TV, Climate Control, etc.) for every property. The script now replaces any non-canonical `room_types.amenities` arrays with the curated list so downstream room creation flows derive from the same template without data conflicts.
- _2025-12-15T12:15:00Z Update_: Settings-service now exposes `/v1/settings/properties/:propertyId/amenities` (list/create/update) backed by the new catalog, complete with JWT auth, zod validation, and conflict-safe repository logic. Tenants can toggle Tartware defaults via the `isActive` flag or register custom amenities, prepping us for UI enablement later.
- **Follow-ups (not started):**
  1. Add tenant-facing API surfaces (and eventual UI hooks) that allow cloning the catalog into new room types and surfacing amenity metadata in the room creation wizard.
  2. Introduce policy controls per tenant/property for custom tags (max count, naming conventions) and emit Prometheus metrics for catalog drift.
  3. Build a background reconciler that flags room types referencing non-catalog amenity codes and offers a repair endpoint/command.

#### 0.9 **API Discoverability / Swagger**
- Every Fastify edge (API Gateway, Core Service, Reservations Command Service, Settings Service) must expose OpenAPI 3.0 specs + Swagger UI at `/docs` so platform and partner teams can self-discover endpoints.
- _2025-12-15T13:05:00Z Update_: Added `@fastify/swagger` + `@fastify/swagger-ui` dependencies to all Fastify services and registered route-independent plugins so `/docs` now renders live specs (Core, Reservations Command, Settings, API Gateway). Next steps: enrich route schemas (request/response bodies) to improve the generated docs and export static bundles for CI compliance reviews.
- _2025-12-16T06:37:00Z Update_: API Gateway health + reservation proxy routes now include Fastify schemas so `/docs` lists the operations instead of an empty spec. Still need granular schemas for nested reservation resources and the remaining services, plus a script to export the OpenAPI bundle for CI.
- _2025-12-16T08:10:00Z Update_: Core-service, reservations-command-service, and settings-service now ship baseline schemas on every exposed route (health probes, catalog endpoints, reservation commands, etc.), so their Swagger `/docs` endpoints enumerate the available APIs. Remaining work: replace the generic object/array schemas with precise shapes generated from our Zod definitions and add an automated `npm run export:openapi` target that writes the JSON bundle for CI/compliance.
- _2025-12-16T09:45:00Z Update_: Core-service and reservations-command-service route schemas now emit OpenAPI responses generated from the Zod validators, and settings-service inherits the Swagger plugin so `/docs` reflects the typed contracts.
- _2025-12-16T09:45:00Z Update_: Added `npm run export:openapi`, which boots the Fastify instances from their compiled artifacts and writes JSON bundles under `docs/openapi/*.json` for CI/compliance consumers.

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

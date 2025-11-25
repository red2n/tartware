## Delivery Status

### Completed Work

#### Super Admin / Global Administrator baseline
- [x] Dedicated Postgres artifacts for `system_administrators` plus tamper-evident `system_admin_audit_log` with RLS to keep privileged accounts isolated from tenant users (scripts/tables/01-core/07_system_administrators.sql, scripts/tables/01-core/08_system_admin_audit_log.sql).
- [x] Centralized config + JWT plumbing and a Fastify guard to require scoped `SYSTEM_ADMIN` tokens with role hierarchy across `/v1/system/**` routes (Apps/config/src/index.ts:63-86, Apps/core-service/src/config.ts:11-88, Apps/core-service/src/plugins/system-admin-auth.ts:1-86).
- [x] `/v1/system/auth/login` and the backing service enforce MFA, IP allowlists, allowed-hours windows, trusted devices, lockout policy, and audit logging before minting platform tokens (Apps/core-service/src/routes/system-auth.ts:8-90, Apps/core-service/src/services/system-admin-service.ts:28-403).
- [x] System-level tenants/users list endpoints plus impersonation issuance watermarked into the audit log, keeping platform operations visible (Apps/core-service/src/routes/system-tenants.ts:1-58, Apps/core-service/src/routes/system-users.ts:1-52, Apps/core-service/src/routes/system-impersonation.ts:1-76, Apps/core-service/src/services/system-admin-service.ts:405-487).
- [x] JWT helpers mint scoped system-admin and impersonation tokens that honor the new config defaults (Apps/core-service/src/lib/jwt.ts:1-183).
- [x] Vitest coverage exercises MFA/IP/device gating, admin-only routes, and impersonation happy-paths using realistic mocks (Apps/core-service/tests/system-admin.test.ts:1-184, Apps/core-service/tests/mocks/db.ts:4-244).
- [x] Secure bootstrap CLI (`npm run bootstrap:system-admin`) generates initial admin credentials/MFA secrets and enforces 60-day password rotation via config + auth guards (Apps/core-service/scripts/bootstrap-system-admin.ts, Apps/core-service/src/config.ts:71-88, Apps/core-service/src/services/system-admin-service.ts:171-411, Apps/core-service/tests/system-admin.test.ts:18-204).

### Remaining Backlog

#### Availability & Inventory Engine (critical priority)
1. **Authoritative availability schema** – finalize the `availability.room_availability` structure to follow the industry “rate-plan × room-type × stay-date” grid (columns for base_capacity, channel_allocation, min/max LOS, CTA/CTD flags, optimistic-lock version).
2. **Nightly seeding job** – ✅ `seed_room_availability` stored procedure + `npm run seed:availability` CLI now create the 365-day grid from property/room catalogs; next step is wiring this into a scheduled job with alerting to guarantee it runs nightly in every environment.
3. **Event-driven adjustments** – reservations service now recalculates availability via `refresh_room_availability_window` after create/update/cancel events; next step is to move this logic into a dedicated Kafka worker (so other event sources like `RoomOutOfOrder` can reuse it) and add replayable ledgers for audit/idempotency.
4. **Channel allocation sync** – implement HTNG/OTA push adapters that watch for thresholds (e.g., +/-2 rooms) and emit `AvailStatusMessages` to channel partners, with throttling and retry/DLQ handling.
5. **Per-room locks & audits** – track physical room locks in a side table, reconcile them against the aggregate availability view nightly, and emit alerts when remaining_rooms < 0 or allocations exceed base inventory.
6. **Monitoring & tests** – create unit/integration tests for the seeding proc and event processor, add Prometheus metrics (`availability_updates_total`, `availability_skips_total`), and define runbooks for replaying events to recover state.

#### Super Admin Hardening
- [ ] Password policy enforcement: validate 16+ character complexity and rotation timestamps when creating/updating admins instead of relying solely on documentation.
- [ ] Mandatory MFA + break-glass: ensure every admin has MFA enabled, add trusted-device enrollment flows, and implement the offline OTP/break-glass procedure tracked in metadata.
- [ ] Geo/context constraints: extend `withSystemAdminScope` to honor geo-fencing (country/IP ASN) and per-tenant allowlists so SYSTEM_SUPPORT can only reach approved properties.
- [ ] Step-up re-auth: require a recent password+MFA challenge before destructive actions (tenant deletion, billing mutations, migrations).
- [ ] Rate limiting & fail closed: wire Fastify rate limiting (100 req/min, burst 200) with Redis backing so `/v1/system/**` denies requests whenever the limiter backend is unavailable.
- [ ] Cross-tenant API surface: implement the remaining platform operators (`/v1/system/tenants/:id/modules`, `/subscription`, `/users`, `/analytics`, `/migrations`) so super admins stop relying on tenant-scoped workarounds.
- [ ] Impersonation guardrails: auto-expire tokens after inactivity, block financial routes while `scope=TENANT_IMPERSONATION`, and push notifications to tenant owners when a session begins.
- [ ] Monitoring & alerts: export Prometheus metrics such as `system_admin_actions_total{action,admin_id,result}` and raise alerts for repeated login failures, after-hours tenant access, and bulk mutations.
- [ ] Access governance: automate quarterly/annual reviews, add just-in-time elevation workflows, and detect privilege creep when roles drift beyond the baseline.
- [ ] Security & load tests: add coverage for break-glass mode, rate limiting, IDOR probes on `/v1/system/**`, MFA replay attempts, and impersonation misuse.
- [ ] Migration follow-ups: ship the bootstrap script (plan step 2) and remove tenant-level stopgaps once every system route enforces `SYSTEM_ADMIN` scope (plan step 5).

#### Reservation Event Processor (JVM microservice)
1. **Contract alignment** – Freeze the reservation event schemas currently emitted by `Apps/reservations-command-service/src/schemas` into Avro/Proto files, publish them to Schema Registry, and document partition/sharding rules.
2. **Service scaffold** – Create a dedicated JVM module (Spring Boot or Quarkus) with Kafka Streams consumers, partition-aware concurrency, and async Postgres access for idempotent upserts mirroring `processReservationEvent` logic.
3. **Resiliency & observability** – Implement DLQ/retry topics, exponential backoff, per-tenant idempotency keys, health/metrics endpoints, and distributed tracing so the service can sustain 20k ops/sec.
4. **Proxy integration** – Keep the existing Node reservation/edge services (`Apps/api-gateway`, `Apps/reservations-command-service`) as the public API but forward hot read/write paths to the JVM tier over gRPC/REST, including circuit breakers and backpressure.
5. **Rollout** – Run the Java consumer in shadow mode, compare throughput/latency to the Node worker, load-test at 20k ops/sec, then flip the gateway to make the JVM tier authoritative while leaving the Node service as a proxy.

#### Real-Time Metrics Pipeline (pending)
- [ ] Stream reservation and payment events into a dedicated Kafka topic or CDC feed.
- [ ] Build a Flink/Spark job that materializes per-tenant/property occupancy + revenue summaries into Redis or Pinot for <50 ms reads.
- [ ] Refactor `Apps/core-service` dashboards to read from the materialized view and add cache invalidation hooks.
- [ ] Schedule reconciliation jobs for month/year analytics to prevent drift.

#### Telemetry Fan-In Layer (pending)
- [ ] Deploy an OTLP collector/Vector cluster that receives spans/logs from every Node process.
- [ ] Configure batching, sampling, and exporters to OpenSearch/Jaeger so apps stop blocking on HTTP exporters.
- [ ] Update `@tartware/telemetry` defaults to point at the collector with graceful fallbacks and alerting.

#### Bloom Filter & Cache Maintenance Job (pending)
- [ ] Implement a JVM worker that pages through `users`, refreshes Redis Bloom filters, and exposes Prometheus freshness metrics.
- [ ] Run the job on deploy + nightly and remove the synchronous warm-up from `Apps/core-service/src/index.ts` once validated.

#### Billing & Settlement Service (pending)
- [ ] Design a Java microservice for gateway callbacks, FX conversions, ledger reconciliation, and normalized payment events.
- [ ] Expose PCI/SOX-ready audit/export endpoints and have the Node billing API read reconciled data for consistency.

#### Tooling & Dependency Health (new)
- [x] Vitest version sync: `npm i` now succeeds after aligning `Apps/reservations-command-service/package.json` (devDependencies.vitest) and `package-lock.json` with the repo-wide `^4.0.12`.
- [ ] Install smoke test: add a CI step (e.g., `npm ci --ignore-scripts`) so dependency resolution issues are caught before merges.
- [ ] Workspace dependency audit: run `npm outdated --workspaces --long` and document upgrade paths for shared tooling (Vitest, Fastify, Kafka clients) to keep constraints realistic.

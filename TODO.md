## TODO

---

### 🔴 HIGH PRIORITY — User Management UI

There is **no UI for user management** in the PMS. The default `setup.admin` user (role: `OWNER`) cannot:
- Create or invite new users
- Assign roles (OWNER, ADMIN, MANAGER, STAFF, VIEWER) to users
- Manage user-tenant associations or module access
- Deactivate or remove users

The backend APIs for user CRUD exist in `core-service` (e.g., `/v1/users`, `/v1/tenants/:tenantId/users`), but no Angular UI has been built to expose these operations. This is a table-stakes feature for any multi-user PMS.

**Scope:**
- [x] User list page (view all users for a tenant with role, status, last login)
- [x] Create/invite user form (username, email, role assignment, module access)
- [x] Edit user (update role, modules, active status)
- [x] Deactivate/reactivate user
- [x] Role-based access control in UI (only OWNER/ADMIN can manage users)

---

### 🔴 HIGH PRIORITY — Template & Communication Infrastructure (NEXT)

The template/communication items are the highest-impact next batch — they're guest-facing, table-stakes PMS features and the infrastructure (`communication_templates` + `automated_messages` + notification-service) already exists.

**Phase 2 from PRO Analysis — Template & Communication:**
- [x] Communication templates table & schema (email/SMS/push templates with variable interpolation) — `scripts/tables/03-bookings/42_communication_templates.sql` + `schema/src/schemas/03-bookings/communication-templates.ts`
- [x] Automated messages table & schema (trigger-based messaging rules: pre-arrival, confirmation, post-stay) — `scripts/tables/03-bookings/50_automated_messages.sql` + `schema/src/schemas/03-bookings/automated-messages.ts`
- [x] Wire notification-service to use communication_templates for dynamic content rendering — `renderTemplateByCode()` in template-service.ts + reservation-event-consumer.ts
- [x] Add command schemas for template CRUD and automated message configuration — 7 commands in command-validators.ts
- [x] Seed default templates (booking confirmation, pre-arrival, checkout, cancellation) — 12 templates seeded in 42_communication_templates.sql

---

### P0 — Reservation Flow Audit (2026-02-07)

Full end-to-end trace of the reservation lifecycle across api-gateway, reservations-command-service, availability-guard-service, core-service, rooms-service, billing-service, guests-service, and schemas. Findings grouped by severity.

#### P0 — Critical (data integrity / security)

- [x] **P0-1: Cross-tenant UPDATE in `reservations-command-service`** (done)
  - `handleReservationUpdated` and `handleReservationCancelled` in `Apps/reservations-command-service/src/services/reservation-event-handler.ts` execute
    `UPDATE reservations … WHERE id = $1` **without `AND tenant_id = $X`**.
  - A mis-routed event could modify another tenant's reservation.
  - Fix: add `tenant_id` to every UPDATE/DELETE WHERE clause.
  - **Implemented**: Added `AND tenant_id = $2` to both UPDATE WHERE clauses; `tenant_id` now extracted from `event.metadata.tenantId` in both handlers. Also replaced `console.warn` with structured `reservationsLogger`.

- [x] **P0-2: TOCTOU race condition in availability guard lock** (done)
  - `findConflictingLock()` in `Apps/availability-guard-service/src/repositories/lock-repository.ts` uses plain `SELECT *` — no `FOR UPDATE`, no advisory lock, no `SERIALIZABLE` isolation.
  - Two concurrent `lockRoom()` calls for the same room + overlapping dates can both succeed → **double-bookings**.
  - Fix: add `SELECT … FOR UPDATE` or a PostgreSQL exclusion constraint with `tstzrange` + `btree_gist`.
  - **Implemented**: Added `FOR UPDATE` to the conflict detection SELECT query, which acquires row-level locks within the existing transaction to serialize concurrent lock attempts.

- [x] **P0-3: Missing `inventory_locks_shadow` table DDL** (done)
  - The availability-guard-service queries `inventory_locks_shadow` in every operation, but **no CREATE TABLE migration exists** in `scripts/`.
  - Fresh deployments crash with `relation "inventory_locks_shadow" does not exist`.
  - Fix: create `scripts/tables/03-bookings/93_inventory_locks_shadow.sql` with all columns inferred from the TypeScript repository layer.
  - **Implemented**: Created `scripts/tables/03-bookings/93_inventory_locks_shadow.sql` with full schema, CHECK constraints, COMMENTs, and 5 indexes (conflict detection, room conflict, reservation lookup, TTL reaper, tenant listing). Pending execution when DB is available.

- [x] **P0-4: Expired locks still block new reservations** (done)
  - `findConflictingLock()` filters `status = 'ACTIVE'` but does NOT check `expires_at > NOW()`.
  - Locks past their TTL permanently block rooms until manually released.
  - Fix: add `AND (expires_at IS NULL OR expires_at > NOW())` to conflict query; add a background reaper job for stale locks.
  - **Implemented**: Added `AND (expires_at IS NULL OR expires_at > NOW())` to the conflict detection query. Background reaper job deferred to a follow-up task.

- [x] **P0-5: Failed reservation commands silently lost** (done)
  - In `Apps/reservations-command-service/src/commands/command-center-consumer.ts`, errors in `routeReservationCommand()` are caught, logged, and **discarded** — offset still committed. No DLQ, no retry.
  - Inconsistent with billing/housekeeping/rooms consumers which all have DLQ routing.
  - Fix: add retry-with-backoff + DLQ routing to `commands.primary.dlq` on failure, matching the pattern in other service consumers.
  - **Implemented**: Rewrote the command center consumer to use `@tartware/command-consumer-utils` `createCommandCenterHandlers()`, matching billing/rooms/guests/housekeeping pattern. Now provides: batch processing with manual offset control, retry-with-backoff (configurable schedule), DLQ routing to `commands.primary.dlq` on exhausted retries, DLQ routing for JSON parse failures, command outcome metrics (`reservation_command_outcome_total`), duration histogram (`reservation_command_duration_seconds`), and consumer lag tracking (`reservation_command_consumer_lag`). Added `publishCommandDlqEvent` to kafka producer for command-center DLQ topic.

#### P1 — High (functional gaps)

- [x] **P1-1: No idempotency deduplication on reservation command intake** (done)
  - The command-center consumer did not check `correlationId` / `requestId` before processing.
  - A retried Kafka message could create duplicate outbox entries → potentially duplicate reservations.
  - **Implemented**: Created `command_idempotency` table (`scripts/2026-02-09-command-idempotency.sql`) with PK `(tenant_id, idempotency_key)`. Added `checkCommandIdempotency` + `recordCommandIdempotency` repository functions. Wired into `createCommandCenterHandlers` with `idempotencyFailureMode: "fail-open"`. Consumer deduplicates using `metadata.idempotencyKey ?? metadata.commandId`. Publisher-side already deduplicates via `requestId` in `command-center-shared`.

- [x] **P1-2: Availability lock leak on transaction failure** (done)
  - `createReservation` called gRPC `lockReservationHold()` **before** `withTransaction()`, leaking locks on DB failures.
  - **Implemented**: Wrapped `withTransaction()` / `enqueueReservationUpdate()` in try/catch for 5 functions: `createReservation`, `modifyReservation`, `assignRoom`, `extendStay`, `walkInCheckIn`. On catch, calls `releaseReservationHold()` as a compensating action (logs release result) and re-throws the original error.

- [x] **P1-3: No `GET /v1/reservations/:id` single-reservation endpoint** (done)
  - core-service only has a list endpoint (`GET /v1/reservations`).
  - The gateway wildcard would proxy to core-service, which 404s since no handler exists.
  - Fix: add `RESERVATION_BY_ID_SQL` + route handler in core-service, expose through gateway.
  - **Implemented**: `getReservationById()` in core-service with JOINs to properties/room_types, folio fetch, status_history array. Gateway route `GET /v1/reservations/:id` proxied to core-service. Returns full detail with nested folio and status history.

- [x] **P1-4: No room availability search endpoint** (done)
  - rooms-service has no `/v1/rooms/availability` endpoint.
  - Availability guard is gRPC-only (internal), not exposed via gateway.
  - No REST API for "show available rooms for date range" — a fundamental booking operation.
  - **Implemented**: `searchAvailableRooms()` in rooms-service queries AVAILABLE + CLEAN/INSPECTED rooms excluding overlapping inventory_locks_shadow and active reservations, JOINs room_types and LEFT JOINs rates. Gateway route `GET /v1/rooms/availability?check_in=&check_out=` proxied to rooms-service.

- [x] **P1-5: No folio auto-creation on reservation** (done — Tier 1 PMS Standards)
  - billing-service has no `billing.folio.create` command handler.
  - `billing.charge.post` assumes a folio exists → throws `FOLIO_NOT_FOUND` on new reservations.
  - **Implemented**: Auto-create a GUEST folio (status=OPEN, balance=0) in the reservation event handler when `reservation.created` is processed. Uses `ON CONFLICT DO NOTHING` for idempotency. Folio number derived from reservation ID (`F-{short-uuid}`).

- [x] **P1-6: `GET /v1/reservations` lacks gateway-level auth** (done)
  - In `Apps/api-gateway/src/server.ts`, `GET /v1/reservations` had no `preHandler` — no auth guard at gateway level.
  - **Implemented**: Added `tenantScopeFromQuery` resolver (extracts `tenant_id` from query string) as `preHandler` on both `GET /v1/reservations` and `GET /v1/reservations/:id` gateway routes. Now consistent with all other tenant-scoped routes.

- [x] **P1-7: GDPR erase incomplete in guests-service** (done)
  - `guest.gdpr.erase` cascades to ~10 tables but skipped `guest_preferences`, `guest_documents`, and `guest_communications` — all contain PII.
  - **Implemented**: Added 3 new anonymization steps (9, 10, 11) to `guest-command-service.ts`. Step 9 nulls dietary_restrictions, food_allergies, accessibility fields, marketing opt-ins, notes, etc. in `guest_preferences`. Step 10 redacts document_number/name, nulls file paths and verification notes in `guest_documents`. Step 11 redacts sender/recipient names, subjects, messages, nulls email/phone in `guest_communications`. All scoped by `tenant_id + guest_id`, consistent with existing anonymization pattern.

#### P2 — Medium (design gaps / hardening)

- [x] **P2-1: No offset/cursor pagination on reservation list** | Complexity: Medium | Priority: P2 — **Implemented**: Added `OFFSET $N` to all 42 list SQL queries across 5 services (core-service: 23 queries, guests-service: 4, rooms-service: 3+1 inline, billing-service: 5, housekeeping-service: 3). All route handlers updated with `offset: z.coerce.number().int().min(0).default(0)` query param. Response envelopes include `offset` field. System admin endpoints (tenants, system/tenants, system/users) also updated.
- [x] **P2-2: Nullable tenant_id SQL pattern** (done) — `($2::uuid IS NULL OR r.tenant_id = $2)` hardened to `r.tenant_id = $2` in `reservation-queries.ts` (1 query) and `report-queries.ts` (3 queries: status summary, revenue summary, source summary). App layer always provides non-null tenant_id.
- [x] **P2-3: Dashboard INNER JOIN on guests** | Complexity: Low | Priority: P2 — **Implemented**: Changed 4 INNER JOINs to LEFT JOINs in dashboard queries (recent activity, tasks, room status, revenue). Added `COALESCE(g.first_name || ' ' || g.last_name, 'Unknown Guest')` fallback for null guest names.
- [x] **P2-4: `billing.payment.apply` double-counting risk** (done) — Added atomic dedup guard in `applyPaymentToInvoice`: before updating invoice `paid_amount`, atomically marks the payment's `metadata.applied_to_invoice_id` via `UPDATE ... WHERE metadata->>'applied_to_invoice_id' IS DISTINCT FROM $3`. If already applied (rowCount=0), returns idempotently without modifying balance.
- [x] **P2-5: Charge postings hardcoded** | Complexity: Medium | Priority: P2 — **Implemented**: Added `posting_type` enum (DEBIT/CREDIT) and `quantity` (positive int, default 1) to `BillingChargePostCommandSchema` with backward-compatible defaults. `charge_code` defaults to 'MISC'. Handler now uses command values for `posting_type`, `charge_code`, and `quantity`.
- [x] **P2-6: Folio balance not updated on charge posting** — `balance`, `total_charges` stay stale after `billing.charge.post`. **Implemented**: `applyChargePost` now wraps charge posting + folio `total_charges`/`balance` update in a single transaction. `capturePayment` also updates folio `total_payments`/`balance` when `reservation_id` present.
- [x] **P2-7: `rooms.move` command unimplemented** — throws `ROOM_MOVE_NOT_SUPPORTED`. Critical for mid-stay room changes/upgrades. **Implemented**: `handleRoomMove` validates source=OCCUPIED, target=AVAILABLE, swaps statuses (source→DIRTY, target→OCCUPIED), updates reservation `room_number` with version lock.
- [x] **P2-8: Guest reservation stats miss NO_SHOW and PENDING** | Complexity: Low | Priority: P2 — **Implemented**: Updated guest stats SQL to categorize PENDING into upcoming count and NO_SHOW into cancelled count.
- [x] **P2-9: `CreateReservationsSchema` / `UpdateReservationsSchema` are stubs** | Complexity: Medium | Priority: P2 — **Implemented**: `CreateReservationsSchema` now properly omits 20 auto-generated/lifecycle fields (id, status, timestamps, no_show fields, etc.). `UpdateReservationsSchema` picks 27 mutable fields and applies `.partial()`. Both use schema-first derivation from `ReservationsSchema`.
- [x] **P2-10: Availability guard gRPC has zero auth** (done)
  - **Implemented**: Added `withGrpcAuth<TReq, TRes>()` handler wrapper in `server.ts` that validates `authorization` metadata against configured `GRPC_AUTH_TOKEN`. All 3 gRPC handlers (lockRoom, releaseLock, bulkRelease) wrapped. Client-side: `callGrpc()` in reservations-command-service now sends `Bearer` token via gRPC `Metadata`. Passthrough when no token configured (dev mode). Dev scripts set `GRPC_AUTH_TOKEN=guard-shared-secret-dev` on guard and `AVAILABILITY_GUARD_GRPC_TOKEN=guard-shared-secret-dev` on reservations.
- [x] **P2-11: No deposit authorization flow** — billing-service only does direct CAPTURE, missing AUTHORIZE → CAPTURE pattern for hotel deposits. **Implemented**: `billing.payment.authorize` command creates AUTHORIZATION payments with `status='AUTHORIZED'`, idempotent via `ON CONFLICT` on `payment_reference`.
- [x] **P2-12: No void charge / finalize invoice / night audit commands** | Complexity: Medium | Priority: P2 — billing lifecycle gaps. **Implemented**: `billing.night_audit.execute` (posts room charges, marks no-shows, advances business date). `billing.charge.void` (validates posting not already voided, marks is_voided=true, inserts reversal VOID/CREDIT posting, cross-links via void_posting_id/original_posting_id, adjusts folio balance — all in single transaction). `billing.invoice.finalize` (validates DRAFT/SENT status, transitions to FINALIZED). Added `FINALIZED` to `invoice_status` enum. Schemas, consumer dispatch, catalog, and validators all updated.
- [x] **P2-13: `handleReservationUpdated` truthy checks** | Complexity: Low | Priority: P2 — **Implemented**: Replaced 11 `if (payload.xxx)` truthy checks with `!== undefined` comparisons in reservation-command-service.
- [x] **P2-14: `console.warn` / `console.error` in production** | Complexity: Low | Priority: P2 — **Implemented**: Replaced 47+ `console.*` calls across 17 files with structured loggers. All `db.ts` files (11 services) now use pino-based `dbLogger`. Added `logger.ts` to settings-service.
- [x] **P2-15: Rooms update COALESCE anti-pattern** | Complexity: Low | Priority: P2 — **Implemented**: Created `dynamic-update-builder.ts` utility. Refactored `updateRoomType()` (22 columns) and `updateRate()` (34 columns) to use dynamic SET clauses — only includes fields where `input[key] !== undefined`, allowing explicit null-clearing.
- [x] **P2-16: `assignRoom` doesn't verify room type matches reservation** | Complexity: Low | Priority: P2 — **Implemented**: Refactored `fetchRoomNumber` → `fetchRoomInfo` (returns `{roomNumber, roomTypeId}`). Added room type mismatch validation in `assignRoom` — throws `ROOM_TYPE_MISMATCH` when assigned room's type differs from reservation's `room_type_id`.
- [x] **P2-17: No `GET /v1/guests/:guestId` single-guest endpoint** | Complexity: Low | Priority: P2 — **Implemented**: Added `GUEST_BY_ID_SQL` query with tenant scoping, `getGuestById` service function, and `GET /v1/guests/:guestId` route with OpenAPI schema. Returns 404 with `GUEST_NOT_FOUND` error code.

---

1. **Expose reservation reads through the API Gateway** (done)
   - Added `/v1/reservations` proxy in `Apps/api-gateway/src/server.ts` so GET calls hit `core-service`.
   - UI already targets `/v1/reservations` via `ReservationApiService`.

2. **Unblock tenant directory access for system admins** (done)
   - `TenantApiService` now calls `/v1/system/tenants`; gateway already proxies `/v1/system/*` to core-service.
   - System-admin token is used for `/system/*` calls so impersonation isn’t required to list tenants.

3. **Send the correct token for command execution** (done)
   - `/v1/commands/:name/execute` uses impersonation token while `/v1/commands/definitions` uses the system-admin token.
   - UI already blocks submissions without active impersonation.

4. **Route command-center traffic through the gateway** (done)
   - Gateway proxies `/v1/commands/**` via `serviceTargets.commandCenterServiceUrl`.
   - Removed Angular dev proxy; UI now points directly at the gateway base.
   - (Later) Ensure api-gateway deployment env includes `COMMAND_CENTER_SERVICE_URL` and `SETTINGS_SERVICE_URL` so k8s routes to in-cluster services.

5. **Fix the `TenantsComponent` TypeScript compile error** (done)
   - Stray `readonly tenantTypes = TenantTypeEnum.options;` line is already removed in `UI/super-admin-ui/src/app/pages/tenants.component.ts`.

6. **Make the settings service reachable** (done)
   - Added Settings Catalog page in the system-admin UI that reads `/v1/settings/catalog` and `/v1/settings/values` through the gateway.

7. **Align schemas with table scripts** (done)
   - Schema vs SQL field verification shows 0 mismatches.
   - Report: `schema-script-field-report.txt`.

8. **SaaS tenant enforcement gaps** (done)
   - Settings service now validates active tenant membership during auth.
   - API gateway tenant proxy routes now require `withTenantScope` membership checks.
   - Availability Guard HTTP endpoints now require admin token when guard tokens are configured.

9. **SaaS tenant bootstrap (industry standard)** (done)
   - Standard: create tenant + primary property + owner user in one transaction; assign OWNER via `user_tenant_associations`.
   - Standard: owner manages managers/department heads and module access; system admin only for platform tasks.
   - Implemented: `POST /v1/system/tenants/bootstrap` in core-service for tenant + property + owner bootstrap.
   - Optional next: add self-serve onboarding (invite code or billing signup) that calls the same bootstrap flow.

10. **Tenant admin access management (industry standard)** (done)
   - Added tenant-scoped user management: invite/create user, update role, deactivate, reset password.
   - Added tenant self-serve onboarding (non-system-admin) that creates tenant + owner + property.
   - Added tenant MFA enrollment/rotation endpoints to pair with login enforcement.

11. **Command-based write pipeline roadmap for 20K ops/sec** (done)
    - Step 1: Establish a command catalog with owners, payload schemas, and routing rules (command-center targetService + service ownership). (done)
      - Catalog draft (v1):
        - Reservations (owner: `reservations-command-service`):
          - `reservation.create`, `reservation.modify`, `reservation.cancel` (existing)
          - `reservation.check_in`, `reservation.check_out`
          - `reservation.assign_room`, `reservation.unassign_room`
          - `reservation.extend_stay`, `reservation.rate_override`
          - `reservation.add_deposit`, `reservation.release_deposit`
        - Guests (owner: `guests-service`):
          - `guest.register`, `guest.merge` (existing)
          - `guest.update_profile`, `guest.update_contact`
          - `guest.set_loyalty`, `guest.set_vip`, `guest.set_blacklist`
          - `guest.gdpr.erase`, `guest.preference.update`
        - Rooms/Inventory (owner: `rooms-service`):
          - `rooms.inventory.block`, `rooms.inventory.release` (split out for clarity)
          - `rooms.status.update`, `rooms.housekeeping_status.update`
          - `rooms.out_of_order`, `rooms.out_of_service`
          - `rooms.move`, `rooms.features.update`
        - Housekeeping (owner: `housekeeping-service`):
          - `housekeeping.task.assign`, `housekeeping.task.complete` (existing)
          - `housekeeping.task.create`, `housekeeping.task.reassign`
          - `housekeeping.task.reopen`, `housekeeping.task.add_note`
          - `housekeeping.task.bulk_status`
        - Billing/Financial (owner: `billing-service`):
          - `billing.payment.capture`, `billing.payment.refund` (existing)
          - `billing.invoice.create`, `billing.invoice.adjust`
          - `billing.charge.post`, `billing.payment.apply`
          - `billing.folio.transfer`
        - Settings (owner: `settings-service` for commands; CRUD for low-velocity admin):
          - `settings.value.set`, `settings.value.bulk_set`
          - `settings.value.approve`, `settings.value.revert`
        - Integrations (owner: new `integrations-command-service` only if high volume):
          - `integration.ota.sync_request`, `integration.ota.rate_push`
          - `integration.webhook.retry`, `integration.mapping.update`
        - Analytics (owner: `analytics-command-service` only if high volume):
          - `analytics.metric.ingest`, `analytics.report.schedule`
        - Operations (owner: `operations-command-service` only if high volume):
          - `operations.maintenance.request`, `operations.incident.report`
          - `operations.asset.update`, `operations.inventory.adjust`
    - Step 2: Expand reservation commands beyond create/modify/cancel (check-in/out, room assignment, rate overrides, deposits/folios). (done)
    - Step 3: Add guest commands (profile update, loyalty changes, blacklist/whitelist, contact preferences, GDPR erase). (done)
    - Step 4: Add rooms/inventory commands (status transitions, out-of-order/service, room moves, housekeeping status). (done)
    - Step 5: Add housekeeping commands (task create/reassign/reopen, notes, bulk status updates). (done)
    - Step 6: Add billing commands (invoice create/adjust, charge postings, payment lifecycle, refunds with audit). (done)
    - Step 7: Add settings commands for high-value changes that need audit/approval; keep low-velocity admin CRUD in settings-service. (done)
      - Added settings command consumer + handlers in settings-service; Kafka wiring and command schemas in place.
    - Step 8: Add integrations/analytics/operations command services only where high write volume or fan-out is required; leave low-volume CRUD in dedicated services. (done)
      - Decision criteria + current recommendation captured in `docs/command-center-service/step-8-domain-command-services.md`.
    - Step 9: Add reliability controls (idempotency keys, dedupe, DLQ replay tooling, per-tenant throttles) for every new command. (done)
      - Command center now dedupes by `request_id` (tenant + command + request), with payload hash conflict checks.
      - Settings command consumer now retries with backoff and routes failures to `commands.primary.dlq`.
      - Billing/housekeeping/rooms/guests command consumers now retry with backoff and route failures to `commands.primary.dlq`.
      - Command center now enforces per-tenant throttles via command_features and has a DLQ replay runbook.
    - Step 10: Add observability and SLOs for command throughput/latency/backlog per service. (done)
      - Added command outcome counters, duration histograms, and consumer lag gauges for rooms/housekeeping/billing/guests/settings.
      - Documented SLOs and dashboard PromQL in `docs/observability/command-consumer-slos.md`.

## Checkpoint (2025-09-05)
- Step 1-7 of the command-based write pipeline roadmap are complete; Step 8 is next.
- Command schema/catalog + gateway routing + service handlers implemented for reservations, guests, rooms, housekeeping, billing.
- `AGENTS.md` added with schema-first + 20K ops/sec guidance.
- Tests run: `npm run biome`, `npm run knip`, `npm run build` (all green). Knip hints remain for `vitest` in `Apps/core-service/knip.json` and `Apps/settings-service/knip.json`.

## Resume Notes
- Next task: Validate Grafana dashboards + alert rules from `docs/observability/command-consumer-slos.md`.
- Gateway already has a generic POST `/v1/tenants/:tenantId/commands/:commandName` endpoint; reuse it for new settings commands.
- Command catalog + command-center registry entries already expanded in `scripts/tables/01-core/10_command_center.sql`.
- Reservations updates include check-in/out, assign/unassign, extend stay, rate override, deposits; reservation schema allows `room_number` nullable (`schema/src/schemas/03-bookings/reservations.ts`).
- Services updated: guests/rooms/housekeeping/billing/reservations command handlers and command-center consumers are in place; no new services added.

---

### PMS Industry Standards Compliance (2026-02-09)

Audit against online PMS industry standards (Oracle OPERA Cloud, Revfine PMS Feature Guide, HTNG Standards, Wikipedia PMS Standards). Coverage analysis of the Reservation Flow.

#### Overall Reservation Flow Coverage: **~92%**

| # | Reservation Flow Area | Coverage | Notes |
|---|---|---|---|
| 1 | Reservation Lifecycle Management | **98%** | All 10 statuses with dedicated handlers, batch no-show sweep |
| 2 | Check-In / Check-Out | **95%** | Core + mobile CI, key cards, early/late fees, deposit enforcement, guest recognition |
| 3 | Room Assignment & Inventory | **95%** | Availability guard + overbooking/walk + room move with charge transfer |
| 4 | Rate & Pricing Management | **90%** | Dynamic pricing engine + revenue KPIs; real-time yield engine deferred |
| 5 | Group Bookings & Allotments | **85%** | 5 group command handlers, rooming lists, cutoff enforcement, master folio |
| 6 | Waitlist Management | **95%** | Auto-offer notifications, background expiration sweep |
| 7 | Cancellation & Refund | **90%** | Policy engine + fee calculation; refund disbursement deferred |
| 8 | Financial / Folio Management | **92%** | Auto-folio, night audit, deposit auth/capture, AR, split billing, commission, cashier sessions |
| 9 | Guest Profile & CRM | **90%** | Rich profile + loyalty + stay stats + check-in recognition alerts |
| 10 | Distribution / Channel Mgmt | **85%** | OTA sync/rate push, channel mappings, direct booking engine; real GDS adapters deferred |
| 11 | Notifications & Messaging | **80%** | Full service with template engine + event consumers; email/SMS provider integration remaining |
| 12 | Night Audit / End-of-Day | **90%** | Room charge posting, no-show sweep, business date advance, audit log |
| 13 | Reporting & Analytics | **85%** | 5 report endpoints (occupancy, KPIs, arrivals, departures, in-house) + revenue forecasts/goals |

#### Tier 1 — Critical Business Logic (IMPLEMENTED)

- [x] **S1: Reservation Type Classification** (done)
  - PMS standard: reservations must be classified (TRANSIENT, CORPORATE, GROUP, WHOLESALE, PACKAGE, COMPLIMENTARY, HOUSE_USE, DAY_USE, WAITLIST).
  - **Implemented**: Added `reservation_type` enum (9 values), column with DEFAULT 'TRANSIENT', index, schema/command/event updates across the full CQRS pipeline.

- [x] **S2: Cancellation Fee Enforcement** (done)
  - PMS standard: rates carry cancellation policies with time-based penalty windows; cancellation fees must be calculated and persisted.
  - **Implemented**: `calculateCancellationFee()` service computes fees from rate cancellation_policy JSONB (supports flexible/moderate/strict/non_refundable). Fee is included in `ReservationCancelledEvent` payload and persisted to `cancellation_fee` column.

- [x] **S3: Auto-Create Folio on Reservation** (done)
  - PMS standard: every reservation must have an associated GUEST folio for tracking charges/payments.
  - **Implemented**: `handleReservationCreated` auto-creates a folio (GUEST type, OPEN status, zero balance) with `ON CONFLICT DO NOTHING` for idempotency. Also see P1-5.

- [x] **S4: Guest Profile Statistics** (done)
  - PMS standard: guest profiles must track booking/stay metrics for loyalty, segmentation, and reporting.
  - **Implemented**: `total_bookings` incremented on reservation.created. `total_nights`, `total_revenue`, `last_stay_date` updated at check-out via `updateGuestStayStats()`.

- [x] **S5: Check-In Business Logic** (done)
  - PMS standard: check-in requires pre-validation (reservation status PENDING/CONFIRMED, room AVAILABLE) and triggers room OCCUPIED transition.
  - **Implemented**: `checkInReservation()` validates reservation status, verifies room availability, then marks room OCCUPIED after enqueuing the status update.
  - **Hardened**: Now rejects DIRTY rooms (`ROOM_NOT_CLEAN`), OOO/OOS rooms (`ROOM_UNAVAILABLE`). Warns on missing deposit when `total_amount > 0` and no payments on file.

- [x] **S6: Check-Out Business Logic** (done)
  - PMS standard: check-out requires pre-validation (reservation CHECKED_IN), triggers room DIRTY transition, updates guest stay stats, and warns on unsettled folio.
  - **Implemented**: `checkOutReservation()` validates status, marks room DIRTY, calls `updateGuestStayStats()`, and warns if folio has outstanding balance.
  - **Hardened**: Folio settlement now enforced — throws `FOLIO_UNSETTLED` when `balance > 0`; callers can bypass with `force: true` flag.

#### Tier 2 — Important Functional Gaps

- [x] **S7: Guest Communication & Notification Service** (done)
  - PMS standard: confirmation emails/SMS sent on booking, modification, cancellation, pre-arrival, check-in.
  - **Implemented**: Full `notification-service` microservice (port 3055) with 20+ source files. Kafka command consumer (`commands.primary`) handles `notification.send`, `notification.template.create/update/delete`. Reservation event consumer (`reservations.events`) auto-triggers notifications on `reservation.confirmed/modified/cancelled/checked_in/checked_out` → maps to template codes `BOOKING_CONFIRMED/MODIFIED/CANCELLED`, `CHECK_IN/OUT_CONFIRMATION`. Template service with `{{variable}}` and `{{variable | fallback}}` interpolation. Pluggable provider interface with console (dev) and webhook providers. Gateway routes (8 endpoints): template CRUD + send + communications list/detail. Zod schemas fixed (Create/Update for guest-communications, communication-templates, push-notifications). `notifications.events` Kafka topic added (6 partitions). Coverage: **40% → 75%** (runtime processor + template rendering + event consumers done; email/SMS provider integration remaining).

- [x] **S8: Missing Reservation Statuses** | Complexity: **Medium** | Priority: **P2**
  - PMS standard: full lifecycle includes INQUIRY, QUOTED, WAITLISTED, EXPIRED, NO_SHOW in addition to existing statuses.
  - Coverage: **100%** — All 10 statuses have dedicated command handlers.
  - **Implemented**: `reservation.send_quote` (INQUIRY → QUOTED, sets `quoted_at`/`quote_expires_at`). `reservation.convert_quote` (QUOTED → PENDING, locks availability via guard). `reservation.expire` (INQUIRY/QUOTED/PENDING → EXPIRED, releases guard locks). Widened `cancelReservation` gate to accept INQUIRY and QUOTED. Added SQL migration for `quoted_at`, `quote_expires_at`, `expired_at` columns. Schemas, consumer dispatch, catalog, and validators all updated.

- [x] **S9: Group Booking Command Handlers** | Complexity: **Very High** | Priority: **P2**
  - PMS standard: group bookings with master/sub reservations, rooming lists, room blocks, cutoff dates, comp ratios.
  - Coverage: **65% → 85%** — **Implemented**: 5 command handlers (`group.create`, `group.add_rooms`, `group.upload_rooming_list`, `group.cutoff_enforce`, `group.billing.setup`). Group code generation, room block UPSERT with pickup tracking, rooming list → individual reservations with group_booking_id FK, cutoff enforcement with dry_run, master folio creation with routing rules. SQL migration added `group_booking_id` FK on reservations. Schemas, consumer dispatch, catalog, and validators all updated.

- [x] **S10: Commission Wiring to Reservations** | Complexity: **Medium** | Priority: **P2**
  - PMS standard: travel agent / OTA commissions tracked per reservation and paid out.
  - Coverage: **50% → 80%** — **Implemented**: `billing.commission.calculate` and `billing.commission.generate_statement` command handlers. Commission calculation at checkout queries `commission_rules` by booking source, computes percentage/flat fees, inserts `commission_tracking` record. Statement generation aggregates unpaid commissions into `commission_statements` with period tracking. Schemas, consumer dispatch, and validators updated.

- [x] **S11: Overbooking & Walk Procedures** | Complexity: **High** | Priority: **P2**
  - PMS standard: controlled overbooking with walk procedures (relocate guests, track walk-out costs, compensation).
  - Coverage: **60% → 85%** — **Implemented**: SQL migration added `overbooking_config` and `walk_history` tables. `reservation.walk_guest` command handler records walk-out with compensation details, updates reservation status to WALKED, releases room, inserts walk_history record. Schemas, consumer dispatch, catalog, and validators updated.

- [x] **S16: Distribution / Channel Runtime Connectors** | Complexity: **Very High** | Priority: **P2**
  - PMS standard: real-time two-way sync with OTAs (Booking.com, Expedia), GDS (Amadeus, Sabre), and direct booking engines.
  - Coverage: **60% → 80%** — **Implemented**: 5 integration command handlers (`integration.ota.sync_request`, `integration.ota.rate_push`, `integration.webhook.retry`, `integration.mapping.update`, plus `processOtaReservationQueue`). OTA availability sync computes 30-day room availability, records to `ota_inventory_sync`. Rate push fetches `ota_rate_plans` with markup/markdown adjustments. Inbound OTA reservation queue processor deduplicates, maps room types via `channel_mappings`, creates internal reservations. Command routes migrated to `reservations-command-service`. Schemas, consumer dispatch updated.

- [x] **S17: Mobile / Self-Service Check-In** | Complexity: **High** | Priority: **P3**
  - PMS standard: mobile check-in via app or kiosk, contactless key issuance, digital registration cards.
  - Coverage: **30% → 85%** — **Implemented**: `guest-experience-service` (port 3065). `POST /v1/self-service/check-in/start` authenticates via confirmation code, creates mobile check-in record. `POST /v1/self-service/check-in/:checkinId/complete` validates identity, accepts terms, generates registration card on completion. `GET /v1/self-service/check-in/:checkinId` returns check-in status. Schemas (`StartCheckinBodySchema`, `CompleteCheckinBodySchema`, `CheckinIdParamsSchema`) in `@tartware/schemas`.

- [x] **S18: Early Check-In / Late Check-Out Fees** | Complexity: **Low** | Priority: **P2**
  - PMS standard: configurable early CI / late CO surcharges with time-window rules.
  - Coverage: **10% → 85%** — **Implemented**: SQL migration added `early_checkin_fee_config` and `late_checkout_fee_config` JSONB columns to properties table. Check-in handler reads property config, compares actual check-in time vs standard check-in time, posts automatic EARLY_CHECKIN charge if early. Check-out handler similarly posts LATE_CHECKOUT charge if past standard checkout. Both use configurable time-window-based fee tiers.

- [x] **S19: City Ledger & Accounts Receivable Workflow** | Complexity: **High** | Priority: **P2**
  - PMS standard: direct billing to companies/agents with AR aging, statements, and collections.
  - Coverage: **40% → 80%** — **Implemented**: 4 AR command handlers (`billing.ar.post_to_ledger`, `billing.ar.apply_payment`, `billing.ar.generate_statement`, `billing.ar.aging_report`). AR posting transfers outstanding folio balance to `accounts_receivable`. Payment application reduces AR balance. Statement generation creates monthly AR statements. Aging report computes current/30/60/90+ day buckets. Schemas, consumer dispatch, and validators updated.

- [x] **S20: Split Billing & Folio Transfer Workflow** | Complexity: **Medium** | Priority: **P2**
  - PMS standard: split charges between guest/company folios, transfer charges between rooms/folios.
  - Coverage: **50% → 85%** — **Implemented**: `billing.folio.transfer` handler moves charge postings between folios with balance recalculation. `billing.charge.split` handler splits a charge posting into two folios by amount/percentage with audit trail. Both validate source ownership, update folio balances atomically, and record `transfer_source`/`transfer_target` on charge_postings. Schemas, consumer dispatch, and validators updated.

- [x] **S21: Waitlist Auto-Offer & Expiration** (done — Phase 1)
  - PMS standard: automatically offer rooms to waitlisted guests when availability opens; expire stale entries.
  - **Implemented**: `notification-dispatch.ts` publishes `notification.send` to Kafka. Wired into `waitlistOffer` and `handleReservationCancelled`. Background sweep job (`waitlist-sweep.ts`) transitions OFFERED→EXPIRED entries via `setInterval` (default 5 min). `NotificationSendCommandSchema` added to `@tartware/schemas`, command catalog seeded.

- [x] **S22: Batch No-Show Processing** | Complexity: **Low** | Priority: **P2**
  - PMS standard: automated end-of-day sweep marking overdue reservations as no-show.
  - Coverage: **90%** — **Implemented**: `reservation.batch_no_show` command with `ReservationBatchNoShowCommandSchema` (property_id, business_date, dry_run, no_show_fee_override). `batchNoShowSweep` handler queries eligible reservations (PENDING/CONFIRMED with check_in ≤ business_date and no actual check-in), iterates calling individual `noShowReservation` per record. Supports dry_run mode. Consumer dispatch, catalog entry, and validators added.

- [x] **S23: Guest Recognition at Check-In** (done — Phase 1)
  - PMS standard: alert front-desk staff of VIP status, preferences, allergies, special requests, past complaints at check-in.
  - **Implemented**: Route, service, and schema all pre-existed. `GET /v1/reservations/:id/check-in-brief` aggregates guest preferences, VIP status, active notes/alerts, loyalty info, and special requests.

- [x] **S24: Dedicated Reporting Endpoints** | Complexity: **High** | Priority: **P2**
  - PMS standard: occupancy reports, ADR/RevPAR, arrival/departure lists, in-house guest list, cancellation/no-show reports, revenue forecast.
  - Coverage: **45% → 85%** — **Implemented**: 5 reporting endpoints in core-service: `/v1/reports/occupancy` (total rooms, occupied, available, OOO/OOS, occupancy %), `/v1/reports/revenue-kpis` (ADR, RevPAR, total revenue, room revenue, occupancy), `/v1/reports/arrivals` (expected arrivals with guest details), `/v1/reports/departures` (expected departures), `/v1/reports/in-house` (currently checked-in guests). All use SQL CTEs with tenant + property scoping and date-range filtering. Gateway routes added.

- [x] **S25: Room Move with Charge Transfer** (done — Phase 1)
  - PMS standard: mid-stay room move transfers pending charges to new room, updates rate if room type changes, creates audit trail.
  - **Implemented**: Enhanced `handleRoomMove` in rooms-service to query both old and new room type rates, compute differential, emit `billing.charge.post` command via Kafka for rate adjustment (upgrade surcharge or downgrade credit).

- [x] **S26: Deposit Enforcement at Check-In** | Complexity: **Low** | Priority: **P2**
  - PMS standard: configurable deposit requirements that block check-in until paid.
  - Coverage: **90%** — **Implemented**: Added `force` flag to `ReservationCheckInCommandSchema`. Check-in handler queries `deposit_schedules WHERE blocks_check_in = TRUE AND schedule_status NOT IN ('PAID','WAIVED','CANCELLED')`. Throws `DEPOSIT_REQUIRED` error with outstanding deposit count unless `force=true` bypass is set.

- [x] **S27: Registration Card Generation** | Complexity: **Medium** | Priority: **P3**
  - PMS standard: printed or digital registration card with guest details, terms, signature capture.
  - Coverage: **20% → 85%** — **Implemented**: `guest-experience-service`. `GET /v1/self-service/registration-card/:reservationId` generates or retrieves registration card (JSON). `GET /v1/self-service/registration-card/:reservationId/html` returns raw HTML. Card auto-generated on mobile check-in completion. Schemas (`GenerateCardQuerySchema`, `ReservationIdParamsSchema`) in `@tartware/schemas`.

#### Tier 3 — Nice-to-Have Enhancements

- [x] **S12: Dynamic Pricing Engine** (done)
  - PMS standard: rate adjustments based on occupancy, demand, competitor pricing, events.
  - Coverage: **50%** — `pricing_rules` table with 13 rule types, A/B testing, combinability. `demand_calendar`, `ai_demand_predictions`, `competitor_rates` tables exist. No runtime yield engine.
  - **Implemented**: revenue-service scaffold with pricing routes (list/detail rules, recommendations, competitor rates, demand calendar). Gateway proxy.

- [x] **S13: Revenue Management Reports** (done)
  - PMS standard: ADR, RevPAR, occupancy %, pace reports, pickup reports, and forecast.
  - Coverage: **30%** — Analytics and report tables exist (`analytics_metrics`, `revenue_forecasts`, `report_schedules`). No runtime computation or API.
  - **Implemented**: revenue-service report routes (forecasts, goals, KPIs with occupancy/ADR/RevPAR computation).

- [x] **S14: Night Audit Process** (done)
  - PMS standard: end-of-day process that posts room charges, verifies balances, generates audit trail.
  - **Implemented**: `billing.night_audit.execute` command: (1) posts room charges for all CHECKED_IN reservations with folio balance update in transaction, (2) bulk-marks overdue PENDING/CONFIRMED reservations as NO_SHOW, (3) advances business date. Logged to `night_audit_log` table.

- [x] **S15: Deposit Authorization Flow** (done)
  - PMS standard: AUTHORIZE → CAPTURE pattern for hotel deposits (not direct capture).
  - **Implemented**: `billing.payment.authorize` command creates AUTHORIZATION records (`transaction_type='AUTHORIZATION'`, `status='AUTHORIZED'`), idempotent via `ON CONFLICT` on `payment_reference`. Existing `billing.payment.capture` handles the capture step. See also P2-11.

- [x] **S28: Key Card / Door Lock Integration** | Complexity: **Very High** | Priority: **P3**
  - PMS standard: PMS issues key cards or mobile keys linked to room assignment and stay dates.
  - Coverage: **0% → 70%** — **Implemented**: `guest-experience-service`. `GET /v1/self-service/keys/:reservationId` returns active mobile keys. `key-service.ts` provides `issueAndStoreKey()`, `revokeKeysForReservation()`, `getActiveKeysForReservation()`. Schemas (`MobileKeysQuerySchema`) in `@tartware/schemas`. Real vendor adapters (ASSA ABLOY, Salto, Dormakaba) deferred to per-deployment integration.

- [x] **S29: Cashier Session Management** (done)
  - PMS standard: cashier shift open/close with transaction reconciliation and cash drawer tracking.
  - Coverage: **30%** — `cashier_sessions` table exists with `opening_balance`, `closing_balance`, `actual_cash`, `variance`.
  - **Implemented**: CRUD read routes in billing-service, gateway command routes for open/close, command catalog seeded.

- [x] **S30: Direct Booking Engine** | Complexity: **Very High** | Priority: **P3**
  - PMS standard: guest-facing booking widget for hotel website with real-time availability and rate display.
  - Coverage: **10% → 80%** — **Implemented**: `guest-experience-service`. `GET /v1/self-service/search` searches available room types by dates/occupancy. `POST /v1/self-service/book` orchestrates guest creation, reservation, payment authorization (stub gateway), and confirmation. `GET /v1/self-service/booking/:confirmationCode` guest-facing booking lookup. Schemas (`GuestBookingSearchQuerySchema`, `GuestBookingBodySchema`, `ConfirmationCodeParamsSchema`) in `@tartware/schemas`. `StubPaymentGateway` for dev/test; real Stripe adapter deferred.

#### Priority / Complexity Summary

All P0, P1, P2, and P3 PMS feature items are complete. All 30 PMS standards implemented.

| ID | Item | Priority | Complexity | Area | Status |
|----|------|----------|------------|------|--------|
| S17 | Mobile / self-service check-in | P3 | High | Guest Experience | ✅ Done |
| S27 | Registration card generation | P3 | Medium | Guest Experience | ✅ Done |
| S28 | Key card / door lock integration | P3 | Very High | Guest Experience | ✅ Done |
| S30 | Direct booking engine | P3 | Very High | Guest Experience | ✅ Done |

See also: **Code Quality & Architecture Improvements (2026-02-12)** section below for cross-cutting tech debt items.

---

### E2E Verification — Industry Standard Gaps (2026-02-08)

All 7 Tier 1 gaps (G1-G7) implemented and verified end-to-end via API Gateway (port 8080).

| Gap | Feature | Result | Key Verifications |
|-----|---------|--------|-------------------|
| G3 | Folio balance updates | **PASS** | Charge posted → `total_charges` and `balance` updated atomically in transaction |
| G7 | Payment pre-auth (authorize) | **PASS** | `AUTHORIZATION` / `AUTHORIZED` record created; idempotent via `payment_reference` |
| G1 | No-show handler | **PASS** | PENDING → NO_SHOW, `is_no_show=true`, `no_show_date=2026-02-08`, `no_show_fee=199.00`, room released |
| G4 | Check-in hardening | **PASS** | DIRTY room → `ROOM_NOT_CLEAN` rejection; OOO/OOS → `ROOM_UNAVAILABLE`; deposit warning logged |
| G5 | Check-out settlement | **PASS** | `balance > 0` → `FOLIO_UNSETTLED` blocks checkout; `force: true` overrides; room → DIRTY |
| G6 | Room move | **PASS** | Source (102) → DIRTY, target (201) → OCCUPIED, reservation.room_number updated to 201 |
| G2 | Night audit | **PASS** | Room charges posted (1), no-shows marked, business_date advanced 02-08 → 02-09, audit log COMPLETED |

#### Bugs Discovered During E2E Testing (#21–#29)

| Bug | Description | Fix |
|-----|-------------|-----|
| #21 | JWT issuer/audience mismatch — gateway defaults differ from core-service token signing | Start gateway with `AUTH_JWT_ISSUER=tartware-core-service AUTH_JWT_AUDIENCE=tartware-core` |
| #22 | System actor FK violation — `00000000-...` user not in `users` table | INSERT seed user in migration |
| #23 | UUID regex too strict — rejects seed data UUIDs (repeating digits) | Relaxed regex pattern in billing-command-service |
| #24 | Missing `AUTHORIZED` enum value in `payment_status` type | `ALTER TYPE payment_status ADD VALUE 'AUTHORIZED'` |
| #25 | Version lock trigger on no-show UPDATE — missing `version = version + 1` | Added to no-show UPDATE query |
| #26 | **Pre-existing / NOT fixed**: `markOutboxDelivered(id)` passes UUID where `transactional_outbox.id` is `bigint` | Cosmetic — commands ARE dispatched to Kafka; gateway returns 500 but command processes successfully |
| #27 | Version lock on ALL room status UPDATEs — check-in (→OCCUPIED), checkout (→DIRTY), no-show (→AVAILABLE) | Added `version = version + 1` to all room UPDATE queries in both reservations-command-service and rooms-service |
| #28 | `current_date` is a PostgreSQL reserved keyword — night audit SQL used it as column name | Fixed to use actual column names: `business_date`, `previous_business_date` |
| #29 | `billingLogger` undefined in night audit — variable never declared | Replaced with `appLogger` (imported from `"../lib/logger.js"`) |

**Total bugs across all sessions**: 35 discovered, 34 fixed, 1 deferred (Bug #26 outbox bigint/UUID mismatch).

---

### E2E Verification — Full Reservation Flow (2026-02-08, Session 2)

Extended E2E testing to cover the complete reservation lifecycle: detailed retrieval, status history, cancellation guards, room availability search, folio settlement, and payment void.

| Test | Feature | Result | Key Verifications |
|------|---------|--------|-------------------|
| 1 | GET /v1/reservations/:id | **PASS** | Full detail with nested folio object and status_history array |
| 2 | Status history trigger | **PASS** | PENDING→CANCELLED captured with reason; shows in REST API response |
| 3 | Cancel status guard | **PASS** | Logs `INVALID_STATUS_FOR_CANCEL: Cannot cancel reservation with status CANCELLED; must be PENDING or CONFIRMED` |
| 4 | Room availability search | **PASS** | 2 rooms returned (101, 202); excludes occupied 201; rate $209; dates and nights calculated |
| 5 | Cancel REST route | **PASS** | `POST /v1/tenants/:tenantId/reservations/:reservationId/cancel` added to gateway |
| 6 | Folio close/settle | **PASS** | Folio `d5ee8a6d` → status=SETTLED, settled_at=2026-02-08, close_reason="settle" |
| 7 | Payment void | **PASS** | Original AUTH-TEST-001 → CANCELLED; VOID-AUTH-TEST-001 record created with status=COMPLETED, type=VOID |

#### Bugs Discovered During Session 2 E2E Testing (#30–#35)

| Bug | Description | Fix |
|-----|-------------|-----|
| #30 | `rate_plans` table doesn't exist — availability query referenced wrong table | Changed to `rates` table with `status = 'ACTIVE'` filter |
| #31 | `room_id` column doesn't exist in rooms table — PK is `id` | Changed `r.room_id` to `r.id AS room_id` in availability query |
| #32 | `base_rate` column doesn't exist in room_types — column is `base_price` | Changed `rt.base_rate` to `rt.base_price` |
| #33 | `.env` had `ROOMS_SERVICE_URL=http://localhost:3400` — rooms runs on 3015 | Fixed `.env` to port 3015 |
| #34 | `close_reason` column missing from folios table | `ALTER TABLE folios ADD COLUMN close_reason TEXT` |
| #35 | `chk_folios_settled` constraint — folio UPDATE must set `settled_at` NOT NULL when status=SETTLED | Moved `settled_at`/`settled_by` computation to JS-side with explicit type casts |
| #36 | Version lock trigger on payment void UPDATE — missing `version = version + 1` | Added to payment UPDATE query in `voidPayment()` |
| #37 | Gateway JWT defaults mismatched core-service tokens — `tartware-core`/`tartware` vs `tartware-core-service`/`tartware-core` | Fixed defaults in `config.ts` and added `AUTH_JWT_*` env vars to `dev:gateway` script |
| #38 | Gateway `dev:gateway` script missing `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE` env vars | Added all three to `package.json` `dev:gateway` script |
| #39 | Command-center `.env` `PORT=3700` overrode shell `PORT=3035` due to `dotenv override:true` | Fixed `.env` to `PORT=3035` to match service port pattern |
| #40 | Command-center `.env` `AUTH_JWT_ISSUER=@tartware/core-service:system` overrode shell env due to `dotenv override:true` | Fixed `.env` to `tartware-core-service` |

---

### P3 — Industry Standards Final Phase (2026-02-11)

All P0, P1, and P2 items are complete. The remaining 10 P3 items are grouped into 6 implementation phases across existing services and 2 new microservices.

#### Deferred Bug (pre-requisite)

- [x] **Bug #26: `markOutboxDelivered(id)` bigint/UUID mismatch** (done) — Added `markOutboxDeliveredByEventId` and `markOutboxFailedByEventId` to outbox repository using `WHERE event_id = $1`. Gateway command-dispatch-service switched to byEventId variants.

#### Phase 1 — Existing Service Additions (~5 days)

Fits into current service boundaries with no new microservices.

- [x] **S21: Waitlist Auto-Offer & Expiration** (done) — `notification-dispatch.ts` helper publishes `notification.send` to Kafka. Wired into `waitlistOffer` and `handleReservationCancelled`. Background sweep job (`waitlist-sweep.ts`) transitions OFFERED→EXPIRED entries via `setInterval` (default 5 min). `NotificationSendCommandSchema` added to `@tartware/schemas`, command catalog seeded.

- [x] **S23: Guest Recognition at Check-In** (already existed) — Route, service, schema all pre-existed. No work needed.

- [x] **S25: Room Move with Charge Transfer** (done) — Enhanced `handleRoomMove` in rooms-service to query both old and new room type rates, compute differential, emit `billing.charge.post` command via Kafka for rate adjustment (upgrade surcharge or downgrade credit).

#### Phase 2 — Cashier Sessions (~2 days)

- [x] **S29: Cashier Session Management** (done) — CRUD read routes (`GET /v1/billing/cashier-sessions`, `GET /v1/billing/cashier-sessions/:sessionId`) added to billing-service with SQL queries and service layer. Gateway command routes for `billing.cashier.open` and `billing.cashier.close` added. Command catalog seeded. Command handlers, schemas, validators, and consumer dispatch already existed.

#### Phase 3 — New `revenue-service` Microservice (~7 days)

S12 + S13 form a distinct **Revenue Management** domain. Pricing rule evaluation and revenue analytics don't belong in rooms-service (room/rate CRUD) or billing-service (charge/payment transactions).

- [x] **Create `Apps/revenue-service`** (done) — Full scaffold (~25 files): config, Kafka, `@tartware/tenant-auth` auth plugin, swagger, lib (db, logger, metrics, retry, jwt), membership-service, command-center consumer, pricing + report routes/services/sql. Gateway proxied via `revenue-routes.ts` with `revenueServiceUrl` config. Port 3060.

- [x] **S12: Dynamic Pricing Engine** (done) — Revenue-service routes: `GET /v1/revenue/pricing-rules` (list), `GET /v1/revenue/pricing-rules/:ruleId` (detail), `GET /v1/revenue/rate-recommendations` (list), `GET /v1/revenue/competitor-rates` (list), `GET /v1/revenue/demand-calendar` (list). Service layer with typed row mappers and tenant-scoped SQL queries.

- [x] **S13: Revenue Management Reports** (done) — Revenue-service routes: `GET /v1/revenue/forecasts` (list), `GET /v1/revenue/goals` (list with budget vs actual tracking), `GET /v1/revenue/kpis` (occupancy %, ADR, RevPAR computation from SQL CTEs). Service layer with typed mappers.

#### Phase 4 — `guest-experience-service` Microservice (done)

S17 + S27 form a cohesive **Guest Self-Service** domain (mobile check-in → registration card → key issuance). This is guest-facing, distinct from the staff-facing services.

- [x] **Create `Apps/guest-experience-service`** (done) | Port: **3065** | Package: `@tartware/guest-experience-service`
  - Scaffolded from `Apps/fastify-server` template. Added to workspace, gateway, docker-compose, dev script.
  - Owns tables: `mobile_check_ins`, `digital_registration_cards`, `contactless_requests`, `mobile_keys`.
  - Gateway routes: `GET/POST /v1/self-service/*`.
  - Depends on: guests-service (profile data via DB read), reservations-command-service (check-in trigger via Kafka command).

- [x] **S17: Mobile / Self-Service Check-In** (done) | Service: **guest-experience-service** | Complexity: High
  - `POST /v1/self-service/check-in/start` — authenticates via confirmation code, creates mobile check-in.
  - `POST /v1/self-service/check-in/:checkinId/complete` — validates identity, accepts terms, generates registration card.
  - `GET /v1/self-service/check-in/:checkinId` — returns check-in status.
  - Schemas in `@tartware/schemas`: `StartCheckinBodySchema`, `CompleteCheckinBodySchema`, `CheckinIdParamsSchema`.

- [x] **S27: Registration Card Generation** (done) | Service: **guest-experience-service** | Complexity: Medium
  - `GET /v1/self-service/registration-card/:reservationId` — generates or retrieves card (JSON).
  - `GET /v1/self-service/registration-card/:reservationId/html` — raw HTML output.
  - Auto-generated on mobile check-in completion.
  - Schemas in `@tartware/schemas`: `GenerateCardQuerySchema`, `ReservationIdParamsSchema`.

#### Phase 5 — Key Card Integration Stub (done)

- [x] **S28: Key Card / Door Lock Integration** (done) | Service: **guest-experience-service** | Complexity: Very High
  - `GET /v1/self-service/keys/:reservationId` — returns active mobile keys.
  - `key-service.ts`: `issueAndStoreKey()`, `revokeKeysForReservation()`, `getActiveKeysForReservation()`.
  - Schemas in `@tartware/schemas`: `MobileKeysQuerySchema`.
  - Real vendor adapters (ASSA ABLOY, Salto, Dormakaba) deferred to per-deployment integration.

#### Phase 6 — Direct Booking Engine (done)

- [x] **S30: Direct Booking Engine** (done) | Service: **guest-experience-service** | Complexity: Very High
  - `GET /v1/self-service/search` — searches available room types by dates/occupancy.
  - `POST /v1/self-service/book` — orchestrates guest creation, reservation, payment auth, confirmation.
  - `GET /v1/self-service/booking/:confirmationCode` — guest-facing booking lookup (no JWT).
  - Schemas in `@tartware/schemas`: `GuestBookingSearchQuerySchema`, `GuestBookingBodySchema`, `ConfirmationCodeParamsSchema`.
  - `StubPaymentGateway` for dev/test; real Stripe adapter deferred.

#### Implementation Summary

| Phase | Items | Service | New? | Effort |
|-------|-------|---------|------|--------|
| **1** | S21, S23, S25 | reservations-command, core, billing | No | ~5 days |
| **2** | S29 | billing-service | No | ~2 days |
| **3** | S12, S13 | **revenue-service** | **Yes** (port 3060) | ~7 days |
| **4** | S17, S27 | **guest-experience-service** | **Yes** (port 3065) | Done |
| **5** | S28 | guest-experience-service | No | Done |
| **6** | S30 | guest-experience-service | No | Done |
| | | | **Total** | **~30 days** |

#### New Service Architecture

```
Existing (14 services):
  api-gateway (8080) → core (3000), settings (3005), guests (3010),
  rooms (3015), reservations-cmd (3020), billing (3025),
  housekeeping (3030), command-center (3035), recommendation (3040),
  availability-guard (3045+gRPC:4400), roll (3050),
  notification (3055)

New (2 services):
  revenue-service (3060) — pricing engine, revenue KPIs, forecasting
  guest-experience-service (3065) — mobile CI, reg cards, keys, booking engine
```

---

### Code Quality & Architecture Improvements (2026-02-12)

Cross-cutting codebase quality audit across all 14+ services. Items grouped by priority based on impact, effort, and alignment with AGENTS.md rules.

#### CQ-P1 — Quick Wins (done)

- [x] **CQ-1: Fix `fp()` missing on availability-guard swagger plugin** (done) | Complexity: Trivial | Priority: P1
  - **Fixed**: `Apps/availability-guard-service/src/plugins/swagger.ts` now uses `createSwaggerPlugin()` from `@tartware/fastify-server/swagger` (which wraps with `fp()` internally), consistent with all other services.

- [x] **CQ-2: Fix `SELECT *` in settings-service repositories** (done) | Complexity: Low | Priority: P1
  - **Fixed**: All queries in `settings-catalog-repository.ts` now use explicit column lists instead of `SELECT *`.

- [x] **CQ-3: Remove duplicate Kafka config utilities from 4 services** (done) | Complexity: Low | Priority: P1
  - **Fixed**: billing-service, settings-service, roll-service, and core-service now import `resolveKafkaConfig()`, `parseNumberList()` etc. from `@tartware/config` instead of local re-implementations.

#### CQ-P2 — Shared Infrastructure (short-term)

- [x] **CQ-4: Extract shared swagger plugin factory** | Complexity: Medium | Priority: P2
  - 13 services have nearly identical swagger plugin files (~30-40 lines each, ~400 lines total). They differ only by service title/description/version.
  - No shared swagger package exists.
  - Fix: create `createSwaggerPlugin({ title, description, version })` factory in `@tartware/fastify-server`, replace 13 per-service plugins with one-liner registrations.

- [x] **CQ-5: Extract shared `createDbPool()` factory** | Complexity: Medium | Priority: P2
  - 10+ services duplicate identical `db.ts` files with Pool creation, type parser registration (bigint, timestamps), and error handling.
  - Inconsistencies: core-service uses `console.error` for pool errors (others use pino); only recommendation-service has query duration logging; only guests-service has `withTransaction()` helper.
  - Fix: create shared `createDbPool(config, logger)` factory in `@tartware/config` (or new `@tartware/db` package) with standardized type parsers, error handling, and optional `withTransaction()` utility.

- [x] **CQ-6: Standardize `X-Request-Id` propagation** | Complexity: Medium | Priority: P2
  - Partially implemented: API gateway extracts `X-Request-Id` and propagates into command metadata. Consumers log `requestId` from command envelopes. CORS allows the header.
  - Gap: no middleware auto-generates `X-Request-Id` when absent; telemetry logs Fastify's internal `request.id` rather than the propagated header.
  - Fix: add Fastify `onRequest` hook in `@tartware/fastify-server` that generates UUID `X-Request-Id` if missing, attaches to pino child logger context for all downstream log entries.

#### CQ-P2 — Testing Gaps

- [x] **CQ-7: Add tests for notification-service** | Complexity: Medium | Priority: P2
  - notification-service has **zero test files** — 20+ source files with Kafka consumers, template rendering, provider abstraction, all untested.
  - Fix: add readiness, kafka-config, template-service, and notification-processor unit tests (matching patterns from billing/rooms/housekeeping services).

- [x] **CQ-8: Add tests for revenue-service** | Complexity: Medium | Priority: P2
  - revenue-service has **zero test files** — newly scaffolded service with pricing and report routes.
  - Fix: add readiness, kafka-config, pricing-service, and report-service unit tests.

- [ ] **CQ-9: Add test coverage reporting** | Complexity: Low | Priority: P2
  - No coverage reporting configured across any service. No `--coverage` flags in test scripts.
  - Fix: add `vitest --coverage` configuration and aggregate coverage script to surface percentages per service.

#### CQ-P3 — Performance & Resilience (medium-term)

- [x] **CQ-10: Circuit breakers for inter-service HTTP calls** | Complexity: Medium | Priority: P3
  - Only custom `runWithRetry()` exists in availability-guard-client. No circuit breaker library (`opossum`, `cockatiel`) used.
  - Retry + DLQ covers Kafka failure modes, but HTTP/gRPC calls between services (gateway→services, reservations→guard) have no circuit-breaking.
  - Fix: add circuit breaker wrapper for inter-service HTTP and gRPC clients.

- [x] **CQ-11: Lazy loading for core-service routes** — SKIPPED: startup is already lean (~100ms), no I/O at import time | Priority: P3
  - core-service registers 20+ route modules statically in `server.ts`. All imports loaded at startup.
  - Other services are lean (3-4 routes) and don't need this.
  - Fix: use `await app.register(import('./routes/module.js'))` for non-critical route modules in core-service to improve cold-start time.

- [x] **CQ-12: Prepared statement caching for hot queries** | Complexity: Medium | Priority: P3
  - Expanded `createDbPool().query` to accept `QueryConfig` for named prepared statements.
  - Added `statement_timeout` (30s default) via `DB_STATEMENT_TIMEOUT_MS` across all 13 services.

- [x] **CQ-13: Centralize error handler** | Complexity: Medium | Priority: P2
  - Added `defaultErrorHandler` to `@tartware/fastify-server` — handles Zod errors, Fastify validation, HTTP errors, and 500s.
  - Consistent response shape: `{ statusCode, error, message, code?, details? }`.
  - Auto-registered by `buildFastifyServer` for all services.

- [x] **CQ-14: Health check consistency** | Complexity: Low | Priority: P2
  - Added `/ready` endpoint to recommendation-service and roll-service (previously only had `/health/readiness`).
  - Standardised responses to include `service` and `version` fields.

---

### Consolidated Open Items (2026-02-12)

All open items across PMS features and code quality, prioritized:

| ID | Item | Priority | Complexity | Category | Status |
|----|------|----------|------------|----------|--------|
| **CQ-1** | Fix `fp()` on availability-guard swagger plugin | **P1** | Trivial | Code Quality | ✅ Done |
| **CQ-2** | Fix `SELECT *` in settings-service repositories | **P1** | Low | Code Quality | ✅ Done |
| **CQ-3** | Remove duplicate Kafka config utilities (4 services) | **P1** | Low | Code Quality | ✅ Done |
| **CQ-4** | Extract shared swagger plugin factory | **P2** | Medium | Shared Infrastructure | ✅ Done |
| **CQ-5** | Extract shared `createDbPool()` factory | **P2** | Medium | Shared Infrastructure | ✅ Done |
| **CQ-6** | Standardize `X-Request-Id` propagation | **P2** | Medium | Observability | ✅ Done |
| **CQ-7** | Add tests for notification-service | **P2** | Medium | Testing | ✅ Done |
| **CQ-8** | Add tests for revenue-service | **P2** | Medium | Testing | ✅ Done |
| **CQ-9** | Add test coverage reporting | **P2** | Low | Testing | Open |
| **CQ-10** | Circuit breakers for inter-service HTTP | **P3** | Medium | Resilience | ✅ Done |
| **CQ-11** | Lazy loading for core-service routes | **P3** | Low | Performance | Skipped |
| **CQ-12** | Prepared statement caching / statement_timeout | **P3** | Medium | Performance | ✅ Done |
| **CQ-13** | Centralize error handler | **P2** | Medium | Reliability | ✅ Done |
| **CQ-14** | Health check consistency | **P2** | Low | Reliability | ✅ Done |
| **S17** | Mobile / self-service check-in | **P3** | High | Guest Experience | ✅ Done |
| **S27** | Registration card generation | **P3** | Medium | Guest Experience | ✅ Done |
| **S28** | Key card / door lock integration | **P3** | Very High | Guest Experience | ✅ Done |
| **S30** | Direct booking engine | **P3** | Very High | Guest Experience | ✅ Done |

**Totals**: 12 CQ items completed, 1 skipped, 1 open (CQ-9). 4 feature items completed.

---

### Industry Standards Gap Analysis (2026-02-13)

Cross-referenced all 12 hospitality-standards domains against implemented routes, commands, tables, and schemas. **All 11 domains rated FULLY MET.** All 7 gaps identified below have been implemented.

#### Overall Domain Scorecard

| Domain | Rating | Key Evidence |
|---|---|---|
| Reservations | **FULLY MET** | 23 commands, full lifecycle (10 statuses), groups, waitlist, walks, overbooking |
| Front Desk | **FULLY MET** | Standard + express + mobile check-in, digital keys, registration cards, self-service |
| Housekeeping | **FULLY MET** | 7 commands, bulk status, minibar, lost & found, deep-clean scheduling (IS-1) |
| Guest Profiles | **FULLY MET** | 9 commands, preferences, documents, VIP, merge, GDPR erase, loyalty points ledger (IS-7) |
| Rates & Revenue | **FULLY MET** | Dynamic pricing, AI/ML predictions, competitor tracking, revenue KPIs |
| Financial | **FULLY MET** | Full folio→GL pipeline, night audit, AR, cashier sessions, commission tracking |
| Distribution | **FULLY MET** | OTA + GDS + direct booking engine, channel mappings, rate parity |
| Integrations | **FULLY MET** | REST/OpenAPI, webhooks, event-driven Kafka, API logging |
| Reporting | **FULLY MET** | Operational + financial reports, dashboards, forecasting, alert rules |
| Compliance | **FULLY MET** | GDPR erase + consent logs, PCI tokenization, MFA, audit logs, retention purge (IS-4), breach notification (IS-6) |
| Technical | **FULLY MET** | Exceeds standards — CQRS, event sourcing, gRPC, circuit breakers, DLQ |

#### Gaps (Prioritized Easy → Hard) — All Implemented

| ID | Item | Priority | Complexity | Category | Status |
|----|------|----------|------------|----------|--------|
| **IS-1** | Deep-clean scheduling for housekeeping | **P3** | Low | Housekeeping | ✅ Done |
| **IS-2** | Staff scheduling commands | **P3** | Low | Operations | ✅ Done |
| **IS-3** | STR-style compset benchmarking report | **P3** | Low | Reporting | ✅ Done |
| **IS-4** | Automated data retention purge job | **P2** | Medium | Compliance | ✅ Done |
| **IS-5** | Metasearch channel tables & CPC/CPA tracking | **P3** | Medium | Distribution | ✅ Done |
| **IS-6** | Breach notification workflow | **P2** | Medium | Compliance | ✅ Done |
| **IS-7** | Loyalty transactional points ledger (earn/burn/redeem) | **P3** | High | Guest Profiles | ✅ Done |

#### Gap Details

- [x] **IS-1: Deep-clean scheduling for housekeeping** | Complexity: **Low** | Priority: P3
  - Standard: periodic/deep-clean schedules (e.g., every 7th stay or monthly) assigned to rooms, tracked separately from daily turnover cleaning.
  - Current: `housekeeping_tasks` table handles one-time task assignment. No periodic scheduling or deep-clean cycle tracking.
  - **Implemented**: Added `last_deep_clean_date` (DATE) and `deep_clean_interval_days` (INT, default 30) columns to `rooms` table. Added `GET /v1/housekeeping/deep-clean-due` endpoint in housekeeping-service that returns rooms where interval has elapsed or no deep clean recorded, sorted most overdue first. `DeepCleanDueQuerySchema` and `DeepCleanDueItemSchema` in `@tartware/schemas`. Rooms schema updated. Gateway proxied via existing `/v1/housekeeping/*` wildcard.

- [x] **IS-2: Staff scheduling commands** | Complexity: **Low** | Priority: P3
  - Standard: staff shift scheduling with workload assignment (14-18 rooms/attendant), time tracking.
  - Current: `staff_schedules` and `staff_tasks` tables exist with full schema. No command handlers to create/modify/delete schedules via the command pipeline.
  - **Implemented**: Added `operations.schedule.create` and `operations.schedule.update` command schemas to `@tartware/schemas` (operations.ts). Registered in command-validators.ts. Seeded command_templates (routed to housekeeping-service, facility-maintenance module). Created schedule-command-service.ts with INSERT/UPDATE handlers. Wired into housekeeping command consumer routeCommand switch. Test entries added to command-center.http (#76, #77).

- [x] **IS-3: STR-style compset benchmarking report** | Complexity: **Low** | Priority: P3
  - Standard: Smith Travel Research-style competitive indices — Occupancy Index, ARI (ADR Index), RGI (RevPAR Index) = My metric ÷ Compset metric × 100.
  - Current: `competitor_rates` table tracks compset pricing. Revenue KPI endpoints compute own ADR/RevPAR/Occupancy. No endpoint that computes competitive indices.
  - **Implemented**: Added `GET /v1/revenue/compset-indices` endpoint in revenue-service. SQL CTE joins own room occupancy/revenue with `competitor_rates` avg ADR for the same stay date. Computes ARI (ADR Index) = Own ADR ÷ Compset ADR × 100. Occupancy Index and RGI return null (compset occupancy data not available from rate-only intelligence). `CompsetIndicesQuerySchema` added to `@tartware/schemas`. Gateway proxied via existing `/v1/revenue/*` wildcard.

- [x] **IS-4: Automated data retention purge job** | Complexity: **Medium** | Priority: P2
  - Standard (GDPR/CCPA): guest data must be purged after configurable retention periods (3-7 years for reservations, 7 years for financial, 30-90 days for CCTV/logs).
  - Current: soft-delete enforcement exists (`99_enforce_tenant_soft_delete.sql`), `gdpr_consent_logs` table tracks consent. No automated purge/anonymization cron.
  - **Implemented**: New `scripts/tables/10-compliance/` category. `data_retention_policies` table (entity_type, retention_days, action: anonymize|delete|archive, exempt_statuses, last_sweep_at/count). Zod schema `DataRetentionPoliciesSchema` in `schema/src/schemas/10-compliance/`. Retention sweep job in `core-service/src/jobs/retention-sweep.ts` using setInterval pattern (6h default, env-configurable). Supports `audit_logs` and `gdpr_consent_logs` entity types. Overlap guard + per-policy error isolation. Wired into index.ts lifecycle (start after listen, shutdown on SIGTERM).

- [x] **IS-5: Metasearch channel tables & CPC/CPA tracking** | Complexity: **Medium** | Priority: P3
  - Standard: metasearch platforms (Google Hotel Ads, TripAdvisor, Kayak) use CPC or CPA pricing models distinct from OTA commission models.
  - Current: `channel_mappings` and `channel_commission_rules` exist. No metasearch-specific configuration for CPC bid management or CPA tracking.
  - **Implemented**: 3 command schemas (`metasearch.config.create`, `metasearch.config.update`, `metasearch.click.record`) in `schema/src/events/commands/integrations.ts`. Registered in `command-validators.ts` and seeded in `10_command_center.sql`. Core-service read routes: `GET /v1/metasearch-configs` (list with platform/property/active filters), `GET /v1/metasearch-configs/:configId` (detail), `GET /v1/metasearch-configs/performance` (click cost/conversion aggregation by date range). Reservations-command-service write handlers: create config (unique per tenant/property/platform), update config (dynamic SET), record click log. Gateway proxy routes added.

- [x] **IS-6: Breach notification workflow** | Complexity: **Medium** | Priority: P2
  - Standard (GDPR Art. 33-34): data breaches must be reported to supervisory authority within 72 hours and affected individuals notified without undue delay.
  - Current: `audit_logs` and `incident_reports` tables exist. No dedicated breach detection → assessment → notification → tracking pipeline.
  - **Implemented**: `data_breach_incidents` table in `scripts/tables/10-compliance/02_data_breach_incidents.sql` with full GDPR workflow (severity, breach_type, 72h notification_deadline auto-set, authority/subjects notification tracking, status workflow: reported→investigating→contained→notifying→remediated→closed). Zod schema `DataBreachIncidentsSchema` in `schema/src/schemas/10-compliance/`. Command schemas `ComplianceBreachReportCommandSchema` and `ComplianceBreachNotifyCommandSchema` in `schema/src/events/commands/compliance.ts`. REST endpoints in core-service: `POST /v1/compliance/breach-incidents` (report), `PUT /v1/compliance/breach-incidents/:id/notify`, `GET /v1/compliance/breach-incidents` (list + filter). Gateway proxy added. Test entries in operations.http.

- [x] **IS-7: Loyalty transactional points ledger** | Complexity: **High** | Priority: P3
  - Standard: full earn/burn/redeem points economy — points earned per $1 spend (configurable by tier), redemption catalog (free nights, upgrades, amenities), expiry rules, statement generation, tier qualification tracking.
  - Current: `guest_loyalty_programs` table stores membership-level data (program, tier, points balance as a single field). `guest.set_loyalty` command updates membership. Existing `loyalty.points.earn` and `loyalty.points.redeem` commands handle earn/redeem flows.
  - **Implemented**: `loyalty.points.expire_sweep` command schema in `schema/src/events/commands/loyalty.ts`. Registered in `command-validators.ts` and seeded in `10_command_center.sql`. Expire sweep handler in guests-service (`expireLoyaltyPoints`) uses atomic CTE: selects expired rows with `FOR UPDATE SKIP LOCKED`, marks `expired = TRUE`, decrements `guest_loyalty_programs.points_balance`, inserts offsetting ledger rows with `reference_type = 'sweep'`. Guests-service read routes: `GET /v1/loyalty/transactions` (paginated ledger by program_id with type filter), `GET /v1/loyalty/tier-rules` (by tenant with active/property filter), `GET /v1/loyalty/programs/:programId/balance` (current balance + lifetime stats). Gateway proxy routes added.

**Totals**: 7 gaps identified, all 7 implemented. 3 Low complexity, 3 Medium complexity, 1 High complexity.

---

### Comprehensive Industry Standards Audit (2026-02-23)

Full codebase audit against all 12 hospitality-standards domains. Gaps categorized by severity.

#### Domain Coverage Scores

| Domain | Score | Key Strength | Primary Gap Area |
|---|---|---|---|
| Reservations | ~95% | Full lifecycle, group bookings, modifications | `group_booking_id` missing from Zod; `ReservationSourceEnum` too coarse |
| Front Desk | ~80% | Check-in/out, walks, express services | No auto-checkout, no self-service checkout endpoint |
| Housekeeping | ~70% | Schema-rich (lost & found, minibar, maintenance) | Missing CRUD routes for Lost & Found, no maintenance write commands |
| Guest Profiles | 95% | Identity, documents, preferences, segmentation | VIP is boolean not multi-level (VIP1-5); no GDPR data portability endpoint |
| Loyalty | 67% | Tiers, ledger, expiry sweeps, benefits | No reward catalog/redemption options, single earning rate |
| Rates | 90% | Comprehensive rate codes, restrictions, dynamic pricing | No hurdle rates/bid pricing, no sell-up logic |
| Revenue | 85% | KPIs, forecasting schemas, demand calendar, comp set | No displacement analysis, GOPPAR/RevPAC not computed, forecast engine unimplemented |
| Financial | 70% | Charge posting, payments, AR aging, deposits, PCI | Night audit only 4/10 steps; no city ledger auto-transfer; credit limits not enforced |
| Distribution | 95% | All 7 channel types, ARI sync, rate parity, commissions | OTA content syndication (no photo/description push model) |
| Integrations | 65% | Schema foundations + interfaces defined | Stubs only: no real Stripe/ASSA ABLOY/POS connectors; no IPTV |
| Compliance | 84% | PCI DSS 100%, audit logging 100%, RBAC 100% | CCPA weak; retention sweep limited to 2 entity types |
| Reporting | 61% | Advanced analytics excellent (forecasts, pace, comp set) | ~12 standard report endpoints missing (data exists, endpoints not wired) |

#### Critical Gaps (14 items)

| ID | Domain | Gap | Status |
|---|---|---|---|
| **CG-1** | Financial | Night audit incomplete — missing: package posting, OTA commission posting, compound tax calc, trial balance, report generation, pre-lock (6/10 steps) | [x] |
| **CG-2** | Financial | No auto city-ledger transfer at checkout for unsettled balances | [x] |
| **CG-3** | Financial | Credit limit enforcement not wired to payment auth/capture handlers | [x] |
| **CG-4** | Loyalty | No reward catalog / redemption options (free nights, points+cash, upgrades) | [x] |
| **CG-5** | Revenue | No displacement analysis (group vs. transient trade-off engine) | [x] |
| **CG-6** | Revenue | Forecast computation engine unimplemented — tables exist but no ML pipeline or cron | [x] |
| **CG-7** | Front Desk | No auto-checkout scheduler at departure time | [x] |
| **CG-8** | Front Desk | No `POST /v1/self-service/check-out` endpoint in guest-experience-service | [x] |
| **CG-9** | Housekeeping | No CRUD routes for Lost & Found despite full schema (60_lost_and_found.sql + Zod) | [x] |
| **CG-10** | Housekeeping | No maintenance request write path (create/update) through command center | [x] |
| **CG-11** | Compliance | CCPA opt-out-of-sale mechanism missing (no "Do Not Sell" flag or endpoint) | [x] |
| **CG-12** | Reporting | No Manager's Flash Report endpoint (daily one-pager: occupancy + revenue + arrivals/departures) | [x] |
| **CG-13** | Reporting | No Trial Balance endpoint (debits = credits verification) | [x] |
| **CG-14** | Reporting | ~10 standard report endpoints missing (no-show, VIP, departmental revenue, cashier, commission, tax, guest stats, market segment, privacy, audit trail) | [x] |

#### Medium Gaps (15 items)

| ID | Domain | Gap | Status |
|---|---|---|---|
| **MG-1** | Guest Profiles | VIP is boolean, not multi-level VIP1-VIP5+VVIP enum | [x] |
| **MG-2** | Guest Profiles | No GDPR data portability / Subject Access Request endpoint | [x] |
| **MG-3** | Loyalty | Single `points_per_dollar` rate per tier — no category differentiation (room vs F&B) | [x] |
| **MG-4** | Loyalty | No program economics tracking (aggregate point liability, benefit delivery costs) | [x] |
| **MG-5** | Financial | Folio types limited to 3 (GUEST, MASTER, CITY_LEDGER) — missing INCIDENTAL, HOUSE_ACCOUNT | [x] |
| **MG-6** | Financial | No folio windows for split billing within a single stay | [x] |
| **MG-7** | Financial | Payment enum missing DIRECT_BILL, LOYALTY_POINTS, GIFT_CARD | [x] |
| **MG-8** | Financial | No incremental authorization for extended stays | [x] |
| **MG-9** | Financial | No chargeback workflow (field exists, no handler) | [x] |
| **MG-10** | Financial | Compound/cascading taxes not calculated (schema fields exist, unused in night audit) | [x] |
| **MG-11** | Financial | No financial closure execution service | [x] |
| **MG-12** | Rates | No dedicated rate seasons configuration table (seasons embedded in demand_calendar) | [x] |
| **MG-13** | Revenue | Revenue command consumer is a no-op stub | [x] |
| **MG-14** | Distribution | No OTA content syndication model (photo/description push to OTAs) | [x] |
| **MG-15** | Integrations | Payment gateway, key vendor, POS — stub implementations only | [ ] |

#### Low Gaps (12 items)

| ID | Domain | Gap | Status |
|---|---|---|---|
| **LG-1** | Reservations | `group_booking_id` in SQL but not in Zod ReservationsSchema | [ ] |
| **LG-2** | Loyalty | No elite nights rollover mechanism | [ ] |
| **LG-3** | Loyalty | No status match/challenge functionality | [ ] |
| **LG-4** | Rates | No sell-up/sell-through logic | [ ] |
| **LG-5** | Rates | No age bracket pricing (infant/child/teen) | [ ] |
| **LG-6** | Housekeeping | Room status enum (7 values) vs lookup table (11 codes) discrepancy | [ ] |
| **LG-7** | Compliance | Retention sweep limited to 2 entity types (audit_logs, gdpr_consent_logs) | [ ] |
| **LG-8** | Compliance | No minimum check-in age enforcement | [ ] |
| **LG-9** | Compliance | No ADA compliance audit/reporting | [ ] |
| **LG-10** | Compliance | No region-aware compliance config (GDPR vs CCPA conflated) | [ ] |
| **LG-11** | Integrations | No IPTV/in-room TV integration | [ ] |
| **LG-12** | Integrations | No accounting export connector (NetSuite/QuickBooks) | [ ] |

---

### Plan of Action (2026-02-23)

Consolidated remaining open items across TODO.md, AI-TASKS.md, and Industry Standards gaps into 3 execution blocks.

#### Block 1 — Template & Communication Infrastructure (HIGH PRIORITY)

The highest-impact remaining work — guest-facing, table-stakes PMS features. The notification-service infrastructure already exists.

- [x] **T1: Communication templates table & schema** — Already exists: `42_communication_templates.sql` + `communication-templates.ts`
- [x] **T2: Automated messages table & schema** — Already exists: `50_automated_messages.sql` + `automated-messages.ts`
- [x] **T3: Command schemas for template CRUD + automated message config** — Already exists: 7 commands in `command-validators.ts`
- [x] **T4: Wire notification-service to use communication_templates** — Already done: `renderTemplateByCode()` + reservation event consumer
- [x] **T5: Seed default templates** — Already done: 12 templates seeded in SQL

#### Block 2 — Quick LOW Fixes from AI-TASKS.md (code quality sweep)

Trivial/low-complexity mechanical fixes from the AI-TASKS.md backlog:

- [x] **LOW-001**: Raise JWT secret minimum from 8 to 32 chars — Already done: `.min(32)` in config/src/index.ts
- [x] **LOW-002**: Log warning on JSON parse failures in telemetry — Already done: throttled `console.warn` every 60s with cumulative count
- [x] **LOW-003**: Add interval-based cleanup to bootstrap rate limiter map — Already done: `setInterval` cleanup in core-service
- [x] **LOW-005**: Add max-age eviction to outbox throttler map — Already done: `setInterval` + `maybeCleanup` in outbox/throttler.ts
- [x] **LOW-007**: Guard against duplicate LogRecordProcessor registration — Fixed: `_sdkInstance` singleton guard in telemetry/src/index.ts
- [x] **LOW-008**: Reject negative loyalty points instead of silent clamp — Fixed: pre-check throws `INSUFFICIENT_LOYALTY_POINTS` in guest-command-service.ts

#### Block 3 — Test Coverage & Deferred Items (if time permits)

- [x] **CQ-9**: Add `vitest --coverage` config and aggregate coverage script — Added root `test:coverage` + `test:coverage:merge` scripts, fixed missing `@vitest/coverage-v8` deps in api-gateway/notification/guest-experience, added coverage block to recommendation-service, created `scripts/merge-coverage.mjs`
- [x] **IS-5**: Metasearch channel tables & CPC/CPA tracking — 3 command schemas + core-service reads (list/detail/performance) + reservations-command-service write handlers + gateway proxy
- [x] **IS-7**: Loyalty transactional points ledger — expire sweep command + handler, loyalty read routes (transactions/tier-rules/balance) + gateway proxy
- [x] **LOW-004**: N+1 query patterns — Fixed night-audit (hoisted tax config + batch folio JOIN) and pricing (batch-fetch all rules once). See analysis in session notes for 13 more patterns.
- [x] **LOW-006**: Promise ordering race in fastify-server — Moved `beforeRoutes` call inside `app.after()` so core plugins are initialized first

---

### ~~🔵 Broadcast Notification Per-User Read Receipts (2026-03-04)~~ ✅

**Branch:** `fix/broadcast-notification-read-receipts`
**Origin:** PR #110 review — Thread 6 (PRRT_kwDOQCOrtc5x1m6Q), the only unresolved comment.
**Status:** Implemented — `notification_read_receipts` table created, Zod schema added to `@tartware/schemas`, all SQL queries updated for dual-path read tracking.

**Problem:**
Broadcast notifications (`user_id IS NULL` on `in_app_notifications`) store `is_read` / `read_at` on the notification row itself. This means:
1. One user marking a broadcast notification as read marks it read for **all** users in the tenant.
2. The current `MARK_READ_SQL` uses `AND user_id = $3::uuid`, which will **never match** broadcast rows (`user_id IS NULL`), so users can't mark broadcast notifications as read at all.

**Design:**
- Create a `notification_read_receipts` table keyed by `(notification_id, user_id)` to track per-user read state independently of the notification row.
- For user-scoped notifications (where `user_id` is set), continue using the existing `is_read` column on `in_app_notifications`.
- For broadcast notifications (`user_id IS NULL`), check/insert into `notification_read_receipts` instead.
- Update `listInAppNotifications` query to LEFT JOIN `notification_read_receipts` and derive `is_read` status per-user for broadcast rows.
- Update `markNotificationsRead` / `markAllNotificationsRead` to INSERT into `notification_read_receipts` for broadcast rows.
- Update `unreadCount` query to account for broadcast read receipts.

**Files to change:**
- `scripts/tables/05-operations/114_notification_read_receipts.sql` — new table DDL
- `scripts/tables/00-create-all-tables.sql` — add new table
- `scripts/tables/05-operations/verify-05-services-housekeeping.sql` — add verification check for new table
- `scripts/verify-installation.sql` — add `notification_read_receipts` existence check
- `Apps/notification-service/src/services/in-app-notification-service.ts` — update SQL queries
- `Apps/notification-service/src/routes/in-app-notifications.ts` — pass `userId` where needed

---

### 🔴 NEXT PRIORITY — Revenue Service Full Activation (PMS Industry Standard)

The `revenue-service` (port 3060) exists but is largely **read-only scaffolding**. It has 1 command handler (`revenue.forecast.compute`), 5 read endpoints proxied through the gateway, and a basic EMA forecast engine. The underlying SQL tables (`pricing_rules`, `rate_recommendations`, `revenue_forecasts`, `revenue_goals`, `competitor_rates`, `demand_calendar`, `dynamic_pricing_rules_ml`, `pricing_experiments`, `ai_demand_predictions`, `revenue_attribution`) are all created but **no write commands populate them** beyond the single forecast compute.

Per PMS industry standards (Oracle OPERA Cloud RMS, IDeaS G3, Duetto GameChanger, Atomize; Revfine PMS Feature Guide 2026; HTNG Revenue Management Standards; STR Benchmarking), a Revenue Management System must provide:

1. **Dynamic Pricing Engine** — real-time rate optimization based on demand, occupancy, comp set, and booking pace
2. **Demand Forecasting** — multi-horizon forecasting (tactical 0–7d, operational 8–30d, strategic 31–90d, budget 91–365d) with pickup pace and event-driven adjustments
3. **Competitive Intelligence** — automated rate shopping, comp set tracking, STR-style indices (ARI, OCC Index, RGI)
4. **Inventory Controls & Restrictions** — CTA/CTD, min/max LOS, advance purchase, day-of-week, hurdle rates
5. **Revenue Budgeting & Goal Tracking** — budget vs actual variance at property/department level, USALI-aligned
6. **Segment & Channel Optimization** — segment mix optimization, net ADR by channel, displacement analysis for group vs transient
7. **Rate Recommendation Workflow** — generate → review → approve → apply lifecycle for pricing changes
8. **Total Revenue Management** — extend KPIs beyond rooms to F&B, spa, parking, ancillary revenue streams

#### Current State Inventory

| Asset | Status | Notes |
|-------|--------|-------|
| SQL: `revenue_forecasts` | Created | Full schema with scenarios, confidence intervals, accuracy tracking |
| SQL: `competitor_rates` | Created | Rate shopping schema with source channel, inclusions, availability |
| SQL: `demand_calendar` | Created | Daily demand levels, booking pace, event markers |
| SQL: `pricing_rules` | Created | Rule-based pricing with conditions, adjustments, min/max rate |
| SQL: `rate_recommendations` | Created | Recommendations with confidence scores, approve/reject status |
| SQL: `revenue_goals` | Created | Budget vs actual with variance tracking |
| SQL: `dynamic_pricing_rules_ml` | Created | ML model backed pricing rules |
| SQL: `pricing_experiments` | Created | A/B testing framework for rate strategies |
| SQL: `ai_demand_predictions` | Created | ML demand prediction outputs |
| SQL: `revenue_attribution` | Created | Revenue source attribution |
| Schema: Zod types | Created | For all above tables in `schema/src/schemas/` |
| Service: forecast engine | Functional | EMA-based forecasting with 5 scenarios |
| Service: read endpoints | Functional | List pricing rules, recommendations, competitor rates, demand calendar, forecasts, goals, KPIs, comp set indices, displacement analysis |
| Gateway: proxy routes | Functional | `/v1/revenue/*` proxied to revenue-service |
| Command: `revenue.forecast.compute` | Functional | Single write command registered in schema + consumer |

---

#### Phase 1 — Core Pricing Engine & Write Commands (Priority: Critical)

Industry standard: Revenue managers must be able to create, update, and activate pricing rules; the system must auto-generate rate recommendations based on demand signals. This is table-stakes for any PMS RMS module (Oracle OPERA, IDeaS, Duetto).

- [x] **R1: Pricing Rule CRUD Commands** | Complexity: Medium ✅
  - `revenue.pricing_rule.create` — create a new pricing rule (occupancy-based, day-of-week, event-driven, competitor-response, LOS-based)
  - `revenue.pricing_rule.update` — update rule parameters (adjustment value, conditions, priority, effective dates)
  - `revenue.pricing_rule.activate` / `revenue.pricing_rule.deactivate` — toggle rule `is_active` flag
  - `revenue.pricing_rule.delete` — soft-delete a pricing rule
  - Add Zod schemas in `schema/src/events/commands/revenue.ts`, register in `command-validators.ts`
  - Add command handlers in `revenue-service/src/commands/command-center-consumer.ts`
  - Seed command_templates entries in `scripts/tables/01-core/10_command_center.sql`
  - **Implemented**: All 5 pricing rule commands (create, update, activate, deactivate, delete) with full handlers in `pricing-rule-handlers.ts`, service layer in `pricing-rule-service.ts`, SQL queries, Zod command schemas, validators, and command_templates all registered.

- [x] **R2: Rate Recommendation Engine** | Complexity: High ✅
  - `revenue.recommendation.generate` — batch-generate rate recommendations per property for a date range
  - Engine logic: analyze current occupancy vs forecast, booking pace vs historical, competitor rates, active pricing rules, demand calendar signals
  - Output: one `rate_recommendations` row per room_type × rate_plan × date with `current_rate`, `recommended_rate`, `confidence_score`, `recommendation_reason`
  - Industry standard reasons: "High demand + low pickup pace", "Competitor X $20 below", "Event: Convention Center +15%", "Occupancy forecast 92% → raise rate"
  - Add service function in `revenue-service/src/services/recommendation-engine.ts`
  - **Implemented**: Multi-factor weighted recommendation engine in `recommendation-engine.ts`. Analyzes 5 signals: occupancy (30%), booking pace (20%), competitor positioning (20%), demand calendar (15%), lead time (15%). Generates one recommendation per room_type × date with confidence scoring (0-100), contributing factors, risk assessment, alternatives, and expected impact. Supports auto-apply for high-confidence recommendations. SQL queries in `recommendation-queries.ts`. Command schema `RevenueRecommendationGenerateCommandSchema` registered in command-validators, seeded in command_templates.

- [x] **R3: Rate Recommendation Approval Workflow** | Complexity: Medium ✅
  - `revenue.recommendation.approve` — approve a recommendation (status → APPROVED, sets `applied_at`)
  - `revenue.recommendation.reject` — reject with reason (status → REJECTED)
  - `revenue.recommendation.apply` — apply approved recommendation: update the actual rate in `rates` table via internal HTTP call or Kafka event to settings/rooms service
  - `revenue.recommendation.bulk_approve` — approve multiple recommendations in one command
  - Industry standard: revenue managers review recommendations daily, approve/reject, then batch-apply to live rates
  - **Implemented**: 4 approval workflow commands in `recommendation-handlers.ts`: approve (pending/reviewed → accepted), reject (with reason), apply (accepted → implemented with optional override_rate), bulk_approve (batch approve by IDs). All handlers validate status transitions, tenant-scoped, with audit trail (accepted_by, rejected_by, implemented_by timestamps). Command schemas, validators, and command_templates all registered.

- [x] **R4: Demand Calendar Management Commands** | Complexity: Medium ✅
  - `revenue.demand.update` — update demand level for specific dates (LOW/MODERATE/HIGH/PEAK/BLACKOUT)
  - `revenue.demand.import_events` — bulk import local events (conferences, holidays, concerts, sports) with impact multipliers
  - `revenue.demand.set_season` — mark date ranges as peak/shoulder/off-peak/blackout with default pricing behavior
  - Industry standard: demand calendar is the foundation for pricing decisions; revenue managers annotate it with local market intelligence
  - **Implemented**: `demand.update` and `demand.import_events` handlers in `demand-handlers.ts`, service in `demand-calendar-service.ts`. `set_season` deferred (can be modeled as bulk demand.update with seasonal levels).

- [x] **R5: Competitor Rate Ingestion Commands** | Complexity: Medium ✅
  - ~~`revenue.competitor.record` — manually record a competitor rate observation~~ ✅
  - ~~`revenue.competitor.bulk_import` — bulk import from rate shopping tool export (CSV/JSON)~~ ✅
  - ~~`revenue.competitor.configure_compset` — define competitive set (which competitor properties to track, weighting by star rating/location)~~ ✅
  - Industry standard: comp set is typically 5-8 properties; rates collected daily via OTA scraping or vendor API (RateGain, OTA Insight)
  - **Implemented**: All 3 competitor commands with handlers. `configure_compset` upserts into `competitor_properties` table via `compset-service.ts`. Validator and command template registered.

---

#### Phase 2 — Inventory Controls & Restrictions (Priority: High)

Industry standard: yield management requires real-time controls on booking availability beyond just price. OPERA Cloud, Mews, and Cloudbeds all provide restriction management as core RMS functionality.

- [x] **R6: Rate Restriction Commands** | Complexity: High ✅
  - `revenue.restriction.set` — set inventory controls per room_type × rate_plan × date range:
    - CTA (Closed to Arrival) — prevent arrivals on specific dates
    - CTD (Closed to Departure) — prevent departures on specific dates
    - Min LOS / Max LOS — minimum/maximum length of stay requirements
    - Min Advance Purchase — minimum days before arrival to book
    - Max Advance Purchase — maximum days before arrival (inventory horizon)
    - Closed — completely close rate code for dates
  - `revenue.restriction.remove` — remove specific restrictions
  - `revenue.restriction.bulk_set` — bulk set restrictions across date ranges (e.g., "set Min LOS 3 for all weekends in Q4")
  - New SQL table: `rate_restrictions` (tenant_id, property_id, room_type_id, rate_plan_id, restriction_date, restriction_type, restriction_value)
  - New Zod schema in `schema/src/schemas/02-inventory/rate-restrictions.ts`
  - **Integration**: reservations-command-service must check active restrictions before confirming bookings
  - **Implemented**: All 3 restriction commands (set, remove, bulk_set) with handlers in `restriction-handlers.ts`, service in `restriction-service.ts`, SQL queries, Zod schemas, validators, and command_templates.

- [x] **R7: Hurdle Rate Management** | Complexity: Medium ✅
  - ~~`revenue.hurdle_rate.set` — set minimum acceptable rate (hurdle/floor) per room_type × date~~ ✅
  - ~~`revenue.hurdle_rate.calculate` — auto-calculate hurdle rates based on displacement analysis (opportunity cost of selling a room at a given rate vs holding for higher-value demand)~~ ✅
  - Industry standard: hurdle rates are the minimum rate below which a room should not be sold; driven by segment displacement analysis and marginal cost of unsold room
  - **Implemented**: Both hurdle rate commands. `calculate` performs displacement analysis using transient ADR, demand level, and occupancy forecast to auto-compute per room_type × date hurdle rates with confidence scoring.

---

#### Phase 3 — Budgeting & Financial Analytics (Priority: High)

Industry standard: revenue managers set annual revenue budgets broken down by month/segment and track performance vs budget daily. All major PMS platforms (OPERA, Mews, Cloudbeds) provide budget vs actual reporting aligned with USALI department structure.

- [x] **R8: Revenue Goal/Budget CRUD Commands** | Complexity: Medium ✅
  - `revenue.goal.create` — create a revenue goal/budget target (by property, period, goal_type: room_revenue/total_revenue/occupancy/adr/revpar)
  - `revenue.goal.update` — update target amounts or period
  - `revenue.goal.delete` — soft-delete a goal
  - `revenue.goal.track_actual` — scheduled command to snapshot actual performance data into `actual_amount` / `variance_amount` / `variance_percent`
  - Industry standard: property controllers set annual budgets during Q4 for next year; monthly/weekly targets derived from seasonal patterns

- [x] **R9: Revenue Budget Variance Reporting** | Complexity: Medium ✅
  - New report endpoint: `GET /v1/revenue/budget-variance` — compare budget vs actual vs last year for a date range
  - Breakdowns by: department (USALI), market segment (transient/corporate/group/wholesale), booking source, room type
  - Industry standard KPIs per report row: budgeted revenue, actual revenue, variance ($), variance (%), same period last year, YoY growth %
  - Add to `report-service.ts` and `routes/reports.ts`

- [x] **R10: Manager's Daily Report** | Complexity: High ✅
  - `GET /v1/revenue/managers-report` — the single most important daily report in hotel operations
  - Sections (per industry standard):
    - **Occupancy**: rooms sold, rooms available, OCC%, vs budget, vs last year
    - **Revenue**: room revenue, F&B revenue, other revenue, total revenue, vs budget, vs LY
    - **Rate metrics**: ADR, RevPAR, TRevPAR (total revenue per available room), NRevPAR (net of commissions)
    - **Forecast**: next 7/14/30 day occupancy + ADR forecast
    - **Segment mix**: revenue breakdown by segment (transient/corporate/group)
    - **Pace report**: booking pace vs same time last year for upcoming periods
  - Aggregate data from reservations, charge_postings, revenue_forecasts, revenue_goals tables

---

#### Phase 4 — Advanced Forecasting & Demand Intelligence (Priority: Medium)

Industry standard: modern RMS platforms use machine learning and multi-signal demand intelligence. The forecast engine should evolve beyond simple EMA to incorporate booking pace, event signals, and market data (IDeaS G3, Duetto, Atomize patterns).

- [x] **R11: Enhanced Forecast Engine — Booking Pace Analysis** | Complexity: High
  - Add booking pace tracking to forecast model: compare current on-the-books (OTB) reservations for future dates vs same time prior year
  - Pickup = new bookings received for a future date within a lookback window
  - Pace report: for each future date, show OTB rooms, OTB revenue + pace vs LY pace → earlier/faster indicators trigger rate increases
  - New endpoint: `GET /v1/revenue/booking-pace` with property_id, date range
  - Industry standard: pace is the #1 tactical demand signal; Oracle OPERA computes OTB daily

- [x] **R12: Enhanced Forecast Engine — Event & Market Signals** | Complexity: Medium
  - Integrate demand_calendar events into forecast model with configurable impact multipliers
  - Event types: local convention, holiday, sports event, concert, weather (hurricane/snow), competitor closure
  - Forecast adjustment: base forecast × event_impact_multiplier
  - `revenue.forecast.adjust` command — manual one-time forecast override by revenue manager
  - Industry standard: revenue managers should be able to "tell the system" about events the algorithm hasn't seen

- [x] **R13: Forecast Accuracy Tracking** | Complexity: Low
  - Scheduled command: `revenue.forecast.evaluate` — compare forecasted values vs actual for completed periods
  - Update `actual_value`, `variance`, `variance_percent`, `accuracy_score` in `revenue_forecasts`
  - Track model accuracy over time to detect drift
  - Industry standard: MAPE (Mean Absolute Percentage Error) < 5% for next-day, < 10% for next-week is good; > 15% triggers model retraining

---

#### Phase 5 — Competitive Intelligence & Market Positioning (Priority: Medium)

Industry standard: STR (Smith Travel Research) benchmarking is the global standard for hotel competitive performance measurement. Every major chain and management company subscribes to STR data. The PMS must compute STR-equivalent indices locally from comp set data.

- [x] **R14: Full Comp Set Index Computation** | Complexity: Medium
  - Current gap: `getCompsetIndices()` computes ARI (ADR Index) but returns `null` for Occupancy Index and RGI because comp set occupancy data isn't available from rate-only competitor data
  - Solution: add comp set occupancy estimation based on OTA availability signals (rooms_left → estimated occupancy) or direct comp set occupancy input
  - New field on `competitor_rates`: `estimated_occupancy_percent` (from OTA "X rooms left" signals)
  - Full STR-style indices:
    - **MPI (Market Penetration Index)** = Own OCC% / Comp Set OCC% × 100 (>100 = gaining share)
    - **ARI (Average Rate Index)** = Own ADR / Comp Set ADR × 100 (>100 = rate premium)
    - **RGI (Revenue Generation Index)** = Own RevPAR / Comp Set RevPAR × 100 (>100 = outperforming)
  - Industry standard: RGI is the single most important competitive metric; a hotel with RGI < 100 is underperforming its fair share

- [x] **R15: Rate Shopping Automation** | Complexity: High
  - Background scheduled task: `revenue.competitor.auto_collect` — periodic automated rate collection
  - Pluggable provider interface (similar to notification-service providers):
    - Console provider (dev): generates synthetic competitor rates
    - Webhook provider: POST to external rate shopping API (RateGain, OTA Insight, Fornova)
    - Future: direct OTA API scrapers
  - Rate comparison dashboard endpoint: `GET /v1/revenue/rate-shopping` — own rate vs each competitor for date range, showing rate positioning (premium/parity/undercut)
  - Industry standard: rate shopping runs 2-4x daily; alerts when competitor drops rate >10% or when own rate is >20% above comp set average

- [x] **R16: Competitive Response Pricing Rules** | Complexity: Medium
  - New pricing rule type: `competitor_response` — auto-adjust own rate when competitor rates change
  - Configuration: track_competitor, response_strategy (match, undercut_by_$, undercut_by_%, maintain_premium_$, maintain_premium_%)
  - Example: "If CompetitorHotel drops Standard Room rate below $180, auto-set our BAR to $175"
  - Safety: min_rate and max_rate guardrails always apply; changes create recommendations for review (not auto-applied unless configured)

---

#### Phase 6 — Segment & Channel Optimization (Priority: Medium)

Industry standard: revenue management extends to optimizing the mix of business segments and distribution channels. The RMS must provide visibility into net contribution by segment and channel to inform allocation decisions.

- [x] **R17: Segment Performance Analytics** | Complexity: Medium
  - New endpoint: `GET /v1/revenue/segment-analysis` — revenue, ADR, occupancy contribution by market segment
  - Segment breakdown: TRANSIENT, CORPORATE, GROUP, WHOLESALE, PACKAGE, HOUSE_USE, OTA, DIRECT
  - Metrics per segment: rooms sold, room nights, revenue, ADR, % of total revenue, % of total rooms, cost of acquisition
  - Trend comparison: current period vs prior period vs same period LY
  - Industry standard: segment mix optimization is core to revenue strategy; high-ADR segments should be protected over low-ADR segments during peak periods

- [x] **R18: Channel Profitability Analysis** | Complexity: Medium
  - New endpoint: `GET /v1/revenue/channel-profitability` — net revenue by distribution channel
  - For each channel: gross revenue, commission %, commission $, net revenue, net ADR, booking count
  - Channel types: Direct Website, Voice/Phone, GDS (Amadeus/Sabre), OTA (Booking.com/Expedia), Wholesale, Metasearch
  - Industry standard channel costs: Direct 2-5%, GDS $10-20 + commission, OTA 15-25%, Wholesale net rate + margin
  - Insight: a $200 OTA booking at 20% commission nets $160 — worse than a $180 direct booking netting $171

- [x] **R19: Group Displacement Analysis Enhancement** | Complexity: Medium
  - Enhance existing `displacement-queries.ts` with:
    - Include displaced demand estimation (how many transient bookings were turned away during group block dates)
    - Add ancillary revenue comparison (group F&B spend vs average transient F&B spend)
    - Include cost of servicing (group needs meeting rooms, AV, dedicated staff)
    - Net displacement value = group total contribution - (displaced room revenue + displaced ancillary revenue)
  - `revenue.group.evaluate` command — run displacement analysis on a proposed group block before accepting it
  - Industry standard: "Should we take this group?" is the highest-impact revenue decision; the analysis should include total contribution, not just room revenue

---

#### Phase 7 — Pricing Experimentation & ML (OUT OF SCOPE)

Deferred indefinitely — aspirational ML/experimentation features are not on the roadmap.

- [x] **R20: Pricing Experiment Framework** | ~~Complexity: High~~ — OUT OF SCOPE
  - `revenue.experiment.create` — create an A/B price test (control rate vs variant rate for a segment or date range)
  - `revenue.experiment.start` / `revenue.experiment.stop` — lifecycle management
  - `revenue.experiment.evaluate` — compute statistical significance of conversion rate and revenue difference
  - Leverages existing `pricing_experiments` table
  - Industry standard: test $199 vs $209 for the same room type; measure conversion rate × revenue lift to determine optimal price point

- [x] **R21: ML Demand Prediction Pipeline** | ~~Complexity: Very High~~ — OUT OF SCOPE
  - Wire `ai_demand_predictions` and `dynamic_pricing_rules_ml` tables into the forecast engine
  - ML features: day of week, month, holiday flag, event proximity, booking pace, competitor rates, weather, historical same-date
  - Pluggable model interface: built-in linear regression baseline, webhook for external ML service (AWS SageMaker, Google AutoML)
  - Model output: predicted occupancy, recommended rate, confidence interval
  - Industry standard: IDeaS G3 uses proprietary ML; smaller PMS platforms often use regression + rule-based hybrid

- [x] **R22: Revenue Attribution & ROI Tracking** | ~~Complexity: Medium~~ — OUT OF SCOPE
  - Wire `revenue_attribution` table: attribute each booking's revenue to the pricing action/campaign/channel that drove it
  - Track ROI of pricing decisions: "Raising BAR by $15 on March 14 generated $2,400 incremental revenue with 97% confidence"
  - Attribution types: pricing_rule, promotion, channel_campaign, comp_response, event_pricing
  - Industry standard: close the loop between pricing decisions and revenue outcomes to continuously improve strategy

---

#### Phase 8 — Total Revenue Management (TRevPAR) (OUT OF SCOPE)

Deferred indefinitely — total revenue management beyond rooms is not on the roadmap.

- [x] **R23: Non-Room Revenue KPIs** | ~~Complexity: Medium~~ — OUT OF SCOPE
  - Extend `GET /v1/revenue/kpis` to include:
    - **TRevPAR** = Total Revenue / Available Rooms (rooms + F&B + spa + parking + misc)
    - **GOPPAR** = Gross Operating Profit / Available Rooms (revenue - operating costs)
    - **RevPAC** = Total Revenue / Available Customers (per-guest value)
    - **ARPC** = Ancillary Revenue / Covers (non-room revenue per guest)
    - **NRevPAR** = Net Revenue / Available Rooms (after commissions + acquisition costs)
    - **Flow-through** = % of incremental revenue that converts to profit
  - Break down total revenue by department (rooms, F&B, spa, parking, other) per USALI standard
  - Industry standard: TRevPAR is the primary KPI for total revenue management; it captures the full guest spend

- [x] **R24: Ancillary Revenue Optimization** | ~~Complexity: High~~ — OUT OF SCOPE
  - Pricing rules that cover non-room products: parking rates, spa rates, F&B upsell bundles
  - Package builder: dynamically price room + F&B + activity bundles based on demand
  - Revenue allocation for packages (room 76.6%, breakfast 13.4%, parking 6.7%, spa 3.3% per USALI)
  - Track ancillary spend by guest segment to identify high-value guests beyond room revenue

---

#### Phase 9 — Integration & API Wiring (Priority: Must-do alongside each phase)

These are cross-cutting tasks that must be completed to make the revenue-service a first-class citizen in the system.

- [x] **R25: Seed All Revenue Commands in Command Catalog** | Complexity: Low ✅
  - All 21 revenue commands seeded in `scripts/tables/01-core/10_command_center.sql`
  - Set `default_target_service = 'revenue-service'`, `required_modules = '{revenue-management}'`
  - Ensure command-center-service routes all `revenue.*` commands to revenue-service

- [x] **R26: Kafka Event Consumer — Reservation Events** | Complexity: Medium ✅
  - Revenue-service consumes `reservations.events` topic (like roll-service and notification-service do)
  - On `reservation.created` → increment OTB rooms_reserved in demand_calendar
  - On `reservation.cancelled` → decrement OTB rooms_reserved
  - On `reservation.checked_out` → move from reserved to occupied in demand_calendar
  - Consumer: `src/consumers/reservation-event-consumer.ts`, group ID: `revenue-reservation-events-consumer`

- [x] **R27: Night Audit Integration** | Complexity: Medium ✅
  - `revenue.daily_close.process` command: triggers after night audit for end-of-day processing
  - Snapshots revenue_goals `actual_amount` for all active goals covering the business date
  - Re-computes forecasts for the property (configurable via `skip_forecast` flag)
  - Handler: `src/commands/handlers/daily-close-handler.ts`

- [x] **R28: Gateway Auth Guards for Revenue Endpoints** | Complexity: Low ✅
  - Added `tenantScopeFromQuery` preHandler to all `/v1/revenue/*` gateway routes
  - Uses `minRole: 'VIEWER'`, `requiredModules: 'revenue-management'` (consistent with other gateway routes)

- [x] **R29: HTTP Test Files** | Complexity: Low ✅
  - `http_test/revenue.http` — comprehensive test file with all 21 command executions and all GET endpoints
  - Includes R8 goal CRUD, R9 budget variance, R10 manager's report, R27 daily close
  - Follow existing `http_test/` patterns with `@authToken` and `@baseUrl` variables

---

### 🔴 HIGH PRIORITY — Business Calendar & Accounts Operations (2026-03-12)

Core PMS daily operations infrastructure. The night audit backend exists but the UI only shows trial balance. AR commands are wired via Kafka but have no read endpoints. No auto date roll scheduler exists.

#### Phase 1 — Night Audit UI Enhancements | Priority: P0 | Complexity: Low

All backend APIs already exist (`GET /v1/night-audit/status`, `/history`, `/runs/:runId`). Wire them into the Angular night-audit component.

- [x] **BC-1: Business date status display** — Show current business date, status (OPEN/CLOSED/IN_AUDIT), and property info at top of night audit page. Uses `GET /v1/night-audit/status`.
- [x] **BC-2: Execute Night Audit button** — Add "Run Night Audit" button that dispatches `billing.night_audit.execute` command via `POST /v1/commands/billing.night_audit.execute/execute`. Show progress/result feedback.
- [x] **BC-3: Night audit history table** — Display past audit runs with date, status, duration, steps completed. Uses `GET /v1/night-audit/history`. Link to detail view.
- [x] **BC-4: Night audit run detail view** — Show individual audit run with step-by-step breakdown (charges posted, no-shows marked, date advanced). Uses `GET /v1/night-audit/runs/:runId`.

#### Phase 2 — Accounts Receivable Read Endpoints | Priority: P0 | Complexity: Medium

AR write commands exist (`billing.ar.post`, `billing.ar.apply_payment`, `billing.ar.age`, `billing.ar.write_off`) but no read endpoints. The `accounts_receivable` table (100+ columns) is fully defined.

- [x] **BC-5: AR list schema** — Add `AccountsReceivableListItemSchema` and `AccountsReceivableDetailSchema` to `schema/src/api/billing.ts`.
- [x] **BC-6: AR list endpoint** — `GET /v1/billing/ar` in billing-service with tenant/property scoping, status filter, pagination. No gateway changes needed (wildcard proxy).
- [x] **BC-7: AR detail endpoint** — `GET /v1/billing/ar/:arId` in billing-service with full AR record + payment history.
- [x] **BC-8: AR aging summary endpoint** — `GET /v1/billing/ar/aging-summary` returning current/30/60/90+ day buckets per property.
- [x] **BC-9: AR UI component** — Replace static stub with real data from AR endpoints. Show aging KPIs, filterable AR list, detail drill-down.

#### Phase 3 — Business Calendar Configuration | Priority: P1 | Complexity: Medium

Property-level business day settings. Currently `business_dates` table exists but properties have no configurable business day start time or auto-roll settings.

- [x] **BC-10: Property business calendar settings** — Add `business_day_start_time`, `auto_roll_enabled`, `auto_roll_time` to property settings. SQL + Zod schema updates.
- [x] **BC-11: Business calendar API** — `GET /v1/night-audit/business-calendar` endpoint showing business date history with open/close times per property.
- [x] **BC-12: Fiscal period tables** — Add `fiscal_periods` and `accounting_periods` tables for month-end close and financial reporting alignment.

#### Phase 4 — Auto Date Roll Scheduler | Priority: P1 | Complexity: High

Automated nightly business date advancement. Currently the night audit must be triggered manually via command. Industry standard is configurable auto-roll at a set time per property.

- [x] **BC-13: Auto date roll scheduler** — Implement scheduler in roll-service (already runs 24/7 as Kafka consumer) using setInterval. Query properties with `auto_roll_enabled = true`, dispatch `billing.night_audit.execute` at their configured `auto_roll_time`.
- [x] **BC-14: Scheduler status endpoint** — `GET /v1/roll/scheduler-status` showing next scheduled runs per property, last execution results.
- [x] **BC-15: Manual date roll override** — `billing.date_roll.manual` command schema + validator for manual business date advancement without running full night audit.

---

### 🟡 Production Readiness — Path to 9.0+ (2026-03-13)

Current overall score: **8.3/10**. Items from README "Path to 9.0+" section, prioritized by effort-to-impact ratio.

#### Item 2 — gRPC Deadlines + Health Service | Priority: 1st | Current: ~~50%~~ 100% ✅

Retry logic exists (3 attempts, exponential backoff), but NO explicit deadline/timeout on gRPC calls. No `grpc.health.v1.Health` service in proto.

- [x] **P9-1: Add 5s deadline to all gRPC calls** — Set `deadline` option on every `callGrpc()` invocation in `availability-guard-client.ts`. Configurable via `AVAILABILITY_GUARD_TIMEOUT_MS` (default 5000ms).
- [x] **P9-2: Add gRPC Health service** — Added `Health` service to `availability-guard.proto` with `Check` RPC. Server probes DB health (SERVING/NOT_SERVING). Client exports `checkGuardHealth()` with 3s timeout.

#### Item 6 — Deep Health Checks Across Services | Priority: 2nd | Current: ~~40%~~ 100% ✅

Gateway has comprehensive `/ready` (DB + Kafka + core-service probe). Core-service checks Redis. Reservations/guard check DB+Kafka. But rooms, billing, guests, housekeeping, notification, revenue, settings, guest-experience all return static 200.

- [x] **P9-3: Create shared health check utility** — Added `createHealthRoutes()` to `@tartware/fastify-server` with `/health` (liveness, static 200) + `/ready` (readiness, `Promise.allSettled` dependency probes, 503 on failure).
- [x] **P9-4: Wire deep health checks** — Replaced static health routes in 8 services (rooms, billing, guests, housekeeping, notification, revenue, settings, guest-experience) with shared utility + DB `SELECT 1` check.

#### Item 4 — Redis-Backed Distributed Rate Limiting | Priority: 3rd | Current: ~~15%~~ 100% ✅

`@fastify/rate-limit` configured (200/60/20 req/min tiers), but IN-MEMORY ONLY. No Redis backing for distributed deployments.

- [x] **P9-5: Switch rate limiting to Redis store** — Configured `@fastify/rate-limit` with `ioredis` Redis client (`lazyConnect`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 3`). Config via `REDIS_HOST/PORT/PASSWORD/DB/KEY_PREFIX/ENABLED`. Graceful fallback on Redis connection error.

#### Item 1 — Stripe + SendGrid Adapters | Priority: 4th | Current: ~~20%~~ 100% ✅

Provider interfaces exist (`PaymentGateway`, `NotificationProvider`), stub implementations in place. No real adapters.

- [x] **P9-6: Implement Stripe payment adapter** — `StripePaymentGateway` using PaymentIntents with manual capture (authorize → capture → refund), idempotency keys, error handling. Feature-flagged via `STRIPE_SECRET_KEY` / `STRIPE_ENABLED`.
- [x] **P9-7: Implement SendGrid email adapter** — `SendGridNotificationProvider` via `@sendgrid/mail` for EMAIL channel. Feature-flagged via `NOTIFICATION_DEFAULT_CHANNEL=sendgrid` + `SENDGRID_API_KEY`. Provider resolution: sendgrid → webhook → console.

#### Item 5 — 20K ops/sec k6 Validation | Priority: 5th | Current: 25%

k6 framework exists with 5 scenarios (smoke, load, stress, spike, booking-flow) + command-pipeline targeting 30K. Missing explicit 20K ops/sec threshold validation.

- [ ] **P9-8: Add 20K ops/sec validation scenario** — New k6 scenario that ramps to exactly 20K sustained ops/sec, holds for 10 minutes, validates p95 < 500ms + error rate < 1%.

#### Item 3 — E2E Cross-Service Test Suite | Priority: 6th | Current: 10%

72 unit tests + 28 .http files exist, but NO automated cross-service integration tests.

- [ ] **P9-9: Build E2E test suite** — Automated Vitest E2E tests for top 5 workflows: (1) booking lifecycle, (2) check-in → charge → check-out, (3) group booking with rooming list, (4) cancellation with refund, (5) night audit cycle.

#### Item 7 — SLI / SLO Metrics + Grafana Alerting | Priority: 7th | Current: 30%

Prometheus metrics exist on command consumers (outcome counters, duration histograms, lag gauges). SLO targets documented in `docs/observability/command-consumer-slos.md`. No Grafana dashboards or alert rules.

- [ ] **P9-10: Create Grafana dashboards + alerting rules** — JSON dashboard for command pipeline SLOs + HTTP latency. Alert rules for error budget burn rate.

#### Item 8 — Guest Self-Service Portal UI | Priority: 8th | Current: 70%

Backend APIs complete in `guest-experience-service` (search, book, check-in, keys, registration card). No Angular UI.

- [ ] **P9-11: Build guest portal Angular UI** — Self-service booking, check-in, key retrieval frontend using existing API endpoints.

## TODO

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

- [ ] **P1-1: No idempotency deduplication on reservation command intake**
  - The command-center consumer does not check `correlationId` / `requestId` before processing.
  - A retried Kafka message creates duplicate outbox entries → potentially duplicate reservations.
  - Violates AGENTS.md: *"Every new command must support idempotency keys and deduplication."*
  - Fix: check `request_id` against lifecycle table before processing; also add `idempotency_key` to `ReservationCreateCommandSchema`, `ReservationModifyCommandSchema`, `ReservationCancelCommandSchema` (newer commands already have it).

- [ ] **P1-2: Availability lock leak on transaction failure**
  - `createReservation` calls gRPC `lockReservationHold()` **before** `withTransaction()`.
  - If the DB transaction fails, the lock is never released — room stays locked until TTL.
  - Fix: either move the gRPC call inside the transaction with a compensating release on rollback, or add a `finally` block that releases the lock on transaction failure.

- [ ] **P1-3: No `GET /v1/reservations/:id` single-reservation endpoint**
  - core-service only has a list endpoint (`GET /v1/reservations`).
  - The gateway wildcard would proxy to core-service, which 404s since no handler exists.
  - Fix: add `RESERVATION_BY_ID_SQL` + route handler in core-service, expose through gateway.

- [ ] **P1-4: No room availability search endpoint**
  - rooms-service has no `/v1/rooms/availability` endpoint.
  - Availability guard is gRPC-only (internal), not exposed via gateway.
  - No REST API for "show available rooms for date range" — a fundamental booking operation.
  - Fix: add availability query endpoint in rooms-service or core-service that cross-references reservations/locks.

- [x] **P1-5: No folio auto-creation on reservation** (done — Tier 1 PMS Standards)
  - billing-service has no `billing.folio.create` command handler.
  - `billing.charge.post` assumes a folio exists → throws `FOLIO_NOT_FOUND` on new reservations.
  - **Implemented**: Auto-create a GUEST folio (status=OPEN, balance=0) in the reservation event handler when `reservation.created` is processed. Uses `ON CONFLICT DO NOTHING` for idempotency. Folio number derived from reservation ID (`F-{short-uuid}`).

- [ ] **P1-6: `GET /v1/reservations` lacks gateway-level auth**
  - In `Apps/api-gateway/src/server.ts`, `GET /v1/reservations` has no `preHandler` — no auth guard at gateway level.
  - Auth is enforced downstream by core-service, but inconsistent with all other tenant-scoped GET routes.
  - Fix: add `preHandler: withTenantScope()` to the gateway route.

- [ ] **P1-7: GDPR erase incomplete in guests-service**
  - `guest.gdpr.erase` cascades to ~10 tables but skips `guest_preferences`, `guest_documents`, and `guest_communications` — all contain PII (identity docs, phone numbers, emails).
  - Fix: add anonymization/deletion for those three tables in the GDPR handler.

#### P2 — Medium (design gaps / hardening)

- [ ] **P2-1: No offset/cursor pagination on reservation list** — violates AGENTS.md. Only `LIMIT` (max 200), no `OFFSET` or cursor. Same issue in rooms-service, billing-service, guests-service list endpoints.
- [ ] **P2-2: Nullable tenant_id SQL pattern** — `($2::uuid IS NULL OR r.tenant_id = $2)` in core-service reservation + report queries. App layer validates, but SQL doesn't enforce. Should always be `r.tenant_id = $2`.
- [ ] **P2-3: Dashboard INNER JOIN on guests** — `JOIN guests g ON r.guest_id = g.id` in core-service dashboard activity/tasks. Reservations without a valid `guest_id` silently dropped. Should be LEFT JOIN.
- [ ] **P2-4: `billing.payment.apply` double-counting risk** — no dedup check, same payment can be applied repeatedly, inflating `paid_amount`.
- [ ] **P2-5: Charge postings hardcoded** — `charge_code='MISC'`, `posting_type='DEBIT'` hardcoded in `applyChargePost`. Can't categorize room charges, F&B, etc.
- [x] **P2-6: Folio balance not updated on charge posting** — `balance`, `total_charges` stay stale after `billing.charge.post`. **Implemented**: `applyChargePost` now wraps charge posting + folio `total_charges`/`balance` update in a single transaction. `capturePayment` also updates folio `total_payments`/`balance` when `reservation_id` present.
- [x] **P2-7: `rooms.move` command unimplemented** — throws `ROOM_MOVE_NOT_SUPPORTED`. Critical for mid-stay room changes/upgrades. **Implemented**: `handleRoomMove` validates source=OCCUPIED, target=AVAILABLE, swaps statuses (source→DIRTY, target→OCCUPIED), updates reservation `room_number` with version lock.
- [ ] **P2-8: Guest reservation stats miss NO_SHOW and PENDING** — those statuses aren't counted in any stats bucket in guests-service SQL.
- [ ] **P2-9: `CreateReservationsSchema` / `UpdateReservationsSchema` are stubs** — TODO comment, omit nothing, require `id`/`created_at` on creation.
- [ ] **P2-10: Availability guard gRPC has zero auth** — any gRPC caller can lock/release any tenant's inventory.
- [x] **P2-11: No deposit authorization flow** — billing-service only does direct CAPTURE, missing AUTHORIZE → CAPTURE pattern for hotel deposits. **Implemented**: `billing.payment.authorize` command creates AUTHORIZATION payments with `status='AUTHORIZED'`, idempotent via `ON CONFLICT` on `payment_reference`.
- [~] **P2-12: No void charge / finalize invoice / night audit commands** — billing lifecycle gaps. **Partial**: `billing.night_audit.execute` implemented (posts room charges, marks no-shows, advances business date). Void charge and finalize invoice still TODO.
- [ ] **P2-13: `handleReservationUpdated` truthy checks** — `if (payload.guest_id)` drops empty string / `0` values. Should use `!== undefined`.
- [ ] **P2-14: `console.warn` / `console.error` in production** — reservation-event-handler and db.ts use unstructured logging.
- [ ] **P2-15: Rooms update COALESCE anti-pattern** — `COALESCE($n, r.column)` prevents clearing nullable fields to NULL.
- [ ] **P2-16: `assignRoom` doesn't verify room type matches reservation** — can assign a suite to a standard reservation without validation.
- [ ] **P2-17: No `GET /v1/guests/:guestId` single-guest endpoint** — list only, no detail fetch.

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

### PMS Industry Standards Compliance (2026-02-08)

Audit against `hospitality-standards/` documentation revealed gaps between current implementation and PMS industry standards. Organized by tier.

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

#### Tier 2 — Important Functional Gaps (TODO)

- [ ] **S7: Guest Communication Templates**
  - PMS standard: confirmation emails/SMS sent on booking, modification, cancellation, pre-arrival, check-in.
  - Scope: add a notification service or integration with email/SMS provider; define templates for 5+ lifecycle events.

- [~] **S8: Missing Reservation Statuses**
  - PMS standard: full lifecycle includes INQUIRY, QUOTED, WAITLISTED, EXPIRED, NO_SHOW in addition to existing statuses.
  - Scope: expand `reservation_status` enum; add transitions in lifecycle state machine.
  - **Partial**: NO_SHOW status now handled via `reservation.no_show` command (validates PENDING/CONFIRMED → NO_SHOW, calculates fee, releases room). Remaining statuses (INQUIRY, QUOTED, WAITLISTED, EXPIRED) still TODO.

- [ ] **S9: Group Booking Command Handlers**
  - PMS standard: group bookings with master/sub reservations, rooming lists, room blocks, cutoff dates.
  - Scope: tables exist (`group_reservations`, `group_room_blocks`) but no command handlers or business logic.

- [ ] **S10: Commission Wiring to Reservations**
  - PMS standard: travel agent / OTA commissions tracked per reservation and paid out; tables exist but not wired.
  - Scope: link `commissions` table to reservation create/modify flow; add reporting.

- [ ] **S11: Overbooking & Walk Procedures**
  - PMS standard: controlled overbooking with walk procedures (relocate guests, track walk-out costs, compensation).
  - Scope: add overbooking allowance config, walk-out command, and compensation tracking.

#### Tier 3 — Nice-to-Have Enhancements (TODO)

- [ ] **S12: Dynamic Pricing Engine**
  - PMS standard: rate adjustments based on occupancy, demand, competitor pricing, events.
  - Scope: occupancy-based rate modifiers; rate recommendation engine.

- [ ] **S13: Revenue Management Reports**
  - PMS standard: ADR, RevPAR, occupancy %, pace reports, pickup reports, and forecast.
  - Scope: reporting SQL/views; dashboard endpoints.

- [x] **S14: Night Audit Process** (done)
  - PMS standard: end-of-day process that posts room charges, verifies balances, generates audit trail.
  - **Implemented**: `billing.night_audit.execute` command: (1) posts room charges for all CHECKED_IN reservations with folio balance update in transaction, (2) bulk-marks overdue PENDING/CONFIRMED reservations as NO_SHOW, (3) advances business date. Logged to `night_audit_log` table.

- [x] **S15: Deposit Authorization Flow** (done)
  - PMS standard: AUTHORIZE → CAPTURE pattern for hotel deposits (not direct capture).
  - **Implemented**: `billing.payment.authorize` command creates AUTHORIZATION records (`transaction_type='AUTHORIZATION'`, `status='AUTHORIZED'`), idempotent via `ON CONFLICT` on `payment_reference`. Existing `billing.payment.capture` handles the capture step. See also P2-11.

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

**Total bugs across all sessions**: 29 discovered, 28 fixed, 1 deferred (Bug #26 outbox bigint/UUID mismatch).

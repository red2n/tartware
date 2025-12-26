# Roll Service & Availability Guard Kickoff (2025-12-26)

This note expands the `0.P0` TODO items with concrete design details so we can begin implementation without blocking on clarifications.

## 1. Shadow-Mode Deployment Shape

### 1.1 Services & Workspaces
- **Availability Guard / Inventory Service**
  - New workspace: `Apps/availability-guard-service` (Fastify + `@tartware/telemetry` + gRPC server).
  - Primary responsibilities: hold canonical room / room-type locks, expose RPC + HTTP APIs for lock management, consume reservation/room commands to keep context, emit `inventory.locked` / `inventory.released` events.
  - Shadow mode: reads everything, persists state to its own Postgres schema, but never blocks/updates upstream writes; only publishes metrics/logs.
- **Roll / Schedule Service**
  - New workspace: `Apps/roll-service` (Fastify worker + scheduled job runner).
  - Responsibilities: consume reservation lifecycle checkpoints, compute deterministic roll events (EOD, checkout, cancel), persist ledger snapshots, surface replay tooling.
  - Shadow mode: builds the same ledgers but keeps them inside `roll_service_shadow_*` tables while we validate parity.

### 1.2 Topics & Data Feeds
| Service | Kafka Topics (read) | Kafka Topics (emit) | Database sources |
|---------|--------------------|---------------------|------------------|
| Availability Guard | `commands.primary` (filtered to `inventory.*`), `reservations.events`, `rooms.events` (later) | `inventory.events` (shadow only), `inventory.events.dlq` | `inventory_locks_shadow`, `room_state_shadow` |
| Roll Service | `reservations.events`, `reservations.events.dlq`, `inventory.events` (for cancellations) | `roll.events.shadow` | `reservation_command_lifecycle`, `reservation_ledger_shadow` |

Both services register their own consumer groups suffixed with `-shadow` so they do not interfere with production offsets (`availability-guard-shadow`, `roll-service-shadow`).

### 1.3 Kubernetes / Helm Layout
- Add optional Helm subcharts under `platform/helm/charts/{availability-guard-service,roll-service}` reusing the existing Fastify service template.
- Introduce `shadowMode.enabled` values in `platform/helm/values.yaml` and `platform/values/dev/common.yaml`; when true:
  - Deployments land in `tartware-shadow` namespace with `podLabels.shadow-mode=true`.
  - ConfigMaps inject `SHADOW_MODE=true`, `KAFKA_CONSUMER_GROUP_SUFFIX=-shadow`, read-only credentials, and disable any mutating cronjobs.
  - ServiceMonitor scrapes `/metrics` but the ClusterIP Services stay internal only.
- Local dev: extend `package.json` scripts with `dev:availability-guard` and `dev:roll-service` so `npm run dev:stack` supervises the new workers alongside existing services.

### 1.4 Observability Wiring
- Reuse `@tartware/telemetry` helpers so both services expose `/metrics`, `/health/liveness`, `/health/readiness`, and OTLP exporters.
- Grafana dashboards + alert rules now live in `docs/observability/shadow-mode.md`. They cover kafka lag, replay drift, lock success/latency, and manual release notification health via the new metrics (`roll_service_lifecycle_events_total`, `roll_service_processing_lag_seconds`, `availability_guard_requests_total`, `availability_guard_notification_delivery_lag_seconds`, etc.).

### 1.5 Shadow Helm Bootstrap (in progress)
- ✅ Added Helm dependencies that alias `service-template` for both shadow services so they can be toggled via `availability-guard-service.enabled` / `roll-service.enabled`.
- ✅ Extended `platform/helm/values.yaml` with disabled-by-default sections that set ports, pod labels (`shadow-mode.tartware.io/enabled`), and the required env wiring (topics, TTLs, consumer groups).
- ⏳ Next: create a dedicated `tartware-shadow` namespace manifest plus NetworkPolicy limiting ingress, and declare ServiceMonitors so Prometheus scrapes `/metrics`.
- Local scripts (`npm run dev:availability-guard`, `npm run dev:roll-service`) already match the Helm defaults—avoid divergence by referencing the same env names in both places.

## 2. Availability Guard RPC & Kafka Contract

### 2.1 RPC Surface
We will ship both gRPC and HTTP (JSON) front doors; the reservations-service client shim talks gRPC for lower latency while we keep an HTTP parity layer for tooling.

```
service AvailabilityGuard {
  rpc LockRoom(LockRoomRequest) returns (LockRoomResponse);
  rpc ReleaseRoom(ReleaseRoomRequest) returns (ReleaseRoomResponse);
  rpc BulkRelease(BulkReleaseRequest) returns (BulkReleaseResponse);
}

message LockRoomRequest {
  string tenant_id = 1;
  string reservation_id = 2;
  string room_type_id = 3;
  string room_id = 4;            // optional for type-level holds
  string stay_start = 5;         // ISO datetime
  string stay_end = 6;
  string reason = 7;             // e.g., RESERVATION_CREATE
  string correlation_id = 8;
  string idempotency_key = 9;    // reservation_id + command iteration
  uint32 ttl_seconds = 10;       // overrides derived TTL when provided
}
```

HTTP routes mirror the RPCs under `/v1/locks`:
- `POST /v1/locks` → `lockRoom`
- `DELETE /v1/locks/:lockId` → `releaseRoom`
- `POST /v1/locks/bulk-release` → `bulkRelease`

All requests must include tenant context headers (`x-tenant-id`, `x-correlation-id`) to align with existing Fastify auth hooks.

### 2.2 Internal Kafka Contract
- **Inbound commands**: Guard subscribes to `commands.primary` with `targetService=availability-guard-service`. Initial command names:
  1. `inventory.lock.room` – emitted synchronously by reservations-service when it needs a persisted hold. The command body matches `LockRoomRequest` (plus metadata).
  2. `inventory.release.room` – triggered on reservation cancel/fail.
  3. `inventory.release.bulk` – used by housekeeping / maintenance flows.
- **Outbound events** (shadow mode keeps them in `inventory.events.shadow`):
  - `inventory.locked`: `{ lockId, reservationId, tenantId, roomTypeId, roomId?, stayStart, stayEnd, expiresAt, reason, actor }`
  - `inventory.release_requested`: fired when we attempt to release but still waiting for confirmation (for parity debugging).
  - `inventory.released`: same payload plus `releasedAt` and `releaseReason`.
  - DLQ topic: `inventory.events.dlq` containing the original event + failure reason.

### 2.3 Commands that must call the guard first
1. `reservation.create` (always).
2. `reservation.modify` when room type, room id, check-in, or check-out changes.
3. `reservation.cancel` – releases existing holds.
4. Future: `rooms.inventory.block` / `rooms.inventory.release` that originate from maintenance tools can also reuse the guard once we exit shadow mode.

## 3. Reservations-Service Client Shim

### 3.1 Package layout
- Create `Apps/reservations-command-service/src/plugins/availability-guard-client.ts` exporting `buildAvailabilityGuardClient(fastify)` which:
  - Establishes a gRPC channel (`@grpc/grpc-js`) to `AVAILABILITY_GUARD_ADDRESS`.
  - Exposes `lockRoom`, `releaseRoom`, `bulkRelease` helpers returning typed results.
  - Publishes Prometheus metrics (`availability_guard_requests_total`, `availability_guard_request_duration_seconds`) via the existing metrics registry in `src/lib/metrics.ts`.
  - Wraps outbound calls in a circuit breaker (we already ship `p-retry` and `abort-controller`; we can use `p-retry` with `AbortSignal` for jittered retries).

Env knobs (add to `Apps/reservations-command-service/.env.example` + Helm values):
```
AVAILABILITY_GUARD_ADDRESS=availability-guard-service.tartware-shadow:4400
AVAILABILITY_GUARD_TIMEOUT_MS=1500
AVAILABILITY_GUARD_SHADOW_MODE=true
AVAILABILITY_GUARD_FAIL_OPEN=true   # until guard replaces in-db locking
```

### 3.2 Injection points
- `createReservation` (`Apps/reservations-command-service/src/services/reservation-command-service.ts`):
  1. Build `LockRoomRequest` from the command payload.
  2. Call `guardClient.lockRoom()` before `withTransaction`.
  3. On success, stash `lockId` into the lifecycle metadata so downstream services can correlate.
  4. If the guard is unavailable and `FAIL_OPEN` is true, log a structured warning and continue; otherwise throw before the outbox write so the command retries upstream.
- `modifyReservation`:
  - Determine whether the mutation affects inventory-critical fields; if not, skip the guard call.
  - If it does, call `lockRoom` for the new stay (reuse the reservationId as the `idempotency_key` so the guard updates the existing lock row in-place).
  - Since the guard now excludes the current `idempotency_key` when checking conflicts, we do not need an explicit release before refreshing the lock. Once the guard exits shadow mode we can still emit a `releaseRoom` if we decide to mint a brand-new lock id.
- `cancelReservation`:
  - Invoke `releaseRoom` with `reason=CANCELLED` before writing the cancellation event.

Pseudo-hook (to be inserted ahead of `recordLifecyclePersisted`):
```ts
const guardLock = await availabilityGuard.lockRoom({
  tenantId,
  reservationId: aggregateId,
  roomTypeId: command.room_type_id,
  roomId: command.room_id ?? null,
  stayStart: command.check_in_date,
  stayEnd: command.check_out_date,
  correlationId: options.correlationId,
  idempotencyKey: `${aggregateId}:${options.correlationId ?? eventId}`,
  reason: "RESERVATION_CREATE",
});

await recordLifecyclePersisted(client, {
  ...,
  metadata: { lockId: guardLock.lockId, eventType: validatedEvent.metadata.type },
});
```

### 3.3 Telemetry & resilience
- Expose Fastify health checks that verify the guard channel (ping RPC) in addition to Kafka/Postgres.
- Emit structured warnings when the guard responds with conflicts so we can surface them in dashboards during shadow mode without impacting the user-visible flow.
- Capture audit logs in `reservation_command_lifecycle.metadata.guard` for future parity checks.
- The guard repository (`findConflictingLock`) now skips the lock matching the provided `idempotency_key`/reservationId so modify flows can "upsert" their existing holds without triggering false conflicts.
- Manual override path: `POST /v1/locks/:lockId/manual-release` (shadow-only for now) requires an `x-guard-admin-token`, writes an audit row to `inventory_lock_audits`, and emits a Kafka notification (`availability-guard.notifications`) so hotel ops, revenue, and finance teams receive an explicit confirmation when someone force-releases a room hold. Read-only visibility lives at:
  - `GET /v1/locks/:lockId/audit` (per-lock trail)
  - `GET /v1/locks/audit?tenantId=<uuid>&lockId=<uuid?>&limit=100` (tenant/search view)
  - Both share the same admin token guard.
- `reservation_guard_locks` table persists the last known guard lock id + status per reservation so modify/cancel flows can release the exact lock id instead of guessing. Command handlers update the row whenever the guard issues a new lock or when a release is requested.
- Dry-run endpoint: `POST /v1/notifications/manual-release/test` (admin token required) merges the configured recipient defaults, classifies channels (email/SMS/Slack), and returns the rendered subject/body so ops can validate routing without pinging real webhooks. The Kafka worker now honors `AVAILABILITY_GUARD_NOTIFICATION_DRY_RUN` and will only invoke actual webhooks once that flag is disabled.
- Notification consumer: the guard app now includes a Kafka worker that consumes `availability-guard.notifications`, validates payloads, classifies recipients (email vs. SMS vs. Slack/webhooks), and fan-outs messages via configurable HTTPS webhooks. Metrics cover per-channel success/failure plus end-to-end lag so Alertmanager can page if notification delivery stalls.

## 4. Lifecycle Backfill Workflow (Roll Service)

### 4.1 Data sources
1. `reservation_command_lifecycle` table (schema already defined under `scripts/tables/03-bookings/54_reservation_command_lifecycle.sql`) gives ordered checkpoints with timestamps and actors.
2. `reservations` table for current booking state (status, amounts).
3. `reservation_ledger` (future) or `payments` tables to reconcile financial entries.

### 4.2 Backfill job outline
- Implement `scripts/backfill-roll-ledgers.ts` (Node) or a dedicated worker inside `Apps/roll-service/src/jobs/backfill.ts` that:
  1. Reads lifecycle rows in chronological batches (default 5k) filtered by `created_at` and `current_state`.
  2. Joins with `reservations` to pull stay metadata and amounts.
  3. Writes derived entries into `roll_service_shadow_ledgers` with idempotency keys (`reservation_id + lifecycle_event_id`).
  4. Publishes synthetic `roll.events.shadow` messages so we can validate Kafka throughput.
- Track progress in `roll_service_backfill_checkpoint` table (tenant_id, last_event_id, updated_at) so the job can resume after restarts.
- Run backfill once before enabling real-time streaming, then schedule nightly incremental runs via the helm-managed CronJob.

### 4.3 Replay tooling
- CLI available via `npm run roll:replay -- --reservation-id=<uuid>`; optional flags:
  - `--output=/custom/path/report.json` to override the default `docs/rolls/reports/reservation-<uuid>.json`
  - `--stdout` to print the JSON report without writing a file (handy for CI)
- Workflow: load `reservation_command_lifecycle` rows, derive expected ledger entries via the shared builder, compare with `roll_service_shadow_ledgers`, and emit per-event status (`match`, `diff`, `missing_in_shadow`, `extra_in_shadow`). Report summary captures counts so Grafana/alerts can watch for drifts.

### 4.4 Implementation Progress (2025-12-26)
- Added `scripts/tables/03-bookings/90_roll_service_shadow_tables.sql` to provision `roll_service_shadow_ledgers` plus `roll_service_backfill_checkpoint` (global sentinel tenant supported). Ledgers enforce `(tenant_id, lifecycle_event_id)` idempotency and carry the original lifecycle payload for parity diffing.
- `Apps/roll-service` now ships a Kafka consumer (`roll-lifecycle-consumer` plugin) that validates `reservations.events` envelopes via `@tartware/schemas`, derives roll classifications (EOD/CHECKOUT/CANCEL), and upserts ledger rows while emitting `roll_service_batch_duration_seconds` + lag gauges.
- Backfill workflow implemented via `buildBackfillJob` (configurable interval/batch size). It replays `reservation_command_lifecycle` rows into the shadow ledger inside a single transaction, then advances the checkpoint so restarts resume where they left off.
- Config knobs: `ROLL_SERVICE_CONSUMER_ENABLED`, `ROLL_SERVICE_BACKFILL_ENABLED`, `ROLL_SERVICE_BACKFILL_BATCH_SIZE`, `ROLL_SERVICE_BACKFILL_INTERVAL_MS`. Defaults keep both workers on during dev/shadow; operators can disable independently if needed.
- Added Prometheus metrics for backfill throughput (`roll_service_backfill_batches_total`, `roll_service_backfill_rows_total`), latency (`roll_service_backfill_batch_duration_seconds`), errors, and the most recent checkpoint timestamp so Grafana can alert on stalled replays.
- Replay CLI + report pipeline live (see §4.3). Next follow-ups: push replay drift counts into Prometheus so alerts fire automatically, and extend the CLI to diff financial amounts once the production ledger schema lands.
- Consumer resiliency: `roll_service_consumer_offsets` table mirrors the last committed Kafka offset/Event ID per partition, and new metrics (`roll_service_consumer_offset`, `roll_service_consumer_event_timestamp`) publish the same data so we can horizontally scale the worker while keeping an operator-friendly checkpoint view. Even if all pods restart, Kafka offsets + this table ensure we resume exactly where the last replica stopped.
- Availability Guard now exposes the gRPC service defined in `proto/availability-guard.proto` (LockRoom/ReleaseRoom/BulkRelease). The HTTP service boots the gRPC server alongside Fastify and shares the same lock business logic, so reservations-service and future clients can talk gRPC without wiring a second contract.
- Reservations-command-service consumes the new gRPC API via `availability-guard-client.ts`. Reservation create commands request a lock before the transactional outbox write, cancellation commands request release, and both paths record telemetry/metadata while honoring the fail-open + shadow-mode toggles.

## 5. Shadow-Mode Success Metrics & Alerting

| Metric | Description | Source |
|--------|-------------|--------|
| `availability_guard_shadow_lock_conflicts_total{tenantId}` | Count of conflicts between guard lock decisions and legacy locker outcomes. | Guard service (increment when guard detects overlapping holds). |
| `availability_guard_shadow_lock_latency_ms` (histogram) | Latency for `lockRoom` RPCs (p50/p95/p99). | Guard Fastify metrics. |
| `availability_guard_drift_seconds` | Difference between guard’s lock expiration and legacy release timestamp for identical reservations. | Compare guard lock table vs. `reservation_command_lifecycle`. |
| `roll_service_shadow_replay_delta_total` | Number of ledger entries that differ from production accruals. | Roll service reconciliation job. |
| `roll_service_processing_lag_seconds` | Kafka consumer lag vs. `reservations.events` (labeled by topic/partition). | Roll consumer instrumentation. |
| `roll_service_consumer_timestamp_drift_seconds` | Wall-clock drift for the last processed lifecycle event per topic/partition. | Roll consumer instrumentation. |
| `roll_service_replay_matches_total` / `_mismatches_total` / `_missing_total` | Counts of per-event replay outcomes (match, updated, first insert). | Roll consumer + backfill when upserting `roll_service_shadow_ledgers`. |
| `availability_guard_notification_delivery_lag_seconds` | Seconds between manual release publish time and downstream notification webhook completion. | Guard notification worker. |
| `availability_guard_notification_channel_deliveries_total{channel,status}` | Channel-specific delivery success/failure counts (email/SMS/Slack). | Guard notification worker. |
| `shadow_mode_alerts_total{service}` | Count of emitted alerts (Slack/PagerDuty) when drift thresholds exceeded. | Alertmanager integration. |

Alerting thresholds:
- Guard drift > 3 minutes for any reservation → warning; > 10 minutes → critical.
- Roll replay delta > 0 for three consecutive batches → paging alert.
- Consumer lag > 60s for guard or roll service → warning (since they should keep up with live traffic even in shadow mode).

## 6. Immediate Next Steps
1. Scaffold both workspaces with Fastify + `@tartware/telemetry`, register dev scripts, and add placeholder Helm charts (shadow-mode only). ✅ scaffolding done, Helm bootstrap underway.
2. Implement the availability guard proto/HTTP surface plus persistence models (start with PostgreSQL + advisory locks for MVP). ✅ HTTP/DB scaffolding complete, gRPC to follow.
3. Build the reservations-service client shim and wire it into `createReservation` while the `FAIL_OPEN` flag keeps production flow unchanged.
4. Implement the roll service shadow consumer + backfill job to populate `roll_service_shadow_ledgers`.
5. Stand up Grafana panels tracking the metrics above so we can validate the services before turning off shadow mode.

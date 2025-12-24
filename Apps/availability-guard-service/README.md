# Availability Guard Service (Shadow Mode)

This workspace hosts the Availability Guard / Inventory locking service. The goal is to own all room/room-type locks outside of the reservations command pipeline so we can safely shadow the future inventory guard without impacting the current transactional path.

## High-Level Responsibilities

1. **Lock orchestration** – Accept lock, release, and bulk-release requests via HTTP (future gRPC) and persist them in `inventory_locks_shadow`.
2. **Conflict detection** – Ensure overlapping locks are rejected (status `CONFLICT`) while recording metrics to compare with the legacy locker.
3. **Shadow telemetry** – Publish Prometheus counters/histograms so dashboards can track drift, conflicts, and latency before the guard becomes authoritative.
4. **Future integration points** – Kafka consumers/producers and gRPC endpoints will be layered on after shadow-mode parity is proven.

## Request Workflow

```
Command (reservation.create) -> Availability Guard HTTP API -> transactional insert into inventory_locks_shadow
    - Lock conflict? -> 409 response + `availability_guard_lock_conflicts_total` increment
    - Successful lock? -> 200 response + row persisted + lifecycle metadata captured

Cancel/Modify (release) -> Availability Guard HTTP API -> UPDATE inventory_locks_shadow SET status='RELEASED'
Bulk maintenance -> POST /v1/locks/bulk-release (room-service/ops flows)
```

Key implementation files:

| Responsibility | File |
| --- | --- |
| Config/env parsing | `src/config.ts` |
| Fastify server & routes | `src/server.ts`, `src/routes/locks.ts` |
| Postgres helpers | `src/lib/db.ts`, `src/repositories/lock-repository.ts` |
| Metrics | `src/lib/metrics.ts` |
| Business logic | `src/services/lock-service.ts` |

## Control Flow Details

### Lock creation
1. `POST /v1/locks` payload is validated via `lockRoomSchema`.
2. `lockRoom` service opens a transaction, checks for conflicts via `findConflictingLock`, and inserts a new row with TTL metadata.
3. Service responds with either `{ status: "LOCKED" }` or `{ status: "CONFLICT" }`.
4. Metrics:
   - `availability_guard_requests_total{operation="lockRoom"}` increments with `success|conflict`.
   - `availability_guard_lock_conflicts_total` increments on conflicts.
   - `availability_guard_request_duration_seconds` records latency.

### Lock release
1. `DELETE /v1/locks/:lockId` validates params/body (`releaseLockSchema`).
2. `releaseLock` marks the row as `RELEASED` and attaches release metadata.
3. Non-existent lock returns 404.

### Bulk release
1. `POST /v1/locks/bulk-release` accepts `{ lockIds[], tenantId }`.
2. Performs a single SQL update and replies with `{ status: "released", released: <count> }`.

### Manual release (audited + notified)
1. `POST /v1/locks/:lockId/manual-release`
   - Requires header `x-guard-admin-token` that matches one of the comma-separated values in `AVAILABILITY_GUARD_ADMIN_TOKENS`.
   - Body shape:
     ```json
     {
       "tenantId": "<uuid>",
       "reservationId": "<uuid | optional>",
       "reason": "Guest moved to different room stack",
       "actorId": "ops.user.42",
       "actorName": "Alex Night Audit",
       "actorEmail": "alex.night.audit@hotel.example",
       "notify": ["gm@hotel.example", "revenue@hotel.example"]
     }
     ```
2. Handler authenticates the token, releases the lock, writes an audit record into `inventory_lock_audits`, and dispatches a notification event to Kafka (topic default `availability-guard.notifications`).
3. Notification payload contains the actor, reason, stay window, and merged recipient list (`notify` body field + `AVAILABILITY_GUARD_NOTIFICATION_RECIPIENTS`). The local notifications worker (below) fans these events out to downstream comms channels.
4. Audit visibility:
   - `GET /v1/locks/:lockId/audit` returns the chronological audit entries for a single lock.
   - `GET /v1/locks/audit?tenantId=<uuid>&lockId=<uuid?>` provides tenant-wide search with pagination via `limit`.
   - Both endpoints require the same `x-guard-admin-token` header as the manual release API.
5. **Smoke-test notifications** (no releases performed):
   - `POST /v1/notifications/manual-release/test`
   - Requires the admin token header. Sends a payload with mock stay/actor/recipient data and the API returns how recipients would be bucketed (email/SMS/Slack) plus the rendered subject/body so ops can validate routing without touching real webhooks.

### Manual release notification consumer

Shadow-mode operators asked for instant confirmation whenever someone force releases a lock. The `manual-release-notification-consumer` worker starts with the Fastify app and:

1. Subscribes to `AVAILABILITY_GUARD_NOTIFICATION_TOPIC` with group `AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_GROUP`.
2. Validates each event payload and deduplicates the merged recipient list.
3. Buckets each recipient automatically:
   - Addresses containing `@` are treated as email recipients.
   - Strings that look like E.164 numbers (`+14155550123`) route to SMS.
   - Values starting with `slack:`, `#channel`, or `@handle` route to Slack/webhook destinations.
4. Sends one webhook call per channel (`email`, `sms`, `slack`). Each webhook receives a structured payload with subject/body text, metadata (lock, tenant, actor, stay window), and the list of recipients it should notify.
5. Retries failed webhook calls with exponential backoff (`AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_MAX_RETRIES` / `_RETRY_BACKOFF_MS`). If every channel fails, the Kafka offset is not committed so the event can be reprocessed.

Webhook endpoints are intentionally generic so Ops can point them at SendGrid, Twilio, Slack Incoming Webhooks, or an internal notification service without changing guard code.

## Configuration & Environment

All config is derived via `@tartware/config`. Important env vars:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT`, `HOST` | Fastify bind info | `3800`, `0.0.0.0` in dev script |
| `KAFKA_BROKERS` | Future Kafka wiring | `localhost:29092` |
| `RESERVATION_EVENTS_TOPIC`, `INVENTORY_EVENTS_TOPIC`, `INVENTORY_EVENTS_DLQ_TOPIC` | Kafka topics reserved for shadow streaming | `reservations.events`, `inventory.events.shadow`, `inventory.events.dlq` |
| `SHADOW_MODE` | Enables shadow-specific behavior (fail-open, internal dashboards) | `true` |
| `AVAILABILITY_GUARD_FAIL_OPEN` | Allows callers to continue when guard is unreachable | `true` |
| `LOCK_DEFAULT_TTL_SECONDS`, `LOCK_MAX_TTL_SECONDS` | TTL boundaries for inserted locks | `7200`, `86400` |
| `AVAILABILITY_GUARD_MANUAL_RELEASE_ENABLED` | Toggles the manual-release endpoint | `true` |
| `AVAILABILITY_GUARD_ADMIN_TOKENS` | Comma-separated shared secrets required for manual release | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATIONS_ENABLED` | Enables Kafka notifications | `true` |
| `AVAILABILITY_GUARD_NOTIFICATION_TOPIC` | Topic for release notifications | `availability-guard.notifications` |
| `AVAILABILITY_GUARD_NOTIFICATION_RECIPIENTS` | Default recipient list appended to each manual release | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_ENABLED` | Enables the Kafka consumer that fans out manual release notifications | `true` |
| `AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_GROUP` | Kafka consumer group for notification worker | `availability-guard-notification-worker` |
| `AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_MAX_RETRIES` | Number of webhook retry attempts before surfacing an error | `3` |
| `AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_RETRY_BACKOFF_MS` | Base delay between webhook retries | `2000` |
| `AVAILABILITY_GUARD_NOTIFICATION_DRY_RUN` | When `true`, Kafka consumer logs payloads instead of calling external webhooks | `true` (flip to `false` when ready for production alerts) |
| `AVAILABILITY_GUARD_NOTIFICATION_EMAIL_ENABLED` | Enables the email webhook channel | `true` |
| `AVAILABILITY_GUARD_NOTIFICATION_EMAIL_WEBHOOK_URL` | HTTPS endpoint that actually sends the email | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_EMAIL_TIMEOUT_MS` | Timeout applied to the email webhook request | `7000` |
| `AVAILABILITY_GUARD_NOTIFICATION_EMAIL_API_KEY` | Optional `Authorization: Bearer` token for the email webhook | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_SMS_ENABLED` | Enables the SMS webhook channel | `false` |
| `AVAILABILITY_GUARD_NOTIFICATION_SMS_WEBHOOK_URL` | Endpoint that sends SMS messages | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_SMS_TIMEOUT_MS` | Timeout applied to the SMS webhook request | `5000` |
| `AVAILABILITY_GUARD_NOTIFICATION_SMS_API_KEY` | Optional API token for the SMS webhook | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_SLACK_ENABLED` | Enables the Slack/webhook channel | `false` |
| `AVAILABILITY_GUARD_NOTIFICATION_SLACK_WEBHOOK_URL` | Slack Incoming Webhook (or compatible) URL | _(empty)_ |
| `AVAILABILITY_GUARD_NOTIFICATION_SLACK_TIMEOUT_MS` | Timeout applied to the Slack webhook request | `5000` |
| `AVAILABILITY_GUARD_NOTIFICATION_SLACK_API_KEY` | Optional API token for the Slack webhook | _(empty)_ |

> ℹ️ **Secrets**: The Helm chart expects a secret named `availability-guard-notification-secrets` with keys `email-webhook-url`, `email-api-key`, `sms-webhook-url`, `sms-api-key`, `slack-webhook-url`, and `slack-api-key`. Populate those with either production endpoints or sandbox destinations before disabling dry-run mode.

## Metrics & Observability

- `/metrics` exposes Prometheus text output aggregated via `metricsRegistry`.
- Default metrics include request counts, conflicts, latency histograms, and notification-consumer health (processed/skipped/failed events, per-channel delivery totals, and `availability_guard_notification_delivery_lag_seconds`).
- `@tartware/telemetry` wiring is enabled for Fastify, HTTP, and PG instrumentation.
- Shadow dashboards will consume `availability_guard_requests_total`, `availability_guard_lock_conflicts_total`, and readiness probes.

## Shadow-Mode Expectations

- Service starts via `npm run dev:availability-guard` alongside the rest of the backend stack.
- Helm/Kubernetes wiring will deploy it into a `tartware-shadow` namespace with `SHADOW_MODE=true` (tracked in TODO step 2).
- No external clients should call this service yet; only synthetic traffic or shadow pipelines should hit it.

## Next Steps

1. **Helm deployment** – add templated Deployments/ConfigMaps to `platform/helm` (in progress per TODO step 2).
2. **RPC & Kafka** – implement gRPC service definition plus command consumers/producers.
3. **Reservations client shim** – integrate guard calls into the reservations command path behind a fail-open flag.
4. **Metrics dashboards** – wire Grafana panels comparing guard vs. legacy locker state/drift.

# Tartware Monorepo – System Overview

This repository hosts every backend component that powers Tartware’s property management platform. The services follow a **command-driven architecture**: all write traffic flows through a central Command Center, lands in Kafka, and is fanned out to the domain services. Read traffic stays HTTP-based via the API Gateway’s proxies.

## High-Level Request Flow

1. **API Gateway** *(Apps/api-gateway)* receives tenant-scoped HTTP requests and handles authentication, rate limits, and routing.
2. **Command submissions** (reservation create, billing capture, etc.) are forwarded to the **Command Center** (`POST /v1/commands/:commandName/execute`) instead of hitting the domain service directly.
3. Command Center validates routing policies, persists the command, and publishes an event to Kafka (`commands.primary`).
4. **Domain services** (reservations-command-service, billing-service, housekeeping-service, etc.) consume their respective command envelopes, apply the mutation inside Postgres, and emit lifecycle/events (`reservations.events`, `inventory.events.shadow`, etc.).
5. **Observability workers** such as the Availability Guard and Roll Service run in shadow mode, consuming the same streams to validate inventory locks and end-of-day schedules before they take ownership of the hot path.

## Service Reference

| Service | Responsibilities | Key HTTP Endpoints | Kafka (consume → produce) | Notes / Dependencies |
|---------|------------------|--------------------|---------------------------|----------------------|
| **API Gateway**<br>`Apps/api-gateway` | Tenant auth, request logging, proxying reads, forwarding writes into the command pipeline. | - `GET /v1/guests`, `/v1/rooms`, `/v1/billing/payments`, `/v1/housekeeping/tasks` (proxy to respective services)<br>- `POST /v1/guests`, `/v1/tenants/:tenantId/reservations`, `/v1/tenants/:tenantId/billing/payments/*`, `/v1/tenants/:tenantId/housekeeping/tasks/*` → Command Center | n/a | Talks to every domain read service plus Command Center. |
| **Command Center Service**<br>`Apps/command-center-service` | Canonical command catalog, routing, transactional outbox, Kafka publisher. | - `POST /v1/commands/:commandName/execute` (accept command)<br>- Future admin APIs (`/v1/commands`, `/v1/routes`, `/v1/dispatches`) | consumes n/a → produces `commands.primary` (+ DLQ `commands.primary.dlq`) | Persists accepted commands in Postgres and enforces per-tenant feature flags. |
| **Reservations Command Service**<br>`Apps/reservations-command-service` | Applies reservation commands, maintains lifecycle guard rails, emits reservation events. | - `/health`, `/metrics`<br>- `GET /v1/reservations/:reservationId/lifecycle` | consumes `commands.primary` (reservation.*), `reservations.events` (for retries) → produces `reservations.events`, `reservations.events.dlq` | Uses transactional outbox and manual Kafka commits (`kafkajs eachBatch`). |
| **Guests Service**<br>`Apps/guests-service` | Guest directory reads + command consumer for guest mutations. | - `GET /v1/guests` | consumes `commands.primary` (`guest.register`, `guest.merge`) → produces domain events (todo) | API Gateway forwards POSTs as commands; service exposes read APIs only. |
| **Rooms Service**<br>`Apps/rooms-service` | Read-only room inventory queries; command consumer handles manual block/release. | - `GET /v1/rooms` | consumes `commands.primary` (`rooms.inventory.block/release`) | Works with Availability Guard for future locking. |
| **Housekeeping Service**<br>`Apps/housekeeping-service` | Task queries + assign/complete command handling. | - `GET /v1/housekeeping/tasks` | consumes `commands.primary` (`housekeeping.task.assign/complete`) | Writes happen via Kafka; HTTP is read-only. |
| **Billing Service**<br>`Apps/billing-service` | Payment ledger reads and capture/refund workflows via commands. | - `GET /v1/billing/payments` | consumes `commands.primary` (`billing.payment.capture/refund`) | Emits payment status events for downstream reconciliation. |
| **Core Service**<br>`Apps/core-service` | Authentication, tenant & user admin, dashboards, system-level APIs. | - `/v1/auth/login`, `/v1/auth/context`, `/v1/auth/change-password`<br>- `/v1/tenants`, `/v1/users`, `/v1/dashboard/*`, `/v1/system/*` | n/a (HTTP only) | Still hosts cross-cutting modules until split out. |
| **Availability Guard Service**<br>`Apps/availability-guard-service` | Shadow inventory lock manager; exposes HTTP lock API and will add gRPC/Kafka integrations. | - `POST /v1/locks`<br>- `DELETE /v1/locks/:lockId`<br>- `POST /v1/locks/bulk-release` | consumes `commands.primary` (`inventory.lock.*`), `reservations.events`, `rooms.events` → produces `inventory.events.shadow`, `inventory.events.dlq` | Runs in fail-open mode; readiness/metrics for `/health` + `/metrics`. |
| **Roll Service**<br>`Apps/roll-service` | Shadow roll/schedule processor for EOD/SOD accruals and replay tooling. | - `/health`, `/health/readiness`, `/metrics` (worker probes)<br>- `npm run roll:replay -- --reservation-id=<uuid>` CLI writes reports under `docs/rolls/reports/` | consumes `reservations.events` (+ future `inventory.events`) → produces `roll.events.shadow` | Persists to `roll_service_shadow_ledgers`, keeps checkpoints in `roll_service_backfill_checkpoint` + `roll_service_consumer_offsets`. |
| **Settings Service**<br>`Apps/settings-service` | Global settings catalog and per-tenant overrides. | - `GET /v1/settings/catalog`<br>- `GET /v1/settings/values`<br>- `GET /v1/settings/ping` | n/a | Used by other services for feature/module flags. |
| **API Support Utilities** | Telemetry, config, schema packages used across services. | n/a | n/a | Shared packages live under `Apps/telemetry`, `Apps/config`, `schema/`. |

> 🚧 *Availability Guard and Roll Service currently run in “shadow mode”: they read all the data, persist their own state, but do not block the production flows until parity dashboards go green.*

## Inter-Service Communication Matrix

| Service | Synchronous protocols | Asynchronous channels | Rationale |
|---------|----------------------|-----------------------|-----------|
| API Gateway | HTTP/REST only | n/a | Acts as the external edge; fan-out happens after commands enter Kafka. |
| Command Center | HTTP ingress (`POST /v1/commands/:commandName/execute`) | Publishes `commands.primary`, `commands.primary.dlq` | Commands must be acknowledged immediately to clients, then streamed for processing. |
| Reservations Command Service | gRPC client to Availability Guard (`availability-guard.proto`); HTTP for health/metrics | Consumes `commands.primary`, `reservations.events`; produces `reservations.events`, DLQ | Needs low-latency lock decisions before committing reservation writes, hence gRPC. All lifecycle fan-out stays on Kafka. |
| Availability Guard Service | HTTP `/v1/locks*` for tooling + manual releases; gRPC server for reservations-service; internal Fastify routes | Consumes `reservations.events`, `commands.primary` (future), `availability-guard.notifications`; produces `inventory.events.shadow`, notification topics | gRPC provides deterministic lock/unlock responses inside the hot reservation write path, while Kafka captures event streams and notifications for replay/ops. |
| Billing / Housekeeping / Guests / Rooms services | HTTP for reads/health | Consume `commands.primary` (+ domain-specific topics) | These domains only need asynchronous command ingestion today; writes come through Kafka, reads stay REST. |
| Roll Service | HTTP for probes + CLI | Consumes `reservations.events`; produces `roll.events.shadow` | Entire workload is batch/stream processing, so Kafka-only. |
| Command Center Outbox Dispatcher | n/a | Reads Postgres outbox, publishes Kafka | Runs headless worker; no sync interface. |

**Why both gRPC and Kafka?** gRPC covers point-to-point coordination where the caller must block on the result (e.g., reservations-service cannot commit a booking until it knows the lock succeeded). Kafka covers everything that benefits from durable fan-out, replay, retries, or multi-consumer analytics (commands, lifecycle events, notification broadcasts). Keeping both lets us optimize each flow without overloading a single transport.

## Kafka Topics & Consumers

- `commands.primary`: all commands emitted by the Command Center. Consumers include reservations-command-service, billing-service, rooms-service, housekeeping-service, guests-service, availability-guard-service, and future domain workers.
- `reservations.events`: lifecycle checkpoints produced by reservations-command-service. Consumers include roll-service (ledger builder), availability-guard-service (lock reconciliation), analytics pipelines, and any audit tooling. Poison messages go to `reservations.events.dlq`.
- `inventory.events.shadow`: availability-guard-service publishes lock/unlock outcomes while in shadow mode. Once promoted, the same topic becomes the canonical lock stream.
- `roll.events.shadow`: roll-service emits derived roll entries for validation/backfill audits.
- Additional downstream topics (billing, housekeeping, etc.) follow the same pattern but are defined inside each service’s Kafka config.

## Observability & Resilience Highlights

- Every Fastify service exposes `/health`, `/health/readiness`, and `/metrics` (Prometheus text) through the shared telemetry plugin.
- Command Center, reservations-command-service, and other producers use a transactional outbox + manual Kafka commits, ensuring at-least-once delivery with idempotent handlers.
- Roll Service checkpoints both the backfill job (`roll_service_backfill_checkpoint`) and the streaming consumer (`roll_service_consumer_offsets`) so horizontal scaling or crashes restart exactly at the last processed event. Metrics `roll_service_backfill_*` and `roll_service_consumer_*` power Grafana dashboards/alerts.
- Availability Guard keeps Postgres state plus Kafka mirrors; `SHADOW_MODE` env flag ensures it fails open until the guard replaces the legacy locker.

## Getting the Big Picture Quickly

- **Clients** hit API Gateway → reads are proxied, writes become commands.
- **Command Center** is the single ingress for everything mutating data.
- **Kafka** is the backbone: commands primary topic for intent, service-specific topics for lifecycle/results.
- **Domain services** own their data stores, expose read APIs, and consume commands asynchronously.
- **Shadow services (Availability Guard & Roll)** observe the same streams, verify correctness, and will take over the hot path once parity is proven.

When in doubt, check `docs/roll-service-availability-guard.md` for the Availability Guard + Roll rollout plan, and `docs/command-center-service/README.md` for the command pipeline specifics.

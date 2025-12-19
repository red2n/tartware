# Command Center Service

## Purpose

The Command Center service is the orchestration hub for **all write-side workflows** in Tartware. Instead of each microservice exposing bespoke mutation endpoints, every user-initiated action is expressed as a _command_ that flows through this control plane. The Command Center is responsible for:

- Defining the canonical catalog of commands (schema, validation, authorization scope).
- Tracking which downstream service (or services) should process each command at runtime.
- Enforcing enable/disable flags, rate limits, and routing policies per tenant/environment.
- Publishing commands as events (via the transactional outbox + Kafka) so downstream services can react asynchronously.
- Auditing command execution history and exposing introspection APIs for operators.

This allows operators to rewire business flows (e.g., “Billing commands now handled by the billing-service v2”) without redeploying edge clients or composing ad-hoc proxy logic.

## High-Level Architecture

```
Client → Command Center (REST/GraphQL) → Transactional Outbox → Kafka (command.topic)
                                                                     ↳ Service A command processor
                                                                     ↳ Service B command processor
```

1. **Ingress API**: `/v1/commands/:commandName/execute` accepts the payload, validates the command template, checks tenant permissions, and writes a row to the `command_dispatches` table + transactional outbox.
2. **Command Registry**: stored in Postgres (`command_templates`, `command_routes`, `command_features`) describing each command, required modules, target topics, and default SLA.
3. **Dispatcher**: a background worker identical to the reservations outbox dispatcher, responsible for publishing enqueued commands to Kafka (`commands.primary`) with headers capturing routing decisions.
4. **Consumers**: individual domain services subscribe to the commands relevant to them. Routing metadata (e.g., `x-command-target=housekeeping-service`) tells the consumer whether to accept or ignore a command.
5. **Control APIs**: `/v1/command-center/commands` (CRUD), `/v1/command-center/routes` (map/unmap targets), `/v1/command-center/features` (enable/disable per tenant/environment).

## Data Model

| Table | Purpose |
| --- | --- |
| `command_templates` | Canonical definition of a command (name, schema, default topic, required modules, version). |
| `command_routes` | Mapping of command → target service(s) for a given environment/tenant/property. Supports weighted routing or blue/green cutovers. |
| `command_features` | Per-tenant feature flags dictating whether a command is enabled, limited, or in “observation mode”. |
| `command_dispatches` | Immutable log of accepted command invocations (tenant, correlation id, payload hash, status). |
| `transactional_outbox` | Reused outbox table storing the serialized command event awaiting publication. |

## API Sketch

| Method & Path | Description |
| --- | --- |
| `POST /v1/commands/:commandName/execute` | Primary ingress. Returns `202 Accepted` with `commandId`, `correlationId`, `targetService`. |
| `GET /v1/commands` | Lists available commands + metadata. Supports filtering by module, status, service owner. |
| `PATCH /v1/commands/:commandName/features` | Enable/disable or throttle a command for specific tenants/environments. |
| `PUT /v1/routes/:commandName` | Replace routing map (e.g., send `reservation.create` to `reservations-service-v2`). |
| `GET /v1/dispatches/:commandId` | Returns execution metadata (received, published, consumed, completion status from downstream acknowledgements). |
| `POST /v1/dispatches/:commandId/replay` | Requeue a command (e.g., after downstream outage) with audit trail. |

All write requests respond immediately with `202` and include:

```json
{
  "status": "accepted",
  "commandId": "3a1b2f9e-…",
  "commandName": "reservation.create",
  "targetService": "reservations-command-service",
  "correlationId": "optional-user-supplied-id"
}
```

## Command Catalog (Initial Draft)

| Command | Description | Default Target | Notes |
| --- | --- | --- | --- |
| `reservation.create` | Accepts reservation intents with pricing & guest info. | `reservations-command-service` | Already implemented; migrate ingress here. |
| `reservation.modify` | Change stay dates, guests, or notes. | `reservations-command-service` | Downstream service emits follow-up events once applied. |
| `reservation.cancel` | Cancel confirmed reservations and trigger refund policies. | `reservations-command-service` + `billing-service` | Multi-target command: billing listens for refunds. |
| `guest.register` | Create or import a guest profile. | `guests-service` | Replaces future `POST /v1/guests`. |
| `guest.merge` | Merge duplicate guest profiles. | `guests-service` | Requires conflict-resolution policies. |
| `billing.payment.capture` | Capture a payment for an outstanding folio. | `billing-service` | Emits `payment.captured` once processed. |
| `billing.payment.refund` | Initiate refund workflow. | `billing-service` | Route can be switched to different PSP connectors. |
| `housekeeping.task.assign` | Assign or reassign a housekeeping task. | `housekeeping-service` | Enables rule-based routing (e.g., property-specific service). |
| `housekeeping.task.complete` | Mark a task completed and optionally request inspection. | `housekeeping-service` | Downstream updates inventory availability. |
| `rooms.inventory.block` | Block rooms for maintenance. | `rooms-service` | Follow-up events keep availability caches consistent. |
| `reports.snapshot.generate` | Trigger reporting job (ETL, analytics). | `reports-service` | Can be routed to batch workers or data warehouse pipelines. |
| `system.impersonation.start` | Issue impersonation tokens for support flows. | `core-service` | Allows centralized auditing. |

The catalog is intentionally granular so future tenants can opt-in/out per command while retaining larger domain modules (`facility-maintenance`, `finance-automation`).

## Routing & Feature Policy

Routing decisions are stored as JSON policies:

```json
{
  "command": "billing.payment.capture",
  "environment": "production",
  "tenantId": null,
  "targets": [
    { "serviceId": "billing-service-v1", "weight": 80 },
    { "serviceId": "billing-service-v2", "weight": 20 }
  ],
  "fallback": "billing-service-v1",
  "status": "active"
}
```

Feature flags allow operators to:

- Disable a command globally or per tenant.
- Force “audit only” mode (commands accepted, events published, but downstream consumers mark them as `ignored`).
- Attach rate limits (`maxPerMinute`, `burst`, `cooldown`) per tenant, property, or user role.

## Event Schema

Every published command shares a common envelope:

```json
{
  "metadata": {
    "id": "uuid",
    "commandName": "guest.register",
    "version": "1.0",
    "issuedAt": "2025-12-19T08:00:00Z",
    "tenantId": "…",
    "initiator": {
      "userId": "…",
      "role": "ADMIN",
      "ip": "203.0.113.10"
    },
    "routing": {
      "targetService": "guests-service",
      "alternateTargets": [],
      "policyId": "route-123"
    },
    "correlationId": "optional"
  },
  "payload": {
    "...": "command-specific fields validated against the template"
  }
}
```

Downstream services respond with their own domain events (`guest.created`, `billing.refunded`, etc.), allowing the Command Center (or observability tooling) to link command → fulfillment status.

## Implementation Steps (Next)

1. **Bootstrap service**: scaffold Fastify app similar to other services, add `/v1/commands/*` endpoints, and reuse the telemetry/logging plugins.
2. **Shared Outbox Module**: extract the transactional outbox helpers from `reservations-command-service` into a sharable package (`@tartware/outbox`) so Command Center (and future command producers) can enqueue commands without copy/paste.
3. **Database Migration**: add the tables described above plus seed data for the initial command catalog.
4. **Dispatcher Worker**: reuse the existing dispatcher logic to publish to `commands.primary` with per-command topics optional.
5. **Admin UI hooks**: update internal tooling/docs so operators can edit routes/feature flags.

Once this service is in place, migrating existing REST writes becomes straightforward: clients call the Command Center instead of the legacy service, and the legacy endpoint can be retired after its consumer handles the new command events.

---

_This README is the initial draft; as we implement the service we should flesh out the JSON Schemas, database DDL, and operational runbooks (alerts, dashboards, replay tooling)._ 

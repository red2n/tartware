# Pattern audit — 25 Aug 2026

Static scan of 19 packages (~120k LOC, 665 tracked TS sources) against the patterns `AGENTS.md`
mandates, with every finding verified at the call site. Summary and backlog status live in
`CLAUDE.md` § 6. Published version:
<https://claude.ai/code/artifact/b79f94ab-5e21-4c18-a880-f5d50b039bac>

## The thesis

SOLID is not uniformly missing. Interface segregation, Liskov and open/closed hold up — small
interfaces, almost no inheritance, composition over modification. **Dependency inversion and
single responsibility are the two that slip**, and they slip through one mechanism:

> A shared helper exists. Using it is optional. Each service grows its own copy. The copies
> diverge. The divergence becomes a bug.

`@tartware/command-consumer-utils/command-utils` exports `resolveActorId`, `asUuid`,
`SYSTEM_ACTOR_ID` and `CommandError`. **No service imports it.** Nine files across six services
redefine `resolveActorId`; five services redefine `CommandError`. That is the same failure that
left five services calling `new Kafka(...)` while `createKafkaClient()` sat unused — fixed
25 Aug 2026 by making the logger a required argument and adding
`scripts/check-shared-framework-usage.mjs`.

## Scorecard

Retry predicate = passes `isRetryable` to `createConsumerLifecycle`. Actor helper = defines a
local `resolveActorId` instead of importing the shared one. TSDoc = share of exported symbols
preceded by a doc comment.

| Service | LOC | Src | Tests | SQL in svc/routes | Repo layer | Retry predicate | Actor helper | TSDoc | >500 ln |
|---------|----:|----:|------:|------------------:|-----------|-----------------|--------------|------:|--------:|
| core-service | 34,136 | 142 | 29 | 20 | partial | n/a | none | 37% | 18 |
| billing-service | 28,343 | 137 | 6 | 41 | partial | wired | **local** | 62% | 12 |
| reservations-command | 10,526 | 49 | 4 | 10 | partial | wired | none | 62% | 5 |
| api-gateway | 9,879 | 45 | 9 | 1 | n/a | n/a | none | 60% | 6 |
| rooms-service | 8,570 | 70 | 4 | 4 | **none** | **missing** | **local** | 40% | 3 |
| revenue-service | 8,080 | 59 | 5 | 1 | **none** | **missing** | **local** | 40% | 2 |
| guests-service | 7,242 | 46 | 3 | 11 | **none** | **missing** | **local** | 63% | 2 |
| housekeeping-service | 4,518 | 32 | 4 | 6 | **none** | **missing** | **local** | 52% | 2 |
| notification-service | 3,930 | 32 | 7 | 5 | **none** | **missing** | **local** | 66% | 1 |
| availability-guard | 2,568 | 23 | 3 | 0 | yes | n/a | none | 11% | 0 |
| command-consumer-utils | 2,008 | 11 | 4 | 0 | n/a | n/a | owns it | 89% | 0 |
| fastify-server | 1,571 | 10 | 3 | 0 | n/a | n/a | n/a | 54% | 1 |
| config | 1,404 | 8 | 0 | 0 | n/a | n/a | n/a | 57% | 0 |
| telemetry | 959 | 1 | 1 | 0 | n/a | n/a | n/a | 8% | 1 |
| outbox | 586 | 4 | 0 | 0 | yes | n/a | n/a | 50% | 0 |
| tenant-auth | 432 | 4 | 0 | 0 | n/a | n/a | n/a | 40% | 0 |

---

## 01 — Non-UUID actor written into UUID audit columns · CRITICAL · FIXED 25 Aug 2026

Six services define a local `resolveActorId`, with five different fallbacks:

| Where | Fallback | Validates UUID |
|-------|----------|----------------|
| `command-utils.ts` (shared) | `SYSTEM_ACTOR_ID` = `00000000-0000-0000-0000-000000000000` | yes |
| `billing-service/.../billing-commands/common.ts` | `SYSTEM_ACTOR_ID` | yes |
| `rooms-service/.../room-command-service.ts:35` | `APP_ACTOR` = `"COMMAND_CENTER"` | **no** |
| `guests-service/.../guest-command-service.ts:31` | `APP_ACTOR` = `"COMMAND_CENTER"` | **no** |
| `housekeeping-service/.../housekeeping-command-service.ts:29` | `APP_ACTOR` = `"COMMAND_CENTER"` | **no** |
| `notification-service/.../notification-command-service.ts:14` | `SYSTEM_ACTOR` = `"NOTIFICATION_SERVICE"` | **no** |
| `revenue-service/.../handlers/forecast-handlers.ts` | `null` | **no** |

Also redefined in `guests-service/.../loyalty-command-service.ts`,
`housekeeping-service/.../maintenance-command-service.ts` and `.../schedule-command-service.ts`.

**Verified failure path.** `room-command-service.ts:736` `handleKeyIssue` resolves the actor, then
`:757` inserts it into `mobile_keys(created_by, updated_by)`. `scripts/tables/05-operations/82_mobile_keys.sql:48`
declares both as `UUID`. Any command arriving without `initiatedBy.userId` — every
scheduler-initiated one — produces `22P02 invalid input syntax for type uuid: "COMMAND_CENTER"`.

**Blast radius.** Tables with UUID audit columns written by services using a non-UUID fallback:
guests 9 (`folios`, `guest_documents`, `guest_preferences`, `incident_reports`, `lost_and_found`,
`transportation_requests`, `digital_registration_cards`, `guest_communications`,
`gds_reservation_queue`), rooms 3 (`mobile_keys`, `charge_postings`, `buildings`),
housekeeping 2 (`incident_reports`, `staff_schedules`). Each needs per-site confirmation that
`actor` reaches the audit column; `mobile_keys` is confirmed.

**Related DDL split.** `created_by`/`updated_by` are `UUID` in 155 tables, `VARCHAR(100)` in 21 and
`VARCHAR(120)` in 3 — which is why the same bad value passes silently in `rooms` and fails in
`mobile_keys`.

**Fixed 25 Aug 2026.** All ten local copies deleted; every service now imports `resolveActorId`
from `command-utils`, which validates the UUID and falls back to `SYSTEM_ACTOR_ID`. The sentinel
now has one definition repo-wide (`@tartware/config`, re-exported by `command-utils` — config
cannot import from command-consumer-utils, which depends on it). Guardrail rule
`actor-resolution` blocks new copies. `reservations`' `APP_ACTOR` survives deliberately: it is a
label inside event `metadata` JSON, never an actor id, and is now documented as such.

**Still open.** The DDL split — decide UUID vs text for audit columns and align the 24 outliers.

---

## 02 — Consumers retry errors that can never succeed · CRITICAL

`processWithRetry` (`Apps/config/src/retry.ts`) documents its default as *retry everything*;
`isRetryable` is optional. Only billing and reservations override it:

```ts
// billing-service/src/commands/command-center-consumer.ts:467
isRetryable: (error) => !(error instanceof BillingCommandError) || error.retryable,
```

Missing in guests, housekeeping, notification, revenue and rooms. With
`KAFKA_RETRY_SCHEDULE_MS=1000,5000,30000`, a deterministic rejection — wrong status, missing FK,
failed validation — costs 36s of backoff before reaching the DLQ it was always going to reach.
Commands are consumed in partition order, so everything queued behind it waits too. Against the
20K ops/sec target that is not a rounding error.

**Fix.** Once 03 lands, default it inside `createConsumerLifecycle`:
`isRetryable: input.isRetryable ?? ((e) => !(e instanceof CommandError) || e.retryable)`.

---

## 03 — One error type, five incompatible copies · CRITICAL

`CommandError` ships in `command-utils` with `code`. Nobody imports it. Instead:
`BillingCommandError`, `ReservationCommandError`, `RoomCommandError`,
`HousekeepingCommandError`, `MaintenanceCommandError`, `ScheduleCommandError`.

Billing and reservations added a `retryable` field with a careful comment explaining that
business-logic failures must not consume retry budget. The others carry only `code` — which is
exactly why they cannot wire 02.

**Fix.** Add `retryable` to the shared `CommandError`; have each service's class extend it rather
than `Error`. Service-specific names can stay; the contract the consumer reads becomes shared.

---

## 04 — Repository layer in 4 of 11 services · HIGH

`repositories/` exists in billing, core, reservations and availability-guard. The other seven put
SQL directly in service and route modules — 84 files.

| File | Lines | SQL statements | Tables |
|------|------:|---------------:|-------:|
| `reservation-commands/checkin-checkout.ts` | 1,229 | 25 | 14 |
| `billing-commands/night-audit.ts` | 1,238 | 27 | 11 |
| `core-service/services/operations-service.ts` | 1,977 | 13 | 3 (31 exports) |
| `api-gateway/routes/billing-routes.ts` | 1,352 | 0 | 0 |

53 source files exceed 500 lines, 18 of them in core-service.

**Fix.** Not a rewrite. Lift SQL into a repository module for the handlers you touch anyway —
that alone makes them unit-testable without a database, which is the real cost today.

---

## 05 — N+1 writes inside command loops · HIGH

One statement per iteration where a multi-row insert or `UNNEST` would do:

- `reservation-commands/group-booking.ts:208` — per block
- `reservation-commands/group-booking.ts:332` — per guest, two statements each
- `revenue-service/services/compset-service.ts:21` — per competitor
- also `night-audit.ts`, `commission.ts`, `ota-integration.ts`, `waitlist.ts`,
  `core-service/services/tenant-reference-data.ts`,
  `core-service/repositories/screen-permissions-repository.ts`,
  `revenue-service/consumers/reservation-event-consumer.ts`

`AGENTS.md` § Data & Query Discipline forbids this, and these are write paths.

---

## 06 — Cross-service fetch with no timeout · HIGH

`billing-service/src/services/business-calendar-settings-service.ts:45` calls core-service with
no `AbortSignal`. It runs from billing's `onReady` hook, so an unresponsive core-service hangs
billing's startup instead of failing fast.

Every other `fetch` sets a timeout, but each hand-rolls the same
`AbortController` + `setTimeout` + `clearTimeout` sequence — six copies across api-gateway
(`proxy.ts`, `health-routes.ts`), core-service (`webhook-service.ts`, `service-status.ts`),
notification (`webhook-provider.ts`), guests (`internal-api.ts`), fastify-server
(`registry-client.ts`).

The SSE proxy at `api-gateway/src/routes/misc-routes.ts:528` is correctly exempt — that stream is
meant to stay open.

**Fix.** One `fetchWithTimeout` in `@tartware/fastify-server`; make the sixth copy the last.

---

## 07 — DB access is a module singleton · MEDIUM

Each service builds one pool in `src/lib/db.ts` and re-exports `query`, `queryWithClient`,
`withTransaction`, `pool`. Import counts: `query` 155 files, `query + queryWithClient +
withTransaction` 25, `pool` 18, others ~20.

`AGENTS.md` § SOLID asks for injection. The style is consistent and works; the cost is that every
service-level test opens with `vi.mock("../src/lib/db.js")`, which is a large part of why so few
exist.

**Fix.** Low priority as a refactor, high value as a rule for new code: new services and new
repositories take their db handle as a parameter. Pairs naturally with 04.

---

## 08 — TSDoc coverage 8%–100% · MEDIUM

`AGENTS.md` requires TSDoc on public and critical methods. Weakest where it matters most —
shared packages everything depends on: telemetry 8%, availability-guard 11%, core-service 37%,
rooms 40%, revenue 40%. Strongest: candidate-pipeline 100%, command-consumer-utils 89%.

---

## 09 — Tests run in no local gate · MEDIUM

- `scripts/check-guardrail-coverage.mjs`: `REQUIRED_TARGETS = ["biome", "knip"]` — no `test`, so a
  package with zero tests reports green.
- `pnpm run build` = `check && nx run-many -t build && nx run-many -t typecheck` — never runs
  `test`.
- `.githooks/pre-push` runs check:frameworks, biome, knip.
- CI: `ci-guardrails.yml` runs two specific test targets; the per-package workflows run the rest
  only on `main`/`develop`/PR.

70 test files exist, ~20 covering domain logic. Billing has 6 for 28k LOC.

**Fix.** Add `"test"` to `REQUIRED_TARGETS` and `nx run-many -t test` to the build script.

---

## 10 — Guardrail rules to add · MEDIUM

`scripts/check-shared-framework-usage.mjs` already blocks raw Kafka clients and bare pino
loggers. Each finding above is expressible the same way:

1. `const resolveActorId` outside `command-utils.ts` → import it.
2. `class *CommandError extends Error` → extend the shared `CommandError`.
3. `createConsumerLifecycle` without `isRetryable` → or make the safe default internal (preferred).
4. `fetch(` with no `AbortSignal` → use the shared timeout wrapper.

---

## What is already solid

Recorded so it does not get re-litigated:

- **Schema-first, enforced.** Flow registry ↔ command catalog ↔ payload validators ↔ consumers ↔
  module registry conformance suites bind all 195 commands. Genuinely rare.
- **Idempotency.** 9 of 9 command consumers wire `createIdempotencyHandlers` with `fail-open`.
- **Configuration.** Every service parses env through zod schemas in `@tartware/config`, with
  production secret validation.
- **Pagination.** Caps live in the schema layer — `paginationFields` caps at 200, per-endpoint
  schemas tighten further.
- **Type safety.** 23 uses of `any` across ~120k lines; zero TODO/FIXME/HACK markers.
- **Service scaffolding.** Health routes, metrics, graceful shutdown and Fastify bootstrap are
  consistent across all eleven services.
- **Kafka clients.** All 13 go through `createKafkaClient` with a required logger, guardrailed.

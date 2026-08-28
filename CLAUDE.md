# Tartware — start here

Command-driven Property Management System. TypeScript monorepo, pnpm + Nx, targeting 20K ops/sec.
All writes go through the API Gateway's Command Center → transactional outbox → dispatcher →
Kafka → domain consumers; a command is durable at the outbox commit, and `202` means recorded,
not published. Reads are proxied straight to services. Postgres per-tenant scoped; OTLP
telemetry throughout.

**This file is the orientation. Read it before scanning the repo — the facts below are verified,
so use them instead of re-deriving them.** Depth lives in `AGENTS.md` (rules), `README.md`
(overview), `docs/` (design notes). Load those only when the task actually needs them.

---

## 1. Non-negotiables

Three gates. Breaking any of them is the top source of drift in this repo.

| Gate | Rule | Enforced by |
|------|------|-------------|
| **Schema-first** | No `z.object`, `interface`, or domain `type` in `Apps/`. Types live in `schema/` (`@tartware/schemas`), created there first, then imported. | Review + `AGENTS.md` § Schema-First |
| **Shared frameworks** | Never hand-roll what a shared package owns (see §3). | `pnpm run check:frameworks` |
| **Green build** | A task is done when `pnpm run build` exits 0 — not when typecheck passes. | `AGENTS.md` § Task Completion Gate |

Allowed local types: `z.infer` aliases, `.pick()/.omit()` derivations, env/config schemas,
Fastify decorator augmentation, single-file internal types. Full list in `AGENTS.md`.

---

## 2. Layout

```
Apps/          12 runtime services + 8 shared packages
schema/        @tartware/schemas — single source of truth for all domain types
scripts/       SQL DDL (tables/, indexes/, migrations/) + guardrail scripts
UI/            pms-ui (Angular), guest-portal
docs/          design notes;  pms-gaps/  capability gap plan of record
```

**Services and ports** (dev scripts in root `package.json`, ports step by 5):

| Port | Service | Role |
|------|---------|------|
| 3000 | core-service | Auth, tenants, users, settings, operations. Largest package (34k LOC). |
| 3010 | guests-service | Guest profiles, loyalty, check-out |
| 3015 | rooms-service | Room inventory, status, keys |
| 3020 | reservations-command-service | Reservation commands + outbox |
| 3025 | billing-service | Folios, charges, AR, night audit, GL (28k LOC) |
| 3030 | housekeeping-service | Housekeeping, maintenance, schedules |
| 3045 | availability-guard-service | Overbooking guard (+ gRPC 4400) |
| 3055 | notification-service | Templates, SSE, delivery providers |
| 3060 | revenue-service | Pricing, forecasting, compset |
| 3080 | document-service | Folio/invoice/statement rendering to PDF + HTML. Stateless — no DB, no Kafka. |
| 8080 | api-gateway | Entry point; hosts Command Center routes |

Next free port: **3085**. New services must be added to `dev:backend`/`dev:stack` and given a
`<SERVICE>_SERVICE_URL` in `dev:gateway`.

---

## 3. Shared frameworks — use the entry point

Going around one of these is how drift starts. `AGENTS.md` § Shared Frameworks holds the full
table; this is the working set.

| Concern | Entry point | Never |
|---------|-------------|-------|
| HTTP service | `buildFastifyServer()` / `bootstrapService()` — `@tartware/fastify-server` | bare `fastify()` |
| Outbound HTTP | `fetch(url, { signal: AbortSignal.timeout(ms) })` | a `fetch` with no deadline |
| Logger | `createServiceLogger()` — `@tartware/telemetry` | `pino()` directly |
| Kafka client | `createKafkaClient()` — `@tartware/command-consumer-utils/producer` | `new Kafka(...)` |
| Consumer lifecycle | `createConsumerLifecycle()` — `.../lifecycle` | bespoke run/disconnect |
| Tenant scope (consumers/loops) | `runWithTenantScope()` — `@tartware/config/db` | `enterTenantScope` off a request |
| Command helpers | `resolveActorId`, `asUuid`, `SYSTEM_ACTOR_ID`, `CommandError` — `.../command-utils` | local copies (see backlog 01–03) |
| DB pool / tenant scope | `createDbPool()`, `enterTenantScope()` — `@tartware/config/db` | local `new Pool(...)` |
| Outbox | `createOutboxRepository()` — `@tartware/outbox` | producing inside a transaction |
| Env config | zod schemas + `loadServiceConfig()` — `@tartware/config` | ad-hoc `process.env` reads |

Add a rule to `scripts/check-shared-framework-usage.mjs` whenever a new entry point becomes the
only right way to do something.

---

## 4. Commands

```bash
pnpm run dev                 # full backend stack (concurrently, all services)
pnpm run dev:billing         # one service (dev:core, dev:gateway, dev:rooms, …)
pnpm run dev:ui              # Angular pms-ui

pnpm run build               # THE gate: check → build → typecheck. Must exit 0.
pnpm run check               # guardrails + frameworks + lint + biome + knip + contrast + i18n
pnpm run check:frameworks    # shared-entry-point guardrail (fast, no build needed)
pnpm run test                # nx run-many -t test — also runs as the last step of build
pnpm run kafka:topics        # bootstrap Kafka topics
```

Per-package work: `npx nx run @tartware/<pkg>:{build,test,lint,biome,knip,typecheck}`.

**`./executables/tartware.sh`** is the operational CLI (run bare for interactive mode):

```bash
./executables/tartware.sh db setup      # full DB reset — required before re-running realdata E2E
./executables/tartware.sh db verify     # verification SQL
./executables/tartware.sh db health     # 20K ops/sec readiness check
./executables/tartware.sh docker up     # container stack (-d / -dd / -dr short forms)
./executables/tartware.sh stop          # kill backend (3000-3060, 8080) + UI (4200, 4300)
```

Underlying scripts live in `executables/<name>/`. If `stop` leaves anything behind,
`pkill -f "src/index.ts"` is the fallback that catches every service.

---

## 5. Verified baseline (25 Aug 2026 — don't re-scan for these)

- **Scale:** 19 packages, ~120k LOC, 665 tracked TS sources, 195 registered commands.
- **DB access:** each service builds one pool in `src/lib/db.ts` and re-exports
  `query` / `queryWithClient` / `withTransaction` / `pool`. ~220 files import those directly
  (module singleton, not injected). Tests isolate it with `vi.mock("../src/lib/db.js")`.
- **SQL placement:** every service now has a `repositories/` layer. What is left inline is
  deliberate: `SELECT 1` health probes, and statements whose WHERE/SET clause is assembled from
  supplied filters (reward catalogue, lost-and-found update, staff schedule update).
- **Consumers:** 9 command consumers, all wiring `createIdempotencyHandlers` + `fail-open`.
  Retry policy is `isRetryableByDefault` inside `createConsumerLifecycle` — honours
  `CommandError.retryable`; consumers only pass `isRetryable` to override it.
- **Kafka:** 13 clients, all through `createKafkaClient` with a required logger.
- **Tests:** ~73 test files. Most services use vitest; the small libs (config, telemetry, outbox,
  tenant-auth) use `node:test` with a `tsconfig.tests.json`. `test` is a required Nx target on
  every project (proto-types exempt — generated code) and runs at the end of `pnpm run build` and
  in the Guardrails workflow.
- **Type safety:** 23 uses of `any` repo-wide, zero TODO/FIXME/HACK markers.
- **Batched writes:** `buildValuesRows` / `chunkForBatch` in `@tartware/config/sql-batch` own the
  placeholder arithmetic for multi-row INSERTs. Never hand-roll it — an off-by-one binds every
  row after the first to the wrong column, which has happened here twice.
- **Audit columns:** `created_by`/`updated_by` are UUID in 155 tables, VARCHAR(100) in 21,
  VARCHAR(120) in 3 — the split matters, see backlog 01.
- Full findings: `docs/PATTERN_AUDIT.md` and the published report
  <https://claude.ai/code/artifact/b79f94ab-5e21-4c18-a880-f5d50b039bac>

---

## 6. Active backlog — pattern audit remediation

Working through these one at a time. Update the status column when one lands.
Findings 01–05 landed 25–26 Aug on `SOLID_Gaps`; detail per finding in
`docs/PATTERN_AUDIT.md`, published summary in the artifact linked in §5.

**CI note:** the Guardrails workflow builds workspace libraries before Lint.
eslint's type-aware rules resolve a workspace import through the target package's
`dist`, so a service holding a type from another package (e.g. `createKafkaClient`'s
return) reports a wall of `no-unsafe-*` errors when that dist is absent. If lint
fails in CI but passes locally, that is the reason — check the build step ran.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 01 | Critical | 6 services define a local `resolveActorId` falling back to non-UUID strings (`"COMMAND_CENTER"`, `"NOTIFICATION_SERVICE"`); `rooms` writes it into `mobile_keys.created_by UUID` → 22P02. Use the shared helper. | **done 25 Aug** |
| 02 | Critical | 5 of 9 consumers omit `isRetryable`, so deterministic failures burn the 1s/5s/30s ladder and stall the partition. | **done 25 Aug** |
| 03 | Critical | `CommandError` reinvented as 5 `*CommandError` classes; only 2 carry `retryable` — the root cause of 02. | **done 25 Aug** |
| 04 | High | Repository layer in 4 of 11 services; 84 files hold SQL in services/routes. | **done 25 Aug** — all 5 services without one now have it (revenue, rooms, notification, housekeeping, guests). Billing/core/reservations already had partial layers; deepening those is separate. |
| 05 | High | N+1 writes inside loops. | **done 25 Aug** — 10 loops batched via `buildValuesRows` (`@tartware/config/sql-batch`). Two stay per-row deliberately: group cutoff (per-group transaction isolation) and OTA intake (duplicate check reads state earlier iterations write). |
| 06 | High | `business-calendar-settings-service.ts:45` fetches with no `AbortSignal` on the startup path. | **done 26 Aug** — every `fetch` now carries `AbortSignal.timeout(...)`; five hand-rolled `AbortController` dances collapsed. No `fetchWithTimeout` wrapper: the platform one-liner already does it. Guardrail rule `fetch-timeout`. SSE proxy exempt. |
| 07 | Medium | DB singleton imported by ~220 files instead of injected (DIP). Fix forward on new code, pair with 04. | open |
| 08 | Medium | TSDoc coverage 8%–100%; weakest in shared packages (telemetry 8%, availability-guard 11%, core 37%). | open |
| 09 | Medium | Tests run in no local gate: `test` missing from `REQUIRED_TARGETS` and from `pnpm run build`. | **done 26 Aug** — `test` now required on every project (proto-types exempt), runs at the end of `pnpm run build`, and CI runs the whole suite instead of two cherry-picked ones. outbox and tenant-auth gained real tests. |
| 10 | Medium | Add guardrail rules for 01, 03, 02 and 06 to `scripts/check-shared-framework-usage.mjs`. | **done 26 Aug** — 5 rules: kafka-client, actor-resolution, command-error, fetch-timeout, pino-logger, plus an undeclared-workspace-dependency check. 02 needs no rule (safe by default). |

### WS-06 — document renderer (in progress)

`document-service` on **:3080** is the one build the workstream hangs on. Three layers, kept apart
on purpose:

- **Payloads** — `schema/src/api/documents.ts`. Assembled whole by the owning service; the renderer
  holds no database handle, so a folio PDF cannot disagree with the folio API about the balance.
- **Templates** — *data*, not code. A template is a list of sections whose values are payload paths,
  i18n keys, literals or joins. A new folio style is a new object.
- **Blocks** — `composeDocument()` in `schema/src/api/document-render.ts` resolves template + payload
  into already-formatted blocks. Both emitters read only that, so HTML and PDF cannot drift on
  content. Pure, no I/O, 52 tests.

PDF is `pdfkit` with Helvetica (WinAnsi: Latin scripts only). `DOCUMENT_BODY_FONT_PATH` registers a
TTF for anything else — the UI already ships `zh-TW`, which needs one. Not shipped in-repo: ~20 MB.

3 of the workstream's 13 items are closed (PMS-11-01, PMS-11-03, PMS-15-17); the other 10 are
unblocked but not built.

### WS-04 — lifecycle reversals and bulk operations (room move open)

Three commands in `reservations-command-service/src/services/reservation-commands/reversals.ts`:
`reservation.reverse_check_in`, `reservation.reverse_check_out`, `reservation.reinstate`.

The rule they all follow: **put back exactly what the reversed operation did, and nothing else.**
`OWNED_CHARGE_CODES` names the postings each operation owns; anything else on the folio makes the
reversal refuse (`FOLIO_HAS_OTHER_CHARGES`) rather than guess. Undoing a check-in must not void a
guest's bar tab. `force` proceeds and leaves the foreign charges standing.

- **Reason codes are mandatory** and resolve against `reason_codes` — previously a table with no
  rows, no route and no reader. Seeded tenant-wide by `scripts/data/defaults/seed-default-data.mjs`,
  readable at `GET /v1/reason-codes`, and the category enum gained `REVERSAL`.
- **`actual_check_in` / `actual_check_out` are now `.nullable()`** in `ReservationsSchema`.
  `undefined` means "leave alone" on an update payload, so a reversal needs `null` to clear the
  stamp — without it `z.coerce.date()` turns null into 1970-01-01.
- **Reinstatement takes the availability hold before changing status**, and fails closed on both
  `CONFLICT` (sold) and `ERROR` (guard could not answer). Overbooking on a shrug is worse than a
  refused reinstatement.
- Every reversal writes twice: `flow_approvals` for operations, `audit_logs` for compliance,
  carrying `balance_before` / `balance_after` so it is auditable without re-deriving.
- New commands need a row in the **flow registry** (`schema/src/flows/flow-registry.ts`), not just
  the service manifest — boot fails with `phantom_command` otherwise. Three more guardrails fire on
  a new command: a payload validator in `schema/src/command-validators.ts`, a catalogue row in
  `scripts/tables/01-core/10_command_center.sql`, and a **name literal somewhere in
  `Apps/api-gateway/src`** — the dispatchability test scans for it, so a command reachable only
  through the generic `execute` endpoint reads as unreachable.

#### Batch envelope

One `BatchCommand<T>` for every mass operation. `buildBatchCommandSchema(itemSchema, extraFields)`
in `schema/src/events/commands/batch.ts` stamps the command; `runBatchCommand` in
`@tartware/command-consumer-utils/batch` executes it. Mass cancel, mass check-in and mass update
ride it today (`reservation-commands/mass-operations.ts`); WS-15's group bulk actions reuse it.

- **One transaction per target, none around the batch.** The runner opens no transaction: each
  item's handler owns its own, so item 7 failing leaves 1–6 applied and durable. A batch is
  therefore *not* atomic, which is why the per-item record exists.
- **Each mass command is the single command applied N times** — `cancelReservation`,
  `checkInReservation`, `modifyReservation` verbatim. A rule added to one reaches the mass path the
  same day. This is why the handlers are eight lines each.
- **`dry_run` calls a separate `validateItem`, never `applyItem`.** The writing function is not
  reachable in a dry run, rather than trusted to check a flag. A command with no validator reports
  `DRY_RUN_NOT_SUPPORTED` instead of a clean run it never performed.
- **Results are persisted, not returned.** A batch is 202-accepted and the consumer discards handler
  return values — which is why `group.check_in` has always built a detailed summary and thrown it
  away. `command_batches` + `command_batch_items` hold one row per run and one per requested item,
  read at `GET /v1/tenants/:tenantId/commands/batches/:batchId`.
  `succeeded + failed + skipped === total` always holds.
- **A client-supplied `batch_id` makes a replay safe**: a finished batch returns its stored result
  instead of cancelling two hundred bookings twice. A killed run leaves the row `RUNNING` and needs
  a new id.
- Ceiling of 500 items: a batch is one Kafka message on one consumer, so its whole run time is
  head-of-line blocking for everything queued behind it.

Open: room move for an in-house guest (the remaining P0).

### Throughput (20K ops/sec target)

**Measured 26 Aug 2026** — full PMS flow (availability search → rate quote →
book → check-in → check-out → folio charge → payment → housekeeping), 51
tenants each with its own token, 12 gateway processes, 5 read replicas, 3
consumer replicas per domain, 128 partitions. Everything — setup, traffic and
verification — goes through the HTTP API; the harness touches no database.

| Metric | Result |
|--------|--------|
| Total ops (reads + writes) | **~4,551/sec** |
| Command acceptance | **2,995/sec**, 97.5% accepted |
| Rate lookup | p50 368 ms, p95 1.63 s |
| Availability search | p50 818 ms, p95 5.45 s |
| Read errors | 1.8% |
| Outbox after settle | **0 pending** |
| CPU during run | **92%** |

Short-lived gateway caching of the two funnel reads (availability 2 s, rates
30 s, invalidated on rate writes) was worth +31% total ops and cut rate-lookup
p95 from 9.35 s to 1.63 s. Safe because overbooking is prevented by
availability-guard when the command is *applied*, not by the search.

Reproduce: `./loadtest/run-full-test.sh 50 12 20000 90s` (resets the DB and runs
the whole sequence). Env knobs: `CONSUMER_REPLICAS`, `READ_REPLICAS`,
`SEED_GUESTS`, `SEED_RESERVATIONS`.

**The box, not the architecture, is the current limit — and ~39% of it is not
the system under test.** Measured per-process during load: k6 **289%** of a
core-equivalent, Chrome **208%**, docker-proxy **78%**, PgBouncer **55%**,
against 16 physical cores. A valid 20K measurement needs the load generator on
its own host; until then treat these as a floor.

Applied (not merely accepted) throughput went from ~274/sec at the start of this
work to ~2,700/sec, roughly 10x, via: 128 partitions, per-aggregate keying,
batched idempotency, intra-batch concurrency, consumer replicas, and raising
PgBouncer's `default_pool_size` — which was the hidden ceiling behind all of it.

| # | Finding | Status |
|---|---------|--------|
| T1 | Consumers drained one partition at a time (`partitionsConsumedConcurrently` unset → 1), capping a process at one command's latency, ~200/sec. | **done 25 Aug** — now configurable via `KAFKA_PARTITION_CONCURRENCY`, default 4. Required `runWithTenantScope` first: `enterWith` writes tenant scope back into the calling context, so a shared batch runner leaked the last tenant's scope. |
| T2 | Gateway accept path ran 5 standalone statements + a synchronous Kafka ack. With an RLS scope active each statement pays its own connect/BEGIN/`set_config`/COMMIT → ~25 round trips, 5 pool checkouts per command. | **done 25 Aug** — one transaction (~6 round trips, 1 checkout); publish moved to the outbox dispatcher. |
| T3 | Outbox was written then published inline and marked delivered in-request — full cost of a durable log, none of the benefit. | **done 25 Aug** — `Apps/api-gateway/src/command-center/dispatcher.ts` drains it with `sendBatch` + batched marking, adaptive polling, `FOR UPDATE SKIP LOCKED` so every replica can run one. |
| T4 | `DB_POOL_MAX` defaulted to 15 per pod. PgBouncer *was* already in `docker-compose.yml` (transaction mode) and `DB_PORT` already defaults to 5433, so services route through it — but there was no Kubernetes manifest, so in-cluster `DB_PORT=5433` resolved to nothing. | **done 25 Aug** — `DB_POOL_MAX` 15→50 (behind a transaction pooler a client connection is cheap; the real Postgres-side cap is PgBouncer's `default_pool_size`), PgBouncer limits made env-tunable, and `platform/kubernetes/pgbouncer.yaml` added. Code verified pooling-safe: `pg_advisory_xact_lock` not the session variant, no LISTEN/NOTIFY, no named prepared statements. |
| T5 | Kafka message keying: commands are keyed by command id, so there is **no ordering guarantee** between two commands on the same reservation or folio. Pre-existing, preserved deliberately through T3. Keying by tenant would fix ordering but hot-partition the largest tenants. Needs a decision. | open |
| T6 | Nothing was measured. | **done 25 Aug** — numbers above. Three blockers had to be cleared first, all recorded as T8-T10. |
| T8 | `loadtest/k6/command-pipeline.js` posts to `POST /v1/reservations`, which the gateway does not serve — every write 404s. The real endpoint is `POST /v1/commands/:name/execute`. `scenarios/*.js` also query `/v1/availability`, which 404s too. | open — new `scenarios/command-capacity.js` uses the real endpoint; the older files still need fixing |
| T9 | All 195 command feature flags ship `disabled` in the default seed, so every write returns 409 until they are enabled. `executables/test-accounts-realdata/test-multi-tenant.sh` bulk-enables them first and calls this the "FEATURE_DISABLED trap"; the load harness does not. | open — document it in `loadtest/README.md` |
| T10 | PgBouncer's resolver fails with `(bad-af)` against the compose DNS name and never connects, so every service falls over on startup with `08P01`. Worked around by pinning `PGBOUNCER_DATABASES_HOST` to the container IP. | open — needs a real fix, the IP changes on recreate |
| T7 | `reservations-command-service` outbox dispatcher publishes one record per `send()`, serially, on a 2s poll with a per-tenant throttle. | open — **now measured, and it is the top bottleneck**. Same run, same DB, same broker: the gateway's batched dispatcher drained **472,587 command rows to zero**, while this one moved **7 rows/sec** and fell *further* behind (203K PENDING and growing, ~7 hours to drain). That backlog is why `reservations` stays empty under load — the events never reach the consumer that creates the rows. Port the `sendBatch` + batched-marking + adaptive-poll design from `Apps/api-gateway/src/command-center/dispatcher.ts`. |
| T11 | `POST /v1/commands/:name/execute` hardcoded `rateLimit: { max: 120, timeWindow: "1 minute" }` — two commands a second on the endpoint every write goes through, unraisable by config, while `self-service-routes` and `misc-routes` already read `gatewayConfig.rateLimit.commandMax`. Capped the first load run at exactly 120 accepted commands. | **done 25 Aug** — now reads the same config, tunable via `API_GATEWAY_RATE_COMMAND_MAX` (default still 60/min; raise it deliberately per environment). |

---

## 7. Gotchas

- **Never `knip --fix` from the repo root** — it strips real dependencies and rewrites generated
  code. Use `npx nx run @tartware/<pkg>:knip` per package.
- **Stopping the stack:** `pkill -f "src/index.ts"` is the only pattern that gets every service.
  It is also the only *safe* one — every `dev:*` script sets `AUTH_JWT_ISSUER=tartware-core-service`,
  so a narrower `pkill -f "core-service"` matches the full command line of **every** service and
  kills the whole stack. Name the service by its `--filter` package if you need to stop just one.
- **E2E realdata suites** need a DB reset (`./scripts/setup-database.sh`) before a re-run.
- **UI work:** grep `UI/shared-styles/shared.scss` before writing component SCSS — reuse
  `.detail-card` / `.detail-list`; swap literal "Loading…" text for the `.skeleton` classes.
  Playwright does run here (unpack libs to `/tmp`, export `LD_LIBRARY_PATH`).
- **Workspace deps** that knip can't resolve go in the package's `knip.json` `ignoreDependencies`,
  matching how `@tartware/config` / `@tartware/schemas` are already handled.
- **Never `git push` without explicit confirmation.**

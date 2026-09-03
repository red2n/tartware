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
| **PURE DEV mode** | No migrations, no `ALTER TABLE … ADD COLUMN`. A schema change edits the `CREATE TABLE`; `db setup` rebuilds. | `pnpm run check:schema-discipline` |

Allowed local types: `z.infer` aliases, `.pick()/.omit()` derivations, env/config schemas,
Fastify decorator augmentation, single-file internal types. Full list in `AGENTS.md`.

---

## 1a. PURE DEV mode — no migrations (3 Sep 2026)

**There is no production deployment, no client, no QA environment, and no data anyone
could not recreate.** `./executables/tartware.sh db setup` rebuilds the whole schema from
`scripts/tables/` in under a minute. So the schema has exactly one description, and a
change to it **edits the `CREATE TABLE`**.

`scripts/migrations/` is **deleted** — 12 files plus an unused tracking-table script.
They were already dead: `setup-database.sh` never referenced them, no `schema_migrations`
table was ever created, and nothing in the repo executed them. Verified before deleting
that all 12 effects were present in a database built from `scripts/tables/` alone, so
nothing was lost. Their design reasoning was already carried in the base DDL — the
`FOLIO_CLOSE_OVERRIDE` split, the six RESTRICT / two SET NULL actor FKs,
`cashier_session_id` being permanently nullable, the step-up grant table's header.

**Why this matters beyond tidiness.** Two descriptions of one schema is the same defect
as a control correct in one path and absent in the path beside it — the shape this repo
spent a fortnight removing. They happened to agree on the day they were deleted, and
establishing *whether* they agreed needed a column-by-column query against a freshly
built database. Reading them could not settle it.

**Enforced by `check:schema-discipline`** (in `check`, so `build` runs it), which fails
on two things: `scripts/migrations/` coming back, and any **new**
`ALTER TABLE … ADD/DROP/ALTER COLUMN`. Verified by reintroducing each.

- `scripts/constraints/` is exempt — 119 files of `ADD CONSTRAINT` is how a schema with
  circular references gets its foreign keys, and it is not a column mutation.
- `tables/99_enforce_tenant_soft_delete.sql` is permanently exempt: it applies tenant and
  soft-delete columns to *every* table dynamically, and folding it would lose the property
  that makes it correct.
- **24 files still bolt a column on after their own CREATE TABLE** — inherited, listed in
  `UNFOLDED_COLUMNS`, and the list **may only shrink**: a stale entry fails the check, the
  same ratchet `KNOWN_UNTYPED` uses in `check-schema-first-tables.mjs`.

**Deleting them exposed a live bug, which is the argument made concretely.**
`sql-contract-check` parsed `scripts/migrations/*.sql` for `ALTER TABLE … ADD COLUMN` and
counted those columns as existing. Nothing executed that directory, so **five columns the
check vouched for had never existed in any database** — `travel_agent_commissions.agent_id`,
`commission_statements.agent_id`, `gds_reservation_queue.guest_id`,
`ota_reservations_queue.guest_id`, `folio_routing_rules.target_account_id` — while three
services queried four of them and failed `42703` at runtime. The check that exists to prove
"no query names a missing column" was green because it trusted a file nothing ran.
**A contract check that reads a second source of truth inherits that source's fiction.**

The four that code reads are now in their `CREATE TABLE` bodies; `target_account_id` was
left out because nothing reads it and an unused column is its own debt. `sql-contract-check`
no longer looks at migrations, and says so where the code used to be.

This also corrects something stated too strongly an hour earlier: the "all 12 migrations are
already in the base DDL" check was a **sample**, not a proof — it tested the tables and
columns picked by hand and missed these five. The exhaustive check was `sql-contract-check`
itself, and it only became exhaustive once the directory it trusted was gone.

**Historical references.** Sections below still cite migration numbers — "migration `008`",
"migration `009`" — because that is how those changes were delivered at the time and the
sentence is still true about *why* the column exists. The files are gone; the schema they
describe is in `scripts/tables/`. Don't go looking for them, and don't recreate them.

**When to lift this.** The day there is a real deployment holding data someone would miss:
cut the base DDL as baseline v1 and start a migration chain from there. That is a
deliberate decision with a date on it — not something that happens because one file
quietly reintroduced the pattern. **Until then, do not write a migration or an
`ALTER TABLE` unless explicitly asked to.**

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
pnpm run check:schema-discipline  # no migrations dir, no bolt-on columns (PURE DEV)
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

**CI note:** eslint's type-aware rules resolve a workspace import through the target
package's `dist`, so a service holding a type from another package (e.g.
`createKafkaClient`'s return) reported a wall of `no-unsafe-*` errors when that dist
was absent — green locally, red in CI, and only in the workflows that did not happen
to build first. `lint` now carries `dependsOn: ["^build"]` in `nx.json`, matching
`test` and `typecheck`, so Nx builds upstream packages before linting anything and the
trap is gone. Don't remove it to make lint faster.

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

Room move for an in-house guest landed in `66413d55` — `reservation.room_move`, guarded by
reason code, category, `requires_approval`, room sellability and a fresh availability hold.
It is the most complete override implementation in the repo and the model the findings below
point at.

### Override & authorization audit (28 Aug 2026 — all 11 findings closed 2 Sep)

Measured against OPERA. **Command breadth is already OPERA-class** — cashier shifts with
counted variance, fiscal period locking, folio windows and routing, comp accounting, walk,
waitlist, dunning, chargebacks, a night audit with a trial balance. The divergence is not what
the system can do, it is **who is allowed to do it**.

Three facts frame everything below:

- ~~**One permission level for all 202 commands.**~~ **Fixed by A02, 29 Aug.** Every command
  required `MANAGER`, so the clerk who checked a guest in had the same authority as the one who
  writes off bad debt, and `user_tenant_associations.permissions` (JSONB) was loaded into every
  request's auth context and read by nothing. Both are now load-bearing — see "A02, as landed".
- ~~**Overrides are logged, never authorized.**~~ **Fixed by A04–A09, 30 Aug – 2 Sep.** Every bypass
  wrote `flow_approvals` and nothing checked entitlement first; `force: true` on a payload was the
  whole mechanism. Now: the five commands that undo a completed accounting control need a *second
  actor* and cannot be run by one login at all (A04), a `force` costs the higher of the reason code's
  `approval_level` and `MANAGER` (A08), and a write-off or rate override is authorized by **amount**
  as well as by command (A06/A07). What is still true is that authority is checked, never
  re-proven — there is no supervisor step-up or re-auth anywhere in the repo, so the control is the
  operator's own membership, not a second credential at the terminal.
- **The flow guard is static.** It proves a command is wired up, not that an operator may run it.
  `dependsOn` is still checked for cycles and never consulted again. **Coverage improved 30 Aug:**
  a `LEDGER_CONTROL` flow took 66/202 to 80/202 and, more to the point, is the first flow whose
  `requiredGates` name a control that exists — dual control on the five. The runtime question
  ("legal in this state?") is answered for reservations as of A10, and only for reservations —
  the other 200 commands still have no declared state rule.

Full report: <https://claude.ai/code/artifact/0f5353d3-94f6-4c71-a2ee-a72a95c0b907>

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| A01 | Critical | Four-eyes took `actioned_by` / `requested_by` from the **request body**, so the self-approval check compared two caller-supplied strings — defeated by typing a colleague's id. `required_role` was stored and never compared. | **done 28 Aug** |
| A02 | Critical | No per-command permission, so no way to express an override as a distinct right. Everything is `MANAGER`. | **done 29 Aug** |
| A03 | High | `flow_approvals.role_at_approval` is a hardcoded literal at all 5 command-path call sites (`"FORCE_OVERRIDE"`, `"GM_OVERRIDE"`, …). The real role rides the envelope as `initiatedBy.role` all the way to the consumer, where `resolveActorId` reads only `.userId` and drops it. | **done 28 Aug** |
| A04 | High | `approval_requests` + `approval-service.ts` are a complete dual-control queue that no command handler ever enters, and approving does not dispatch the stored `operation_payload`. | **done 30 Aug** |
| A05 | High | `GUEST_BLACKLISTED` and `CREDIT_LIMIT_EXCEEDED` are hard throws with **no override path at all** — the blacklist error even cites "a GM override with documented reason", which does not exist. | **done 1 Sep** — blacklist landed with `assertOverrideAuthority`; the credit-limit half was schema-only (fields on three commands, read by nothing) and now enforces on payment authorize, capture and city-ledger transfer. |
| A06 | High | `reservation.rate_override` has no reason code (`reason` is `.optional()`), no threshold, no approval record. The settings catalogue already defines `discountApprovalThresholds`, `compNightsLimit` and `refundPolicy.requireApprovalAbove` — nothing reads them, and the roles they name are not in `TenantRoleEnum`. | **done 2 Sep** — mandatory RATE_OVERRIDE code, authority check, `flow_approvals` record, and the thresholds now read: `resolveSettings` left core-service for `settings-utils` in `@tartware/command-consumer-utils`, and `schema/src/api/override-thresholds.ts` turns the catalogue's rungs into an enforced demand. |
| A07 | High | `ar.city_ledger.write_off` takes free text, with no reason code, threshold, approval or `flow_approvals` row. | **done 2 Sep** — all three write-offs (`ar.city_ledger.write_off`, `billing.ar.write_off`, `billing.suspense.write_off`) enter one `write-off-gate.ts`: mandatory WRITE_OFF code, the acting role clearing its `approval_level`, the amount clearing the ladder, and a `flow_approvals` record written after the ledger moves. The reason-code picker its UI callers needed shipped with it. |
| A08 | High | `requires_approval` is honoured only by room move, and its escape hatch is `force` "on the authority of the caller" — which is the same `MANAGER`. `reason_codes.approval_level` (NONE/SUPERVISOR/MANAGER/DIRECTOR/GM) is read nowhere. | **done 2 Sep** — `forcedOverrideMinRole` + `assertForcedOverrideAuthority` in `command-utils`, at **8 sites**: room move, the three reversals, check-in, check-out and night audit. The first sweep stopped at four and left the only three controls the registry calls `kind: "gate"` unauthorized; the `forced-override-authority` guardrail is what found that, and is what keeps a ninth from being written without one. |
| A09 | Medium | `charge_postings.cashier_name` is free text with no FK to `cashier_sessions`, so a drawer cannot be reconciled against its own postings. `cashier_sessions.supervisor_overrides` has a GIN index and no writer. | **done 2 Sep** — `charge_postings.cashier_session_id` (migration `008`), written by `resolveOpenCashierSession`, which matches on the cashier and never on "the property's only open session". |
| A10 | Medium | No `RESERVATION_LEGAL_TRANSITIONS`, though `EVENT_BOOKING_LEGAL_TRANSITIONS` and `ALLOTMENT_LEGAL_TRANSITIONS` exist in `schema/` for two peripheral aggregates. Reservation status rules are inline literals across 8 files. | **done 30 Aug** |
| A11 | Medium | `pnpm run flow:integrity` (12 flow checks) is in neither `check` nor `build` nor CI. | **done 30 Aug** |

**A06–A09, as landed (2 Sep).** The audit is closed — every finding A01–A11 is done. The last
four had one shape between them: a control that existed, and an escape hatch nobody checked.

**The thresholds finally read.** `schema/src/api/override-thresholds.ts` turns the settings
catalogue's `discountApprovalThresholds`, `compNightsLimit` and `refundPolicy.requireApprovalAbove`
— declared since before the audit and read by nothing — into a demand the code enforces, so an
override is authorized by **amount** and not only by command. Discounting a room 5% and writing 90%
off it were the same command, cleared by the same role, recorded the same way. Two things had to be
true first: `resolveSettings` had to leave core-service, where billing and reservations could not
call it (it is `settings-utils` in `@tartware/command-consumer-utils` now); and the roles the policy
names — `REVENUE_MANAGER`, `GENERAL_MANAGER` — had to be translatable into `TenantRoleEnum`, on the
same rule `override-authority.ts` uses for SUPERVISOR and DIRECTOR: where the product has no
equivalent tier the demand rounds **up**, never down to "anyone".

**The shipped defaults are load-bearing, not a safety net.** The catalogue installer writes
`settings_definitions` under the demo tenant, so for every real property the policy lookup finds
nothing. If an absent policy meant "no threshold", this control would be on in sample data and off
everywhere that moves money — the same shape of defect that had all seventeen override reason codes
invisible outside the demo tenant. So the defaults in that file apply until a tenant states
otherwise, and the catalogue imports them rather than restating them.

**A08 was three lines once `approval_level` was readable — per site.** `forcedOverrideMinRole` takes
the higher of the reason code's `approval_level` and `MANAGER` when the code says
`requires_approval` — the flag that had been read by nothing — and `assertForcedOverrideAuthority`
refuses the force otherwise, failing closed with `OVERRIDE_AUTHORITY_UNKNOWN` on a level this product
cannot enforce (the column sits behind a CHECK constraint, which is one migration from holding
anything). Each call names its own declared gate, so the registry's closed vocabulary stays closed.

**The first sweep stopped at four, and missed the three that mattered most.** Room move and the
reversals got the check; check-in, check-out and night audit did not — and check-in/check-out hold
`reservation_status_check`, `deposit_required_check` and `folio_settlement_check`, the **only three
controls the registry declares `kind: "gate"` rather than "record"**. Each sat inside
`if (command.force)`, wrote its `flow_approvals` row, and asked nobody. Each also passed a hardcoded
reason code — `"FORCE_CHECK_IN"`, `"FORCE_CHECK_IN_REINSTATE"`, `"FORCE_CHECK_OUT"` — with no row in
`reason_codes`, the defect the night-audit work removed when it replaced `"SKIP_PRECONDITIONS"`.
That is *why* they were skipped: no real code means no `approval_level`, so there was nothing for an
authority check to measure. The halves are coupled, so both landed together — migration `009` adds
`CHECK_IN_OVERRIDE` / `CHECK_OUT_OVERRIDE` with nine system-tenant codes, and `reason_code` is now
mandatory whenever `force` is set (a `.refine`, like `skip_reason_code`). One category per
**command**, not per gate: a forced check-in can trip both its gates and the payload carries one
code. `express` is exempt on check-out — it settles the folio rather than bypassing the check.
Night audit was the fourth: it resolved its code correctly and never read it.

**Nothing caught that for four days, which is the actual lesson.** Guardrail rule
`forced-override-authority` in `check-shared-framework-usage.mjs` fails any file that writes
`forced: true` to `flow_approvals` without calling one of the two authority helpers. It is
file-level rather than a `RULES` entry on purpose: the assertion runs *before* the refusals it
authorises — room move resolves its code first so one check covers three gates — so it is never
inside the `recordFlowApproval` call, and a line rule with a forward-reading `satisfied` cannot
see it. Verified by deleting both asserts and watching it fire. An **unforced** move or reversal is untouched: A02's floor already governs who may run
the command, and gating a night manager's routine call would be theatre.

**Room move resolves its reason code before the three force-gated refusals**, so one authority check
covers all of them — forcing past a do-not-move flag, an approval-required code and a dirty room is
one decision, not three. The visible consequence is that an invalid reason code is now reported ahead
of a do-not-move refusal.

**A07's remainder: one gate, three commands.** `billing.ar.write_off` and `billing.suspense.write_off`
stayed on free text when the city-ledger one was hardened, for a stated reason — both have UI callers,
and demanding a reason code from a screen that could not offer one would have broken them. The picker
exists now, so all three enter `write-off-gate.ts` and the city-ledger one moved onto the shared gate
rather than keeping its copy. Four things a write-off owes, in order: a WRITE_OFF code ("which of bad
debt, goodwill, settled dispute and small balance was this year's £40k" is the first question asked of
write-offs); the acting role clearing the code's `approval_level`; the acting role clearing the amount
ladder; and a `flow_approvals` row written **after** the ledger moves — a record, not a gate, so
`forced` stays false. **Under dual control the ladder measures the requester, not the countersigner.**
All three are in `COMMAND_DUAL_CONTROL`, so the envelope reaching the handler keeps the requester as
`initiatedBy` and carries the approver as `metadata.approval`; measuring the approver would let a
clerk raise any amount so long as an owner rubber-stamped it.

**A09 binds a posting to its drawer.** `charge_postings.cashier_session_id` (migration `008`) is
permanently nullable — most postings have no drawer, and NULL says so truthfully rather than inventing
an attribution. `resolveOpenCashierSession` matches on the **cashier**, never on "the property's only
open session": crediting a posting to a drawer its operator was not holding is worse than leaving it
unattributed, because it is the reconciliation itself that would then be wrong.

**Three findings fixed rather than filed, all reference data that was invisible where it mattered.**
The reason-code list route read only the caller's tenant while `resolveReasonCode` also reads the
system tenant — so the new picker would have shown an empty list on every real property while every
handler went on accepting all 46 codes. The settings installer's demo-tenant scope is the second (see
the defaults above). And dual control could be **dispatched around**: `command-dispatch` now throws
`COMMAND_APPROVAL_UNAVAILABLE` (503) when a caller reaches it without the approval queue wired,
because dispatching a write-off *because the control could not run* is the exact failure dual control
exists to prevent.

Tests: 16 `command-utils`, 9 `cashier-attribution`, 10 `settings-utils`, 17 `write-off-reason`,
13 `blacklist-override`, 13 `rate-override-control`, 26 `room-move`, 36 `reversals` — plus **Phase 5g**
of `test-multi-tenant.sh`, which walks the blacklist override on a real guest. `flow:integrity` is
**102 checks, green**.

**A02, as landed.** `COMMAND_MIN_ROLE` in `schema/src/api/command-permissions.ts` declares a floor
for each of the 202 commands, on the same `TENANT_ROLE_PRIORITY` ladder A01 consolidated — no second
ordering. Four tiers with a stated principle each: **STAFF** the work of a shift (check-in, post a
charge, room status), **MANAGER** anything that reverses, waives, overrides or applies in bulk,
**ADMIN** permanent ledger movements and the config that decides how money is recorded, and
**OWNER** the five that undo a completed accounting control (`fiscal_period.reopen`,
`date_roll.manual`, the three write-offs). No command is within reach of VIEWER, and a test asserts
that.

It is enforced in exactly one place — `resolveCommandForTenant`, which is the choke point inside
`acceptCommand` and the first point that knows both the command name and the membership. So the
13 `requiredRole: "MANAGER"` literals are gone rather than relaxed: a coarser ladder in front of the
declared one silently wins whenever it is stricter. The route gates now use
`COMMAND_AUTHORITY_FLOOR`, **computed** from the declarations so it cannot drift below them, and the
proxy write scopes are untouched at `MANAGER`.

**`user_tenant_associations.permissions` finally means something.** `{"commands":{"allow":[…],
"deny":[…]}}` grants or removes one named command on one membership, written by
`POST /v1/user-tenant-associations/command-permissions` (ADMIN, core-service) — the column had no
write path at all, which would have left the grant unreachable. Both lists are absolute, an
unknown command name is a 400 rather than a stored grant of nothing, and **a grantor cannot grant
past their own role** (`GRANT_EXCEEDS_GRANTOR_AUTHORITY`), or an ADMIN could hand themselves an
OWNER-tier command and the ladder would be one call deep. Exact names only — a
`billing.*` wildcard is the shortcut this finding exists to remove. **Deny beats everything,
including OWNER** (a hotel keeping its GM out of `charge.void` is separating duties), and an
**undeclared command is refused outright** — a new command is unreachable until someone decides who
may run it, which is how the single-`MANAGER` model happened in the first place. The 403 says only
"not authorised"; the reason is logged, not returned, so a failed caller cannot map the model.
Guardrail rule `command-required-role`, verified by reintroducing a literal. 37 unit tests
(23 schema, 9 gateway, 5 core-service) plus **Phase 5c** of
`executables/test-accounts-realdata/test-multi-tenant.sh`, which walks the four behaviours
end-to-end on a real STAFF login.

Two things this does **not** do: it is a floor per command, not per amount, so A06's
`discountApprovalThresholds` still reads nothing; and it authorizes the *caller*, not a second
actor, so A04's approval queue is still unentered. Noted while here: `guest.gdpr.rectify` and
`guest.gdpr.restrict` are gateway routes naming commands that exist in neither the validator map
nor the catalogue — they 400 on payload validation today and did before this change.

**Flow-guard gates, as landed (30 Aug).** A10 answered "is this legal in this state?" for
reservations; this is the gate column of the registry finally meaning something. Three findings,
measured rather than inherited from the audit:

- **The gate model was disconnected in both directions.** Seven `gateName` literals were written to
  `flow_approvals` by reservations-command-service and declared by no flow, while three declared
  gates (night audit's) were verified by nothing — `flow:integrity` hand-wrote a check for
  `blacklist_check` and `dual_control` and for the other three nobody remembered. So the registry
  knew 5 gate names, the running system enforced 12, and it could not tell you whether 3 of its own
  5 still existed.
- **Only 2 of 5 declared gates were verified**, because the check lived apart from the declaration.
- **`skip_preconditions` recorded a reason code that did not have to exist.**

**`evidence` is the ratchet.** `FlowGateRequirement` now requires it — repo-relative file plus a
literal that must appear there — so a new gate *will not compile* without proof, and
`checkDeclaredControls` reads all of it in one loop instead of per-flow hand-written cases. The two
subsumed hand-written checks are gone rather than left duplicating it. `checkNoUndeclaredControls`
closes the other direction: no `gateName:` literal in `Apps/*/src` may be undeclared, which gives
`flow_approvals.gate_name` — free text, `VARCHAR` — a closed vocabulary for the first time. 88
checks, verified by breaking both directions (rename an enforced gate → `Undeclared control`; delete
the enforcing code → `declared but NOT enforced`).

**Not all seven were gates, and that distinction is now in the type.** Only three refuse:
`reservation_status_check` and `deposit_required_check` on check-in, `folio_settlement_check` on
check-out — each written inside an `if (force)`. The other four (`room_move`, the three reversals)
are written *unconditionally*: the operation is the controlled thing, and `forced` says whether a
gate was bypassed. `FlowControlKind` is `"gate" | "record"`, defaulting to `"gate"`. Declaring a
reversal as a precondition would have made the registry lie in a new way.

**Night audit's bypass.** It always wrote its `flow_approvals` rows — A03 already gave them the real
role — so the gap was narrower than "no audit trail": the row carried the hardcoded literal
`"SKIP_PRECONDITIONS"`, a code that needed no row, could not be grouped, and whose
`requires_approval` / `approval_level` were therefore unreadable. `skip_reason_code` is now
mandatory whenever `skip_preconditions` is set (a schema `.refine`), resolved against `reason_codes`
under a new `NIGHT_AUDIT` category (migration `006`, four seeded codes), and an unknown or
wrong-category code refuses the audit *before* anything is skipped. `resolveReasonCode` moved to
`@tartware/command-consumer-utils/command-utils` to make that possible — billing had none at all,
which is why it had a literal — and reservations' copy now delegates to it. The gate list it logs
against comes from `flowControlNames(FlowId.NIGHT_AUDIT)`, deleting a fourth copy of three names.

**Left alone deliberately:** `recordFlowApproval` still never throws. Its own comment states the
call — "an override that cannot be logged must not also fail the operation the operator deliberately
forced" — and reversing that is a repo-wide behavioural decision, not part of this change. The
reason-code resolution is the part that fails closed, and it runs first. 20 tests (15
command-consumer-utils, 5 billing) plus **Phase 5e** of `test-multi-tenant.sh`.

**A11 + registry coverage, as landed.** `pnpm run flow:integrity` is now in `pnpm run check` (so
`build` runs it) and a step in `ci-guardrails.yml`. It had been **failing** the whole time it sat in
no gate: it asserted a handler for `operations.maintenance.*`, three commands retired on 2026-08-18
when plain HTTP became the live path — every other file was updated and this one was not, which is
what a check nobody runs decays into. Now 78 checks, all green.

`FlowId.LEDGER_CONTROL` is the first new flow since the guest lifecycle: 14 commands that reverse,
forgive or reopen a posted entry, claimed by billing-service. Its `requiredGates` are the five
`dual_control` gates from A04, and **api-gateway now has a flow manifest** — its first — claiming
those gates and nothing else, because it is the service that enforces them (`acceptCommand`), while
the domain services still handle the commands. `validateServiceManifest` runs at gateway startup
with `mode: "throw"` like everywhere else. Deleting the deferral now breaks the boot instead of
breaking nothing: a void still voids and a write-off still writes off, so no behavioural test would
have noticed.

Two things the registry work turned up, both fixed rather than recorded:
- **The dispatchability test can be fooled by a manifest.** It counts any command literal in
  `api-gateway/src` as a dispatch path, and a *gate* declaration is not one. `flow-manifest.ts` is
  now excluded from that scan — otherwise declaring a gate would have credited five commands with a
  path they do not have.
- **Four commands had a handler, a catalogue row, a permission floor and no route**:
  `ar.city_ledger.write_off`, `billing.suspense.write_off`, `billing.deposit.waive`,
  `ar.payment.unapply` — reachable only through the generic execute endpoint, which is exactly how
  they stayed outside every flow. They now have routes under
  `/v1/tenants/:tenantId/billing/{city-ledger,suspense,deposits,cash-applications}/:entryId/...`.

Verified by breaking it three ways: dropping a gate from the gateway manifest fails the compliance
test with `unclaimed_gate`, and dropping a command from `COMMAND_DUAL_CONTROL` fails both
`flow:integrity` and the schema test that pins the set to A02's OWNER tier.

**A10, as landed.** `RESERVATION_LEGAL_TRANSITIONS` in `schema/src/api/reservations.ts` sits beside
the allotment table it was modelled on. Writing it turned up the thing the finding predicted:
the eight handler literals and pms-ui's own set had **already drifted in both directions** — the
reservation screen offered Cancel on a WAITLISTED booking the service refused, and hid it on the
INQUIRY and QUOTED bookings the service accepted. Neither side had the whole set; the table is the
union, and both now read it.

**A legality table alone cannot gate a command**, which is the part worth knowing. CHECKED_OUT →
CHECKED_IN is a perfectly legal edge — it is `reservation.reverse_check_out`'s, which reopens the
folio and refuses once the balance has gone to city ledger. Gating check-in on legality alone would
have let a caller undo a check-out by pressing Check In, and the first draft did exactly that until
an existing reversal test caught it. So `RESERVATION_COMMAND_TRANSITIONS` maps each edge to the
command that owns it, and a handler asks *"may **this command** make this move?"*. Two tests hold
the two halves together: no claim exceeds the legality table, and no `forcedFrom` exists that the
forced table does not declare.

**The hole this closed was `reservation.modify`.** It takes an optional status and wrote whatever it
was handed — CHECKED_OUT back to CONFIRMED with no reversal, CANCELLED to CHECKED_IN with no
reinstatement and no availability hold, a folio stranded either way — and `reservation.mass_update`
re-enters the same handler, so it was that 500 bookings at a time. What it may still do is
**derived, not listed**: `RESERVATION_UNCLAIMED_TRANSITIONS` is the legal edges no dedicated command
claims, today PENDING → CONFIRMED (a deposit landing) and WAITLISTED → PENDING/CONFIRMED. The day
someone writes a real command for one, that edge leaves the set on its own and the general editor
stops being able to shortcut it. `reservation.create` gained the matching entry rule
(`RESERVATION_INITIAL_STATUSES`) — booking straight into CHECKED_OUT was the other way past every
edge.

Three deliberate behaviour changes, each because the table forced a decision the literals had been
dodging: **cancel now accepts WAITLISTED** (the screen always offered it; a guest who no longer
wants to wait cancels); **`billing.no_show_charge` accepts PENDING**, matching `reservation.no_show`
— it is the one command outside the reservation aggregate that writes `reservations.status`, with a
raw UPDATE, and it now reads the same table rather than its own list; and **a reversal is refused
from a state that has nothing to reverse** rather than passing as a no-op. `force` opens only what
`RESERVATION_FORCED_TRANSITIONS` declares — NO_SHOW → CHECKED_IN, on check-in alone — and `modify`
does not consult it at all, because an override owes a `flow_approvals` row and only the specific
command writes one.

Guardrail rule `reservation-status-literal` fires on two adjacent double-quoted statuses, verified
by reintroducing `["INQUIRY", "QUOTED", "PENDING", "CONFIRMED"]` and watching it trip. It is
double-quotes-only on purpose: ~40 read-side SQL filters (`status IN ('CONFIRMED','CHECKED_IN')`)
say which bookings a report counts, not where one may move, and converting them would be wrong.
The script scans `Apps/*/src` only, so the pms-ui half rests on the shared import. 49 tests
(37 schema, 12 service) plus **Phase 4** of `test-ws04-lifecycle.sh`, which proves it on real data:
modify is 202-accepted and the booking does not move, while a statusless edit and the PENDING →
CONFIRMED deposit both still apply — the controlled comparison that says the pipeline works and the
guard is what stopped the rest.

Not done: `reservation_status_history` has a reader (core-service) and exactly one writer (a room
move in rooms-service), so the table its own DDL calls an audit trail of "every check-in/out/cancel"
holds room moves and nothing else. Now that every move goes through one guard that knows both
statuses, filling it is a small change — but it belongs in the event applier, which is a different
layer, so it is a finding rather than a silent extra.

**A04, as landed.** `COMMAND_DUAL_CONTROL` in `schema/src/api/command-approvals.ts` names the
commands one person may not run alone, and `acceptCommand` records them as `approval_requests` rows
instead of writing them to the outbox — the same choke point A02's floor is enforced at, so there is
no second route into the pipeline for a requester to use instead. Releasing one **dispatches the
stored payload**: approving now *causes* the operation rather than annotating it, which is the half
the queue never had.

The set is the **OWNER tier, exactly** — the three write-offs, `fiscal_period.reopen`,
`date_roll.manual` — and a test asserts the two declarations stay identical. It is not the wider
"high risk" list: a charge void or a folio reopen is correctable inside the front office and already
carries a floor, and a queue that fills with routine work gets rubber-stamped. Extending the map is
one line once A06/A08 give those commands thresholds. **A property needs two OWNER logins** to write
anything off — that is the control, not a bug, and the E2E suites now create their second approver
rather than working around it.

Mechanics worth knowing: `evaluateApprovalAction` in the same file is the *one* implementation of
the four rules (pending → unexpired → not the requester → clears `required_role`), and billing's
`approval-service` was moved onto it, so the two queues cannot drift. The approval carries
`command_name` / `request_id` / `requested_by_role` / `dispatched_command_id` (migration `005`), and
a unique index on `(tenant_id, command_name, request_id)` makes a resubmitted idempotency key report
the request it already raised instead of queueing a second write-off. The claim is a conditional
`UPDATE`, so two approvers pressing at once cannot both win; the dispatch that follows is a separate
transaction, and a failure there **releases the claim back to PENDING** rather than leaving a row
that reads APPROVED for a command that never ran. The dispatched envelope keeps the requester as
`initiatedBy` and carries the approver alongside as `metadata.approval` — the record has to say
which is which. Guardrail rule `approval-grant` keeps the grant that satisfies the gate mintable in
exactly one file. Routes: `GET|POST /v1/tenants/:tenantId/commands/approvals[/:approvalId][/approve|/reject]`.
33 tests (17 schema, 6 command-center-shared, 10 gateway; billing's 11 pass unchanged on the
shared evaluator) plus **Phase 5d** of `test-multi-tenant.sh`, which walks queue → refuse self → refuse a clerk → reject → replay → release
on a real AR balance. Not built: an approvals inbox in `pms-ui` — the three screens that submit
these commands now say the request was queued instead of claiming it ran, and the queue is readable
over the API only.

**A03, as landed.** `resolveActorRole()` sits beside `resolveActorId` in `command-utils` and
validates against `TenantRoleEnum`, so the literals it replaced cannot come back through it;
`SYSTEM_ACTOR_ROLE` is the fallback for a scheduler or replay and is deliberately **not** a member
of the enum. `CommandContext.initiatedBy` gained `role`, which the gateway had been stamping and
every consumer dropping. The "was this forced" fact that the old literals smuggled into the role
column now has its own `forced` flag on `FlowApprovalParams`, folded into `reason_notes` behind a
stable `FORCED:` prefix by both writers (`@tartware/config` and billing's repository) so the two
services read alike. Guardrail rule `approval-role-literal` fires on any quoted
`role_at_approval:` — verified by reintroducing `"GM_OVERRIDE"` and watching it trip. 6 tests.

**A01, as landed.** The role ladder now lives once, in `schema/src/shared/enums.ts` as
`TENANT_ROLE_PRIORITY` + `tenantRoleAtLeast()` — the same five numbers had been copied into
api-gateway, core-service and tenant-auth, and a fourth copy was about to be written. Routes are
the trust boundary: `Apps/billing-service/src/routes/approvals.ts` derives every identity from
`request.auth.userId` and passes the approver's membership role down, so the body can no longer
name who acted. `required_role` is enforced inside the same transaction that reads the row, and
**fails closed** on a value that is not a known role — the column is `VARCHAR(60)`, and an
unrecognised string scoring 0 would have admitted everyone. Approval is gated; rejection is not,
since declining needs no more authority than seeing the request. 8 tests in
`Apps/billing-service/tests/approval-service.test.ts`.

### Eight actor columns whose foreign key could never fire (3 Sep 2026)

Found while cleaning up test data, not by any check. `audit_logs.user_id` is `NOT NULL` and
`fk_audit_logs_user` is `ON DELETE SET NULL`. Postgres accepts both and then fails the delete at
runtime, so the constraint could not do what its own comment said:

```sql
-- Note: SET NULL to preserve audit trail if user is deleted
... ON DELETE SET NULL
user_id UUID NOT NULL
```

**A sweep of every table DDL against every constraint file found eight, not one** — all actor
attribution columns: `audit_logs.user_id`, `guest_notes.created_by`, `folios.created_by`,
`incident_reports.created_by`, `maintenance_requests.reported_by`, `night_audit_log.initiated_by`,
`rate_overrides.requested_by`, `refunds.requested_by`.

It is **latent, not live**: nothing in the application hard-deletes a user (`users.is_deleted` is
the only path), so it bites on manual cleanup and would bite hard the day an erasure job was written
against it.

**The eight do not deserve the same answer, and giving them one would be the actual mistake.** What
separates them is whether the row can still say who acted once the id is gone:

- **SET NULL** (drop `NOT NULL`) for the two that keep a denormalised actor — `audit_logs` has
  `user_email`/`user_name`/`user_role`, `guest_notes` has `created_by_name`/`created_by_role`. The
  trail survives the account.
- **RESTRICT** for the other six, where the column is the only record of who acted. Nulling
  `refunds.requested_by` or `rate_overrides.requested_by` keeps a financial control record and
  erases its author, which is the half that makes it a control — a refund nobody requested is not an
  audit trail, it is a hole in one. Since staff are soft-deleted, RESTRICT blocks nothing the product
  does; it refuses precisely the operation that would silently destroy attribution.

Migration `012`, matching table DDL, and `user_id`/`created_by` are `.nullable()` in
`AuditLogsSchema` and `GuestNotesSchema` — nullable rather than optional, because the column is
present and NULL, not absent.

**Verified on the live database, both directions.** Before: deleting a user with one `audit_logs`
row failed with `null value in column "user_id" ... violates not-null constraint`, the failing
statement being the FK's own `UPDATE ... SET user_id = NULL`. After: that delete succeeds with
`user_id` nulled and `user_name`/`user_email` intact, while deleting a user who created a folio is
refused by `fk_folios_created_by`. Every probe ran inside a rolled-back transaction; no rows left
behind.

### Three forces that bypassed a control on nobody's authority (3 Sep 2026)

The override audit closed A01–A11 and the guardrail written with A08 was supposed to keep it
closed. It could not see these three, because of the shape of the rule: `forced-override-authority`
fires on files that write `forced: true` to `flow_approvals`, which **trusts a bypass to declare
itself**. These wrote no row at all.

| Command | `force` bypasses | Was |
|---|---|---|
| `billing.folio.close` | an outstanding balance on the folio | STAFF tier, force checkbox shipped in pms-ui, no code, no check, no row |
| `billing.group.checkout` | unsettled member folios | no code, no check, no row |
| `group.check_in` | `blocks_check_in` deposit holds, up to 500 at once | no code, no check, no row |

**The last two bypass, in bulk, the controls the registry declares `kind: "gate"` on the
single-reservation path.** Since A08 a single departure over an unsettled folio has needed a reason
code and an authority; the *group* departure asked nobody. A control with a cheaper bulk route is
not a control, and the registry could not say so because a gate is declared per *command* —
`folio_settlement_check` named only `reservation.check_out`, so it read as enforced.

All three now resolve a reason code, call `assertForcedOverrideAuthority` (step-up included), and
write a `flow_approvals` row. Three new registry declarations with `evidence`, claimed in both
service manifests: 104 → **107 flow:integrity checks**.

**The record is written after the bypass, and only when it actually happened.** Forcing a group whose
deposits were all paid, or a folio that settled at zero, bypassed nothing — a row claiming otherwise
is worse than no row, being exactly the free-text `force: true` this replaces. `group.check_in` now
loads its blocking-deposit set **even when forcing**, which it never did: under force the set was
unread, so the handler could not say how many deposits the override stepped over. Timing follows the
credit-limit lesson: written after the write commits, so a retried handler does not record one
operator decision four times.

**`billing.folio.close` needed its own reason-code category, and reusing CHECK_OUT_OVERRIDE would
have been worse than free text.** Those codes describe a balance that *goes* somewhere —
`CO_TO_CITY_LEDGER` is level NONE precisely because billing an approved company account is not a
loss. Closing a folio moves nothing: no city-ledger transfer, no write-off entry, the balance simply
stops being collectable through the folio. A clerk could therefore have named a transfer that never
happens **and**, the code being level NONE, waived the authority check while doing it. Migration
`011` adds `FOLIO_CLOSE_OVERRIDE` with five system-tenant codes, none below SUPERVISOR, because
there is no unremarkable close over a balance. `FC_UNCOLLECTABLE` names the write-off in its own
description and sits at DIRECTOR: a balance nobody is pursuing should be written off, where dual
control and the amount ladder apply, and closing the folio instead reaches the same outcome with
neither — the code exists so that choice is recorded rather than hidden.

The two group commands **reuse** their single-reservation categories (CHECK_OUT_OVERRIDE,
CHECK_IN_OVERRIDE): the same decision at a different scale, and `flow_approvals.gate_name` then
groups the bulk bypass with the single one, which is how an auditor reads it.

**The permission floors are unchanged, deliberately.** `billing.folio.close` stays STAFF: settling a
folio at zero is the work of a shift, and the floor governs the command while the reason code's
`approval_level` governs the override. Raising the floor would have gated the ordinary close and
still left the force measured by nothing.

**The new guardrail inverts the old one's assumption.** `force-branch-authority` fails any file that
branches on `command.force` without calling an authority helper — no longer waiting for the bypass to
record itself. Exemptions are typed out, not inferred: `mass-operations.ts` is the one entry, because
it forwards `force` into the single-reservation command that does the asserting. Verified by
reproducing the original shape (assert *and* record deleted) and watching it fire.

Tests: 18 billing (`forced-settlement-authority`), 7 reservations (`group-forced-arrival-authority`).
The folio-close ones drive the real transaction rather than a stubbed `withTransaction` — the first
draft mocked it away and its assertions about what gets recorded passed whatever the code did, which
is how a test comes to agree with a bug. pms-ui's force-close checkbox now carries the picker, the
step-up prompt and a Get authorisation button, so the screen that could ask for a balance to be
abandoned is the second UI caller of the step-up dialog.

### Two things the E2E found that no unit test could (1 Sep 2026)

**`CommandError.retryable` was void at runtime, in every consumer.** Services run from source
through tsx and reach siblings by specifier, so a tsconfig path of the form
`"@tartware/pkg/*": ["../../pkg/src/*"]` silently misses any export whose *file* name differs from
its *export* name. Three did — `/lifecycle` (consumer-lifecycle.ts), `/idempotency`
(idempotency-repository.ts), `/batch` (batch-runner.ts) — and fell through the exports map to
`dist` while their neighbours resolved to `src`. Two copies of the module, two `CommandError`
classes, and `error instanceof CommandError` false for exactly the errors `isRetryableByDefault`
exists to recognise. Every deterministic rejection burned the full 4-attempt ladder (~36s) and
stalled its partition before landing in the DLQ anyway — with a DLQ entry whose own JSON read
`"retryable": false`. Findings 02 and 03 were not enforced by anything for as long as this existed.

The fix is a **value brand**: `COMMAND_ERROR_BRAND` plus `isCommandError`, which checks the brand
and the two fields the policy reads. `instanceof` is not used, because a monorepo in this shape can
always produce two identities and a safety default must not depend on getting resolution right
forever. The three subpaths also got explicit tsconfig paths in all six service tsconfigs, so the
split is gone as well as survivable. Guarded three ways: cross-copy tests in `retry-policy.test.ts`
(a `ForeignCommandError` — same shape and brand, unrelated identity — because every existing test
imported one copy and so could never see this), and a guardrail in
`check-shared-framework-usage.mjs` that fails any tsconfig mapping a package's `/*` to `src` while
an exported subpath has no source file of that name.

**Reference reason codes were invisible to every tenant but the demo one.** `resolveReasonCode`
resolves property → tenant → the all-zero **system** tenant, and 17 codes — every REVERSAL,
NIGHT_AUDIT, BLACKLIST and CREDIT_LIMIT one — were seeded under tenant `1111…` in
`default_seed.json`. So a night audit could not state why it skipped a precondition and no blacklist
override could name a code, on every property except the sample. All 17 moved into
`scripts/tables/09-reference-data/08_reason_codes.sql` beside the 23 that were always there;
reference data the handlers require ships with the schema. `checkOverrideReasonCodes` in
`flow:integrity` reads the categories out of the handlers themselves (both call shapes) and fails
any with no system-tenant row. 88 → 100 checks.

**Also: `pnpm run build` is not a clean build.** Deleting `dist/` leaves `tsconfig.tsbuildinfo`,
and tsc then believes declarations are current — emitting `.js` and `.d.ts.map` but no `.d.ts`, which
surfaces far away as `TS7016 … implicitly has an 'any' type` in whichever service imports the
subpath. A real clean is `nx reset` + `rm -rf */dist` + `rm **/*.tsbuildinfo`.

### Room blocks were never broken — the cache was (1 Sep 2026)

`INVARIANT: a 2-room block removes 2 rooms from sale — expected=2 actual=4` failed in every E2E run
for weeks, and reads exactly like an allotment that does not hold inventory. It is not. The
availability query subtracts allotment holds correctly; the gateway's 2-second availability cache
was answering the check from before the block existed.

**Rate writes invalidated that cache and allotment writes did not** — not by decision, but because
both caches were created inside `registerRoomRoutes`, so only that file could reach them. Any other
route family that moves inventory had no way to drop them. They now live in
`utils/read-caches.ts` as module singletons with `invalidateFunnelReads(tenantId)`, called by rate
writes as before and by every allotment verb: create, `PUT /:id` (pickup, cutoff) and
`POST /:id/status` (cancel) all change how many rooms the block holds.

Two seconds is a small window, and it opens in the least forgiving direction: immediately after
someone deliberately takes rooms out of sale, the funnel goes on offering them. Verified with no
sleeps — 4 → block 2 rooms → 2 → pick up 1 → 3 → cancel → 4, which is the assertion sequence the
E2E makes.

**The 429s beneath it were a second mask.** `http_test/smoke-operations.sh` writes faster than the
gateway's rate limiter allows and shares a token and address with the rest of the run, so it
out-runs whatever the ceiling is; twelve failures were four 429s and eight assertions downstream of
them reading `expected 2 got 0`. Its one request helper now passes `--retry`, which curl treats 429
as transient for and backs off from, honouring `Retry-After`. 12 failures → 1, and that one is a
fixture (no sellable room type in the window on a churned database), not an invariant.

### `ar.city_ledger.transfer` had never worked (1 Sep 2026)

Found by giving Phase 5f the fixture it had always been missing — `companies` is empty on a fresh
database and an AR account hangs off one, so the phase skipped silently on every run and the
credit-limit gate went unproven on real data.

**`42P10` on every transfer.** The insert infers `ON CONFLICT (tenant_id, folio_id, ar_account_id)
WHERE entry_status NOT IN (…)`, but `ar_city_ledger_folio_account_ux` is partial on
`folio_id IS NOT NULL AND entry_status NOT IN (…)`. Postgres requires the inference predicate to
*imply* the index predicate, and the missing null test meant it matched no index at all — "no unique
or exclusion constraint matching the ON CONFLICT specification". The command had no gateway route
until A11 and no test ever drove it, so taking a folio balance to a company's account has never once
succeeded. One clause.

**And an override recorded three times for a transfer that never happened.** `clearCreditLimitGate`
wrote its `flow_approvals` row *at the decision*, copying the blacklist gate. With the transfer
failing after it, the retry ladder re-ran the handler and wrote the row again per attempt. The
blacklist reasoning does not transfer: there the controlled thing is a refusal that was overridden,
here the row's whole meaning is that a balance moved, so a record per attempt is worse than none.
The gate now only authorises; `recordCreditLimitOverride` is called by each of the three sites after
its write commits. Verified on real data — one row, one ledger entry, role `OWNER`.

### Schema-first, now enforced (1 Sep 2026)

`pnpm run check:schema-first` (`scripts/check-schema-first-tables.mjs`, wired into `check`, so
`build` runs it) reads every `CREATE TABLE` and fails any without a declared shape in `schema/` —
`<Name>Schema`, `<Name>RowSchema` or `<Name>Row`, singular or plural. **253 tables, 241 typed, 12
known untyped.** The rule was the repo's first non-negotiable and the only one nothing checked.

Two tables had their row shapes in `Apps/` — the exact prohibition: `command_batches` /
`command_batch_items` (`CommandBatchRow`, `CommandBatchItemRow`, `CommandBatchDetail`, read from two
files) and `approval_requests` (`CommandApprovalRow`, read from three, while billing's own queue
reads the same table through a private shape). Both now live in `schema/src/api/`.

`KNOWN_UNTYPED` holds the remaining 12 with a note each, and **the check also fails when an entry
becomes stale**, so the list can only shrink. Nine are the AR ledger — `ar_accounts`,
`ar_city_ledger`, `ar_disputes`, `ar_aging_snapshots`, `ar_cash_applications`, `ar_dunning_events`,
`folio_windows`, `invoice_sequences`, `payment_gateway_webhooks` — all read through inline
`query<{ … }>` generics, every caller re-deriving the shape. That is the paydown queue, and it is
the corner that moves money.

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
| T9 | All 195 command feature flags ship `disabled` in the default seed, so every write returns 409 until they are enabled. `executables/test-accounts-realdata/test-multi-tenant.sh` bulk-enables them first and calls this the "FEATURE_DISABLED trap"; the load harness did not. | **partly done** — `loadtest/run-full-test.sh` now calls `loadtest/enable-via-api.sh` before traffic, so the harness enables them. Still undocumented: `loadtest/README.md` (75 lines) does not mention the trap, so anyone driving k6 by hand still hits it. |
| T10 | PgBouncer's resolver fails with `(bad-af)` against the compose DNS name and never connects, so every service falls over on startup with `08P01`. Worked around by pinning `PGBOUNCER_DATABASES_HOST` to the container IP. | open — needs a real fix, the IP changes on recreate |
| T7 | `reservations-command-service` outbox dispatcher publishes one record per `send()`, serially, on a 2s poll with a per-tenant throttle. | **done 1 Sep** — measured first, and it was the top bottleneck: same run, same DB, same broker, the gateway's batched dispatcher drained **472,587 command rows to zero** while this one moved **7 rows/sec** and fell *further* behind (203K PENDING, ~7 hours to drain), which is why `reservations` stayed empty under load. Rather than port the design, both now share it: the loop is `createOutboxDispatcher` in `@tartware/outbox`, and `Apps/reservations-command-service/src/outbox/dispatcher.ts` is a composition root supplying the producer, config, lifecycle bookkeeping and DLQ routing. Not re-measured under load since. |
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

# Tartware — start here

Command-driven Property Management System. TypeScript monorepo, pnpm + Nx, targeting 20K ops/sec.
All writes go through the API Gateway's Command Center → Kafka → domain consumers. Reads are
proxied straight to services. Postgres per-tenant scoped; OTLP telemetry throughout.

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
Apps/          11 runtime services + 8 shared packages
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
| 8080 | api-gateway | Entry point; hosts Command Center routes |

Next free port: **3080**. New services must be added to `dev:backend`/`dev:stack` and given a
`<SERVICE>_SERVICE_URL` in `dev:gateway`.

---

## 3. Shared frameworks — use the entry point

Going around one of these is how drift starts. `AGENTS.md` § Shared Frameworks holds the full
table; this is the working set.

| Concern | Entry point | Never |
|---------|-------------|-------|
| HTTP service | `buildFastifyServer()` / `bootstrapService()` — `@tartware/fastify-server` | bare `fastify()` |
| Logger | `createServiceLogger()` — `@tartware/telemetry` | `pino()` directly |
| Kafka client | `createKafkaClient()` — `@tartware/command-consumer-utils/producer` | `new Kafka(...)` |
| Consumer lifecycle | `createConsumerLifecycle()` — `.../lifecycle` | bespoke run/disconnect |
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
pnpm run test                # nx run-many -t test — NOT part of build (see backlog 09)
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
- **SQL placement:** `repositories/` exists only in billing, core, reservations,
  availability-guard. The other seven put SQL in `services/` and `routes/` (84 files).
- **Consumers:** 9 command consumers, all wiring `createIdempotencyHandlers` + `fail-open`.
  Only billing and reservations pass `isRetryable`.
- **Kafka:** 13 clients, all through `createKafkaClient` with a required logger.
- **Tests:** 70 test files; ~20 cover domain logic. Runner is vitest. `test` is not a required
  Nx target and `pnpm run build` does not run it.
- **Type safety:** 23 uses of `any` repo-wide, zero TODO/FIXME/HACK markers.
- **Audit columns:** `created_by`/`updated_by` are UUID in 155 tables, VARCHAR(100) in 21,
  VARCHAR(120) in 3 — the split matters, see backlog 01.
- Full findings: `docs/PATTERN_AUDIT.md` and the published report
  <https://claude.ai/code/artifact/b79f94ab-5e21-4c18-a880-f5d50b039bac>

---

## 6. Active backlog — pattern audit remediation

Working through these one at a time. Update the status column when one lands.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 01 | Critical | 6 services define a local `resolveActorId` falling back to non-UUID strings (`"COMMAND_CENTER"`, `"NOTIFICATION_SERVICE"`); `rooms` writes it into `mobile_keys.created_by UUID` → 22P02. Use the shared helper. | open |
| 02 | Critical | 5 of 9 consumers omit `isRetryable`, so deterministic failures burn the 1s/5s/30s ladder and stall the partition. | open |
| 03 | Critical | `CommandError` reinvented as 5 `*CommandError` classes; only 2 carry `retryable` — the root cause of 02. | open |
| 04 | High | Repository layer in 4 of 11 services; 84 files hold SQL in services/routes. `checkin-checkout.ts` = 1,229 lines / 25 statements / 14 tables. | open |
| 05 | High | N+1 writes inside loops in 10 files (group-booking, compset-service, night-audit, commission, ota-integration, waitlist, …). | open |
| 06 | High | `business-calendar-settings-service.ts:45` fetches with no `AbortSignal` on the startup path; 6 files hand-roll the same timeout dance → needs a shared `fetchWithTimeout`. | open |
| 07 | Medium | DB singleton imported by ~220 files instead of injected (DIP). Fix forward on new code, pair with 04. | open |
| 08 | Medium | TSDoc coverage 8%–100%; weakest in shared packages (telemetry 8%, availability-guard 11%, core 37%). | open |
| 09 | Medium | Tests run in no local gate: `test` missing from `REQUIRED_TARGETS` and from `pnpm run build`. | open |
| 10 | Medium | Add guardrail rules for 01, 03, 02 and 06 to `scripts/check-shared-framework-usage.mjs`. | open |

---

## 7. Gotchas

- **Never `knip --fix` from the repo root** — it strips real dependencies and rewrites generated
  code. Use `npx nx run @tartware/<pkg>:knip` per package.
- **Stopping the stack:** `pkill -f "src/index.ts"` is the only pattern that gets every service.
- **E2E realdata suites** need a DB reset (`./scripts/setup-database.sh`) before a re-run.
- **UI work:** grep `UI/shared-styles/shared.scss` before writing component SCSS — reuse
  `.detail-card` / `.detail-list`; swap literal "Loading…" text for the `.skeleton` classes.
  Playwright does run here (unpack libs to `/tmp`, export `LD_LIBRARY_PATH`).
- **Workspace deps** that knip can't resolve go in the package's `knip.json` `ignoreDependencies`,
  matching how `@tartware/config` / `@tartware/schemas` are already handled.
- **Never `git push` without explicit confirmation.**

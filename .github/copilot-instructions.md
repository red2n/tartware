# Copilot Instructions

**MANDATORY**: Before making ANY code changes, read and follow `/AGENTS.md`. It contains project-specific rules that override general coding practices.

> **SCHEMA FIRST — ABSOLUTE RULE.** Before writing any `type X = {`, `interface X {`, or `z.object({})` anywhere in `Apps/`: open `schema/src/` and check whether the shape already exists. If it does, import it. If it does not, create it in `schema/` first, run `npx nx run @tartware/schemas:build --skip-nx-cache`, then import. There are NO exceptions beyond the explicit ALLOWED list in this file.

## Architecture Overview

Tartware is a **command-driven Property Management System** (PMS) built as a pnpm/Nx TypeScript monorepo targeting 20K ops/sec.

```
Client → API Gateway (:8080) → Command Center → Kafka → Domain Services
                             → Proxy reads directly to domain services
```

- **Writes** flow through the Command Center into Kafka via a transactional outbox; domain services consume commands asynchronously.
- **Reads** are proxied by the API Gateway directly to domain services as HTTP GET requests.
- **CRUD REST** is only for low-velocity admin/config data or read endpoints.

### Key directories
| Directory | Purpose |
|-----------|---------|
| `Apps/` | All services and shared libraries (each is an Nx project) |
| `schema/` | `@tartware/schemas` — single source of truth for Zod schemas |
| `scripts/tables/` | Canonical SQL table scripts organized by category (`01-core/`, `02-inventory/`, etc.) |
| `scripts/02-enum-types.sql` | All PostgreSQL enum type definitions |
| `http_test/` | `.http` files for API testing via VS Code REST Client |
| `hospitality-standards/` | Domain reference docs for PMS industry knowledge |

### Shared libraries in `Apps/`
| Package | Role |
|---------|------|
| `fastify-server` | Standardized Fastify server builder with Helmet, CORS, metrics |
| `config` | Shared config loading (`loadServiceConfig`, `databaseSchema`) |
| `outbox` | Transactional outbox pattern for Kafka publishing |
| `command-center-shared` | Command dispatch types and repositories |
| `command-consumer-utils` | Kafka consumer utilities for domain services |
| `tenant-auth` | JWT auth + multi-tenant context extraction |
| `telemetry` | OpenTelemetry + Pino structured logging |
| `openapi-utils` | Swagger/OpenAPI helpers |

## Schema Ownership — `schema/` is the Single Source of Truth

- **NEVER define sharable types inside `Apps/`** — this includes Zod schemas, TypeScript `interface` declarations, `type` aliases, input/output shapes, provider contracts, and options objects. ALL sharable data shapes MUST live in `schema/` and be imported from `@tartware/schemas`.
- API response schemas → `schema/src/api/`; command schemas → `schema/src/events/commands/`; table schemas → `schema/src/schemas/`.
- **Allowed locally in `Apps/`:** route-specific query/param schemas, `.pick()`/`.omit().extend()` derivations, env/config schemas, thin `z.array()` wrappers, and `export type { X }` re-exports.
- After any schema change: `npx nx run @tartware/schemas:build --skip-nx-cache` (always use `--skip-nx-cache` — NX caches stale build results and will silently return an outdated success).

### What MUST go in `schema/` (FORBIDDEN locally in any service)

| Forbidden local pattern | Where it belongs |
|-------------------------|-----------------|
| `interface CreateXInput { ... }` / `interface UpdateXInput { ... }` | `schema/src/schemas/<domain>.ts` |
| `interface ListXInput { ... }` / `type GetXInput = { ... }` | `schema/src/schemas/<domain>.ts` |
| `interface XServiceInput { ... }` / `type XOutputShape = { ... }` | `schema/src/api/<domain>.ts` |
| `z.object({...})` domain/repository schemas | `schema/src/schemas/` or `schema/src/api/` |
| Command payload types | `schema/src/events/commands/<domain>.ts` |
| Event payload types | `schema/src/events/events/<domain>.ts` |
| Provider contracts / service interfaces used cross-layer | `schema/src/api/<domain>.ts` |
| Shared utility functions operating on domain data | `schema/src/api/<domain>.ts` |
| DB row shapes used by >1 file | `schema/src/schemas/<domain>.ts` |

### What MAY remain local (explicitly allowed)

| Allowed local pattern | Rationale |
|-----------------------|-----------|
| `type X = z.infer<typeof LocalQuerySchema>` | Route param extraction; no new shape |
| `.pick()` / `.omit().extend()` one-liner | Derivation only |
| `z.object` for `process.env` / service config | Config only; never shared |
| Fastify `.d.ts` decorator augmentation | Framework integration |
| JWT / auth-context interfaces in `core-service` | Auth layer; never cross-service |
| `BuildServerOptions` / plugin-local option types | Single-file infra only |
| `type Row = ExistingSchemaRow` (re-alias an import) | Rename only; no new shape |
| Single-file internal types never exported | Truly private; no shareability |

### Known allowed exception files — do NOT migrate these
These files are explicitly exempt from the schema-first rule. Do not move their types to `schema/`:

| File | Why it is allowed |
|------|------------------|
| `core-service/src/types/auth.ts` | JWT / auth-context for auth layer only |
| `core-service/src/types/system-admin.ts` | Fastify decorator augmentation for system admin scope |
| `core-service/src/services/auth-service.ts` | Auth-layer internal shapes |
| `core-service/src/lib/jwt.ts` | JWT payload types (`AccessTokenPayload`); auth layer only |
| `core-service/src/lib/cache.ts` | Generic LRU cache infrastructure; single-file, never shared |
| `core-service/src/lib/system-admin-rate-limiter.ts` | Rate limiter infra; single-file infrastructure only |
| `core-service/src/lib/tenant-auth-throttle.ts` | Auth throttle; auth layer only |
| `core-service/src/services/tenant-auth-security-service.ts` | Auth security profiles; auth layer, never cross-service |
| `core-service/src/services/user-cache-service.ts` | User/membership cache; single-service only |
| `core-service/src/services/membership-cache-hooks.ts` | Membership cache hooks; single-service internal |
| `settings-service/src/types/auth.ts` | Auth-context extension, never cross-service |
| `settings-service/src/services/membership-service.ts` | `Omit<>` derivation from schema type — ALLOWED pattern |
| `availability-guard-service/src/grpc/server.ts` | gRPC framework bindings (protocol types) |
| `reservations-command-service/src/clients/availability-guard-client.ts` | gRPC protocol client types |
| `api-gateway/src/utils/circuit-breaker.ts` | Infrastructure-only, single-file |
| `api-gateway/src/devtools/duplo-dashboard.ts` | Dev tooling, never production |
| `api-gateway/src/plugins/auth-context.ts` | Fastify plugin-local option types |
| `rooms-service/src/sql/dynamic-update-builder.ts` | SQL utility; single-file, never cross-service |
| `roll-service/src/cli/roll-replay.ts` | CLI tooling, never shared |
| Any `*.d.ts` file` | TypeScript ambient declarations |

### Row type naming convention
When a service needs a typed PostgreSQL query result row:
- Create it in `schema/src/api/<domain>-rows.ts` (e.g., `guest-rows.ts`, `reservation-rows.ts`)
- Name it `<Entity>Row` (e.g., `GuestRow`, `ReservationStayRow`)
- Use `type` (not `interface`), no Zod — these are raw `pg` result shapes
- Export from `schema/src/api/index.ts`; import as `import type { FooRow } from "@tartware/schemas"`
- **Never define `type XxxRow = { ... }` locally in a service**

### Compliance check — run before every commit
```bash
# Stage 1 — find candidate violations
grep -rn \
  "^type [A-Z]\|^interface [A-Z]\|^export type [A-Z]\|^export interface [A-Z]" \
  Apps/*/src/**/*.ts 2>/dev/null \
  | grep -v "\.d\.ts" \
  | grep -v "= z\.\|z\.infer" \
  | grep -v "export type { " \
  | grep -v "= [A-Z].*Row$\|= [A-Z].*Input\|= [A-Z].*Output\|= [A-Z].*Schema" \
  | grep -v "BuildServerOptions\|AuthContext\|TenantContext\|JwtPayload\|QueryRunner\|UpdateField"

# Stage 2 — list by file with counts (shows which service needs the most work)
grep -rn \
  "^type [A-Z]\|^interface [A-Z]\|^export type [A-Z]\|^export interface [A-Z]" \
  Apps/*/src/**/*.ts 2>/dev/null \
  | grep -v "\.d\.ts\|= z\.\|z\.infer\|export type { \|BuildServerOptions\|AuthContext\|TenantContext\|JwtPayload" \
  | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -20
```
Any result NOT matching the ALLOWED list or the known exception files above is a violation — move it to `schema/` before committing. See `AGENTS.md` for full rules and taxonomy.

## Schema-First Development

SQL and TypeScript schemas must stay in lockstep:
1. Add/update SQL in `scripts/tables/<category>/<file>.sql` (never date-prefixed migration files).
2. Add/update Zod schemas in `schema/src/`.
3. Run the SQL: `psql -h localhost -U postgres -d tartware -f scripts/tables/<category>/<file>.sql`.
4. Build schemas: `npx nx run @tartware/schemas:build --skip-nx-cache`.
5. When enums change, update both `scripts/02-enum-types.sql` and the corresponding Zod enum.

Use idempotent SQL patterns (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). New tables must be added to `scripts/tables/00-create-all-tables.sql`. See SQL documentation standard in `AGENTS.md`.

## Service Port Map

Ports increment by 5 starting at 3000. API gateway is **8080**. Next available: **3080**.

When adding a new service: assign the next port, add `dev:<name>` script in root `package.json`, update `dev:backend`/`dev:stack`, and add `<SERVICE>_SERVICE_URL` to `dev:gateway`.

## Service Structure Pattern

Each Fastify service follows this layout (reference: `Apps/rooms-service/`):
```
src/
  index.ts        # Entry point — calls buildServer() and listen()
  server.ts       # Uses buildFastifyServer() from @tartware/fastify-server
  config.ts       # Uses loadServiceConfig() from @tartware/config
  routes/         # Route handlers (register*Routes functions)
  services/       # Business logic
  plugins/        # Fastify plugins (auth-context, swagger)
  schemas/        # Route-local query/param schemas ONLY
  commands/       # Kafka command handlers (if applicable)
  kafka/          # Kafka consumer setup (if applicable)
  repositories/   # DB access layer
```

## Cross-Service Communication

| Pattern | From → To | Details |
|---------|-----------|---------|
| **HTTP Proxy** | api-gateway → all services | `fetch()` with circuit breaker (5-fail threshold, 30s reset), 30s timeout. Reads only. |
| **Kafka Commands** | api-gateway → `commands.primary` → domain services | Writes go through transactional outbox; consumers filter by `metadata.targetService`. |
| **Kafka Events** | reservations → `reservations.events` → roll-service, notification-service | Fan-out; each consumer uses its own group ID. |
| **gRPC** | reservations-command-service → availability-guard (:4400) | Room inventory locks. Bearer token auth via `GRPC_AUTH_TOKEN`. Retry + fail-open + shadow mode by default. |
| **HTTP Direct** | rooms-service → recommendation-service | Room ranking calls with 5s timeout via `RECOMMENDATION_SERVICE_URL`. |

### Kafka Topics (from `scripts/dev/bootstrap-kafka-topics.mjs`)
| Topic | Purpose |
|-------|---------|
| `commands.primary` (12 partitions, compact) | Main command bus — all domain commands |
| `commands.primary.dlq` (6 partitions, 7d retention) | Dead-letter queue for failed commands |
| `reservations.events` (12 partitions) | Reservation lifecycle events |
| `reservations.events.dlq` | DLQ for reservation events |
| `notifications.events` (6 partitions) | Notification delivery events |
| `roll.events.shadow` / `inventory.events.shadow` | Shadow ledger events |

### Special Service Roles
- **roll-service** — Internal Kafka consumer only (no command center). Builds a shadow roll ledger from `reservations.events` + DB backfill polling. Used for night audit / end-of-day processing.
- **notification-service** — Dual consumer: standard command center commands + `reservations.events` listener that auto-sends booking confirmations/cancellations.
- **availability-guard-service** — HTTP + gRPC dual-protocol. gRPC for sub-ms inventory locks from reservations pipeline. Proto: `proto/availability-guard.proto`.

## Wiring a New Command (End-to-End Checklist)

1. **Define Zod schema** in `schema/src/events/commands/<domain>.ts`
2. **Export** from `schema/src/events/commands/index.ts`
3. **Register validator** in `schema/src/command-validators.ts` (add entry to `commandPayloadValidators` Map)
4. **Build schemas**: `npx nx run @tartware/schemas:build`
5. **Seed DB**: INSERT into `command_templates` table (`command_name`, `default_target_service`, `default_topic="commands.primary"`, `required_modules`)
6. **In domain service**: add `case "<command.name>":` to `routeCommand()` switch in `commands/command-center-consumer.ts`
7. **Implement handler** in `services/`
8. **Test**: `POST http://localhost:8080/v1/commands/<command.name>/execute` with `{ tenant_id, payload }`

## Dev Workflow

```bash
pnpm install                    # Install all deps
docker compose up -d postgres redis kafka  # Start infrastructure
pnpm run kafka:topics           # Bootstrap Kafka topics
pnpm run dev                    # Start all services (concurrently)
```

### Testing — Always through the API Gateway
- **Always route requests through `localhost:8080`** — never call services directly on ports 3000–3065.
- Use `http_test/*.http` files or `curl` against the gateway.
- Auth: `TOKEN=$(./http_test/get-token.sh)` then `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v1/...`
- Default credentials: `setup.admin` / `TempPass123`.

### Quality commands
```bash
pnpm run build        # lint + biome + knip + compile all
pnpm run check        # lint + biome + knip (no compile)
pnpm run test         # all test suites
```

## Pre-Push Quality Gates

Before every commit intended for push, run on **all affected services**:
1. `cd Apps/<service> && npx biome check --write src/`
2. `cd Apps/<service> && npx knip`
3. `cd Apps/<service> && npx eslint src/` (0 errors required)

## Git & GitHub

- **NEVER push without asking the user first.** Commits are fine; pushes need explicit approval.
- **Always use GitHub CLI (`gh`)** for PR creation, reviews, issue management, comment replies, and thread resolution.
- Use `gh api graphql` for operations that require GraphQL (e.g., resolving review threads).

### Issue Tracking — Always Use GitHub, Never TODO.md

**When the user asks any variant of "what bugs are left", "what's open", "what issues remain", "what's next", or "show me the backlog":**
1. Run `gh issue list --state open --limit 50` to fetch current open issues from GitHub.
2. Do NOT read `TODO.md` for open work — TODO.md is a historical log, not the live backlog.
3. Group and summarize the issues by label (e.g., `bug`, `settings`, `folio-routing`, `billing-ui`, `production-readiness`) and priority label (`p0`, `p1`, `p2`, `p3`).
4. When starting work on an issue, reference the GH issue number in commit messages and close it with `gh issue close <number>` when done.

```bash
# Fetch all open issues
gh issue list --state open --limit 100 --json number,title,labels

# Filter to bugs only
gh issue list --state open --label bug

# Filter by priority
gh issue list --state open --label p0
gh issue list --state open --label p1
```

## Bug Fix Tracking

**Workflow — always follow this order:**
1. Run `gh issue list --state open --label bug --json number,title,labels` to get the current bug queue.
2. Work on the highest-priority open bug (P0 first, then P1, then P2).
3. When a bug is fixed and committed, close it: `gh issue close <number> --comment "<resolution notes>"`.
4. Update AGENTS.md and this file: move the bug from **Active** to **Completed** and set *Active* to the next bug.

### Active Bug
| # | Title | Priority |
|---|-------|----------|
| [#132](https://github.com/red2n/tartware/issues/132) | Group reservation did not have check-in | — |

### Completed Bugs
| # | Title | Fixed In | Notes |
|---|-------|----------|-------|
| [#127](https://github.com/red2n/tartware/issues/127) | Failed to process reservation event notification | `a089dfdd` | NULLIF($3, '')::uuid in GET_TEMPLATE_BY_CODE_SQL prevents invalid UUID cast for empty propertyId |
| [#128](https://github.com/red2n/tartware/issues/128) | column reference "room_type_id" is ambiguous | pre-existing | Already fixed — availability SQL uses qualified aliases throughout |
| [#193](https://github.com/red2n/tartware/issues/193) | FR-6: Fix group billing — store routing rules as proper DB rows | `710dd7b3` | Removed JSON blob from folio.notes; INSERT folio_routing_rules rows inside transaction |
| [#181](https://github.com/red2n/tartware/issues/181) | SETTINGS-BUG-2: MULTI_SELECT control falls back to text input in edit mode | `5d55f93d` | Added checkbox-group edit branch in settings.html; isMultiSelectChecked + onMultiSelectToggle in settings.ts; startEdit normalises stored value to string[] |
| [#180](https://github.com/red2n/tartware/issues/180) | SETTINGS-BUG-1: GET /settings/values returns empty in DB mode | `0c0e6c88` | settingsAuthPlugin: added request.auth.memberships fallback for tenantId |

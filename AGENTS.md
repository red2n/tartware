# Agent Instructions

## Project Principles
- This app targets 20K ops/sec; prefer designs that scale under sustained write throughput.
- Favor modular, low-coupling boundaries between services.
- Prefer asynchronous, command-based writes (event pipeline + transactional outbox) for high-volume domains.
- Use CRUD REST only for low-velocity admin/config data or read-only endpoints.

## TypeScript Design (SOLID)
- **Single Responsibility**: each module/class should do one thing; keep handlers thin and move logic into services.
- **Open/Closed**: prefer extension via composition/config over modifying core flows.
- **Liskov Substitution**: avoid fragile inheritance; use interfaces and ensure substitutability.
- **Interface Segregation**: keep interfaces small and focused; avoid “god” interfaces.
- **Dependency Inversion**: depend on abstractions; inject dependencies (db, cache, clients) rather than importing globals.
- **Naming**: file, variable, and method names must be human-readable and intent-revealing; avoid abbreviations unless domain-standard.
- **Docs**: add TSDoc for public/critical methods (core workflows, command handlers, and complex utilities).

## Schema-First Development — NON-NEGOTIABLE STANDARD

> **STOP GATE — enforce before every edit.**
> Before writing `type Foo = {`, `interface Foo {`, or any `z.object({})` in `Apps/`:
> 1. Search `schema/src/` — does this type already exist?
> 2. If not — create it in `schema/` FIRST, build, then import.
> 3. If yes — import from `@tartware/schemas`. Never redefine it locally.
> Skipping this gate is the #1 source of schema drift. There are no exceptions beyond the ALLOWED list below.

`schema/` (package: `@tartware/schemas`) is the **single source of truth** for all domain types. This is a hard architectural rule, not a guideline.

### FORBIDDEN in `Apps/` — MUST live in `schema/`
Never write any of these locally in a service:

| Forbidden pattern | Required location |
|-------------------|-------------------|
| `z.object({...})` / `z.string()` domain schemas | `schema/src/schemas/` or `schema/src/api/` |
| `interface InputType { ... }` for repository params | `schema/src/schemas/<domain>.ts` |
| `interface ServiceInput { ... }` for service-layer data | `schema/src/api/<domain>.ts` |
| `type OutputShape = { ... }` for API or command outputs | `schema/src/api/<domain>.ts` |
| Command payload types | `schema/src/events/commands/<domain>.ts` |
| Event payload types | `schema/src/events/events/<domain>.ts` |
| Cross-layer row shapes used by >1 file | `schema/src/schemas/<domain>.ts` |
| Provider contracts / service interfaces | `schema/src/api/<domain>.ts` |
| Shared utility functions on domain data | `schema/src/api/<domain>.ts` |

### ALLOWED locally in `Apps/`
These are the **only** patterns permitted as local types in service code:

| Allowed pattern | Rationale |
|-----------------|-----------|
| `type X = z.infer<typeof LocalSchema>` | Route-local param extraction; not a new shape |
| `.pick()` / `.omit().extend()` one-liner | Derivation from schema type; no new shape defined |
| `env/config` schemas (`z.object` for process.env) | Config only, never shared |
| Fastify decorator augmentation (`.d.ts` files) | Framework integration only |
| JWT / auth-context interfaces in `core-service` | Auth layer, never cross-service |
| `BuildServerOptions` / plugin-local option types | Single-file infrastructure only |
| `type Row = ExistingSchemaRow` re-alias | Renaming an import, not defining a shape |
| Single-file internal types never exported beyond the file | Truly internal; no shareability |

### Known allowed exception files — do NOT attempt to migrate these
These files contain types that are explicitly allowed locally by the rules above. Do not flag them as violations or move them to `schema/`:

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
| Any `*.d.ts` file | TypeScript ambient declarations |

### Schema directory taxonomy
```
schema/src/
  schemas/      ← Zod table schemas + DB row types (aligned with SQL tables)
  api/          ← API request/response shapes, shared service logic, provider interfaces
    *-rows.ts   ← Raw PostgreSQL query row shapes (type-only, no Zod — one per domain)
  events/
    commands/   ← Kafka command payloads (one file per domain)
    events/     ← Kafka event payloads
  types/        ← Re-exported TypeScript interfaces (non-Zod shared types)
```

**Row type naming convention** — when a service queries the DB and needs a typed row shape:
- File: `schema/src/api/<domain>-rows.ts`
- Exported name: `<Entity>Row` (e.g., `ReservationRow`, `GuestRow`, `AllotmentRow`)
- Type-only (`type`, not `interface`, no Zod) — these are raw `pg` query result shapes
- One file per domain group; import as `import type { FooRow } from "@tartware/schemas";`
- **Never define `type XxxRow = { ... }` locally in a service** — always create it in `schema/src/api/*-rows.ts` first

### Workflow — always schema first
1. Define the shape in `schema/src/<path>/<domain>.ts` first.
2. Export it from the appropriate `index.ts`.
3. Build: `npx nx run @tartware/schemas:build --skip-nx-cache` (always use `--skip-nx-cache` after adding or removing exported types — NX caches stale results).
4. Import from `@tartware/schemas` in `Apps/`.
5. Add or update corresponding SQL in `scripts/tables/` in lockstep.

### Schema compliance scan
Run this before any commit to detect violations. The two-stage filter reduces false positives:
```bash
# Stage 1 — find candidate type definitions
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
Any result NOT matching the ALLOWED list or the known exception files above is a violation — move it to `schema/` before committing.

### Other Schema-First rules
- Add or update schemas in `schema/src/schemas/...` before wiring new command handlers.
- Keep command payloads aligned with schema definitions and enums.
- Keep schema changes and SQL migrations in lockstep; never change one without the other.
- When enums change, update `scripts/02-enum-types.sql` alongside schema enums.
- Prefer additive, backward-compatible migrations: add nullable columns + defaults, backfill, then tighten constraints.
- Use idempotent migration patterns (`IF NOT EXISTS`) and avoid destructive changes without an explicit rollback plan.
- Add CHECK constraints for invariants (status enums, non-negative amounts) and keep audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) on new tables.

## SQL Migration Execution
- **Never create date-prefixed migration files** (e.g., `scripts/YYYY-MM-DD-*.sql`). All schema changes (new tables, new columns, seed data) must go directly into the canonical category table scripts under `scripts/tables/<category>/`.
- New tables get their own numbered file (e.g., `scripts/tables/03-bookings/56_overbooking_config.sql`) and must be added to `scripts/tables/00-create-all-tables.sql`.
- New columns on existing tables must be added to the existing canonical CREATE TABLE file (e.g., add columns to `08_rates.sql`, not a separate migration).
- New seed/reference data rows must be added to the existing seed INSERT in the canonical file (e.g., add charge codes to `07_charge_codes.sql`).
- After any table/column change, update the corresponding `verify-*.sql` script (table counts, column checks).
- After creating or modifying SQL scripts, execute them against local database: `psql -h localhost -U postgres -d tartware -f scripts/tables/<category>/<file>.sql`
- After running a migration, verify it succeeded by checking affected tables/columns exist.
- Use idempotent patterns (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) so scripts are safe to re-run.

## SQL File Documentation Standard
Every SQL table script must include all 6 documentation elements. Reference: `scripts/tables/01-core/01_tenants.sql`.

1. **File header block** — banner comment with filename, table name, industry standard, pattern, and date:
   ```sql
   -- =====================================================
   -- filename.sql
   -- Table description
   -- Industry Standard: ...
   -- Pattern: ...
   -- Date: YYYY-MM-DD
   -- =====================================================
   ```
2. **Section header** — banner with table name in caps and brief purpose (for larger/multi-table files):
   ```sql
   -- =====================================================
   -- TABLE_NAME TABLE
   -- Brief purpose description
   -- =====================================================
   ```
3. **Inline column comments** — `-- description` at the end of every column line in CREATE TABLE:
   ```sql
   name VARCHAR(200) NOT NULL, -- Legal name displayed in UI
   status tenant_status NOT NULL DEFAULT 'TRIAL', -- Subscription lifecycle flag
   ```
4. **COMMENT ON TABLE** — PostgreSQL catalog comment:
   ```sql
   COMMENT ON TABLE tablename IS 'Business purpose description';
   ```
5. **COMMENT ON COLUMN** — for all domain-significant columns (skip generic audit columns like `created_at`, `updated_at`):
   ```sql
   COMMENT ON COLUMN tablename.column IS 'Description of business meaning';
   ```
6. **`\echo` confirmation** — at the end of every file:
   ```sql
   \echo 'tablename table created successfully!'
   ```

## Reliability Defaults
- Every new command must support idempotency keys and deduplication.
- Use existing outbox patterns and Kafka throttling utilities.
- Ensure DLQ handling and replay tooling exist for new command streams.

## Data & Query Discipline
- Avoid N+1 query patterns; prefer JOINs/CTEs or batched queries with `IN (...)` for list endpoints.
- Enforce pagination (`limit`/`offset` or cursor) on list endpoints with sane caps.
- Add supporting indexes for new filter/sort fields in `scripts/indexes/`.
- Avoid unindexed JSONB filters on hot paths; add GIN indexes or normalize columns.
- Avoid `SELECT *` in production queries; select explicit columns.
- Every DB query should include a `WHERE` clause unless it is a bounded aggregate or maintenance operation.

## Performance & Integration
- Set explicit timeouts + retry with backoff for DB, Kafka, HTTP, and gRPC calls.
- Keep migrations in `scripts/` aligned with schemas in `schema/` (schema-first, lockstep changes).
- Add metrics for new command streams (throughput, lag, error, DLQ) by default.

## Root pnpm Overrides
Every entry in `pnpm.overrides` (root `package.json`) must have a documented reason. Only add overrides for packages actually in the dependency tree.
- **eslint 8.57.0** — Pin across all packages; v9 migration not yet complete.
- **rxjs 7.8.2** — Required by concurrently; pin to stable release.
- **js-yaml 4.1.1** — Security fix (prototype pollution CVE); used by eslint + nx.
- **@fastify/swagger ^9.6.1** — Align version across all Fastify services.
- **@fastify/swagger-ui ^5.2.3** — Align version across all Fastify services.
- **esbuild 0.27.2** — Pin for tsx; prevents unexpected binary re-downloads.

## Service Port Map
Canonical dev port assignments (set via `PORT=` env var in root `package.json` dev scripts). Ports increment by 5.

| Port | Service | Dev Script | Notes |
|------|---------|------------|-------|
| 3000 | core-service | `dev:core` | |
| 3005 | settings-service | `dev:settings` | |
| 3010 | guests-service | `dev:guests` | |
| 3015 | rooms-service | `dev:rooms` | |
| 3020 | reservations-command-service | `dev:reservations` | Kafka + outbox |
| 3025 | billing-service | `dev:billing` | |
| 3030 | housekeeping-service | `dev:housekeeping` | |
| 3035 | command-center-service | `dev:command-center` | Kafka + outbox |
| 3040 | recommendation-service | `dev:recommendation` | |
| 3045 | availability-guard-service | `dev:availability-guard` | + gRPC on 4400 |
| 3050 | roll-service | `dev:roll-service` | Internal consumer |
| 3055 | notification-service | `dev:notification-service` | Kafka consumer |
| 3060 | revenue-service | `dev:revenue` | Kafka consumer |
| 3065 | guest-experience-service | `dev:guest-experience` | Kafka consumer |
| 3070 | calculation-service | `dev:calculation` | Stateless |
| 3075 | service-registry | `dev:registry` | In-memory registry |
| 8080 | api-gateway | `dev:gateway` | Entry point |

- When adding a new service, assign the next port in the sequence (next: **3080**) and add it to `dev:backend`/`dev:stack` in root `package.json`.
- Add the service URL env var (`<SERVICE>_SERVICE_URL=http://localhost:<port>`) to the `dev:gateway` script.
- Non-HTTP services (shared libs, outbox, config, telemetry, tenant-auth) do not need a port.

## Testing & Data Access
- **Always use API routes** to test the application; do not use direct SQL queries or scripts (Python, TypeScript, shell) to GET, POST, PUT, or DELETE data in the database.
- **Always route requests through the API Gateway (port 8080)**—never call individual services directly (ports 3000–3065, etc.) during testing.
- Use `http_test/*.http` files or `curl` commands against `localhost:8080` for manual testing.
- The gateway provides unified authentication, rate limiting, and routing to backend services.
- Direct database access is only permitted for read-only diagnostics (e.g., verifying record counts) or one-time migration scripts—never for routine data manipulation during testing.

## Pre-Push Quality Gates
- **Before every `git push`**, run these three checks on all affected services and fix any failures:
  1. **Biome**: `cd Apps/<service> && npx biome check --write src/` (auto-fix formatting/lint)
  2. **Knip**: `cd Apps/<service> && npx knip` (detect unused exports/deps)
  3. **ESLint**: `cd Apps/<service> && npx eslint src/` (must have 0 errors; warnings are acceptable)
- If any check fails, fix the issues before committing.
- **Never push to git without explicit user confirmation.** Always ask the user before running `git push`.

## Git & GitHub — Issue Tracking

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

## UI Scope
- Unless explicitly asked, ignore UI changes.

## Bug Fix Tracking

**Workflow — always follow this order:**
1. Run `gh issue list --state open --label bug --json number,title,labels` to get the current bug queue.
2. Work on the highest-priority open bug (P0 first, then P1, then P2).
3. When a bug is fixed and committed, close it: `gh issue close <number> --comment "<resolution notes>"`.
4. Update this section: move the bug from **Active** to **Completed** and set *Active* to the next bug.

### Active Bug
| # | Title | Priority |
|---|-------|----------|
| [#127](https://github.com/red2n/tartware/issues/127) | Failed to process reservation event notification | P0 |

### Completed Bugs
| # | Title | Fixed In | Notes |
|---|-------|----------|-------|
| [#128](https://github.com/red2n/tartware/issues/128) | column reference "room_type_id" is ambiguous | pre-existing | Already fixed — availability SQL uses qualified aliases throughout |
| [#193](https://github.com/red2n/tartware/issues/193) | FR-6: Fix group billing — store routing rules as proper DB rows | `710dd7b3` | Removed JSON blob from folio.notes; INSERT folio_routing_rules rows inside transaction |
| [#181](https://github.com/red2n/tartware/issues/181) | SETTINGS-BUG-2: MULTI_SELECT control falls back to text input in edit mode | `5d55f93d` | Added checkbox-group edit branch in settings.html; isMultiSelectChecked + onMultiSelectToggle in settings.ts; startEdit normalises stored value to string[] |
| [#180](https://github.com/red2n/tartware/issues/180) | SETTINGS-BUG-1: GET /settings/values returns empty in DB mode | `0c0e6c88` | settingsAuthPlugin: added request.auth.memberships fallback for tenantId |

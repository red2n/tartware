# tartware Agent Instructions

## Priority Ladder
When rules conflict, this order wins:

1. **Safety / non-destructive** — never drop, truncate, or destructively migrate without an explicit rollback plan
2. **Schema-first** — no type may exist in `Apps/` before it exists in `schema/`
3. **Build must pass** — a task is not done until `pnpm run build` exits 0
4. **Test via API gateway only** — all test requests go through port 8080
5. **Performance** — 20K ops/sec target; async command writes for high-volume domains, CRUD only for config/admin

---

## 🛑 STOP GATE 1 — Before Writing Any Type

Before writing `type Foo = {`, `interface Foo {`, or `z.object({})` anywhere in `Apps/`:

1. Search `schema/src/` — does this type already exist?
2. **If yes** → import from `@tartware/schemas`. Stop here.
3. **If no** → create it in `schema/` first, build, then import.

**Skipping this gate is the #1 source of schema drift. No exceptions beyond the ALLOWED list.**

---

## Schema Package (`@tartware/schemas`)

`schema/` is the single source of truth for all domain types. This is a hard architectural rule.

### Directory Taxonomy

```
schema/src/
  schemas/        ← Zod table schemas + DB row types (aligned with SQL tables)
  api/            ← API request/response shapes, provider interfaces, shared service logic
    *-rows.ts     ← Raw PostgreSQL query row shapes (type-only, no Zod — one per domain)
  events/
    commands/     ← Kafka command payloads (one file per domain)
    events/       ← Kafka event payloads
  types/          ← Re-exported TypeScript interfaces (non-Zod shared types)
```

### FORBIDDEN in `Apps/` — Must Live in `schema/`

| Forbidden pattern | Required location |
|---|---|
| `z.object({...})` / `z.string()` domain schemas | `schema/src/schemas/` or `schema/src/api/` |
| `interface InputType { ... }` for repository params | `schema/src/schemas/<domain>.ts` |
| `interface ServiceInput { ... }` for service-layer data | `schema/src/api/<domain>.ts` |
| `type OutputShape = { ... }` for API/command outputs | `schema/src/api/<domain>.ts` |
| Command payload types | `schema/src/events/commands/<domain>.ts` |
| Event payload types | `schema/src/events/events/<domain>.ts` |
| Cross-layer row shapes used by >1 file | `schema/src/schemas/<domain>.ts` |
| Provider contracts / service interfaces | `schema/src/api/<domain>.ts` |
| `type XxxRow = { ... }` DB row shapes | `schema/src/api/<domain>-rows.ts` |

### ALLOWED Locally in `Apps/`

| Allowed pattern | Rationale |
|---|---|
| `type X = z.infer<typeof LocalSchema>` | Route-local param extraction only |
| `.pick()` / `.omit().extend()` one-liner | Derivation from existing schema type |
| `env/config` schemas (`z.object` for process.env) | Config only, never shared |
| Fastify decorator augmentation (`.d.ts` files) | Framework integration only |
| JWT / auth-context interfaces in `core-service` | Auth layer, never cross-service |
| `BuildServerOptions` / plugin-local option types | Single-file infrastructure only |
| `type Row = ExistingSchemaRow` re-alias | Renaming an import, not defining a shape |
| Single-file internal types never exported | Truly internal; no shareability |

### Known Allowed Exception Files — Do NOT Migrate These

| File | Why it is allowed |
|---|---|
| `core-service/src/types/auth.ts` | JWT / auth-context for auth layer only |
| `core-service/src/types/system-admin.ts` | Fastify decorator augmentation |
| `core-service/src/services/auth-service.ts` | Auth-layer internal shapes |
| `core-service/src/lib/jwt.ts` | JWT payload types; auth layer only |
| `core-service/src/lib/cache.ts` | Generic LRU cache; single-file infrastructure |
| `core-service/src/lib/system-admin-rate-limiter.ts` | Rate limiter infra; single-file |
| `core-service/src/lib/tenant-auth-throttle.ts` | Auth throttle; auth layer only |
| `core-service/src/services/tenant-auth-security-service.ts` | Auth security; auth layer only |
| `core-service/src/services/user-cache-service.ts` | User/membership cache; single-service |
| `core-service/src/services/membership-cache-hooks.ts` | Membership cache hooks; internal |
| `settings-service/src/types/auth.ts` | Auth-context extension; never cross-service |
| `settings-service/src/services/membership-service.ts` | `Omit<>` derivation — ALLOWED pattern |
| `availability-guard-service/src/grpc/server.ts` | gRPC framework bindings |
| `reservations-command-service/src/clients/availability-guard-client.ts` | gRPC protocol client types |
| `api-gateway/src/utils/circuit-breaker.ts` | Infrastructure-only; single-file |
| `api-gateway/src/devtools/duplo-dashboard.ts` | Dev tooling; never production |
| `api-gateway/src/plugins/auth-context.ts` | Fastify plugin-local option types |
| `rooms-service/src/sql/dynamic-update-builder.ts` | SQL utility; single-file |
| `roll-service/src/cli/roll-replay.ts` | CLI tooling; never shared |
| Any `*.d.ts` file | TypeScript ambient declarations |

### Schema-First Workflow

```
1. Define shape in schema/src/<path>/<domain>.ts
2. Export from the appropriate index.ts
3. Build: npx nx run @tartware/schemas:build --skip-nx-cache
   (always use --skip-nx-cache after adding or removing exported types)
4. Import from @tartware/schemas in Apps/
5. Add or update SQL in scripts/tables/ in lockstep
```

### Schema Compliance Scan (Run Before Every Commit)

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

# Stage 2 — count by file (shows which service needs the most work)
grep -rn \
  "^type [A-Z]\|^interface [A-Z]\|^export type [A-Z]\|^export interface [A-Z]" \
  Apps/*/src/**/*.ts 2>/dev/null \
  | grep -v "\.d\.ts\|= z\.\|z\.infer\|export type { \|BuildServerOptions\|AuthContext\|TenantContext\|JwtPayload" \
  | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -20
```

Any result not matching the ALLOWED list or the known exception files is a violation — move it to `schema/` before committing.

---

## SQL Migrations

### Where Changes Go

- **New tables** → new numbered file under `scripts/tables/<category>/` (e.g., `56_overbooking_config.sql`). Register in `scripts/tables/00-create-all-tables.sql`.
- **New columns on existing tables** → edit the existing canonical CREATE TABLE file (e.g., `08_rates.sql`). Never create a separate migration file.
- **New seed/reference data** → add rows to the existing seed INSERT in the canonical file.
- **Never create date-prefixed migration files** (e.g., `scripts/YYYY-MM-DD-*.sql`).

### After Every SQL Change

```bash
# Execute
psql -h localhost -U postgres -d tartware -f scripts/tables/<category>/<file>.sql

# Verify
# Run the corresponding verify-*.sql script and confirm affected tables/columns exist
```

### SQL Idempotency

Always use:
- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- `ON CONFLICT DO NOTHING`

Scripts must be safe to re-run without side effects.

### SQL File Documentation Standard

Every table script must include all 6 elements. Reference: `scripts/tables/01-core/01_tenants.sql`.

```sql
-- =====================================================
-- filename.sql
-- Table description
-- Industry Standard: ...
-- Pattern: ...
-- Date: YYYY-MM-DD
-- =====================================================

-- Inline column comment on every column line:
name VARCHAR(200) NOT NULL, -- Legal name displayed in UI

-- PostgreSQL catalog comment:
COMMENT ON TABLE tablename IS 'Business purpose description';
COMMENT ON COLUMN tablename.column IS 'Description of business meaning';
-- (Skip generic audit columns: created_at, updated_at)

-- Confirmation at end of file:
\echo 'tablename table created successfully!'
```

### Migration Principles

- Additive, backward-compatible first: add nullable + default → backfill → tighten constraints.
- Keep schema changes and SQL migrations in lockstep. Never change one without the other.
- When enums change, update `scripts/02-enum-types.sql` alongside schema enums.
- Add CHECK constraints for invariants (status enums, non-negative amounts).
- Every new table needs audit fields: `created_at`, `updated_at`, `created_by`, `updated_by`.
- Add supporting indexes for new filter/sort fields in `scripts/indexes/`.

---

## TypeScript Design Principles

### SOLID — Applied to This Repo

- **Single Responsibility** — keep route handlers thin; move logic into services.
- **Open/Closed** — extend via composition/config; never modify core flows directly.
- **Liskov Substitution** — use interfaces; avoid fragile inheritance.
- **Interface Segregation** — small, focused interfaces; no "god" interfaces.
- **Dependency Inversion** — inject db, cache, and clients; never import globals.

### Naming and Docs

- Names must be human-readable and intent-revealing. No abbreviations unless domain-standard.
- Add TSDoc to all public/critical methods: core workflows, command handlers, complex utilities.

---

## Architecture Defaults

### Write Path
- High-volume domains → async command writes via event pipeline + transactional outbox.
- CRUD REST → low-velocity admin/config data and read-only endpoints only.
- Every new command must support idempotency keys and deduplication.
- Use existing outbox patterns and Kafka throttling utilities.
- Ensure DLQ handling and replay tooling exist for new command streams.

### Query Discipline
- No N+1 queries — prefer JOINs/CTEs or batched `IN (...)`.
- All list endpoints must have pagination (`limit`/`offset` or cursor) with sane caps.
- No `SELECT *` in production queries — select explicit columns.
- Every DB query must have a `WHERE` clause unless it is a bounded aggregate.
- No unindexed JSONB filters on hot paths — add GIN indexes or normalize the column.

### Reliability
- Set explicit timeouts + retry with backoff for DB, Kafka, HTTP, and gRPC calls.
- Add metrics (throughput, lag, error rate, DLQ) for every new command stream by default.

---

## 🛑 STOP GATE 2 — Task Completion

**A task is NOT complete until `pnpm run build` exits 0.**

```bash
# Run from monorepo root — must exit 0
pnpm run build   # lint + biome + knip + compile all projects
```

Steps:
1. Run `pnpm run build`.
2. If it fails, fix all errors before marking the task complete.
3. Only mark a todo as `completed` after a clean build is confirmed.

This supersedes all other completion signals (typecheck passing, no TS errors in one service, etc.).

---

## Pre-Push Quality Gates

Run these on all affected services before every `git push`:

```bash
# 1. Biome — auto-fix formatting/lint
cd Apps/<service> && npx biome check --write src/

# 2. Knip — detect unused exports/deps
cd Apps/<service> && npx knip

# 3. ESLint — must exit with 0 errors (warnings are acceptable)
cd Apps/<service> && npx eslint src/
```

**Never push to git without explicit user confirmation.** Always ask the user before running `git push`.

---

## Testing Rules

- **All test requests go through the API Gateway (port 8080).** Never call individual services directly (ports 3000–3065).
- Use `http_test/*.http` files or `curl` commands against `localhost:8080`.
- Direct DB access is only permitted for read-only diagnostics or one-time migration scripts. Never for routine data manipulation during testing.

---

## GitHub Issue Tracking

### When the User Asks What's Open / What's Next

```bash
gh issue list --state open --limit 100 --json number,title,labels
```

1. Fetch issues from GitHub — do NOT read `TODO.md` for open work.
2. Group and summarize by label (`bug`, `p0`, `p1`, `p2`, `p3`, feature area).
3. Reference GH issue numbers in commit messages.
4. Close issues when done: `gh issue close <number> --comment "<resolution notes>"`.

```bash
gh issue list --state open --label bug
gh issue list --state open --label p0
```

### Bug Fix Workflow

1. `gh issue list --state open --label bug --json number,title,labels`
2. Work highest priority first: P0 → P1 → P2.
3. Close on completion: `gh issue close <number> --comment "<resolution notes>"`.

### Active Bug

| # | Title | Priority |
|---|---|---|
| [#135](https://github.com/red2n/tartware/issues/135) | Unified Architecture Onboarding | — |

### Completed Bugs

| # | Title | Fixed In | Notes |
|---|---|---|---|
| [#133](https://github.com/red2n/tartware/issues/133) | Settings screen should be usable | `7180bb45` | Seeded settings catalog; unique constraints; fixed repository SELECTs to include tenant_id |
| [#132](https://github.com/red2n/tartware/issues/132) | Group reservation did not have check-in | `0dfea299` | uploadGroupRoomingList INSERT missing required NOT NULL fields |
| [#127](https://github.com/red2n/tartware/issues/127) | Failed to process reservation event notification | `a089dfdd` | NULLIF($3, '')::uuid prevents invalid UUID cast for empty propertyId |
| [#128](https://github.com/red2n/tartware/issues/128) | column reference "room_type_id" is ambiguous | pre-existing | Already fixed — availability SQL uses qualified aliases |
| [#193](https://github.com/red2n/tartware/issues/193) | FR-6: Fix group billing — store routing rules as proper DB rows | `710dd7b3` | Removed JSON blob from folio.notes; INSERT folio_routing_rules inside transaction |
| [#181](https://github.com/red2n/tartware/issues/181) | SETTINGS-BUG-2: MULTI_SELECT falls back to text input in edit mode | `5d55f93d` | Added checkbox-group edit branch; isMultiSelectChecked + onMultiSelectToggle |
| [#180](https://github.com/red2n/tartware/issues/180) | SETTINGS-BUG-1: GET /settings/values returns empty in DB mode | `0c0e6c88` | settingsAuthPlugin: added request.auth.memberships fallback for tenantId |
| [#121](https://github.com/red2n/tartware/issues/121) | Resolve remaining unresolved review findings from PR #117 | pre-existing | Already closed |

---

## Service Port Map

| Port | Service | Dev Script | Notes |
|---|---|---|---|
| 3000 | core-service | `dev:core` | Also handles settings routes (Phase 5 consolidation) |
| ~~3005~~ | ~~settings-service~~ | ~~`dev:settings`~~ | **Absorbed into core-service** |
| 3010 | guests-service | `dev:guests` | |
| 3015 | rooms-service | `dev:rooms` | |
| 3020 | reservations-command-service | `dev:reservations` | Kafka + outbox |
| 3025 | billing-service | `dev:billing` | |
| 3030 | housekeeping-service | `dev:housekeeping` | |
| ~~3035~~ | ~~command-center-service~~ | ~~`dev:command-center`~~ | **Absorbed into api-gateway** |
| 3040 | recommendation-service | `dev:recommendation` | |
| 3045 | availability-guard-service | `dev:availability-guard` | + gRPC on 4400 |
| 3050 | roll-service | `dev:roll-service` | Internal consumer |
| 3055 | notification-service | `dev:notification-service` | Kafka consumer |
| 3060 | revenue-service | `dev:revenue` | Kafka consumer |
| 3065 | guest-experience-service | `dev:guest-experience` | Kafka consumer |
| 3070 | calculation-service | `dev:calculation` | Stateless |
| 3075 | service-registry | `dev:registry` | In-memory registry |
| 8080 | api-gateway | `dev:gateway` | Entry point; hosts command-center routes |

**Adding a new service:** assign next port (**3080**), add to `dev:backend`/`dev:stack` in root `package.json`, add `<SERVICE>_SERVICE_URL=http://localhost:<port>` to the `dev:gateway` script.

Non-HTTP packages (shared libs, outbox, config, telemetry, tenant-auth) do not need a port.

---

## `pnpm.overrides` — Documented Reasons

Every entry must have a documented reason. Only add overrides for packages actually in the dependency tree.

| Package | Version | Reason |
|---|---|---|
| eslint | 8.57.0 | Pin across all packages; v9 migration not yet complete |
| rxjs | 7.8.2 | Required by concurrently; pin to stable release |
| js-yaml | 4.1.1 | Security fix (prototype pollution CVE); used by eslint + nx |
| @fastify/swagger | ^9.6.1 | Align version across all Fastify services |
| @fastify/swagger-ui | ^5.2.3 | Align version across all Fastify services |
| esbuild | 0.27.2 | Pin for tsx; prevents unexpected binary re-downloads |
| fastify | ^5.8.5 | CVE-2026-3419 (incorrect regex, CVSS 6.9) + CVE-2026-3635 (CVSS 6.0) + Dependabot #62 (body schema validation bypass via leading space in Content-Type, patched in 5.8.5) |
| protobufjs | ^7.5.5 | Arbitrary code execution via malicious type field (Dependabot #67); patched in 7.5.5 |

---

## Scope Reminder

Unless explicitly asked, **ignore UI changes**.

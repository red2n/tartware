# Copilot Instructions

**MANDATORY**: Before making ANY code changes, read and follow `/AGENTS.md`. It contains project-specific rules that override general coding practices.

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

- **NEVER define sharable Zod schemas inside `Apps/`** — import from `@tartware/schemas`.
- API response schemas → `schema/src/api/`; command schemas → `schema/src/events/commands/`; table schemas → `schema/src/schemas/`.
- **Allowed locally in `Apps/`:** route-specific query/param schemas, `.pick()`/`.omit().extend()` derivations, env/config schemas, and thin `z.array()` wrappers.
- After any schema change: `npx nx run @tartware/schemas:build`.

## Schema-First Development

SQL and TypeScript schemas must stay in lockstep:
1. Add/update SQL in `scripts/tables/<category>/<file>.sql` (never date-prefixed migration files).
2. Add/update Zod schemas in `schema/src/`.
3. Run the SQL: `psql -h localhost -U postgres -d tartware -f scripts/tables/<category>/<file>.sql`.
4. Build schemas: `npx nx run @tartware/schemas:build`.
5. When enums change, update both `scripts/02-enum-types.sql` and the corresponding Zod enum.

Use idempotent SQL patterns (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). New tables must be added to `scripts/tables/00-create-all-tables.sql`. See SQL documentation standard in `AGENTS.md`.

## Service Port Map

Ports increment by 5 starting at 3000. API gateway is **8080**. Next available: **3070**.

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

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

## Schema-First Development
- Always use the `schema/` package for data shapes and validation.
- Add or update schemas in `schema/src/schemas/...` before wiring new command handlers.
- Keep command payloads aligned with schema definitions and enums.
- Keep schema changes and SQL migrations in lockstep; never change one without the other.
- When enums change, update `scripts/02-enum-types.sql` alongside schema enums.
- Prefer additive, backward-compatible migrations: add nullable columns + defaults, backfill, then tighten constraints.
- Use idempotent migration patterns (`IF NOT EXISTS`) and avoid destructive changes without an explicit rollback plan.
- Add CHECK constraints for invariants (status enums, non-negative amounts) and keep audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) on new tables.

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

## Testing & Data Access
- **Always use API routes** to test the application; do not use direct SQL queries or scripts (Python, TypeScript, shell) to GET, POST, PUT, or DELETE data in the database.
- Use `http_test/*.http` files or `curl` commands against the running services for manual testing.
- Direct database access is only permitted for read-only diagnostics (e.g., verifying record counts) or one-time migration scripts—never for routine data manipulation during testing.

## UI Scope
- Unless explicitly asked, ignore UI changes.

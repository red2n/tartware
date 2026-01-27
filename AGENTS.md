# Agent Instructions

## Project Principles
- This app targets 20K ops/sec; prefer designs that scale under sustained write throughput.
- Favor modular, low-coupling boundaries between services.
- Prefer asynchronous, command-based writes (event pipeline + transactional outbox) for high-volume domains.
- Use CRUD REST only for low-velocity admin/config data or read-only endpoints.

## Schema-First Development
- Always use the `schema/` package for data shapes and validation.
- Add or update schemas in `schema/src/schemas/...` before wiring new command handlers.
- Keep command payloads aligned with schema definitions and enums.

## Reliability Defaults
- Every new command must support idempotency keys and deduplication.
- Use existing outbox patterns and Kafka throttling utilities.
- Ensure DLQ handling and replay tooling exist for new command streams.

## UI Scope
- Unless explicitly asked, ignore UI changes.

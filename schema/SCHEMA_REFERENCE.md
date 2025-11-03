# Schema Reference (Source of Truth)

This document lists the guarantees and workflows that keep the `schema/` workspace authoritative for **all** shared contract surfaces between the UI, public APIs, and the PostgreSQL database.

## Core Principles

- The `schema/` package is the canonical runtime and build-time representation of database structure, enums, and validation rules.
- Every table, view, enum, trigger, and stored procedure change in `scripts/` must have an equivalent Zod schema representation here before shipping.
- All downstream clients (web, mobile, integrations, analytics, internal services) must depend on the published artifacts from `schema/` to avoid drift.

## Directory Overview

| Path | Purpose |
|------|---------|
| `schema/src/shared` | Reusable primitives: base schemas, enums, validators, helper types. |
| `schema/src/schemas` | Seven domain categories mirroring the database folder structure (`01-core` … `07-analytics`). Each file exports `Schema`, `CreateSchema`, and `UpdateSchema` variants. |
| `schema/src/index.ts` | Barrel exports so consumers can tree-shake by category. |
| `schema/utilities/schema-generator.ts` | Generates table schemas from PostgreSQL meta-data (information_schema). Run when database tables change. |
| `schema/dist` | Build artifacts published to npm/internal registry. |

## Required Workflow

1. **Database change** → update SQL under `scripts/` (tables, enums, procedures, triggers).
2. **Sync schemas** → regenerate or hand-edit the Zod schema inside `schema/src/schemas/**`.
3. **Validate** → `npm run build`, `npm run typecheck`, `npm run knip`, `npm run test`, `npm run format:check`.
4. **Release** → version bump via `CHANGELOG.md`, publish, and ensure dependent services consume the new package.

## Automation Notes

- `npm run generate -- <category>` rehydrates schema files for any category using the live PostgreSQL meta-data.
- The OpenTelemetry-ready tooling (linting, formatting, unused export checks) must pass before committing.
- Future migrations **must** include updates to this package; CI tasks should fail if `schema/` is not kept current with database DDL.

## Critical Rules

- Never exclude or ignore the `schema/` folder from builds, linting, packaging, test automation, or repository operations.
- Do not patch SQL directly without simultaneously updating Zod definitions, tests, and docs.

Keep this file as a persistent reminder: the `schema/` directory is the single source of truth for every contract shared among UI, API, and database layers.

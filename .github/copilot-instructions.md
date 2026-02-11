# Copilot Instructions

**MANDATORY**: Before making ANY code changes, you MUST read and follow the instructions in `/AGENTS.md`.

This includes:
- Schema-first development (SQL + TypeScript schemas in lockstep)
- Never hardcode enum values in TypeScript when database CHECK constraints enforce them
- Always execute SQL migrations after creation
- Use API routes through gateway (port 8080) for testing
- Follow SOLID principles for TypeScript design

The AGENTS.md file contains project-specific rules that override general coding practices.

## Schema Ownership — `schema/` is the Single Source of Truth

- **NEVER define sharable Zod schemas (table shapes, API response schemas, command payloads) inside `Apps/`.**
- All data-shape schemas MUST live in the `schema/` package (`@tartware/schemas`) and be imported by App services.
- **Allowed in `Apps/` route files only:** route-specific query/param/filter schemas (e.g., `QuerySchema`, `ParamsSchema`), thin `z.array()` wrappers around imported schemas, and inline `z.object({ tenant_id: z.string().uuid() })` param helpers.
- **Allowed in `Apps/` config files only:** environment/config validation schemas (e.g., `baseConfigSchema`, `databaseSchema`).
- **Allowed in `Apps/` service files only:** schemas that `.pick()` or `.omit().extend()` from an existing `@tartware/schemas` schema (derived transformations, not new definitions), or cache-specific projections that depend on app-internal constants not available in the schema package.
- If a new API endpoint returns a new data shape, add the response schema to `schema/src/api/` first, then import it in the App service/route.
- If a new command is added, add the command schema to `schema/src/events/commands/` first.
- Run `npx nx run @tartware/schemas:build` after any schema change to ensure downstream Apps compile.

## Git Workflow
- **NEVER push changes without asking the user first**
- Always ask for confirmation before running `git push`
- Commits can be made without asking, but pushing requires explicit approval
- **Before every commit that will be pushed**, run biome, knip, and eslint on all affected services (see Pre-Push Quality Gates in AGENTS.md)

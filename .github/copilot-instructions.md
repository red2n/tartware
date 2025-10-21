<!--
Purpose: Guidance for AI coding agents (Copilot / coding assistants) working on the Tartware repo.
Keep this short, actionable, and specific to this codebase.
-->

# Copilot instructions for Tartware (AI coding agents)

Follow these focused, repository-specific rules when editing, refactoring or adding code and SQL in this project.

1. Big picture and intent
   - Tartware is a PostgreSQL-first, multi-tenant Property Management System (PMS). The database is the primary application surface; most development work is in SQL scripts under `scripts/`.
   - Two schemas are used: `public` (application tables) and `availability` (high-volume inventory). Primary keys are UUIDs; configuration frequently uses JSONB and many ENUM types (`02-enum-types.sql`).
   - Changes to the schema must preserve multi-tenant isolation (always consider `tenant_id`) and soft-delete semantics (`deleted_at`). See `docs/multi-tenancy.md` and `scripts/README.md` for design rationale.

2. Where to make changes
   - Add/modify tables in `scripts/tables/` using the existing numbered filename pattern (NN_name.sql). Do NOT change execution order numbers unless you also update the master script.
   - Add/modify indexes in `scripts/indexes/` and foreign keys in `scripts/constraints/`. Index/constraint files are applied after tables by `00-master-install.sh`.
   - Stored procedures go in `scripts/procedures/`, triggers in `scripts/triggers/`.

3. Execution and developer workflows (exact commands)
   - **ALWAYS use `./setup-database.sh` for database operations.** Never manually run individual SQL scripts - the setup script handles everything correctly.
   - Fast full install (Docker):
     - Start containers: `docker compose up -d` (or use `./setup-database.sh --mode=docker`)
     - Connect into database: `docker exec -it tartware-postgres psql -U postgres -d tartware`
     - Watch logs: `docker-compose logs -f postgres`
   - Local/direct install:
     - Run setup script: `./setup-database.sh` (interactive) or `./setup-database.sh --mode=direct` for automation.
     - Alternative: Run master SQL installer manually: `cd scripts && ./00-master-install.sh` (only if setup-database.sh is unavailable)
   - Verification: run `psql -U postgres -d tartware -f scripts/verify-all.sql` or use category-level verifiers in `scripts/` (e.g., `verify-all-categories.sql`).

4. Conventions and patterns (must follow)
   - File naming: numeric prefixes control execution order. Preserve them (e.g., `01_...`, `02_...`).
   - Schema lifecycle: run `01-database-setup.sql` → `02-enum-types.sql` → `scripts/tables/...` → `scripts/indexes/...` → `scripts/constraints/...` → `scripts/procedures/...` → `scripts/triggers/...`.
   - Avoid `SELECT *`; the repo enforces `SELECT`-column discipline via triggers (`scripts/triggers/01_prevent_select_star.sql`). When adding queries, list explicit columns.
   - Use JSONB fields where existing tables do; follow examples in `scripts/tables/*` to match naming and indexing patterns (e.g., GIN indexes for JSONB).
   - Soft deletes: prefer `deleted_at` over hard deletes. New DDL must include audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) when appropriate.

5. Tooling & developer preferences
   - Use `rg` (ripgrep) for fast text search instead of `grep` where available.
   - Use `fd` (or `fdfind`) for file discovery instead of `find` where available.
   - Use environment variables for DB connection when running local scripts: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
   - For Python code, prefer modern Python 3 with type hints where appropriate (follow existing style in `data/` loaders).

6. Helpful references in the repo (cite examples when relevant)
   - Master setup and orchestration: `setup-database.sh`, `docker-compose.yml`, `scripts/docker/docker-entrypoint-custom.sh`
   - Script layout and verification: `scripts/README.md`, `scripts/00-master-install.sh`, `scripts/verify-all.sql`
   - Multi-tenancy and architecture docs: `docs/multi-tenancy.md`, `docs/database-architecture.md`

7. Commit & PR guidance for AI edits
   - Keep DDL changes modular: add a new `scripts/tables/NN_name.sql` file rather than editing many existing files if possible.
   - Update `scripts/00-master-install.sh` and `scripts/README.md` only when you add new files or change ordering.
   - Include verification commands in the PR description (example: `psql -U postgres -d tartware -f scripts/verify-all.sql`) and list the expected verification outputs if the change affects counts.

8. Safety and non-goals
   - Do not modify production credentials or create new secrets in the repo.
   - Do not attempt network calls during code generation. Keep changes local to the repository structure.

9. If unsure, follow these minimal checks before a patch
   - SQL DDL compiles: run `psql -U postgres -d tartware -f <file>` (or use docker exec).
   - Execution order preserved: ensure file numeric prefix matches where it will be executed.
   - Multi-tenant check: new tables/queries include `tenant_id` filtering or explicit rationale documented in the change.

If this file misses details you'd like (CI, production deploy, or additional coding patterns), tell me what to add and I will update it.

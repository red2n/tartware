# Tartware Documentation Placeholder

This repository now generates script documentation dynamically in CI.
Download the latest `script-docs` artifact from the build workflow for
up-to-date developer references.

## Runtime Requirements

- The Angular 21 toolchain only supports Node 18/20/22. This repo ships an `.nvmrc`
  pinned to **v22.11.0** so local shells can run `nvm use` (or `fnm use`) and stay
  on a supported runtime.
- Root `package.json` enforces `>=20.11.1 <23`. Running `npm install` with Node 24+
  will now emit the same warning the Angular CLI raised, helping us catch drift
  before shipping builds.

## Telemetry Fan-In

- Observability flows through a single OTLP collector (`otel-collector` in
  `docker-compose.yml`). Bring up `opensearch-node` and `otel-collector` together:

  ```bash
  docker compose up -d opensearch-node otel-collector
  ```

- All services send logs/traces to the collector via `OTEL_EXPORTER_OTLP_*`
  environment variables (see `run-with-otel.sh` for local defaults). The collector
  fans logs straight into OpenSearch for external tools to query.

- We intentionally removed the standalone OpenSearch Dashboards container; only
  the storage node needs to run for telemetry fan-in.
- We intentionally removed the standalone OpenSearch Dashboards container; the
  Tartware UI already exposes log search tooling, so only the storage node needs
  to run.

## Module & Admin Bootstrap CLI

- Run `npm run bootstrap:modules` from the repo root to launch an interactive
  helper that reads the canonical module catalog (`module-registry.ts`) and
  connects to Postgres via the core-service config.
- The script lets you:
  - List all SaaS modules with their tiers/descriptions.
  - Inspect the current module set for any tenant (slug or UUID) and enable/disable
    modules by choosing their numeric indexes; the helper writes back to
    `tenants.config -> 'modules'` with optimistic version bumps.
  - View existing system administrators and bootstrap a new privileged account
    (prompts for username/email/role/password, enforces bcrypt hashing, seeds an
    MFA secret, and stores CIDR-based IP allow lists + allowed hours).
- Use this tool when bringing up new environments: first pick the modules allowed
  for that deployment, then create the initial system admin credentials that will
  manage subscription keys and tenant provisioning.

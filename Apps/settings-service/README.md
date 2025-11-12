# Tartware Settings Service

The Settings Service exposes the PMS settings catalogue and scoped overrides through a dedicated Fastify-based Node.js microservice. It is designed to run behind the existing API Gateway and authenticate inbound requests using the shared JWT infrastructure.

## Stack

- **Runtime:** Node.js 20 / TypeScript
- **Framework:** Fastify (with Helmet, Sensible, and CORS plugins)
- **Auth:** `@fastify/jwt` verifying RS256 tokens issued by the platform auth service
- **Config:** Environment variables parsed via `zod`
- **Testing:** Vitest
- **Linting/Formatting:** ESLint, Biome, Knip

## Local Development

```bash
# install dependencies from the repository root
npm install

# run the service in watch mode
npm run dev --workspace=Apps/settings-service

# execute unit tests
npm test --workspace=Apps/settings-service
```

Copy `.env.example` to `.env` and adjust values for your environment before running locally.

## Endpoints

| Method | Path                 | Description                | Auth |
|--------|----------------------|----------------------------|------|
| GET    | `/health`            | Liveness probe             | No   |
| GET    | `/v1/settings/ping`  | Authenticated connectivity | Yes  |

## Next Steps

1. Add PostgreSQL access layer (via pooled client) for `setting_categories`, `setting_definitions`, and override tables.
2. Define contract schemas (`zod`) for list, detail, and mutation payloads.
3. Implement read APIs for categories and definitions (tenant-scoped filtering).
4. Introduce mutation endpoints with optimistic locking and audit trails.
5. Wire service deployment: Dockerfile, Helm chart values, gateway route registration.
6. Extend test coverage with integration tests against a disposable Postgres schema.

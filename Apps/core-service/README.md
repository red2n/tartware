# Core Service

Fastify-based API for Tartware's core domain (tenants, users, properties, guests). The service:

- Validates every payload with `@tartware/schemas`
- Talks directly to PostgreSQL using the shared schema
- Ships with TypeScript, ESLint, Knip, and Biome quality gates

## Getting Started

```bash
npm install
npm run dev
# optional quality gates
npm run lint
npm run biome
npm run knip
```

The server listens on `http://localhost:3000` by default.

### Environment

- PostgreSQL: `127.0.0.1:5432`
- Database: `tartware`
- Username: `postgres`
- Password: `postgres`

## Available Endpoints

- `GET /health` — Basic service readiness probe.
- `GET /v1/tenants` — Tenant catalogue with aggregate stats.
- `GET /v1/properties` — Property inventory (optional `tenant_id` filter).
- `GET /v1/users` — Users with tenant assignments (optional `tenant_id`).
- `GET /v1/guests` — Guest directory with rich filters (`tenant_id`, `email`, `phone`, `loyalty_tier`, `vip_status`, `is_blacklisted`).
- `GET /v1/user-tenant-associations` — RBAC links between users and tenants (filter by `tenant_id`, `user_id`, `role`, `is_active`).

## Next Steps

1. Add authentication/authorization middleware to enforce tenant scoping.
2. Implement create/update operations with optimistic locking.
3. Introduce contract tests and load tests that exercise the PostgreSQL queries.

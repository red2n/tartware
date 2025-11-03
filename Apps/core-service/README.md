# Core Service

Lightweight Fastify-based API that exposes Tartware core domain operations (tenants, properties, users). This first iteration keeps implementation simple and focuses on:

- Using `@tartware/schemas` for every request/response contract
- Establishing minimal project scaffolding (TypeScript, linting)
- Providing health and tenant listing endpoints backed by an in-memory repository

## Getting Started

```bash
npm install
npm run dev
# optional quality gates
npm run lint
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
- `GET /v1/tenants` — Returns sample tenant records validated against the schema package.

## Next Steps

1. Replace the in-memory repository with PostgreSQL access using `pg`.
2. Add authentication middleware that enforces tenant scoping.
3. Expand routes for properties, users, and tenant creation/update operations.
4. Introduce contract tests to ensure schema alignment.

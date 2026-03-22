e# Tartware PMS

A command-driven property management platform built as a TypeScript monorepo. All write traffic flows through a central Command Center into Kafka; domain services consume commands asynchronously. Read traffic stays HTTP-based via the API Gateway.

## Architecture
<img width="2752" height="1536" alt="unnamed" src="https://github.com/user-attachments/assets/fc3212e2-17e9-408c-a82b-4d7921c826e0" />

## Build Status

### Monorepo

[![Build](https://github.com/red2n/tartware/actions/workflows/build.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/build.yml)
[![Duplo Duplicate Scan](https://github.com/red2n/tartware/actions/workflows/duplo.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/duplo.yml)
[![CodeQL](https://github.com/red2n/tartware/actions/workflows/codeql.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/codeql.yml)

### Services

| Package | Status |
|---------|--------|
| API Gateway | [![CI · API Gateway](https://github.com/red2n/tartware/actions/workflows/ci-api-gateway.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-api-gateway.yml) |
| Core Service | [![CI · Core Service](https://github.com/red2n/tartware/actions/workflows/ci-core-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-core-service.yml) |
| Command Center Service | [![CI · Command Center Service](https://github.com/red2n/tartware/actions/workflows/ci-command-center-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-command-center-service.yml) |
| Reservations Command Service | [![CI · Reservations Command Service](https://github.com/red2n/tartware/actions/workflows/ci-reservations-command-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-reservations-command-service.yml) |
| Guests Service | [![CI · Guests Service](https://github.com/red2n/tartware/actions/workflows/ci-guests-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-guests-service.yml) |
| Rooms Service | [![CI · Rooms Service](https://github.com/red2n/tartware/actions/workflows/ci-rooms-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-rooms-service.yml) |
| Billing Service | [![CI · Billing Service](https://github.com/red2n/tartware/actions/workflows/ci-billing-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-billing-service.yml) |
| Cashier Service | [![CI · Cashier Service](https://github.com/red2n/tartware/actions/workflows/ci-cashier-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-cashier-service.yml) |
| Accounts Service | [![CI · Accounts Service](https://github.com/red2n/tartware/actions/workflows/ci-accounts-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-accounts-service.yml) |
| Finance Admin Service | [![CI · Finance Admin Service](https://github.com/red2n/tartware/actions/workflows/ci-finance-admin-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-finance-admin-service.yml) |
| Housekeeping Service | [![CI · Housekeeping Service](https://github.com/red2n/tartware/actions/workflows/ci-housekeeping-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-housekeeping-service.yml) |
| Settings Service | [![CI · Settings Service](https://github.com/red2n/tartware/actions/workflows/ci-settings-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-settings-service.yml) |
| Availability Guard Service | [![CI · Availability Guard Service](https://github.com/red2n/tartware/actions/workflows/ci-availability-guard-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-availability-guard-service.yml) |
| Roll Service | [![CI · Roll Service](https://github.com/red2n/tartware/actions/workflows/ci-roll-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-roll-service.yml) |
| Recommendation Service | [![CI · Recommendation Service](https://github.com/red2n/tartware/actions/workflows/ci-recommendation-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-recommendation-service.yml) |
| Notification Service | [![CI · Notification Service](https://github.com/red2n/tartware/actions/workflows/ci-notification-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-notification-service.yml) |
| Revenue Service | [![CI · Revenue Service](https://github.com/red2n/tartware/actions/workflows/ci-revenue-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-revenue-service.yml) |
| Guest Experience Service | [![CI · Guest Experience Service](https://github.com/red2n/tartware/actions/workflows/ci-guest-experience-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-guest-experience-service.yml) |
| Calculation Service | [![CI · Calculation Service](https://github.com/red2n/tartware/actions/workflows/ci-calculation-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-calculation-service.yml) |
| Service Registry | [![CI · Service Registry](https://github.com/red2n/tartware/actions/workflows/ci-service-registry.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-service-registry.yml) |

### UI

| Package | Status |
|---------|--------|
| PMS UI | [![CI · PMS UI](https://github.com/red2n/tartware/actions/workflows/ci-pms-ui.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-pms-ui.yml) |
| Guest Portal | [![CI · Guest Portal](https://github.com/red2n/tartware/actions/workflows/ci-guest-portal.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-guest-portal.yml) |

### Shared Libraries

| Package | Status |
|---------|--------|
| Schemas | [![CI · Schemas](https://github.com/red2n/tartware/actions/workflows/ci-schemas.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-schemas.yml) |
| Command Center Shared | [![CI · Command Center Shared](https://github.com/red2n/tartware/actions/workflows/ci-command-center-shared.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-command-center-shared.yml) |
| Candidate Pipeline | [![CI · Candidate Pipeline](https://github.com/red2n/tartware/actions/workflows/ci-candidate-pipeline.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-candidate-pipeline.yml) |
| Fastify Server | [![CI · Fastify Server](https://github.com/red2n/tartware/actions/workflows/ci-fastify-server.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-fastify-server.yml) |
| Outbox | [![CI · Outbox](https://github.com/red2n/tartware/actions/workflows/ci-outbox.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-outbox.yml) |
| OpenAPI Utils | [![CI · OpenAPI Utils](https://github.com/red2n/tartware/actions/workflows/ci-openapi-utils.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-openapi-utils.yml) |
| Command Consumer Utils | [![CI · Command Consumer Utils](https://github.com/red2n/tartware/actions/workflows/ci-command-consumer-utils.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-command-consumer-utils.yml) |
| Config | [![CI · Config](https://github.com/red2n/tartware/actions/workflows/ci-config.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-config.yml) |
| Telemetry | [![CI · Telemetry](https://github.com/red2n/tartware/actions/workflows/ci-telemetry.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-telemetry.yml) |
| Tenant Auth | [![CI · Tenant Auth](https://github.com/red2n/tartware/actions/workflows/ci-tenant-auth.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-tenant-auth.yml) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d postgres redis kafka

# Bootstrap Kafka topics
pnpm run kafka:topics

# Start all services
pnpm run dev
```

## Monorepo Commands

```bash
pnpm run build        # Lint + Biome + Knip + compile all packages
pnpm run lint         # ESLint across all packages
pnpm run biome        # Biome check across all packages
pnpm run knip         # Dead code detection across all packages
pnpm run test         # Run all test suites
pnpm run clean:all    # Remove all build artifacts
```

## Dev Ports

| Port | Service |
|------|---------|
| 8080 | API Gateway |
| 3000 | Core Service |
| 3005 | Settings Service |
| 3010 | Guests Service |
| 3015 | Rooms Service |
| 3020 | Reservations Command Service |
| 3025 | Billing Service |
| 3030 | Housekeeping Service |
| 3035 | Command Center Service |
| 3040 | Recommendation Service |
| 3045 | Availability Guard Service |
| 3050 | Roll Service |
| 3055 | Notification Service |
| 3060 | Revenue Service |
| 3065 | Guest Experience Service |
| 3070 | Calculation Service |
| 3075 | Service Registry |
| 3080 | Cashier Service |
| 3085 | Accounts Service |
| 3090 | Finance Admin Service |

## Production Readiness Scorecard

> Last assessed: March 2026

### System Vital Statistics

| Metric | Count |
|--------|-------|
| Microservices | 20 + API Gateway |
| SQL Tables | 201 |
| Registered Commands | 162 |
| Zod Schemas | 250+ |
| Backend Test Files | 72 |
| HTTP Test Endpoints | 28 |
| UI Feature Modules | 17 |
| Kafka Topics | 7 (with DLQs) |

### Overall Score: 8.3 / 10 — Production-Ready (Beta / Limited GA)

| # | Dimension | Score | Weight | Weighted |
|---|-----------|-------|--------|----------|
| 1 | Architecture & Scalability | 8.5 | 15% | 1.275 |
| 2 | PMS Industry Features | 9.0 | 15% | 1.350 |
| 3 | Security | 8.5 | 12% | 1.020 |
| 4 | Database Design | 9.0 | 10% | 0.900 |
| 5 | API Design & Standards | 8.5 | 10% | 0.850 |
| 6 | Observability | 8.0 | 8% | 0.640 |
| 7 | Resilience & Reliability | 8.0 | 8% | 0.640 |
| 8 | Testing | 7.0 | 8% | 0.560 |
| 9 | UI Efficiency | 7.5 | 7% | 0.525 |
| 10 | DevOps & Deployment | 8.0 | 7% | 0.560 |
| | **OVERALL** | | **100%** | **8.32** |

### Architecture & Scalability — 8.5 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| CQRS / Event-driven | 9.5 | Transactional outbox → Kafka → domain consumers. Textbook CQRS. |
| Service decomposition | 9.0 | 17 bounded contexts with clean domain boundaries |
| Async write path | 9.0 | 162 commands through Kafka with DLQ + retry |
| Circuit breaker | 8.5 | Per-service state machine, configurable thresholds, Prometheus metrics |
| gRPC (availability guard) | 6.0 | Working but no deadlines, no retries enabled, no health service |
| Horizontal scaling | 8.0 | Kubernetes manifests, HPA configured, stateless services |
| Connection pooling | 7.5 | pg-pool present but pool size not env-configurable |

### PMS Industry Feature Coverage — 9.0 / 10

| Domain | Score | Detail |
|--------|-------|--------|
| Reservation lifecycle | 9.5 | 10 statuses, walk-in, waitlist, mobile check-in, quotes |
| Room & inventory mgmt | 9.5 | Availability guard with gRPC locks, overbooking, room moves |
| Guest profiles & CRM | 9.0 | VIP levels, loyalty tiers, preferences, merge, GDPR erase + SAR |
| Billing & folios | 9.0 | Night audit, 5 folio types, deposits, AR, commissions, chargebacks, folio windows |
| Rate & revenue mgmt | 9.0 | Dynamic pricing, hurdle rates, seasons, restrictions, competitor tracking |
| Groups & events | 8.0 | 6 commands: create, rooms, rooming list, cutoff, billing, check-in |
| Distribution / channels | 8.0 | OTA sync / rate push / content sync, metasearch, channel mappings |
| Housekeeping | 9.0 | 7 task commands, bulk status, inspection notes |
| Notifications | 8.0 | 12 templates, Kafka-driven, variable substitution |
| Night audit | 9.0 | Room charges, no-show sweep, business date advance, fiscal period close |
| Reporting | 8.0 | KPIs, occupancy, arrivals / departures |

### Security — 8.5 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Authentication (JWT) | 9.5 | RS256, issuer / audience validation, grace window rotation |
| MFA | 9.0 | TOTP enrollment + verification |
| RBAC | 9.0 | 5-tier role hierarchy, module-level permissions, screen-permission UI |
| Multi-tenancy isolation | 9.5 | All queries scoped by `tenant_id`, scope guards on every route |
| SQL injection prevention | 10 | 100% parameterized queries, zero string concatenation |
| Input validation | 9.5 | Zod on every route + command payload validators |
| GDPR / compliance | 8.0 | Consent logs, 9-step erasure, retention sweep, SAR export |
| Rate limiting | 7.5 | Per-instance (not distributed); tiered by endpoint type |
| Audit logging | 8.0 | `created_by` / `updated_by` on all tables; system admin audit log |
| Helmet / CORS | 9.0 | Helmet on all services, explicit CORS allow-list |

### Database Design — 9.0 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Schema completeness | 9.5 | 201 tables across 10 categories |
| Normalization | 9.0 | Proper 3NF with intentional JSONB for flexible structure |
| Constraints & integrity | 9.0 | CHECK constraints, FKs, unique indexes, enum types |
| Indexing strategy | 8.5 | Multi-column indexes on hot paths; some JSONB GIN indexes |
| Audit trails | 9.5 | `created_at` / `updated_at` / `created_by` / `updated_by` + soft-delete |
| Idempotent DDL | 9.0 | `IF NOT EXISTS` patterns throughout |
| Enum lockstep | 9.0 | SQL enums + Zod enums kept in sync |
| Tenant isolation | 9.5 | Every table partitioned by `tenant_id` |

### API Design & Standards — 8.5 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| OpenAPI / Swagger | 9.0 | 14 service specs (OpenAPI 3.0.3), auto-generated from code |
| Error format | 9.5 | RFC 9457 Problem Details, machine-readable error codes |
| Versioning | 7.5 | Consistent `/v1/` prefix; no deprecation / sunset strategy yet |
| Pagination | 7.5 | Offset-based on all list endpoints; no cursor pagination |
| Response consistency | 9.0 | `{ data: [...], total: N }` envelope pattern |
| Input validation | 9.5 | Zod schemas on all body / query / param inputs |
| Command bus API | 9.0 | Unified `POST /v1/commands/{name}/execute` pattern |

### Observability — 8.0 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Distributed tracing | 9.0 | OpenTelemetry SDK, W3C context propagation, Jaeger export |
| Structured logging | 9.0 | Pino with 40+ redaction paths, trace context injection |
| Prometheus metrics | 7.5 | Gateway metrics + default Node.js metrics; custom service metrics sparse |
| Dashboards | 7.0 | Loadtest Grafana dashboard; per-service dashboards needed |
| Runbooks | 7.5 | DLQ runbooks exist; per-service runbooks incomplete |
| Alerting | 6.5 | HPA threshold alerts; no SLI / SLO-based alerting rules |
| Health checks | 7.0 | Gateway comprehensive; other services return static 200 |

### Resilience & Reliability — 8.0 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Circuit breaker | 8.5 | Per-service state machine with metrics |
| Retry + backoff | 8.5 | Exponential backoff with configurable schedule |
| Transactional outbox | 9.0 | `SKIP LOCKED`, retry budget, tenant throttling, DLQ routing |
| Idempotency | 8.5 | Command dedup with fail-open / fail-closed modes |
| DLQ handling | 7.5 | Published but no automated replay mechanism |
| Graceful shutdown | 8.5 | SIGTERM / SIGINT handlers, Kafka drain, `Promise.allSettled` |
| Kafka consumer reliability | 8.5 | Manual offset commits, heartbeats, lag monitoring |

### Testing — 7.0 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Unit tests | 7.5 | 72 test files, Vitest, core logic covered |
| Integration tests | 7.0 | Readiness tests (Kafka + DB), some scenario tests |
| HTTP test coverage | 7.5 | 28 `.http` files covering major endpoints |
| E2E tests | 4.0 | No cross-service workflow tests |
| Load testing | 6.5 | k6 loadtest scripts exist but not CI-integrated |
| Test automation (CI) | 6.0 | Per-service CI workflows defined; no unified gate |

### UI Efficiency — 7.5 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Framework | 9.0 | Angular 18+ with standalone components, esbuild |
| Feature coverage | 8.5 | 17 feature modules matching backend domains |
| Shared CSS / design system | 8.0 | `shared.scss` + `tokens.css` + Material overrides |
| Layout architecture | 8.0 | Shell + sidebar + topbar + status-bar + sub-sidebar |
| Core services | 8.0 | API client, auth, i18n, notifications, theme, context |
| Shared components | 7.5 | Pagination, toast, pipes, badge / format / sort utils |
| Accessibility | 7.0 | ARIA labels present; not audited for WCAG 2.1 AA |
| Guest self-service UI | 5.0 | Backend ready; frontend minimal |

### DevOps & Deployment — 8.0 / 10

| Sub-area | Score | Detail |
|----------|-------|--------|
| Containerization | 8.5 | Docker Compose for local, Kubernetes manifests exist |
| Kubernetes readiness | 8.0 | Deployments, Services, ConfigMaps, HPA, liveness / readiness probes |
| CI quality gates | 7.5 | Biome + Knip + ESLint defined; per-service CI workflows |
| Blue / green deploys | 7.0 | Documented (Argo Rollouts) but not validated |
| Infrastructure as code | 7.0 | Kubernetes YAMLs present; no Terraform / Pulumi |

### Key Strengths

- 162 commands across 15 domains through battle-tested Kafka pipeline
- 201 SQL tables with full tenant isolation, audit trails, and constraint enforcement
- CQRS + transactional outbox architecture targeting 20K ops/sec
- Enterprise-grade security: RS256 JWT, MFA, RBAC, 100% parameterized queries, Zod validation
- End-to-end OpenTelemetry tracing with Pino structured logging and 40+ redaction paths
- RFC 9457 error responses, OpenAPI 3.0.3 specs on all services
- Schema-first development with SQL and Zod kept in lockstep

### Path to 9.0+

1. Wire real payment gateway (Stripe) + email provider (SendGrid)
2. Add gRPC deadlines (5s) + retry (3x with backoff) on availability guard client
3. Build E2E test suite for top 5 cross-service workflows
4. Implement Redis-backed distributed rate limiting at the gateway
5. Validate 20K ops/sec with sustained k6 load test
6. Standardize deep health checks across all services
7. Add SLI / SLO metrics and Grafana alerting rules
8. Complete guest self-service portal UI

## License

UNLICENSED — Proprietary

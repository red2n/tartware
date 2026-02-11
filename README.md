# Tartware PMS

A command-driven property management platform built as a TypeScript monorepo. All write traffic flows through a central Command Center into Kafka; domain services consume commands asynchronously. Read traffic stays HTTP-based via the API Gateway.

## Architecture

```
Client → API Gateway (:8080) → Command Center → Kafka → Domain Services
                             → Proxy reads to domain services
```

## Build Status

### Monorepo

[![Build](https://github.com/red2n/tartware/actions/workflows/build.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/build.yml)
[![Duplo Duplicate Scan](https://github.com/red2n/tartware/actions/workflows/duplo.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/duplo.yml)

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
| Housekeeping Service | [![CI · Housekeeping Service](https://github.com/red2n/tartware/actions/workflows/ci-housekeeping-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-housekeeping-service.yml) |
| Settings Service | [![CI · Settings Service](https://github.com/red2n/tartware/actions/workflows/ci-settings-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-settings-service.yml) |
| Availability Guard Service | [![CI · Availability Guard Service](https://github.com/red2n/tartware/actions/workflows/ci-availability-guard-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-availability-guard-service.yml) |
| Roll Service | [![CI · Roll Service](https://github.com/red2n/tartware/actions/workflows/ci-roll-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-roll-service.yml) |
| Recommendation Service | [![CI · Recommendation Service](https://github.com/red2n/tartware/actions/workflows/ci-recommendation-service.yml/badge.svg)](https://github.com/red2n/tartware/actions/workflows/ci-recommendation-service.yml) |

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

## License

UNLICENSED — Proprietary

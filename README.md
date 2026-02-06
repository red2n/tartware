# Tartware PMS

A command-driven property management platform built as a TypeScript monorepo. All write traffic flows through a central Command Center into Kafka; domain services consume commands asynchronously. Read traffic stays HTTP-based via the API Gateway.

## Architecture

```
Client → API Gateway (:8080) → Command Center → Kafka → Domain Services
                             → Proxy reads to domain services
```

## Package Status

### Services

| Package | Path | Lint | Biome | Knip | Test | Build |
|---------|------|:----:|:-----:|:----:|:----:|:-----:|
| `@tartware/api-gateway` | `Apps/api-gateway` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/core-service` | `Apps/core-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/command-center-service` | `Apps/command-center-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/reservations-command-service` | `Apps/reservations-command-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/guests-service` | `Apps/guests-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/rooms-service` | `Apps/rooms-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/billing-service` | `Apps/billing-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/housekeeping-service` | `Apps/housekeeping-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/settings-service` | `Apps/settings-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/availability-guard-service` | `Apps/availability-guard-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/roll-service` | `Apps/roll-service` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/recommendation-service` | `Apps/recommendation-service` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Shared Libraries

| Package | Path | Lint | Biome | Knip | Test | Build |
|---------|------|:----:|:-----:|:----:|:----:|:-----:|
| `@tartware/schemas` | `schema` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/command-center-shared` | `Apps/command-center-shared` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/candidate-pipeline` | `Apps/candidate-pipeline` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/fastify-server` | `Apps/fastify-server` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/outbox` | `Apps/outbox` | ✅ | ✅ | ✅ | — | ✅ |
| `@tartware/openapi` | `Apps/openapi-utils` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/command-consumer-utils` | `Apps/command-consumer-utils` | ✅ | ✅ | ✅ | — | ✅ |
| `@tartware/config` | `Apps/config` | ✅ | ✅ | ✅ | — | ✅ |
| `@tartware/telemetry` | `Apps/telemetry` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@tartware/tenant-auth` | `Apps/tenant-auth` | ✅ | ✅ | ✅ | — | ✅ |

> Packages marked **—** under Test are thin utility libraries with no test files.

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d postgres redis kafka

# Bootstrap Kafka topics
npm run kafka:topics

# Start all services
npm run dev
```

## Monorepo Commands

```bash
npm run build        # Lint + Biome + Knip + compile all packages
npm run lint         # ESLint across all packages
npm run biome        # Biome check across all packages
npm run knip         # Dead code detection across all packages
npm run test         # Run all test suites
npm run clean:all    # Remove all build artifacts
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

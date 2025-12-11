# Load Testing & Observability Baseline

This folder contains a k6 scenario that exercises the public API gateway so we can measure real throughput while OTEL instrumentation captures traces/metrics in OpenSearch.

## Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/).  
2. Bring up infrastructure + telemetry exporters:
   ```bash
   npm run telemetry:start      # launches opensearch + otel collector
   docker compose up api-gateway core-service reservations-command-service -d
   ```
3. Seed a tenant/user so you can obtain a valid JWT (see `Apps/core-service/src/routes/auth.ts`). Export:
   ```bash
   export LOADTEST_BASE_URL=http://localhost:3333    # API gateway
   export LOADTEST_TENANT_ID=<tenant-uuid>
   export LOADTEST_AUTH_TOKEN=<bearer token>
   ```

## Running the Scenario

```bash
k6 run load-testing/k6-crud-baseline.js
# or via npm
npm run loadtest:crud
```

Key environment variables (override defaults with `--env VAR=value` if preferred):

| Var | Purpose | Default |
| --- | --- | --- |
| `LOADTEST_BASE_URL` | Gateway origin under test | `http://localhost:3333` |
| `LOADTEST_TENANT_ID` | Tenant UUID used in query params / posts | _required_ |
| `LOADTEST_AUTH_TOKEN` | `Authorization: Bearer` JWT | _required_ |
| `LOADTEST_PROPERTY_ID` | Optional property UUID for filtering | unset |

## What It Does

- Mixes read-heavy traffic (reservations, housekeeping, billing GETs) with a trickle of reservation `POST`s routed through the command service/Kafka topic.
- Applies thresholds for p(95) latency (`<750ms`) and HTTP failure ratio (`<1%`) so regressions fail fast.
- Emits custom k6 metrics so you can slice read vs write latency.

## Observability Hooks

- All Fastify services already initialize `@tartware/telemetry`; they export traces/logs to the OTEL Collector when `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` are set (see `run-with-otel.sh` for defaults).
- During a load test:
  1. Confirm spans in OpenSearch by querying `otel-v1-apm-span-*` for `service.name: "@tartware/core-service"` and filtering on the load-test time window.
  2. Inspect logs in the `otel-v1-apm-log-*` index; verify that each k6 request shows up with `http.target`.
  3. Use the collector’s metrics endpoint (`http://localhost:4318/v1/metrics`) or Prometheus scrape if enabled to capture CPU/memory.

Document the throughput/latency numbers you observe and paste them into your change logs so future roadmap steps have a baseline to beat.

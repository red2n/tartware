# Observability Playbook

This walkthrough explains how to capture traces, logs, and metrics while running the k6 CRUD baseline (`load-testing/k6-crud-baseline.js`).

## 1. Start Telemetry Dependencies

```bash
npm run telemetry:start           # starts opensearch-node + otel-collector
docker compose up api-gateway core-service reservations-command-service -d
```

The OTEL collector listens on `http://localhost:4318` for traces/logs (`/v1/traces`, `/v1/logs`) and forwards them into OpenSearch indices (`otel-v1-apm-*`).

## 2. Export OTEL Environment

All Node services instantiate `@tartware/telemetry` during boot and pick up exporter endpoints via env vars. Use the helper script or export manually:

```bash
source ./run-with-otel.sh             # sets OTEL_EXPORTER_OTLP_* variables
# or
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
export OTEL_SDK_DISABLED=false
```

Restart services after exporting so the SDK initializes.

## 3. Run the Load Test

Follow `load-testing/README.md` to provide `LOADTEST_*` variables and execute:

```bash
npm run loadtest:crud
```

While the test runs, the Fastify auto-instrumentation emits spans for every route, PG query, and downstream HTTP call.

## 4. Inspect Signals

1. **Traces** – Query OpenSearch (`http://localhost:9200/_dashboards`) or your preferred APM UI for `service.name` in `["@tartware/api-gateway", "@tartware/core-service", "@tartware/reservations-command-service"]`. Filter by `attributes.http.target` to isolate hot endpoints.
2. **Logs** – Search the `otel-v1-apm-log-*` indices for `body.attributes["x-correlation-id"]` (k6 returns this header in responses). Validate there are no error bursts.
3. **Metrics** – If the collector is scraping metrics, hit `http://localhost:4318/v1/metrics` or your Prometheus endpoint for:
   - `http.server.duration` (Fastify auto-instrumentation)
   - `process.runtime.nodejs.eventloop.lag.max`
   - `db.client.operations.duration` (PG)

Store snapshots of latency/throughput in your change log so future streaming work can compare apples-to-apples.

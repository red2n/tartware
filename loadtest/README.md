# Tartware PMS Load Testing (Fresh Start)

This is a fresh, industry-standard load testing harness focused on realistic PMS business transactions.

## Principles

- **Gateway only**: all traffic goes through http://localhost:8080.
- **Writes via Command Center**: no direct write endpoints; use `/v1/commands/*`.
- **Idempotency**: every write uses `X-Idempotency-Key`.
- **Configurable workload ratios**: traffic mix reflects PMS/OTA reality.

## Scenarios

- [loadtest/k6/scenarios/smoke.js](loadtest/k6/scenarios/smoke.js): quick sanity check.
- [loadtest/k6/scenarios/load.js](loadtest/k6/scenarios/load.js): baseline workload model.
- [loadtest/k6/scenarios/stress.js](loadtest/k6/scenarios/stress.js): capacity discovery.
- [loadtest/k6/scenarios/spike.js](loadtest/k6/scenarios/spike.js): burst resilience.
- [loadtest/k6/scenarios/booking-flow.js](loadtest/k6/scenarios/booking-flow.js): end-to-end booking journey.

## Quick Start

1) Copy env file:

```
cp .env.example .env
```

2) Run a smoke test:

```
docker compose up -d influxdb grafana
docker compose run --rm k6 run /scripts/scenarios/smoke.js
```

> **Note:** The k6 scenarios (including `smoke.js`) query the availability endpoint.
> On a fresh installation this endpoint may not yet be implemented, so availability
> checks are expected to fail until that endpoint is provided by the API.

3) Run baseline workload:

```
docker compose run --rm k6 run /scripts/scenarios/load.js
```

## Real-Time Metrics

- Grafana: http://localhost:3001 (admin/admin)
- InfluxDB: http://localhost:8086 (authentication disabled by default)

If the default dashboard panels are empty, use Grafana Explore with the `k6` bucket and build panels for `http_req_duration`, `http_req_failed`, and scenario metrics (e.g. `baseline_read_latency`).

## Default Workload Ratios (Baseline)

- Availability: 40%
- Reservation create: 10%
- Reservation modify: 6%
- Reservation cancel: 4%
- OTA sync: 12%
- Check-in: 4%
- Check-out: 4%
- Payment: 8%
- Reporting/admin: 12%

Tune these via env vars in [loadtest/.env.example](loadtest/.env.example).

## Workload Profiles

Set `WORKLOAD_PROFILE` to one of:

- `ota-heavy` (default)
- `direct-heavy`
- `enterprise-mix`

If you set explicit ratio env vars, they override the profile.
```

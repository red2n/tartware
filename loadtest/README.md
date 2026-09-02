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

> **Two things will make a fresh run look broken when it is not.** Read the next
> section before concluding anything from a red result.

## Before your first run

**1. Enable the command feature flags.** All 195 commands ship `disabled` in the
default seed, so every write returns **409 FEATURE_DISABLED** until they are
turned on — a full run of red that looks like a broken pipeline and is a
configuration default. `run-full-test.sh` calls `enable-via-api.sh` for you; if
you are driving k6 by hand, run it yourself first:

```
./loadtest/enable-via-api.sh /tmp/tartware-tenant-tokens.tsv http://localhost:8085
```

`executables/test-accounts-realdata/test-multi-tenant.sh` calls this the
"FEATURE_DISABLED trap", and it is the single most common reason a first run
reports nothing working.

**2. A command answers 202, not 200.** `POST /v1/commands/:name/execute` records
the command and returns **202 Accepted**; the consumer applies it afterwards. A
check asserting 200 or 201 reports a healthy pipeline as failing. Two scripts
did exactly that until 2 Sep.

> **Historical note.** This file used to say the availability endpoint "may not
> yet be implemented". It was implemented — the scripts were calling
> `/v1/availability`, which the gateway declares and proxies to a service that
> registers nothing by that name. The real route is `/v1/rooms/availability`,
> and `ENDPOINTS.availability` now points at it. A note that explains a failure
> away is worse than no note: it is why this went unexamined for months.

## Keeping the harness honest

`pnpm run check:loadtest` (part of `pnpm run check`, so `pnpm run build` runs it)
parses every script and verifies that each `import` resolves and each
`ENDPOINTS.*` key exists. Nothing else in the repo compiles or lints these
files, and they had drifted badly: eight of them imported `TENANT_ID`,
`generateGuest` and four other names that no module exported, so they threw on
their first iteration and had never reached the HTTP layer at all.

Twenty-two `ENDPOINTS` keys are still undefined and listed in
`KNOWN_UNDEFINED_ENDPOINTS` in that script. The list may only shrink — defining
one and leaving it listed is reported as stale.

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

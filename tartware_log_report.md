# Tartware — Log Analysis Report
**Date:** 2026-05-05 | **Source:** `output.log` | **Services Analysed:** 10

---

## Overall Health

All 10 services started and are running without crashes. OTEL, Kafka, Redis, and gRPC are all connected. The command registry is stable at **173 commands / 173 routes**. Response times are excellent across the board (most endpoints sub-10ms). No fatal errors in the entire log.

---

## Issues

### 🔴 Critical

#### 1. `tenant_id` Trusted from Query Params
**Affected services:** `billing-service`, `guests-service`, `rooms-service`, `core-service`

Calls like `GET /v1/billing/folios?tenant_id=<uuid>` and `GET /v1/rooms?tenant_id=<uuid>` pass tenant context via query parameters. If these are reachable through the gateway without the tenant being extracted from the JWT server-side, any authenticated user could pass an arbitrary `tenant_id` and read another tenant's data — a full multi-tenancy isolation bypass.

**Action:** Verify the gateway extracts `tenant_id` from the validated JWT and injects it as a trusted header. Services should never trust `tenant_id` from the request payload or query string on non-system endpoints.

---

### 🟡 Medium

#### 2. Startup Race Condition — Service Registry
**Affected services:** `availability-guard-service`, `api-gateway`

Both services log `service registry unavailable — skipping registration` on startup because `core-service` (the registry, port 3000) hasn't finished booting when they attempt to register. `concurrently` starts all 10 services simultaneously with no dependency ordering.

During the unregistered window, the gateway has no registry entry for `availability-guard`, meaning any route that depends on it could fail silently until the first successful heartbeat (~30s).

**Action:** Add retry-with-backoff logic on the registration call at startup. Alternatively, add a `wait-for-core.mjs` pre-step (similar to your existing `ensure-otel.mjs`) to delay dependent services by ~2–3s.

---

#### 3. Billing Shadow Ledger — Suspiciously Low Batch Throughput
**Affected service:** `billing-service`

```
Roll backfill batch persisted to shadow ledger {"processed":1}
```

Running every ~60 seconds, processing exactly **1 record per batch**, despite `OUTBOX_BATCH_SIZE=25` being configured on the reservations service. Either the shadow ledger cursor watermark is misaligned and filtering out most records, or the dev seed has too little data to trigger meaningful batch sizes.

**Action:** Verify the backfill query's watermark/cursor logic. Confirm that `processed:1` is expected for an idle dev environment, and add an assertion or alert if it consistently processes < batch_size in production.

---

#### 4. `availability-guard-service` and `billing-service` in `SHADOW_MODE=true`
**Affected services:** `availability-guard-service`, `billing-service`

Both are running in shadow mode in this session. This is likely intentional for dev/staging validation, but worth calling out explicitly — shadow mode means availability checks and billing writes are **not authoritative**. If this is a pre-production environment being used for integration testing, results from these two services are not reliable.

**Action:** Ensure shadow mode is explicitly gated behind an environment check and cannot be accidentally deployed to production. Add a startup `WARN` banner if `SHADOW_MODE=true` is detected in a non-development environment.

---

### 🟢 Minor / Housekeeping

#### 5. Empty Log Messages — `housekeeping-service`
**Lines:** 172–175

Four consecutive `INFO` log entries emitted during startup with no message — only `{}` metadata. Some initialization code is calling `logger.info()` without a message string.

```
INFO (@tartware/housekeeping-service): {"service":"@tartware/housekeeping-service","version":"0.1.0"}
INFO (@tartware/housekeeping-service): {"service":"@tartware/housekeeping-service","version":"0.1.0"}
INFO (@tartware/housekeeping-service): {"service":"@tartware/housekeeping-service","version":"0.1.0"}
INFO (@tartware/housekeeping-service): {"service":"@tartware/housekeeping-service","version":"0.1.0"}
```

**Action:** Find the initialization block in `housekeeping-service/src/index.ts` that fires these and add meaningful message strings or remove the calls entirely.

---

#### 6. Placeholder Encryption Keys Logged at WARN Level
**Affected services:** `guests-service`, `billing-service`, `core-service`

```
WARN: guest data encryption key is using a development placeholder
WARN: compliance encryption key is using a local placeholder
```

These warnings are the right behaviour. The risk is that they blend into startup noise and could be missed in a production deployment checklist.

**Action:** Consider escalating these to `ERROR` if the environment is not explicitly `NODE_ENV=development`, and add them to your deployment runbook / CI pre-flight checks.

---

#### 7. `POST /v1/auth/login` Takes ~200ms
**Affected service:** `core-service`

```
POST /v1/auth/login — 200 OK — durationMs: 199.70
```

Expected with bcrypt in dev (cost factor ~10–12). Not an issue now, but worth baselining. If this degrades in load testing, consider bcrypt cost factor tuning or moving to Argon2id.

**Action:** No immediate action. Add this endpoint to your performance baseline for load testing.

---

## What's Working Well

| Area | Status |
|---|---|
| Service startup time | All 10 services up in < 1s |
| Command registry | Stable at 173 commands, refreshes every 30s |
| Heartbeat mechanism | Working correctly, sub-1ms on core-service |
| Kafka consumers | All consumers connected across reservations, guests, billing, availability-guard, housekeeping, notifications, revenue |
| gRPC (availability-guard) | Bound on port 4400, consumers started |
| Redis | Connected on api-gateway for rate limiting and circuit breaking |
| Multi-tenant isolation | Two tenant IDs served correctly throughout (assuming JWT validation is enforced — see Issue #1) |
| Structured logging | Consistent `reqId`, `correlationId`, `initiatedBy`, `durationMs` across all services |
| OTEL | Traces and logs export configured on all 10 services |
| Outbox pattern | Reservations outbox polling active (2s interval, batch 25, DLQ configured) |
| Bloom filter | Warmed on core-service startup |

---

## Priority Order

| # | Issue | Priority | Effort |
|---|---|---|---|
| 1 | tenant_id trusted from query params | 🔴 Critical | Low |
| 2 | Startup race condition on service registry | 🟡 Medium | Low |
| 3 | Billing shadow ledger batch throughput | 🟡 Medium | Medium |
| 4 | Shadow mode production guard | 🟡 Medium | Low |
| 5 | Empty housekeeping log messages | 🟢 Minor | Low |
| 6 | Placeholder encryption key escalation | 🟢 Minor | Low |
| 7 | Login endpoint performance baseline | 🟢 Minor | Low |

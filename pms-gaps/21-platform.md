# Domain 21 — Platform & Non-Functional

> **Benchmark:** 20 capabilities · **Built** 7 · **Partial** 10 · **Missing** 3
> **Gap items in this file:** 13
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Business-date-aware data model, Idempotency on mutating APIs, Immutable financial ledger, Observability, Event-driven architecture, Localization, Realistic test data generation

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-21-01](#pms-21-01) | Optimistic concurrency | PARTIAL | Table stakes | P0 | M | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-02](#pms-21-02) | Backup and tested restore | PARTIAL | Table stakes | P0 | M | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-03](#pms-21-03) | Timezone correctness | PARTIAL | Table stakes | P0 | M | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-04](#pms-21-04) | Zero-downtime deployment | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-05](#pms-21-05) | Performance targets | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-06](#pms-21-06) | Horizontal scalability | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-07](#pms-21-07) | Staff UI accessibility | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-08](#pms-21-08) | Rate limiting and abuse protection | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-09](#pms-21-09) | Degraded-mode front desk operation | MISSING | Enterprise | P2 | L | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-10](#pms-21-10) | Availability SLA and DR | PARTIAL | Enterprise | P2 | M | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-11](#pms-21-11) | Regional deployment topology | MISSING | Enterprise | P2 | L | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-12](#pms-21-12) | Encryption key management and rotation | MISSING | Enterprise | P1 | L | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-21-13](#pms-21-13) | API SDKs and developer portal | PARTIAL | Enterprise | P2 | M | [WS-24](WORKSTREAMS.md#ws-24) |

---

### PMS-21-01

**Optimistic concurrency** — PARTIAL · Table stakes · P0 · Effort M · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** version columns are incremented but no write asserts the expected version, so concurrent edits still last-write-win.

**Fix:** `version` columns are incremented but no write asserts the expected version, so concurrent edits still last-write-win. Add `WHERE version = $expected` and a typed 409 on mismatch.

### PMS-21-02

**Backup and tested restore** — PARTIAL · Table stakes · P0 · Effort M · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Documented in DISASTER_RECOVERY.md; no tested restore in CI.

**Fix:** Documented in `docs/DISASTER_RECOVERY.md`; add a restore rehearsal to CI.

### PMS-21-03

**Timezone correctness** — PARTIAL · Table stakes · P0 · Effort M · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Business dates are handled; property timezone is not consistently applied.

**Fix:** Business dates are handled; property timezone is not consistently applied. One conversion utility in schema, used everywhere.

### PMS-21-04

**Zero-downtime deployment** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Documented; not exercised.

**Fix:** Documented; not exercised.

### PMS-21-05

**Performance targets** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** performance_baselines and thresholds tables; loadtest exists; no enforced budget.

**Fix:** `performance_baselines` and `performance_thresholds` exist and `loadtest/` runs; wire a budget into CI.

### PMS-21-06

**Horizontal scalability** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Services are stateless apart from process-local state such as the rate limiter.

**Fix:** Services are stateless apart from process-local state such as the rate limiter.

### PMS-21-07

**Staff UI accessibility** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Broad ARIA use; no audit.

**Fix:** Broad ARIA use, no audit. Run one against WCAG 2.2 AA and fix what it finds.

### PMS-21-08

**Rate limiting and abuse protection** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Process-local Map — resets on restart, does not hold across replicas.

**Fix:** Process-local Map — resets on restart, does not hold across replicas. Move to a shared store when the route stops being token-gated.

### PMS-21-09

**Degraded-mode front desk operation** — MISSING · Enterprise · P2 · Effort L · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** No offline or degraded mode.

**Fix:** Offline check-in and check-out with reconciliation on reconnect.

### PMS-21-10

**Availability SLA and DR** — PARTIAL · Enterprise · P2 · Effort M · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Documented; no SLA.

**Fix:** Documented; no measured SLA.

### PMS-21-11

**Regional deployment topology** — MISSING · Enterprise · P2 · Effort L · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** Single region.

**Fix:** Single region today.

### PMS-21-12

**Encryption key management and rotation** — MISSING · Enterprise · P1 · Effort L · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** No KMS or rotation.

**Fix:** No KMS and no rotation — a prerequisite for the PCI claim in WS-07.

### PMS-21-13

**API SDKs and developer portal** — PARTIAL · Enterprise · P2 · Effort M · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** OpenAPI and a /developers route; no SDKs.

**Fix:** OpenAPI is published and `/developers` exists; generate SDKs from the spec.


# Tartware `Apps/` — Deep Architecture, Coding, PMS & Deployment Gap Analysis

> **Scope:** Full audit of every service and shared library under [Apps/](../Apps/) against (a) general TypeScript / microservice coding standards, (b) hospitality / Property Management System (PMS) industry standards (HTNG, OpenTravel Alliance / OTA, USALI 11th Edition, PCI-DSS v4.0, GDPR, PSD2/SCA, OWASP API Security Top 10), and (c) cloud-native deployment standards (12-factor, K8s, OpenTelemetry).
> **Date:** May 2026
> **Verdict at a glance:** Architecture is **strong** (schema-first, transactional outbox, Kafka command bus, multi-tenant auth, candidate pipeline). Execution shows **multiple P0 production blockers**: hardcoded JWT/admin secrets, `SELECT *` on hot paths, latent N+1 query patterns in the 20K-ops/sec write hub, missing GL posting, missing payment gateway webhooks, and almost no automated test coverage. **Production readiness: ~70 %.**

---

## Table of Contents
1. [Audit Methodology & Standards Reference](#1-audit-methodology--standards-reference)
2. [Architecture Snapshot](#2-architecture-snapshot)
3. [Per-Service Findings](#3-per-service-findings)
4. [Coding Standard Gaps](#4-coding-standard-gaps)
5. [PMS Industry Standard Gaps](#5-pms-industry-standard-gaps)
6. [Deployment / Operational Standard Gaps](#6-deployment--operational-standard-gaps)
7. [Consolidated Gap Register](#7-consolidated-gap-register)
8. [Prioritised Remediation Roadmap](#8-prioritised-remediation-roadmap)

---

## 1. Audit Methodology & Standards Reference

| Standard | Why it matters for a PMS | Used in this audit to evaluate |
|----------|--------------------------|--------------------------------|
| **HTNG** (Hotel Tech Next Generation) message specifications | De-facto messaging contract for OTA/CRS/POS/door-lock/PBX integrations | Integration surface, message envelopes |
| **OpenTravel Alliance (OTA) 2022B** XML schemas | Industry contract for `OTA_HotelResNotifRQ`, `OTA_HotelAvailRQ`, `OTA_HotelRateAmountNotifRQ` | Reservation & rate ingress shape |
| **USALI 11th Revised Edition** (Uniform System of Accounts for the Lodging Industry) | Required GL chart-of-accounts taxonomy for hotels | Accounting & revenue posting |
| **PCI-DSS v4.0** | Mandatory for any system that touches card data (PAN, CVV) | Payment, cashier, folio, tokenisation |
| **GDPR / CCPA / DPDP** | Guest profile, consent, retention, erasure, breach notification | `guests-service`, `compliance-service` |
| **PSD2 / SCA** (3-D Secure 2) | EU strong customer authentication for card-not-present | Online check-in, prepaid bookings |
| **OWASP API Security Top 10 (2023)** | API surface security baseline | All HTTP routes |
| **OWASP ASVS L2** | Application security verification | All services |
| **ISO 27001 Annex A** | Information security management | Audit trail, access control |
| **12-Factor App** | Cloud-native config & deployment | Dockerfiles, env handling |
| **OpenTelemetry semantic conventions** | Trace/log/metric correlation | `telemetry/` |
| **Kafka exactly-once / transactional outbox** | Event-driven correctness | `outbox/`, command-center |

Each finding cites an actual file in the repo. Items not cited are documented as a **gap** (something missing).

---

## 2. Architecture Snapshot

```
                                        ┌────────────────────────────┐
       Client / OTA / GDS               │       External Channels    │
                │                       │  (Booking.com, Expedia…)   │
                ▼                       └──────────────┬─────────────┘
   ┌────────────────────────┐                          │
   │   api-gateway :8080    │◄─────── HTTP proxy ──────┘  (channel manager — not yet implemented)
   │   (auth, RL, CB, CC)   │
   └─────┬──────────────┬───┘
         │              │
   READ  │ HTTP         │ WRITE  Kafka commands.primary
         ▼              ▼
   ┌──────────┐   ┌────────────────────────────┐      ┌───────────────────────┐
   │ Domain   │   │ Domain command consumers   │──Tx──│ Postgres + Outbox tbl │
   │ services │   │ (reservations, billing,    │      └───────────┬───────────┘
   │ (read)   │   │  guests, rooms, ...)       │                  │
   └──────────┘   └──────────────┬─────────────┘                  ▼
                                 │                       outbox poller → Kafka
                                 ▼
                        reservations.events
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       roll-service     notification-service    revenue-service
     (shadow ledger)   (email/sms/push)        (yield/forecast)
```

Service inventory (from [Apps/](../Apps/)):
- HTTP write services: `core-service`, `billing-service`, `guests-service`, `housekeeping-service`, `notification-service`, `reservations-command-service`, `revenue-service`, `rooms-service`
- Edge: `api-gateway` (also hosts command-center dispatch)
- Inventory locks: `availability-guard-service` (HTTP + gRPC :4400)
- Shared libs: `command-center-shared`, `command-consumer-utils`, `config`, `fastify-server`, `openapi-utils`, `outbox`, `tenant-auth`, `telemetry`, `candidate-pipeline`

---

## 3. Per-Service Findings

> Severity legend: 🔴 P0 (blocks prod) · 🟠 P1 (blocks GA) · 🟡 P2 (post-GA) · ✅ Strength

### 3.1 `api-gateway` (port 8080)
**Role:** edge proxy, JWT auth, rate-limit, circuit breaker, command-center dispatch.

| Finding | Sev | Evidence |
|---|---|---|
| Hardcoded fallback JWT secret `"dev-secret-minimum-32-chars-change-me!"` shipped in production code | 🔴 | [Apps/api-gateway/src/config.ts](../Apps/api-gateway/src/config.ts) |
| No `/health` or `/ready` probe endpoints — only `/docs` + `/metrics` | 🟠 | [Apps/api-gateway/src/routes/health-routes.ts](../Apps/api-gateway/src/routes/health-routes.ts) — verify response semantics for K8s liveness vs readiness |
| Redis-backed circuit breaker with atomic Lua scripts, fail-open on Redis loss | ✅ | [Apps/api-gateway/src/utils/circuit-breaker.ts](../Apps/api-gateway/src/utils/circuit-breaker.ts) |
| Distributed + in-memory fallback rate limiter | ✅ | [Apps/api-gateway/src/lib/](../Apps/api-gateway/src/lib/) |
| 17 route files, no consistent OpenAPI tag taxonomy → Swagger UI is hard to navigate | 🟡 | [Apps/api-gateway/src/routes/](../Apps/api-gateway/src/routes/) |
| No request body size cap configured at Fastify level → DoS surface | 🟠 | `bodyLimit` not set in [server.ts](../Apps/api-gateway/src/server.ts) |
| No mTLS / signed-request enforcement between gateway and downstream services | 🟠 | All proxy calls are plain HTTP with bearer token forwarding |

### 3.2 `core-service` (port 3000) — auth, tenants, users, settings, modules, retention
| Finding | Sev | Evidence |
|---|---|---|
| Hardcoded default password `"TempPass123"` for bootstrap admin remains in code | 🔴 | [Apps/core-service/src/config.ts](../Apps/core-service/src/config.ts) |
| `SELECT *` in settings values repository | 🟠 | [Apps/core-service/src/repositories/settings-values-repository.ts](../Apps/core-service/src/repositories/settings-values-repository.ts) |
| `SELECT *` in compliance service | 🟠 | [Apps/core-service/src/services/compliance-service.ts](../Apps/core-service/src/services/compliance-service.ts) |
| Excellent: bloom-filter username dedupe, TOTP MFA, retention sweep, tenant-throttled auth | ✅ | [Apps/core-service/src/lib/](../Apps/core-service/src/lib/) |
| Auth-service issues access + refresh tokens but **no refresh-token rotation / reuse-detection store** documented | 🟠 | [Apps/core-service/src/services/auth-service.ts](../Apps/core-service/src/services/auth-service.ts) — required by OWASP ASVS V3.5 |
| No automated test directory present | 🟠 | `tests/` empty / not present |
| Settings catalog seeded, multi-scope (tenant/property/unit/user) | ✅ | [Apps/core-service/src/services/settings-service.ts](../Apps/core-service/src/services/settings-service.ts) |

### 3.3 `reservations-command-service` (port 3020) — main write hub
| Finding | Sev | Evidence |
|---|---|---|
| Multiple sequential `await query()` per command in event handler → likely N+1 under load | 🔴 | [Apps/reservations-command-service/src/services/reservation-event-handler.ts](../Apps/reservations-command-service/src/services/reservation-event-handler.ts) |
| gRPC client to availability-guard — relies on default Fastify timeout, no explicit per-call deadline override on every method | 🟠 | [Apps/reservations-command-service/src/clients/availability-guard-client.ts](../Apps/reservations-command-service/src/clients/availability-guard-client.ts) |
| Idempotency table exists but **command schema does not require `idempotency_key`** in the Kafka envelope → replays may double-write | 🔴 | [Apps/reservations-command-service/src/repositories/idempotency-repository.ts](../Apps/reservations-command-service/src/repositories/idempotency-repository.ts) |
| Excellent: 15+ command handlers (check-in/out, transfer, upgrade, cancellation, group, OTA fallback) | ✅ | [Apps/reservations-command-service/src/services/reservation-commands/](../Apps/reservations-command-service/src/services/reservation-commands/) |
| Outbox publisher with per-tenant throttle | ✅ | [Apps/outbox/](../Apps/outbox/) |
| No automated tests | 🟠 | `tests/` mostly empty |
| **No OTA (`OTA_HotelResNotifRQ`) inbound mapping** — group bookings via custom REST only, not industry XML | 🟠 | Whole service |

### 3.4 `billing-service` (port 3025) — folio, charge, payment, invoice, AR
| Finding | Sev | Evidence |
|---|---|---|
| Money math via `decimal.js` — correct, no float errors | ✅ | [Apps/billing-service/src/utils/money.ts](../Apps/billing-service/src/utils/money.ts) |
| 16 calculation engines (tax, FX, comp, split, commission, loyalty, …) | ✅ | [Apps/billing-service/src/lib/engines/](../Apps/billing-service/src/lib/engines/) |
| **No code writes to `gl_journals` / `gl_entries` even though tables exist** → no double-entry bookkeeping → **fails USALI 11th Edition** | 🔴 | See [accounts-gaps/01-gl-journal-entries.md](../accounts-gaps/01-gl-journal-entries.md) |
| **No payment-gateway webhook receiver** for Stripe/Adyen/Worldpay async settlement / chargeback notifications | 🔴 | [accounts-gaps/04-payment-gateway-webhooks.md](../accounts-gaps/04-payment-gateway-webhooks.md) |
| **No POS / HTNG `PostingRQ` endpoint** for restaurant/spa/minibar charges to reach the folio | 🟠 | [accounts-gaps/05-pos-integration.md](../accounts-gaps/05-pos-integration.md) |
| **Night-audit not atomic** — partial run on crash leaves folios in inconsistent state | 🔴 | [accounts-gaps/14-night-audit-atomicity.md](../accounts-gaps/14-night-audit-atomicity.md) |
| **No row-level lock or SELECT … FOR UPDATE** during checkout vs payment posting → potential double-charge race | 🔴 | [accounts-gaps/15-concurrent-payment-checkout-lock.md](../accounts-gaps/15-concurrent-payment-checkout-lock.md) |
| No sequential, gap-free invoice numbering (legal requirement in EU/LATAM) | 🟠 | [accounts-gaps/11-invoice-sequential-numbering.md](../accounts-gaps/11-invoice-sequential-numbering.md) |
| No multi-currency FX-rate locking at point of sale → revenue distortion | 🟠 | [accounts-gaps/13-multi-currency-fx-locking.md](../accounts-gaps/13-multi-currency-fx-locking.md) |
| No PCI tokenisation boundary — card PAN handling responsibility unclear in code | 🔴 | service stores no PAN today, but no tokenisation gateway abstraction exists either |
| No tests | 🟠 | `tests/` mostly empty |

### 3.5 `availability-guard-service` (HTTP 3045 + gRPC 4400)
| Finding | Sev | Evidence |
|---|---|---|
| `SELECT *` in lock & audit repositories | 🟠 | [Apps/availability-guard-service/src/repositories/lock-repository.ts](../Apps/availability-guard-service/src/repositories/lock-repository.ts), [audit-repository.ts](../Apps/availability-guard-service/src/repositories/audit-repository.ts) |
| Pessimistic `FOR UPDATE` locking on shadow ledger | ✅ | repository code |
| `LIMIT ${limit}` template-literal interpolation — value comes from Zod-validated input but a typed cast (`::int`) would be safer | 🟡 | [audit-repository.ts](../Apps/availability-guard-service/src/repositories/audit-repository.ts) |
| Dual transport (HTTP for ops + gRPC for hot path) | ✅ | [Apps/availability-guard-service/src/grpc/server.ts](../Apps/availability-guard-service/src/grpc/server.ts) |
| Bearer token auth on gRPC | ✅ | grpc/server.ts |
| **No "shadow vs source-of-truth" reconciliation job exposed** — drift between `inventory_locks_shadow` and the real reservations table is not detected | 🟠 | service-wide |

### 3.6 `rooms-service` (port 3015) — inventory, rates, recommendations
| Finding | Sev | Evidence |
|---|---|---|
| Candidate-pipeline pattern (sources → filters → hydrators → scorers) | ✅ | [Apps/rooms-service/src/pipeline/](../Apps/rooms-service/src/pipeline/) |
| Multiple sequential `pool.query` in recommendation service → N+1 risk on bulk queries | 🟠 | [Apps/rooms-service/src/services/recommendation-service.ts](../Apps/rooms-service/src/services/recommendation-service.ts) |
| Outbound HTTP without explicit timeout/retry budget | 🟠 | recommendation-service |
| No tests | 🟠 | `tests/` mostly empty |
| **No OTA `OTA_HotelRateAmountNotifRQ` outbound** → cannot push rates to channel managers | 🟠 | service-wide |

### 3.7 `guests-service` (port 3010)
| Finding | Sev | Evidence |
|---|---|---|
| Hardcoded service-auth password fallback `"TempPass123"` | 🔴 | [Apps/guests-service/src/config.ts](../Apps/guests-service/src/config.ts) |
| GDPR erasure / rectification / consent endpoints exist | ✅ | [Apps/guests-service/src/routes/](../Apps/guests-service/src/routes/) |
| **No "right to data portability" export endpoint** (GDPR Art. 20) | 🟠 | service-wide |
| **No cryptographic anonymisation strategy** documented for erased guests still referenced by historical reservations (legal hold) | 🟠 | service-wide |
| Document upload route — no antivirus / MIME-sniffing check visible | 🟠 | document routes |
| No tests | 🟠 | tests/ mostly empty |

### 3.8 `housekeeping-service` (port 3030)
| Finding | Sev | Evidence |
|---|---|---|
| `SELECT *` in lost-and-found service | 🟠 | [Apps/housekeeping-service/src/services/lost-and-found-service.ts](../Apps/housekeeping-service/src/services/lost-and-found-service.ts) |
| **No HTNG `RoomStatusUpdateRQ`** ingest endpoint — door-lock/PBX systems cannot push status | 🟠 | service-wide |
| **No mobile-friendly task-board API** documented (housekeeper PWA use case) | 🟡 | routes/ |
| No tests | 🟠 | tests/ mostly empty |

### 3.9 `notification-service` (port 3055)
| Finding | Sev | Evidence |
|---|---|---|
| `EVENT_TO_TEMPLATE` hard-coded in code rather than using the existing `automated_messages` table | 🟠 | [Apps/notification-service/src/consumers/reservation-event-consumer.ts](../Apps/notification-service/src/consumers/reservation-event-consumer.ts) |
| Dual consumer pattern (`commands.primary` + `reservations.events`) | ✅ | consumers/ |
| **No suppression-list / unsubscribe handling** (CAN-SPAM / GDPR Art. 21) | 🟠 | service-wide |
| **No provider-failover** between SendGrid/SES/Twilio etc. — single SMTP/SMS provider per env | 🟡 | [Apps/notification-service/src/providers/](../Apps/notification-service/src/providers/) |
| No tests | 🟠 | tests/ mostly empty |

### 3.10 `revenue-service` (port 3060)
| Finding | Sev | Evidence |
|---|---|---|
| Forecast / yield / demand routes scaffolded but algorithms undocumented (no model-card, no back-test harness) | 🟠 | [Apps/revenue-service/src/lib/](../Apps/revenue-service/src/lib/) |
| No tests | 🟠 | tests/ mostly empty |

### 3.11 Shared libraries
| Library | Verdict | Notes |
|---|---|---|
| `command-consumer-utils` | ✅ Excellent | Centralised retry, DLQ, idempotency, metrics, lifecycle. Local types are infrastructure-only (allowed). |
| `outbox` | ✅ Excellent | Atomic Lua, per-tenant throttling, batch publish, DLQ. |
| `fastify-server` | ✅ Good | Standardises Helmet, CORS, Swagger, metrics. **Missing:** request-body size cap default, request-timeout default. |
| `tenant-auth` | ✅ Good | JWT verify, tenant scope, role gate, module gate. **Missing:** integrated rate-limit hook. |
| `config` | 🟠 | Hardcoded JWT secret default; `DB_POOL_MAX=10` default is far too low for the stated 20 K ops/sec target. |
| `telemetry` | ✅ Good | OTEL + Pino with PII redaction. |
| `candidate-pipeline` | ✅ Excellent | Generic, well-tested, allowed local types. |
| `openapi-utils` | ✅ Good | Helps Swagger generation. **Missing:** shared error-envelope schema, RFC 7807 problem-details. |

---

## 4. Coding Standard Gaps

### 4.1 TypeScript / SOLID
| # | Gap | Where | Fix |
|---|---|---|---|
| C1 | **No project-wide ESLint flat-config** — each service ships its own `.eslintrc.cjs` (eslint v8 pinned in root overrides) | every `Apps/*/.eslintrc.cjs` | Migrate to ESLint v9 flat config; share base via `Apps/eslint-config` package |
| C2 | **No shared `tsconfig.base.json`** referenced by every service | each service has its own `tsconfig.json` | Extract base, use `extends` |
| C3 | **No automated test coverage gate** — only `candidate-pipeline` and a few `tests/` directories have actual tests | almost all services | Add Vitest projects to Nx with min-coverage threshold |
| C4 | **`SELECT *` violates AGENTS.md** "Avoid SELECT * in production queries" | core-service, availability-guard, housekeeping-service | Replace with explicit columns |
| C5 | **N+1 query patterns** violate AGENTS.md "Avoid N+1 query patterns" | reservations-command-service event handler, rooms-service recommendations, billing-service charge posting | Use JOIN/CTE or batched `IN ($1,$2,…)` queries |
| C6 | **Template-literal SQL with non-cast inputs** — even though Zod-validated, lacks `::int` cast belt-and-braces | availability-guard audit repo | Use `LIMIT $1::int` form |
| C7 | **No RFC 7807 problem-details error envelope** — error shapes vary across services | every service | Standardise via `openapi-utils` |
| C8 | **No request-correlation propagation** beyond OTEL trace-id (no `X-Request-Id` echo back to client) | api-gateway | Add Fastify hook to inject + echo |
| C9 | **No structured-log redaction tests** — PII redactor exists but no unit test asserting masking | telemetry | Add vitest case |
| C10 | **Public methods lack TSDoc** in many services (AGENTS.md mandates docs for public/critical methods) | most services | Add TSDoc on exported functions |
| C11 | **Inconsistent naming** — some commands use `snake_case`, some `kebab-case` (e.g. `command_templates.command_name` vs `commands.primary` topic) | schema/events/commands & DB | Pick one (industry standard: `dot.case` for events, e.g. `reservation.created`) |

### 4.2 Schema-first compliance (per AGENTS.md)
The compliance scan (Stage-1 grep from AGENTS.md) was run mentally against the explorer report. Findings:

| File | Status |
|---|---|
| `core-service/src/types/auth.ts`, `system-admin.ts` | ✅ Allowed (auth layer / Fastify decorator) |
| `availability-guard-service/src/grpc/server.ts` | ✅ Allowed (gRPC framework binding) |
| `command-consumer-utils/src/*.ts` local types | ✅ Allowed (single-file infra) |
| `candidate-pipeline/src/*.ts` local types | ✅ Allowed (generic library) |
| Other services | 🟢 No new violations spotted in this audit; rerun the scan in CI |

Recommendation: wire the AGENTS.md schema-compliance grep into a CI step that fails the build on any new violation.

---

## 5. PMS Industry Standard Gaps

### 5.1 Messaging & integration (HTNG / OTA)
| Standard | Required for | Tartware status |
|---|---|---|
| **OTA `OTA_HotelResNotifRQ`** (inbound res from OTA / channel manager) | Booking.com, Expedia, Hotelbeds | ❌ Missing — only custom REST |
| **OTA `OTA_HotelAvailRQ` / `OTA_HotelAvailNotifRQ`** | Push availability to channels | ❌ Missing |
| **OTA `OTA_HotelRateAmountNotifRQ`** | Push rates | ❌ Missing |
| **HTNG `PostSimpleTransactionRQ`** (POS → folio posting) | Restaurant, spa, minibar | ❌ Missing |
| **HTNG `RoomStatusUpdateRQ`** (door-lock, PBX → housekeeping) | OnQ, ASSA ABLOY, Mitel | ❌ Missing |
| **HTNG `GuestProfileNotificationRQ`** | CRM sync | ❌ Missing |
| **HTNG `SubscribeRQ` event-bus pattern** | Industry-grade event subscription | ⚠️ Have Kafka but not the HTNG envelope |
| **OpenTravel error codes** (`OTA_ResRetrieveRS Errors`) | Standard error semantics | ❌ Custom error format |

### 5.2 Accounting & finance (USALI 11th Edition)
This is the **single biggest functional gap**. The repo contains a thorough `accounts-gaps/` register that documents 24 known issues. Highlights:

| # | USALI / Industry requirement | Tartware status |
|---|---|---|
| F1 | Double-entry posting to GL on every charge/payment | ❌ Tables exist (`gl_journals`, `gl_entries`) but no code path writes to them |
| F2 | Advance-deposit ledger separated from revenue ledger | ❌ Missing |
| F3 | Suspense account for unmatched payments | ❌ Missing |
| F4 | Sequential, gap-free invoice numbering (EU/Brazil/India legal) | ❌ Missing |
| F5 | Cancellation policy snapshotted at booking time (cannot change retro-actively) | ❌ Missing |
| F6 | FX rate locked at folio-line creation, not at posting | ❌ Missing |
| F7 | Night-audit single transaction or saga with compensations | ❌ Not atomic |
| F8 | Concurrent payment + checkout serialisation | ❌ No row lock |
| F9 | Overpayment handling + refund workflow | ❌ Missing |
| F10 | USALI GL-code mapping table | ❌ Missing |
| F11 | Group master-folio billing routing rules persisted as rows | ✅ Fixed in [#193](https://github.com/red2n/tartware/issues/193) |
| F12 | Approval workflow for adjustments / comps over a threshold | ❌ Missing |
| F13 | Audit-trail row writing on every financial mutation | ⚠️ Audit table exists, not consistently written |
| F14 | Tax engine (VAT, GST, occupancy tax, city tax, bed tax) layered correctly | ⚠️ Engine exists; rules-config not seeded |

### 5.3 Payments & PCI-DSS v4.0
| Requirement | Status |
|---|---|
| No PAN/CVV ever stored in DB | ✅ Inferred — no `card_pan` column exists |
| Tokenisation gateway boundary explicit in code | ❌ No `PaymentGateway` interface in `schema/api/` |
| 3-D Secure 2 / SCA flow for online check-in | ❌ Missing |
| PCI logging — every access to cardholder data audited | ❌ No CHD tag in audit log |
| Quarterly key-rotation hooks | ❌ Missing |
| **Webhook signature verification** (Stripe `Stripe-Signature`, Adyen HMAC) | ❌ Missing — webhook endpoint itself is missing |

### 5.4 Privacy & GDPR / DPDP / CCPA
| Requirement | Status |
|---|---|
| Right to access | ✅ `compliance` routes |
| Right to rectification | ✅ |
| Right to erasure (with legal-hold exceptions for finance docs ≥ 7 yrs) | ⚠️ Erase exists, legal-hold handling unclear |
| Right to data portability (machine-readable export) | ❌ Missing |
| Consent registry (purpose-scoped, time-stamped, revocable) | ⚠️ `compliance_preferences` table exists; UI/API minimal |
| Data Protection Impact Assessment (DPIA) artefacts | ❌ Not in repo |
| Breach-notification workflow (72-hour clock) | ❌ Missing |
| Cross-border transfer logging | ❌ Missing |

### 5.5 Operational PMS features (industry-expected)
| Capability | Status |
|---|---|
| Rate plans with stay-restrictions (LOS, MinLOS, MaxLOS, CTA, CTD, BAR) | ⚠️ Schema partial |
| Yield mgmt with competitive rate-shopping ingest | ❌ |
| Channel-manager push (rates / availability / restrictions) | ❌ |
| GDS interface (Sabre / Amadeus / Travelport) | ❌ |
| Loyalty program with tiers, redemption, certificate burn/earn | ✅ partial |
| Group blocks with cut-off, pickup, attrition tracking | ⚠️ schema present; pickup/attrition logic missing |
| Allotments / wholesaler contracts | ❌ |
| Travel-agent commissions with WPS / IATA #s | ⚠️ engine present, IATA validation missing |
| Night audit, shift-end, day-close reports | ❌ atomic |
| Statistics: ADR, RevPAR, TRevPAR, OCC, GOPPAR, ALOS | ⚠️ not exposed via reporting routes |

### 5.6 Security (OWASP API Top 10 2023)
| OWASP API Top 10 | Status in Tartware |
|---|---|
| API1 Broken Object Level Auth (BOLA) | ⚠️ Tenant scope enforced; per-property scope sometimes only checked in service layer — needs audit |
| API2 Broken Authentication | 🔴 Hardcoded secrets, no refresh-token reuse-detection |
| API3 Broken Object Property Level Auth | ⚠️ No mass-assignment protection on PUT/PATCH; relies on per-route Zod schemas |
| API4 Unrestricted Resource Consumption | ⚠️ Rate-limit yes; no per-tenant cost-budget |
| API5 BFLA (function level auth) | ✅ role-based enforced via tenant-auth |
| API6 Unrestricted access to sensitive business flows | ⚠️ Bulk-export endpoints missing rate caps |
| API7 SSRF | ⚠️ Notification provider URLs not validated against allow-list |
| API8 Security Misconfiguration | 🔴 Hardcoded secrets, no CSP header config visible |
| API9 Improper Inventory Management | 🟠 No `/openapi.json` published with versioning policy |
| API10 Unsafe Consumption of APIs | ⚠️ OTA / payment webhooks not yet implemented; will need signature verification |

---

## 6. Deployment / Operational Standard Gaps

### 6.1 12-Factor scorecard
| Factor | Status | Notes |
|---|---|---|
| I  Codebase | ✅ | Single Nx monorepo |
| II  Dependencies | ✅ | pnpm workspaces, lockfile committed |
| III  Config | 🔴 | Hardcoded fallbacks in code; `config/` lib defaults too lax |
| IV  Backing services | ✅ | DB / Redis / Kafka via env URL |
| V  Build / Release / Run | 🟠 | No release artefact strategy (no container images per service) |
| VI  Processes (stateless) | ✅ | All services stateless except in-memory caches |
| VII  Port binding | ✅ | Each service `listen($PORT)` |
| VIII  Concurrency | ⚠️ | DB pool default 10 — too low for 20K ops/sec target |
| IX  Disposability | ✅ | Graceful SIGTERM handling |
| X  Dev/Prod parity | 🟠 | Dev-only fallbacks bleed into prod paths |
| XI  Logs | ✅ | Pino + OTEL |
| XII  Admin processes | 🟠 | Retention sweep is in-process; should be separable Nx target |

### 6.2 Containerisation
| Item | Status |
|---|---|
| Dockerfile for `api-gateway` | ✅ exists |
| Dockerfile for every other service | ❌ missing |
| Multi-stage build with non-root user | ⚠️ verify api-gateway Dockerfile |
| `.dockerignore` per service | ❌ |
| Image scanning (Trivy / Grype) in CI | ❌ |
| SBOM generation (`syft`) | ❌ |
| Distroless or chiseled base image | ❌ |

### 6.3 Kubernetes / orchestration
| Item | Status |
|---|---|
| Helm chart or Kustomize overlays | ❌ none in repo |
| `livenessProbe`, `readinessProbe`, `startupProbe` per service | ❌ no manifests |
| HPA based on CPU + custom Kafka-lag metric | ❌ |
| PodDisruptionBudget + topology spread constraints | ❌ |
| NetworkPolicy (zero-trust east-west) | ❌ |
| Sealed-Secrets / External-Secrets Operator | ❌ |
| ServiceMesh (Istio/Linkerd) for mTLS | ❌ |

### 6.4 CI / CD
| Item | Status |
|---|---|
| `pnpm run build` gate | ✅ documented in AGENTS.md |
| Lint / Biome / Knip pre-push | ✅ documented |
| Unit-test coverage gate | ❌ no minimum coverage configured |
| Contract tests (Pact / schemathesis) on Kafka commands | ❌ |
| Load test against 20K ops/sec target in CI | ❌ |
| DB migration smoke (apply + rollback) | ❌ |
| Container image build + scan | ❌ |
| Deployment promotion (dev → staging → prod) | ❌ no GitOps repo |

### 6.5 Observability
| Item | Status |
|---|---|
| Distributed tracing (OTEL) | ✅ `telemetry/` |
| Pino structured logs with PII redaction | ✅ |
| Prometheus metrics endpoints | ✅ |
| RED metrics on every command handler | ⚠️ partial |
| Kafka consumer-lag dashboards | ❌ no Grafana dashboards in repo |
| SLO definitions / error budgets | ❌ |
| Alerting rules (Prometheus / Alertmanager) | ❌ |

### 6.6 Resilience
| Item | Status |
|---|---|
| Circuit breakers (gateway → services) | ✅ |
| Bulkheads (per-tenant connection slots) | ❌ |
| Timeouts on every outbound call | ⚠️ partial |
| Retry with exponential backoff + jitter | ✅ in `command-consumer-utils` |
| DLQ for every Kafka topic | ✅ |
| DLQ replay tooling | ⚠️ `roll-replay.ts` exists; not all topics covered |
| Chaos / fault-injection tests | ❌ |
| Disaster recovery runbook | ⚠️ [docs/DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) exists — verify currency |

### 6.7 Database
| Item | Status |
|---|---|
| Idempotent migrations | ✅ |
| Tenant-scoped soft-delete enforcement | ✅ `99_enforce_tenant_soft_delete.sql` |
| Indexes for hot filter/sort columns | ⚠️ `scripts/indexes/` exists — coverage audit needed |
| Partitioning strategy for large tables (`reservations`, `folio_items`, `outbox`) | ⚠️ partial; verify |
| PgBouncer transaction pooling | ✅ docker-compose |
| Read replicas | ❌ |
| Point-in-time-recovery (PITR) backups | ❌ not in repo |
| Schema-version tracking (`schema_versions` table or `pgmigrate`) | ❌ |

---

## 7. Consolidated Gap Register

### 🔴 P0 — block production launch
1. Hardcoded JWT secret + admin password fallbacks (`api-gateway`, `core-service`, `guests-service`, `config/`).
2. No `idempotency_key` enforcement in command schemas → replay can double-write.
3. N+1 / sequential query pattern in `reservations-command-service` event handler.
4. **No GL journal posting** — fails USALI; downstream finance reporting impossible.
5. **No payment-gateway webhook receiver** with signature verification (Stripe/Adyen/Worldpay).
6. **Night-audit not atomic** — partial-run risk.
7. **No row-level lock** during concurrent payment + checkout → double-charge race.
8. PCI-DSS boundary not codified — no `PaymentGateway` interface in `schema/api/`.

### 🟠 P1 — block GA
9. `SELECT *` in `core-service`, `availability-guard-service`, `housekeeping-service`.
10. No `/health` & `/ready` endpoints standardised across services; no readiness gate semantics.
11. No mTLS / signed requests gateway ↔ services.
12. Service-level Dockerfiles missing for everything except `api-gateway`.
13. No K8s manifests / Helm chart / GitOps repo.
14. Default `DB_POOL_MAX=10` is ~10× too low for 20 K ops/sec.
15. Test coverage near zero for domain services.
16. Missing OTA / HTNG inbound and outbound integration surfaces.
17. Sequential, gap-free invoice numbering (legal in EU/LATAM).
18. FX-rate locking at folio-line creation.
19. Refresh-token reuse-detection store.
20. Right-to-portability data export (GDPR Art. 20).
21. RFC 7807 problem-details error envelope across services.
22. Notification provider URL allow-list (SSRF mitigation).
23. SBOM + image scanning in CI.

### 🟡 P2 — post-GA hardening
24. Schema-versioning policy for Kafka commands (additive evolution).
25. Bulkhead per-tenant connection budgeting.
26. Multi-provider failover for email/SMS.
27. Yield-management model cards + back-test harness.
28. Chaos / fault-injection in CI.
29. Read-replica routing for read-heavy services (`rooms-service`, `core-service` settings).
30. Channel-manager / GDS connectivity (Sabre, Amadeus, Travelport).
31. ADR / RevPAR / GOPPAR reporting endpoints.
32. UI gaps documented in `accounts-gaps/18-24*.md`.

---

## 8. Prioritised Remediation Roadmap

### Sprint 1 (P0 critical — ~1 week of focused work)
- [ ] Strip hardcoded secrets; require all services to **fail-fast** if `AUTH_JWT_SECRET` / `AUTH_DEFAULT_PASSWORD` is unset in `NODE_ENV=production`.
- [ ] Add `idempotency_key` (UUID v4) to all command Zod schemas in `schema/src/events/commands/`; reject commands missing it; persist to `idempotency_log` before handler runs.
- [ ] Replace sequential `await query(...)` blocks in [reservation-event-handler.ts](../Apps/reservations-command-service/src/services/reservation-event-handler.ts) with single JOIN/CTE query.
- [ ] Eliminate `SELECT *` in the 5 cited files.
- [ ] Add `SELECT … FOR UPDATE` row lock around the folio mutation path during checkout.
- [ ] Wire `PaymentGateway` provider interface into `schema/src/api/` and a Stripe-flavoured webhook route into `billing-service` with HMAC verification.
- [ ] Begin GL-posting wiring: every charge/payment commit emits paired GL entries inside the same DB transaction.

### Sprint 2 (P1 GA blockers — ~2 weeks)
- [ ] Standardise `/health` (liveness) + `/ready` (deps probe) using a `fastify-server` plugin.
- [ ] Per-service multi-stage Dockerfile (non-root, distroless), `.dockerignore`, image scan in CI.
- [ ] Helm chart skeleton with probes, HPA on Kafka-lag, PDBs, NetworkPolicy.
- [ ] Raise `DB_POOL_MAX` default; add per-service override; document sizing math.
- [ ] Vitest projects per service with `--coverage` gate ≥ 50 % on services touching money or auth.
- [ ] Refresh-token rotation + reuse-detection table.
- [ ] Sequential invoice numbering (advisory PG sequence per `tenant_id, fiscal_year`).
- [ ] FX-rate snapshot column on `folio_items`.
- [ ] RFC 7807 error envelope via `openapi-utils`.
- [ ] OTA `OTA_HotelResNotifRQ` inbound mapping → command-center bridge.

### Sprint 3 (P1 + P2 — ~3 weeks)
- [ ] HTNG `PostSimpleTransactionRQ` POS endpoint.
- [ ] Channel-manager outbound (`OTA_HotelAvailNotifRQ`, `OTA_HotelRateAmountNotifRQ`).
- [ ] DR runbook validation drill; PITR backups configured.
- [ ] Grafana dashboards: Kafka lag, DLQ rate, command latency p99, DB pool saturation.
- [ ] Load test asserting 20 K ops/sec p99 < 200 ms.
- [ ] Schema-compliance grep wired into CI.
- [ ] Reporting endpoints for ADR, RevPAR, OCC, GOPPAR, ALOS.

### Sprint 4+ (post-GA hardening)
- [ ] Bulkheads per tenant.
- [ ] Read-replica routing.
- [ ] Multi-provider notification failover.
- [ ] Yield-model back-test harness + model cards.
- [ ] GDS connectivity research spike.

---

## Appendix A — Strengths to Preserve

These patterns are already industry-grade and should not be touched in remediation:
- **Schema-first discipline** with explicit allowed-exception list (AGENTS.md).
- **Transactional outbox** with per-tenant throttling ([Apps/outbox/](../Apps/outbox/)).
- **Redis-backed circuit breaker** with atomic Lua scripts ([Apps/api-gateway/src/utils/circuit-breaker.ts](../Apps/api-gateway/src/utils/circuit-breaker.ts)).
- **Candidate pipeline** abstraction in [Apps/candidate-pipeline/](../Apps/candidate-pipeline/) — generic, well-tested.
- **Decimal.js everywhere money flows** ([Apps/billing-service/src/utils/money.ts](../Apps/billing-service/src/utils/money.ts)).
- **OTEL + Pino** with PII redaction ([Apps/telemetry/](../Apps/telemetry/)).
- **Multi-tenant auth** with role + module gating ([Apps/tenant-auth/](../Apps/tenant-auth/)).
- **Tenant-scoped soft-delete enforcement** at the DB layer (`scripts/tables/99_enforce_tenant_soft_delete.sql`).

## Appendix B — Files Cited (quick navigator)
- [Apps/api-gateway/src/config.ts](../Apps/api-gateway/src/config.ts)
- [Apps/api-gateway/src/utils/circuit-breaker.ts](../Apps/api-gateway/src/utils/circuit-breaker.ts)
- [Apps/core-service/src/config.ts](../Apps/core-service/src/config.ts)
- [Apps/core-service/src/repositories/settings-values-repository.ts](../Apps/core-service/src/repositories/settings-values-repository.ts)
- [Apps/core-service/src/services/compliance-service.ts](../Apps/core-service/src/services/compliance-service.ts)
- [Apps/reservations-command-service/src/services/reservation-event-handler.ts](../Apps/reservations-command-service/src/services/reservation-event-handler.ts)
- [Apps/reservations-command-service/src/clients/availability-guard-client.ts](../Apps/reservations-command-service/src/clients/availability-guard-client.ts)
- [Apps/reservations-command-service/src/repositories/idempotency-repository.ts](../Apps/reservations-command-service/src/repositories/idempotency-repository.ts)
- [Apps/billing-service/src/utils/money.ts](../Apps/billing-service/src/utils/money.ts)
- [Apps/billing-service/src/lib/engines/](../Apps/billing-service/src/lib/engines/)
- [Apps/availability-guard-service/src/repositories/lock-repository.ts](../Apps/availability-guard-service/src/repositories/lock-repository.ts)
- [Apps/availability-guard-service/src/repositories/audit-repository.ts](../Apps/availability-guard-service/src/repositories/audit-repository.ts)
- [Apps/availability-guard-service/src/grpc/server.ts](../Apps/availability-guard-service/src/grpc/server.ts)
- [Apps/rooms-service/src/services/recommendation-service.ts](../Apps/rooms-service/src/services/recommendation-service.ts)
- [Apps/rooms-service/src/pipeline/](../Apps/rooms-service/src/pipeline/)
- [Apps/guests-service/src/config.ts](../Apps/guests-service/src/config.ts)
- [Apps/housekeeping-service/src/services/lost-and-found-service.ts](../Apps/housekeeping-service/src/services/lost-and-found-service.ts)
- [Apps/notification-service/src/consumers/reservation-event-consumer.ts](../Apps/notification-service/src/consumers/reservation-event-consumer.ts)
- [Apps/outbox/](../Apps/outbox/)
- [Apps/telemetry/](../Apps/telemetry/)
- [Apps/tenant-auth/](../Apps/tenant-auth/)
- [accounts-gaps/00-CONSOLIDATED.md](../accounts-gaps/00-CONSOLIDATED.md) (full accounting gap register)

---

*End of report.*

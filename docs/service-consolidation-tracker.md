# Service Consolidation Tracker

**Goal:** Reduce 20 services → 10 PMS-domain-specific services with SaaS support.
**Architecture:** Command-driven (Kafka outbox), multi-tenant, targeting 20K ops/sec.

---

## Progress Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Done | API Gateway absorbs Command Center |
| Phase 2 | ✅ Done | guests-service absorbs guest-experience-service |
| Phase 3 | ✅ Complete | property-service (rooms + recommendation) |
| Phase 4 | ✅ Complete | operations-service (housekeeping + cashier) |
| Phase 5 | ✅ Complete | platform-service (core + settings + service-registry) |
| Phase 6 | ✅ Complete | finance-service (billing + accounts + finance-admin + calculation + roll) |
| Phase 7 | ⬜ Pending | revenue-service extended |

---

## Service Map: Before → After

| Original Service | Port | Status | Destination |
|-----------------|------|--------|-------------|
| `api-gateway` | 8080 | ✅ Active | Kept — gateway entry point |
| `command-center-service` | 3035 | ✅ Deleted | Absorbed into `api-gateway` (Phase 1) |
| `guests-service` | 3010 | ✅ Active | Kept + absorbs guest-experience (Phase 2) |
| `guest-experience-service` | 3065 | ✅ Deprecated | Merged into `guests-service` (Phase 2) |
| `reservations-command-service` | 3020 | ⬜ Unchanged | Keep as-is |
| `availability-guard-service` | 3045 | ⬜ Unchanged | Keep as-is (gRPC + HTTP) |
| `notification-service` | 3055 | ⬜ Unchanged | Keep as-is |
| `rooms-service` | 3015 | ✅ Complete | absorbed `recommendation-service` (Phase 3) |
| `recommendation-service` | 3040 | ✅ Deprecated | merged into `rooms-service` (Phase 3) |
| `housekeeping-service` | 3030 | ✅ Complete | absorbed `cashier-service` (Phase 4) |
| `cashier-service` | 3080 | ✅ Deprecated | merged into `housekeeping-service` (Phase 4) |
| `core-service` | 3000 | ✅ Complete | Kept + absorbs settings + service-registry (Phase 5) |
| `settings-service` | 3005 | ✅ Deprecated | Merged into `core-service` (Phase 5) |
| `service-registry` | 3075 | ✅ Deprecated | Merged into `core-service` (Phase 5) |
| `billing-service` | 3025 | ✅ Complete | Kept as base + absorbed accounts, finance-admin, calculation, roll (Phase 6) |
| `accounts-service` | 3085 | ✅ Deprecated | Absorbed into `billing-service` (Phase 6) |
| `finance-admin-service` | 3090 | ✅ Deprecated | Absorbed into `billing-service` (Phase 6) |
| `calculation-service` | 3070 | ✅ Deprecated | Absorbed into `billing-service` (Phase 6) |
| `roll-service` | 3050 | ✅ Deprecated | Absorbed into `billing-service` (Phase 6) |
| `revenue-service` | 3060 | ⬜ Pending | Extended in Phase 7 |

**Eliminated so far: 9 / 10 target**

---

## Target Architecture (10 Services)

```
Client → API Gateway (:8080)
  ├── guests-service (:3010)           — guest profiles, loyalty, GDPR, self-service
  ├── reservations-command-service (:3020) — reservation lifecycle + Kafka outbox
  ├── availability-guard-service (:3045)  — inventory locks (gRPC + HTTP)
  ├── notification-service (:3055)     — email/SMS/push via Kafka
  ├── property-service (:3015)         — rooms, room types, recommendations [Phase 3]
  ├── operations-service (:3030)       — housekeeping, cashier, front-desk ops [Phase 4]
  ├── platform-service (:3000)         — auth, tenants, settings, SaaS metering [Phase 5]
  ├── finance-service (:3025)          — billing, folios, accounts, GL, roll ledger [Phase 6]
  └── revenue-service (:3060)          — KPIs, STR benchmarks, compliance reporting [Phase 7]
```

---

## Phase Details

### ✅ Phase 1 — API Gateway absorbs Command Center
**Services merged:** `command-center-service` → `api-gateway`
**What moved:**
- Command definitions/features routes → `api-gateway/src/routes/command-center-routes.ts`
- Command registry (in-memory + DB poll) → `api-gateway/src/command-center/`
- Feature toggle SQL → `api-gateway/src/command-center/sql/`

**Removed:**
- `dev:command-center` script
- `COMMAND_CENTER_SERVICE_URL` env var
- Health check for `command-center-service`
- `Apps/command-center-service/` directory deleted

---

### ✅ Phase 2 — guests-service absorbs guest-experience-service
**Services merged:** `guest-experience-service` (3065) → `guests-service` (3010)
**What moved:**
- Self-service routes (check-in, checkout, booking, keys, rewards, registration card)
- Checkin/checkout/key/card/booking/reward services
- Stripe payment gateway integration
- Internal API client (`internalGet`)
- Second Kafka consumer group (`guest-experience-command-center-consumer`)
- Check-in metrics

**Removed:**
- `dev:guest-experience` script
- `GUEST_EXPERIENCE_SERVICE_URL` env var
- Gateway `self-service-routes.ts` now routes to `guestsServiceUrl`
- `Apps/guest-experience-service/` marked DEPRECATED

---

### ✅ Phase 3 — property-service (rooms + recommendation)
**Target service name:** `property-service` (port 3015)
**Services to merge:** `rooms-service` (3015) → kept as base + absorbs `recommendation-service` (3040)
**What to move:**
- Room listing, room types, room availability, floor maps
- Room recommendation/ranking engine
- Remove `RECOMMENDATION_SERVICE_URL` env var and health check
- Remove `dev:recommendation` script

---

### ✅ Phase 4 — operations-service (housekeeping + cashier)
**Target service name:** `operations-service` (port 3030)
**Services merged:** `cashier-service` (3080) → `housekeeping-service` (3030)
**What moved:**
- Cashier session routes (list, detail, shift-summary) → `housekeeping-service/src/routes/cashier.ts`
- Cashier read service → `housekeeping-service/src/services/cashier-service.ts`
- Cashier command handlers (open/close/handover) → `housekeeping-service/src/services/cashier-commands.ts`
- Cashier SQL queries → `housekeeping-service/src/sql/cashier-queries.ts`
- `cashier-commands.ts` → `housekeeping-service/src/services/cashier-common.ts`
- Billing command schemas → `housekeeping-service/src/schemas/billing-commands.ts`
- `billing.cashier.open`, `billing.cashier.close`, `billing.cashier.handover` cases added to command consumer
- `queryWithClient`, `withTransaction` added to `lib/db.ts`

**Removed:**
- `dev:cashier` script
- `CASHIER_SERVICE_URL` env var from `dev:gateway`
- Gateway `billing-routes.ts` cashier proxy now routes to `housekeepingServiceUrl`
- `Apps/cashier-service/` marked DEPRECATED

---

### ✅ Phase 5 — platform-service (core + settings + service-registry)
**Target service name:** `platform-service` (port 3000)
**Services merged:** `settings-service` (3005) + `service-registry` (3075) → `core-service` (3000)
**What moved:**
- Settings routes (catalog, amenities, packages, screen-permissions) → `core-service/src/routes/settings-*.ts`
- Settings repositories (5 repo files) → `core-service/src/repositories/`
- Settings data catalog (entire `src/data/` folder) → `core-service/src/data/`
- Settings Kafka consumer + command service → `core-service/src/commands/settings-command-center-consumer.ts`
- In-memory service registry (`registry-store.ts`, `routes/registry.ts`) → `core-service/src/`
- Auth compatibility adapter → `core-service/src/plugins/settings-auth.ts`
- Registry metrics (`registry_services_total`, `registry_registrations_total`) → `core-service/src/lib/metrics.ts`
- Settings Kafka client/producer → `core-service/src/kafka/settings-kafka-*.ts`

**Removed:**
- `dev:settings` and `dev:registry` scripts
- `SETTINGS_SERVICE_URL` and `SERVICE_REGISTRY_URL` env vars from `dev:gateway`
- `REGISTRY_URL` updated to `http://localhost:3000` in dev:backend/dev:stack
- `KAFKA_BROKERS` added to `dev:core` for settings consumer startup
- Gateway `misc-routes.ts` and `registry-proxy-routes.ts` updated to use `coreServiceUrl`
- `Apps/settings-service/` and `Apps/service-registry/` marked DEPRECATED

---

### ✅ Phase 6 — billing-service absorbs (accounts + finance-admin + calculation + roll)
**Target service name:** `finance-service` (port 3025)
**Services to merge:** `billing-service` (3025) → kept as base + absorbs others
**What to move:**
- Accounts receivable (accounts-service)
- Finance admin reports and GL exports (finance-admin-service)
- Rate calculation engine (calculation-service)
- Shadow roll ledger consumer (roll-service)
- Remove `ACCOUNTS_SERVICE_URL`, `FINANCE_ADMIN_SERVICE_URL`, `CALCULATION_SERVICE_URL` env vars
- Remove `dev:accounts`, `dev:finance-admin`, `dev:calculation`, `dev:roll-service` scripts

---

### ⬜ Phase 7 — revenue-service extended
**Target service name:** `revenue-service` (port 3060)
**Currently does:** KPI aggregates, RevPAR/ADR/occupancy, STR benchmarks
**What to add:**
- Compliance/reporting routes that currently live in `core-service`
- Audit log exports
- Remove any remaining split between core reporting and revenue reporting

---

## Completed Changes Log

| Date | Phase | Action |
|------|-------|--------|
| 2026-04-03 | 1 | `command-center-service` absorbed into `api-gateway`; directory deleted |
| 2026-04-03 | 2 | `guest-experience-service` merged into `guests-service`; marked deprecated |
| 2026-04-03 | 3 | `recommendation-service` merged into `rooms-service`; marked deprecated |
| 2026-04-03 | 4 | `cashier-service` merged into `housekeeping-service`; marked deprecated |
| 2026-04-XX | 6 | `accounts-service`, `finance-admin-service`, `calculation-service`, `roll-service` absorbed into `billing-service`; all 4 deprecated |

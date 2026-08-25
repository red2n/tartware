# PMS Capability Gap Analysis — Consolidated

> **Benchmark:** Hotel PMS Capability Atlas — 479 capabilities, 21 domains. Spine is Oracle OPERA
> Cloud 25.3's functional surface, extended with what cloud-native vendors (Mews, Cloudbeds, Apaleo,
> Stayntouch, Agilysys) have made table stakes since 2020, plus obligations that come from PCI DSS
> v4.0, PSD2/SCA, GDPR and national fiscalization regimes rather than from competitors.
> **Graded against:** `api-to-ui-gap` @ `ed524c8f` — `schema/src/schemas` (10 categories),
> `Apps/*/src` (19 services, ~430 route paths), `UI/pms-ui` (71 routes) and `UI/guest-portal`.
> **Date:** 2026-08-25
> **Commit tag:** `PMS-nn`
> **Read [README.md](README.md) before starting work.**

---

## Headline

**181 built · 144 partial · 154 missing.**

Only **four table-stakes capabilities are missing outright**. For a product at this stage that is
unusually complete — cashiering, AR, night audit and the platform layer are genuinely strong, and the
schema reaches into places most PMS products never get to.

**The exposure is not in what's absent. It's in the 35 table-stakes items graded PARTIAL** — where a
table exists, a route exists, and nothing enforces, calls or renders it. Eight of those fail in the
first hour of an evaluation:

| # | What | Why it fails |
|---|---|---|
| 1 | [One reservation, one room, one rate](01-reservations.md#pms-01-02) | `reservations` holds a single `room_id` and a flat `room_rate`. No per-night rate table anywhere. Kills multi-room, split-rate, mid-stay changes — four items, one schema decision. |
| 2 | [Restrictions never enforced](03-rooms-inventory.md#pms-03-02) | `rate_calendar` has CTA/CTD/min-LOS/advance/`rooms_to_sell`. `createReservation` reads none of them. Every restriction is decorative. |
| 3 | [Nothing calls a PSP](15-payments-fiscal.md#pms-15-02) | Real Stripe adapter exists — in `guests-service`, self-service only. `billing-service` stores caller-supplied gateway references. A front desk cannot take a card. |
| 4 | [No door-lock interface](17-integrations.md#pms-17-01) | Zero vendor references. `mobile_keys` has nothing to issue against. The most-asked-about PMS interface, with no groundwork. |
| 5 | [Channel push is simulated](14-distribution.md#pms-14-01) | `ota-integration.ts:29` says so. 775 lines of correct machinery around a stub. Rates go nowhere. |
| 6 | [No document renderer](11-cashiering-folios.md#pms-11-01) | No PDF path in the repo. Folios, invoices, statements, batch reg cards and every export past GL CSV/XML die here. **13 items, one build.** |
| 7 | [Check-in cannot be undone](02-front-desk.md#pms-02-01) | No reversal for check-in or check-out. A mis-key on an arrival day means direct database work. |
| 8 | [Fiscalization does not exist](15-payments-fiscal.md#pms-15-13) | "Fiscal" here means accounting periods. No TSE, SdI, NF-e or GST e-invoicing. DE/IT/PT/PL/BR/IN are closed markets — a legal gate, not a feature gap. |

---

## What is already strong — do not rebuild

| Area | Evidence |
|---|---|
| **Cashiering & folios** (18/33) | Multi-window folios, split/merge/transfer, void, credit notes, comps with authorizers, tax exemption, cashier sessions with handover and variance, 16 calculation engines |
| **Accounts receivable** (13/21) | Account master, aging, statements, dunning rules with effectiveness tracking, risk score, DSO, collection rate, GL batches with CSV/XML export and USALI categories, write-off |
| **Night audit** (8/14) | Business date management, pre-audit checklist, room and tax posting, no-show sweep, date roll, trial balance, bucket-check, suspense items, checkpoints, re-run protection |
| **Revenue management** (10/18) | Forecasts, pace, budget variance, displacement, compset indices, competitor rates, hurdle rates, channel profitability, segment analysis, manager's report |
| **Administration & security** (12/21) | RBAC with screen permissions, MFA, break-glass with audit, feature flags per property, approval workflows, module entitlement, data retention, system-admin impersonation |
| **Platform** (7/20) | Business-date-aware model, idempotency (37 schema + 57 service files), transactional outbox, Kafka event pipeline, OpenTelemetry, i18n across 175 UI files, realdata E2E generation |
| **Events & catering** (6/17) | Function space, diary, event bookings, BEO generation with versioning and publish/revise, day sheet, event charge posting — more than most products have at this stage |

---

## Scoreboard by domain

| # | Domain | Built | Partial | Missing | Gap file |
|---|---|---|---|---|---|
| 01 | Reservations & Booking | 15 | 12 | 20 | [01-reservations.md](01-reservations.md) |
| 02 | Front Desk & Front Office | 15 | 13 | 12 | [02-front-desk.md](02-front-desk.md) |
| 03 | Rooms & Inventory | 8 | 6 | 9 | [03-rooms-inventory.md](03-rooms-inventory.md) |
| 04 | Housekeeping & Maintenance | 11 | 5 | 4 | [04-housekeeping.md](04-housekeeping.md) |
| 05 | Rates & Pricing | 14 | 7 | 5 | [05-rates-pricing.md](05-rates-pricing.md) |
| 06 | Revenue Management & Forecasting | 10 | 6 | 2 | [06-revenue-management.md](06-revenue-management.md) |
| 07 | Guest Profiles & CRM | 12 | 9 | 5 | [07-guest-profiles.md](07-guest-profiles.md) |
| 08 | Loyalty & Memberships | 4 | 4 | 8 | [08-loyalty.md](08-loyalty.md) |
| 09 | Groups, Blocks & Allotments | 6 | 7 | 8 | [09-groups-blocks.md](09-groups-blocks.md) |
| 10 | Events, Catering & Function Space | 6 | 3 | 8 | [10-events-catering.md](10-events-catering.md) |
| 11 | Cashiering, Folios & Billing | 18 | 8 | 7 | [11-cashiering-folios.md](11-cashiering-folios.md) |
| 12 | Accounts Receivable & Back Office | 13 | 4 | 4 | [12-accounts-receivable.md](12-accounts-receivable.md) |
| 13 | Night Audit & Day Close | 8 | 3 | 3 | [13-night-audit.md](13-night-audit.md) |
| 14 | Distribution & Channel Management | 2 | 9 | 8 | [14-distribution.md](14-distribution.md) |
| 15 | Payments & Fiscal Compliance | 1 | 9 | 8 | [15-payments-fiscal.md](15-payments-fiscal.md) |
| 16 | Reporting & Analytics | 9 | 4 | 6 | [16-reporting.md](16-reporting.md) |
| 17 | Integrations & Interfaces | 3 | 11 | 11 | [17-integrations.md](17-integrations.md) |
| 18 | Guest-Facing Digital | 6 | 7 | 6 | [18-guest-digital.md](18-guest-digital.md) |
| 19 | Administration, Configuration & Security | 12 | 6 | 3 | [19-administration.md](19-administration.md) |
| 20 | Multi-Property, Chain & Enterprise | 1 | 1 | 14 | [20-multi-property.md](20-multi-property.md) |
| 21 | Platform & Non-Functional | 7 | 10 | 3 | [21-platform.md](21-platform.md) |
| | **Total** | **181** | **144** | **154** | |

By tier: table stakes **86 built / 35 partial / 4 missing**, competitive **77 / 75 / 66**,
enterprise **18 / 34 / 84**.

---

## Phase plan

298 items collapse into **24 workstreams**. Full specs in [WORKSTREAMS.md](WORKSTREAMS.md).

### Phase 1 — the core is sellable

| WS | Workstream | Items | P0 | Why now |
|---|---|---|---|---|
| [WS-01](WORKSTREAMS.md#ws-01) | Stay model: per-night rates and multiple rooms | 8 | 4 | **Do this first.** Changes the shape of the reservation record. Every later workstream that touches price, availability or folio reads that shape — doing it after WS-03 or WS-09 means doing them twice. |
| [WS-02](WORKSTREAMS.md#ws-02) | Restriction enforcement at booking | 10 | 2 | The data is already there. One evaluator, three callers. Cheapest large win in the document. |
| [WS-06](WORKSTREAMS.md#ws-06) | Document renderer | 13 | 3 | 13 items, one build. Unblocks folios, statements, reg cards, audit pack, exports. |
| [WS-07](WORKSTREAMS.md#ws-07) | Payments: talk to an actual PSP | 14 | 6 | Highest P0 count. Starts by moving an interface into `schema/` — small first step. |
| [WS-04](WORKSTREAMS.md#ws-04) | Lifecycle reversals and bulk operations | 20 | 2 | Reversals are a correctness gap, not a feature gap. The batch envelope is reused by WS-15. |

### Phase 2 — it demos without a caveat

| WS | Workstream | Items | P0 |
|---|---|---|---|
| [WS-03](WORKSTREAMS.md#ws-03) | Rate resolution at quote time | 15 | 2 |
| [WS-05](WORKSTREAMS.md#ws-05) | What hangs off a reservation | 20 | 5 |
| [WS-09](WORKSTREAMS.md#ws-09) | Real channel transport | 16 | 4 |
| [WS-10](WORKSTREAMS.md#ws-10) | Interface framework — door lock + POS only | 26 | 2 |
| [WS-19](WORKSTREAMS.md#ws-19) | Night audit completeness | 5 | 0 |

### Phase 3 — sellable into a regulated market

| WS | Workstream | Items | P0 |
|---|---|---|---|
| [WS-08](WORKSTREAMS.md#ws-08) | Fiscalization and legal invoicing | 6 | 0 (all P1, legal) |
| [WS-24](WORKSTREAMS.md#ws-24) | Platform and non-functional | 14 | 3 |
| [WS-22](WORKSTREAMS.md#ws-22) | Administration and security hardening | 9 | 1 |

### Phase 4 — domain depth

[WS-11](WORKSTREAMS.md#ws-11) guest comms (13) · [WS-12](WORKSTREAMS.md#ws-12) housekeeping (12) ·
[WS-13](WORKSTREAMS.md#ws-13) profile model (12) · [WS-14](WORKSTREAMS.md#ws-14) loyalty engine (11) ·
[WS-15](WORKSTREAMS.md#ws-15) groups and blocks (15) · [WS-17](WORKSTREAMS.md#ws-17) cashiering depth (9) ·
[WS-18](WORKSTREAMS.md#ws-18) AR depth (5) · [WS-20](WORKSTREAMS.md#ws-20) reporting platform (8) ·
[WS-21](WORKSTREAMS.md#ws-21) revenue management depth (8)

### Phase 5 — upmarket

[WS-23](WORKSTREAMS.md#ws-23) multi-property and chain (18) ·
[WS-16](WORKSTREAMS.md#ws-16) events and catering (11) ·
remaining [WS-10](WORKSTREAMS.md#ws-10) adapters

---

## All 24 workstreams

| WS | Workstream | Items | P0 | P1 | P2 | Phase |
|---|---|---|---|---|---|---|
| [WS-01](WORKSTREAMS.md#ws-01) | Stay model: per-night rates and multiple rooms | 8 | 4 | 2 | 2 | 1 |
| [WS-02](WORKSTREAMS.md#ws-02) | Restriction enforcement at booking | 10 | 2 | 7 | 1 | 1 |
| [WS-03](WORKSTREAMS.md#ws-03) | Rate resolution at quote time | 15 | 2 | 10 | 3 | 2 |
| [WS-04](WORKSTREAMS.md#ws-04) | Lifecycle reversals and bulk operations | 20 | 2 | 15 | 3 | 1 |
| [WS-05](WORKSTREAMS.md#ws-05) | What hangs off a reservation | 20 | 5 | 9 | 6 | 2 |
| [WS-06](WORKSTREAMS.md#ws-06) | Document renderer | 13 | 3 | 7 | 3 | 1 |
| [WS-07](WORKSTREAMS.md#ws-07) | Payments: talk to an actual PSP | 14 | 6 | 7 | 1 | 1 |
| [WS-08](WORKSTREAMS.md#ws-08) | Fiscalization and legal invoicing | 6 | 0 | 6 | 0 | 3 |
| [WS-09](WORKSTREAMS.md#ws-09) | Real channel transport | 16 | 4 | 7 | 5 | 2 |
| [WS-10](WORKSTREAMS.md#ws-10) | Interface framework, then adapters | 26 | 2 | 13 | 11 | 2 / 5 |
| [WS-11](WORKSTREAMS.md#ws-11) | Guest communications | 13 | 0 | 6 | 7 | 4 |
| [WS-12](WORKSTREAMS.md#ws-12) | Housekeeping depth | 12 | 1 | 7 | 4 | 4 |
| [WS-13](WORKSTREAMS.md#ws-13) | Profile model | 12 | 3 | 4 | 5 | 4 |
| [WS-14](WORKSTREAMS.md#ws-14) | Loyalty engine | 11 | 0 | 4 | 7 | 4 |
| [WS-15](WORKSTREAMS.md#ws-15) | Groups and blocks | 15 | 1 | 8 | 6 | 4 |
| [WS-16](WORKSTREAMS.md#ws-16) | Events and catering | 11 | 0 | 0 | 11 | 5 |
| [WS-17](WORKSTREAMS.md#ws-17) | Cashiering depth | 9 | 0 | 7 | 2 | 4 |
| [WS-18](WORKSTREAMS.md#ws-18) | Accounts receivable depth | 5 | 0 | 3 | 2 | 4 |
| [WS-19](WORKSTREAMS.md#ws-19) | Night audit completeness | 5 | 0 | 3 | 2 | 2 |
| [WS-20](WORKSTREAMS.md#ws-20) | Reporting platform | 8 | 0 | 3 | 5 | 4 |
| [WS-21](WORKSTREAMS.md#ws-21) | Revenue management depth | 8 | 0 | 3 | 5 | 4 |
| [WS-22](WORKSTREAMS.md#ws-22) | Administration and security hardening | 9 | 1 | 6 | 2 | 3 |
| [WS-23](WORKSTREAMS.md#ws-23) | Multi-property and chain | 18 | 0 | 3 | 15 | 5 |
| [WS-24](WORKSTREAMS.md#ws-24) | Platform and non-functional | 14 | 3 | 7 | 4 | 3 |
| | **Total** | **298** | **39** | **147** | **112** | |

---

## Where the grading came from

Three layers per capability: a table in `schema/src/schemas`, a route in `Apps/*/src`, a screen in
`UI/pms-ui/src/app/features`. Where the three disagreed, the code was read.

**PARTIAL is the grade worth reading** — 144 items, and it covers three distinct failures:

1. **A table with no route** — `report_schedules`, `call_records`, `lost_business`,
   `room_status_codes`, `field_configurations`. The model is right and unreachable.
2. **A route whose data nothing consumes** — `rate_restrictions`, `channel_commission_rules`,
   `channel_rate_parity`, `hurdle_rates`, `data_sync_status`. Stored and inert.
3. **A complete implementation around a stubbed transport** — OTA push, payment capture. The hard
   part is done and the last hop is missing.

**This is static analysis. It shows what exists, not whether it works.** An item graded Built can
still be wrong at runtime. Where a card makes a behavioural claim, that claim came from reading the
named file.

**Companion artifact** (all 479 including the 181 built, filterable):
https://claude.ai/code/artifact/0d74fafd-a3fd-46b1-a425-887852d7342d

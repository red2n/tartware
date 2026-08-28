# PMS Capability Gap Analysis — Consolidated

> **Benchmark:** Hotel PMS Capability Atlas — 479 capabilities, 21 domains. Spine is Oracle OPERA
> Cloud 25.3's functional surface, extended with what cloud-native vendors (Mews, Cloudbeds, Apaleo,
> Stayntouch, Agilysys) have made table stakes since 2020, plus obligations that come from PCI DSS
> v4.0, PSD2/SCA, GDPR and national fiscalization regimes rather than from competitors.
> **Graded against:** `api-to-ui-gap` @ `ed524c8f` — `schema/src/schemas` (10 categories),
> `Apps/*/src` (19 services, ~430 route paths), `UI/pms-ui` (71 routes) and `UI/guest-portal`.
> **Date:** 2026-08-25 · **counts reconciled against `TRACKER.md` 2026-08-28**
> **Commit tag:** `PMS-nn`
> **Read [README.md](README.md) before starting work.**
>
> The grading below is the original static analysis. Where work has since landed the numbers have
> been moved and the row annotated — the *reasoning* is left as written, because the point of this
> document is why each gap mattered, not just its current count.

---

## Headline

**As graded (2026-08-25):** 181 built · 144 partial · 154 missing.
**Now (2026-08-28):** **195 built · 138 partial · 146 missing** — 14 items closed across WS-01,
WS-02, WS-06 and WS-04.

At grading, four table-stakes capabilities were missing outright. **One now is** — the
[door-lock interface](17-integrations.md#pms-17-01), which needs a vendor. Everything else at that
tier is either built or partial. For a product at this stage that is unusually
complete: cashiering, AR, night audit and the platform layer are genuinely strong, and the schema
reaches into places most PMS products never get to.

**The exposure was never in what's absent. It's in the table-stakes items graded PARTIAL** — where a
table exists, a route exists, and nothing enforces, calls or renders it. That count is down from 35
to 31. Eight of those failed in the first hour of an evaluation; **three are now closed:**

| # | What | Why it was flagged | Status |
|---|---|---|---|
| 1 | [One reservation, one room, one rate](01-reservations.md#pms-01-02) | `reservations` holds a single `room_id` and a flat `room_rate`. No per-night rate table anywhere. Kills multi-room, split-rate, mid-stay changes — four items, one schema decision. | **Closed** — `reservation_rooms` + `reservation_nights`. Verified: 3 rooms booked, split rates 200/250/180 posted per night. |
| 2 | [Restrictions never enforced](03-rooms-inventory.md#pms-03-02) | `rate_calendar` has CTA/CTD/min-LOS/advance/`rooms_to_sell`. `createReservation` reads none of them. Every restriction is decorative. | **Closed** — one pure evaluator, three callers. Verified: 2 nights on a 3-night minimum refused `RESTRICTION_MIN_LOS`, non-retryable, no row and no lock. |
| 3 | [Nothing calls a PSP](15-payments-fiscal.md#pms-15-02) | Real Stripe adapter exists — in `guests-service`, self-service only. `billing-service` stores caller-supplied gateway references. A front desk cannot take a card. | Open (WS-07). The provider contract has since moved to `schema/src/api/payment-gateway.ts`, so the workstream's stated first step is already spent. |
| 4 | [No door-lock interface](17-integrations.md#pms-17-01) | Zero vendor references. `mobile_keys` has nothing to issue against. The most-asked-about PMS interface, with no groundwork. | Open (WS-10) |
| 5 | [Channel push is simulated](14-distribution.md#pms-14-01) | `ota-integration.ts:29` says so. 775 lines of correct machinery around a stub. Rates go nowhere. | Open (WS-09) |
| 6 | [No document renderer](11-cashiering-folios.md#pms-11-01) | No PDF path in the repo. Folios, invoices, statements, batch reg cards and every export past GL CSV/XML die here. **13 items, one build.** | **Closed** — `document-service` on :3080. Verified: a closed folio rendered to PDF through the gateway in two languages with its tax registration lines. 3 of the 13 items ticked; the other 10 are unblocked, not built. |
| 7 | [Check-in cannot be undone](02-front-desk.md#pms-02-01) | No reversal for check-in or check-out. A mis-key on an arrival day means direct database work. | **Closed** — check-in, check-out and cancellation can all be undone, each with a mandatory reason code. A reversal voids only what its own operation posted and refuses otherwise, so undoing a keystroke cannot wipe a guest's bar tab. |
| 8 | [Fiscalization does not exist](15-payments-fiscal.md#pms-15-13) | "Fiscal" here means accounting periods. No TSE, SdI, NF-e or GST e-invoicing. DE/IT/PT/PL/BR/IN are closed markets — a legal gate, not a feature gap. | Open (WS-08) — now unblocked by the renderer: a legal invoice number must be allocated *before* the document renders. |

---

## What has landed since grading

Eleven items, 25–28 Aug. Each was verified through the gateway against real data, not by reading
code — the grading below is static analysis, and this section deliberately is not.

| WS | Items closed | What actually changed |
|---|---|---|
| [WS-01](WORKSTREAMS.md#ws-01) Stay model | 3/8 — PMS-01-02, 01-03, 01-04 | `reservation_rooms` + `reservation_nights`. Billing fees, night audit, revenue pace/segment/displacement and the core KPI report all moved off the flat `room_rate`. |
| [WS-02](WORKSTREAMS.md#ws-02) Restrictions | 5/10 — PMS-03-01, 03-02, 03-04, 03-05, 03-09 | One pure evaluator (`schema/src/api/restrictions.ts`, 24 tests) called by create, modify and the availability search. Scope precedence PROPERTY < ROOM_TYPE < RATE < CHANNEL. `rate_calendar.rooms_sold` had never been written by anything, so the sell ceiling could never bind — a rebuild job now recomputes it. |
| [WS-06](WORKSTREAMS.md#ws-06) Documents | 3/13 — PMS-11-01, 11-03, 15-17 | `document-service` on :3080. Payload + template id in, PDF or HTML out; the renderer holds no database handle. Templates are data, so a new folio style is a new object rather than new code. |
| [WS-04](WORKSTREAMS.md#ws-04) Reversals | 3/20 — PMS-02-01, 02-14, 01-20 | Undo check-in, undo check-out, reinstate a cancellation. Each takes a mandatory `reason_code` resolved against `reason_codes` — a table that had existed with no rows, no route and no reader. Reinstatement re-acquires the availability hold *before* changing status, so it fails closed rather than overbooking. |

**The two structural wins are worth naming, because they are what the remaining items lean on.**
The stay model changed the shape of the reservation record — every workstream touching price,
availability or folio now reads that shape. The renderer removed the last-hop stub that 13 items
terminated at; 10 of them are now buildable without further groundwork.

**Two findings from this work are not gap items and are recorded nowhere else:**

1. `properties.tax_id` and `tax_configurations.tax_registration_number` existed as columns, but
   **neither the create nor the update command had a field for the registration number** — nothing
   in the product could ever write the number a folio is legally required to show. Fixed as part of
   PMS-15-17.
2. `billing.payment.capture` documents `folio_id` as usable "for standalone folios without a
   reservation", but `payments.reservation_id` is `NOT NULL`, so that call always fails `23502`.
   The failure is deterministic and **still burns the retry ladder**, blocking its partition —
   the same class as the consumer-retry findings in `docs/PATTERN_AUDIT.md`. Not fixed; belongs
   with WS-07.

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

Current counts, with the 2026-08-25 grading in parentheses where it has moved.

| # | Domain | Built | Partial | Missing | Gap file |
|---|---|---|---|---|---|
| 01 | Reservations & Booking | **19** (15) | **11** (12) | **17** (20) | [01-reservations.md](01-reservations.md) |
| 02 | Front Desk & Front Office | **17** (15) | 13 | **10** (12) | [02-front-desk.md](02-front-desk.md) |
| 03 | Rooms & Inventory | **13** (8) | **4** (6) | **6** (9) | [03-rooms-inventory.md](03-rooms-inventory.md) |
| 04 | Housekeeping & Maintenance | 11 | 5 | 4 | [04-housekeeping.md](04-housekeeping.md) |
| 05 | Rates & Pricing | 14 | 7 | 5 | [05-rates-pricing.md](05-rates-pricing.md) |
| 06 | Revenue Management & Forecasting | 10 | 6 | 2 | [06-revenue-management.md](06-revenue-management.md) |
| 07 | Guest Profiles & CRM | 12 | 9 | 5 | [07-guest-profiles.md](07-guest-profiles.md) |
| 08 | Loyalty & Memberships | 4 | 4 | 8 | [08-loyalty.md](08-loyalty.md) |
| 09 | Groups, Blocks & Allotments | 6 | 7 | 8 | [09-groups-blocks.md](09-groups-blocks.md) |
| 10 | Events, Catering & Function Space | 6 | 3 | 8 | [10-events-catering.md](10-events-catering.md) |
| 11 | Cashiering, Folios & Billing | **20** (18) | **6** (8) | 7 | [11-cashiering-folios.md](11-cashiering-folios.md) |
| 12 | Accounts Receivable & Back Office | 13 | 4 | 4 | [12-accounts-receivable.md](12-accounts-receivable.md) |
| 13 | Night Audit & Day Close | 8 | 3 | 3 | [13-night-audit.md](13-night-audit.md) |
| 14 | Distribution & Channel Management | 2 | 9 | 8 | [14-distribution.md](14-distribution.md) |
| 15 | Payments & Fiscal Compliance | **2** (1) | **8** (9) | 8 | [15-payments-fiscal.md](15-payments-fiscal.md) |
| 16 | Reporting & Analytics | 9 | 4 | 6 | [16-reporting.md](16-reporting.md) |
| 17 | Integrations & Interfaces | 3 | 11 | 11 | [17-integrations.md](17-integrations.md) |
| 18 | Guest-Facing Digital | 6 | 7 | 6 | [18-guest-digital.md](18-guest-digital.md) |
| 19 | Administration, Configuration & Security | 12 | 6 | 3 | [19-administration.md](19-administration.md) |
| 20 | Multi-Property, Chain & Enterprise | 1 | 1 | 14 | [20-multi-property.md](20-multi-property.md) |
| 21 | Platform & Non-Functional | 7 | 10 | 3 | [21-platform.md](21-platform.md) |
| | **Total** | **195** (181) | **138** (144) | **146** (154) | |

By tier: table stakes **93 built / 31 partial / 1 missing** (was 86 / 35 / 4), competitive
**83 / 74 / 61** (was 77 / 75 / 66), enterprise **19 / 33 / 84** (was 18 / 34 / 84).

The one table-stakes capability still missing outright is the
[door-lock interface](17-integrations.md#pms-17-01) (WS-10) — and it is missing because it needs a
lock vendor, not because of anything in this codebase.

---

## Phase plan

298 items collapse into **24 workstreams**. Full specs in [WORKSTREAMS.md](WORKSTREAMS.md).

### Phase 1 — the core is sellable

| WS | Workstream | Done | P0 | State |
|---|---|---|---|---|
| [WS-01](WORKSTREAMS.md#ws-01) | Stay model: per-night rates and multiple rooms | 3/8 | 4 | **Core done.** The record shape changed and every downstream reader moved with it. The open tail is additive — share reservations, occupant editing after booking. |
| [WS-02](WORKSTREAMS.md#ws-02) | Restriction enforcement at booking | 5/10 | 2 | **Core done.** Evaluator, scoping, sell limits and the rebuild job all landed. Open: wing/section columns, the discrepancy job, and the channel-scope write route. |
| [WS-06](WORKSTREAMS.md#ws-06) | Document renderer | 3/13 | 3 | **The build is done, the documents are not.** Folio renders end to end; audit pack, reg cards, statements and exports are now buildable against a working renderer. |
| [WS-07](WORKSTREAMS.md#ws-07) | Payments: talk to an actual PSP | 0/14 | 6 | Highest remaining P0 count. **Its "small first step" is already spent** — the provider contract sits in `schema/src/api/payment-gateway.ts`. What is left needs a live PSP sandbox to finish honestly. |
| [WS-04](WORKSTREAMS.md#ws-04) | Lifecycle reversals and bulk operations | 3/20 | 2 | **Reversals done.** The remaining P0 is room move for an in-house guest; the rest is the batch envelope (mass cancel, mass check-in, mass update) which WS-15 also reuses — write it once. |

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

| WS | Workstream | Items | Done | P0 | P1 | P2 | Phase |
|---|---|---|---|---|---|---|---|
| [WS-01](WORKSTREAMS.md#ws-01) | Stay model: per-night rates and multiple rooms | 8 | **3** | 4 | 2 | 2 | 1 |
| [WS-02](WORKSTREAMS.md#ws-02) | Restriction enforcement at booking | 10 | **5** | 2 | 7 | 1 | 1 |
| [WS-03](WORKSTREAMS.md#ws-03) | Rate resolution at quote time | 15 | — | 2 | 10 | 3 | 2 |
| [WS-04](WORKSTREAMS.md#ws-04) | Lifecycle reversals and bulk operations | 20 | **3** | 2 | 15 | 3 | 1 |
| [WS-05](WORKSTREAMS.md#ws-05) | What hangs off a reservation | 20 | — | 5 | 9 | 6 | 2 |
| [WS-06](WORKSTREAMS.md#ws-06) | Document renderer | 13 | **3** | 3 | 7 | 3 | 1 |
| [WS-07](WORKSTREAMS.md#ws-07) | Payments: talk to an actual PSP | 14 | — | 6 | 7 | 1 | 1 |
| [WS-08](WORKSTREAMS.md#ws-08) | Fiscalization and legal invoicing | 6 | — | 0 | 6 | 0 | 3 |
| [WS-09](WORKSTREAMS.md#ws-09) | Real channel transport | 16 | — | 4 | 7 | 5 | 2 |
| [WS-10](WORKSTREAMS.md#ws-10) | Interface framework, then adapters | 26 | — | 2 | 13 | 11 | 2 / 5 |
| [WS-11](WORKSTREAMS.md#ws-11) | Guest communications | 13 | — | 0 | 6 | 7 | 4 |
| [WS-12](WORKSTREAMS.md#ws-12) | Housekeeping depth | 12 | — | 1 | 7 | 4 | 4 |
| [WS-13](WORKSTREAMS.md#ws-13) | Profile model | 12 | — | 3 | 4 | 5 | 4 |
| [WS-14](WORKSTREAMS.md#ws-14) | Loyalty engine | 11 | — | 0 | 4 | 7 | 4 |
| [WS-15](WORKSTREAMS.md#ws-15) | Groups and blocks | 15 | — | 1 | 8 | 6 | 4 |
| [WS-16](WORKSTREAMS.md#ws-16) | Events and catering | 11 | — | 0 | 0 | 11 | 5 |
| [WS-17](WORKSTREAMS.md#ws-17) | Cashiering depth | 9 | — | 0 | 7 | 2 | 4 |
| [WS-18](WORKSTREAMS.md#ws-18) | Accounts receivable depth | 5 | — | 0 | 3 | 2 | 4 |
| [WS-19](WORKSTREAMS.md#ws-19) | Night audit completeness | 5 | — | 0 | 3 | 2 | 2 |
| [WS-20](WORKSTREAMS.md#ws-20) | Reporting platform | 8 | — | 0 | 3 | 5 | 4 |
| [WS-21](WORKSTREAMS.md#ws-21) | Revenue management depth | 8 | — | 0 | 3 | 5 | 4 |
| [WS-22](WORKSTREAMS.md#ws-22) | Administration and security hardening | 9 | — | 1 | 6 | 2 | 3 |
| [WS-23](WORKSTREAMS.md#ws-23) | Multi-property and chain | 18 | — | 0 | 3 | 15 | 5 |
| [WS-24](WORKSTREAMS.md#ws-24) | Platform and non-functional | 14 | — | 3 | 7 | 4 | 3 |
| | **Total** | **298** | **14** | **39** | **147** | **112** | |

---

## Where the grading came from

Three layers per capability: a table in `schema/src/schemas`, a route in `Apps/*/src`, a screen in
`UI/pms-ui/src/app/features`. Where the three disagreed, the code was read.

**PARTIAL is the grade worth reading** — 144 items, and it covers three distinct failures:

1. **A table with no route** — `report_schedules`, `call_records`, `lost_business`,
   `room_status_codes`, `field_configurations`. The model is right and unreachable.
2. **A route whose data nothing consumes** — `channel_commission_rules`, `channel_rate_parity`,
   `hurdle_rates`, `data_sync_status`. Stored and inert. `rate_restrictions` was the worst of
   these and is no longer one of them (WS-02).
3. **A complete implementation around a stubbed transport** — OTA push, payment capture. The hard
   part is done and the last hop is missing.

**This is static analysis. It shows what exists, not whether it works.** An item graded Built can
still be wrong at runtime. Where a card makes a behavioural claim, that claim came from reading the
named file.

That caveat has teeth, and the work so far keeps proving it. `rate_calendar.rooms_sold` graded as a
present column and was never written by anything, so the sell ceiling could not bind. The tax
registration columns existed with no command field to populate them. **Nothing is ticked in
`TRACKER.md` on a code read** — only on a verified run through the gateway against real data.

**Companion artifact** (all 479 including the 181 built, filterable):
https://claude.ai/code/artifact/0d74fafd-a3fd-46b1-a425-887852d7342d

# Workstreams

> 298 gap items collapse into 24 workstreams. **Work the workstream, not the item.** Most items in a
> workstream are the same change applied in different places — building them one at a time means
> designing the same thing 20 times and getting 20 slightly different answers.
>
> Each spec below is the shape of the work. The per-item deltas live in the domain files
> (`01-reservations.md` … `21-platform.md`); the ledger is [TRACKER.md](TRACKER.md).
>
> **Before touching any of this, read [README.md](README.md).** The schema-first STOP GATE in
> `AGENTS.md` is not optional and half of these workstreams start with a schema change.

---

## Phase plan

| Phase | Goal | Workstreams |
|---|---|---|
| **1** | The core is sellable | WS-01, WS-02, WS-06, WS-07, WS-04 |
| **2** | The core demos without a caveat | WS-03, WS-05, WS-09, WS-10 (lock + POS only), WS-19 |
| **3** | It can be sold into a regulated market | WS-08, WS-24, WS-22 |
| **4** | Domain depth | WS-11 … WS-18, WS-20, WS-21, WS-12, WS-13, WS-14, WS-15, WS-17 |
| **5** | Upmarket | WS-23, WS-16, remaining WS-10 adapters |

Phase 1 is not negotiable ordering — WS-01 changes the shape of the reservation record and every
later workstream that touches price, availability or folio reads that shape. Doing WS-01 after
WS-03 or WS-09 means doing them twice.

---

<a id="ws-01"></a>

## WS-01 — Stay model: per-night rates and multiple rooms

**Why.** `reservations` carries a single `room_id`, a single `room_type_id` and a flat `room_rate`.
There is no per-night rate row anywhere in `scripts/tables/03-bookings/`. That one decision is why
multi-room bookings, split-rate stays, mid-stay room changes and any rate that varies across the
stay are all impossible. It is the single highest-leverage change in this document.

**Blast radius.** Large and unavoidable: every price read, the availability guard, night audit room
posting, folio charge generation, the reservation grid, and the E2E realdata suites.

**Schema** (`schema/src/schemas/03-bookings/`)
- `reservation-rooms.ts` — `reservation_room_id`, `reservation_id`, `room_type_id`, `room_id`,
  `adults`, `children`, `infants`, `do_not_move`, `status`.
- `reservation-nights.ts` — `reservation_room_id`, `stay_date`, `rate_id`, `rate_amount`,
  `currency`, `adults`, `children`, `is_complimentary`.
- `reservation-occupants.ts` — named occupants per room, `is_primary`.
- Update `reservations.ts`: `room_id`/`room_type_id`/`room_rate` become derived/deprecated, not
  dropped, until every reader has moved.

**SQL** (`scripts/tables/03-bookings/`)
- New numbered files, registered in `scripts/tables/00-create-all-tables.sql`.
- Additive first: create the tables, backfill one room row + N night rows per existing reservation,
  then tighten. Never drop `room_rate` in the same change that adds the nights table.
- Index `(tenant_id, reservation_id)` and `(tenant_id, property_id, stay_date)`.
- Update the matching `verify-*.sql`.

**Service** (`Apps/reservations-command-service`)
- `createReservation` writes the room rows and the night rows inside the existing transaction.
- `modifyReservation` diffs nights rather than overwriting a scalar.
- Extend/shorten become insert/delete of night rows.
- The availability guard holds one lock per room row, not one per reservation.

**Downstream reads to migrate** — `Apps/billing-service` (room charge posting, folio totals),
`Apps/rooms-service` (availability), `Apps/revenue-service` (ADR, on-the-books).

**Done when** a reservation can hold three rooms at three different rates, change rate on night 3,
and night audit posts the right amount for each — verified through the gateway, not SQL.

**Closes 8 gap items** — P0 4 · P1 2 · P2 2

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-01-01](01-reservations.md#pms-01-01) | Availability search | PARTIAL | P0 |
| [PMS-01-02](01-reservations.md#pms-01-02) | Multi-room reservation | MISSING | P0 |
| [PMS-01-03](01-reservations.md#pms-01-03) | Multi-segment / split-rate stay | MISSING | P0 |
| [PMS-01-04](01-reservations.md#pms-01-04) | Extend and shorten stay | PARTIAL | P0 |
| [PMS-01-11](01-reservations.md#pms-01-11) | Share reservations | MISSING | P1 |
| [PMS-01-13](01-reservations.md#pms-01-13) | Accompanying guests | MISSING | P1 |
| [PMS-03-11](03-rooms-inventory.md#pms-03-11) | Suite component rooms | MISSING | P2 |
| [PMS-11-15](11-cashiering-folios.md#pms-11-15) | Daily covers adjustment | MISSING | P2 |

---

<a id="ws-02"></a>

## WS-02 — Restriction enforcement at booking

**Why.** `rate_calendar` already stores `closed_to_arrival`, `closed_to_departure`,
`min_length_of_stay`, `max_length_of_stay`, `min_advance_days`, `max_advance_days` and
`rooms_to_sell`. `createReservation` in
`Apps/reservations-command-service/src/services/reservation-commands/core.ts` validates that
check-out follows check-in (line 70) and takes an availability lock (line 181). It never reads any
restriction. Every restriction in the product is currently decorative.

**Schema** — `schema/src/api/restrictions.ts`: the evaluator input, the typed refusal result
(`RESTRICTION_CTA`, `RESTRICTION_CTD`, `RESTRICTION_MIN_LOS`, `RESTRICTION_MAX_LOS`,
`RESTRICTION_ADVANCE`, `RESTRICTION_SELL_LIMIT`), and a `scope` discriminator
(`PROPERTY | ROOM_TYPE | RATE | CHANNEL`). Shared logic lives in `schema/src/api/`, per AGENTS.md.

**Service** — one `evaluateRestrictions()` used by three callers: `createReservation`,
`modifyReservation` (when the stay changes), and the availability search in `rooms-service`. Call it
*before* `lockReservationHold` so a refusal never takes a lock.

**Also here** — `rooms_to_sell − rooms_sold` becomes the sellable ceiling (not the physical room
count), plus an availability rebuild job that recomputes `rooms_sold` from `reservation_nights`
(WS-01), because the moment availability can drift you need a way to repair it.

**Done when** a booking that violates min-LOS is refused with a typed error the UI can render, and
the same rule refuses it through the gateway, the self-service path, and a channel delivery.

**Closes 10 gap items** — P0 2 · P1 7 · P2 1

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-03-01](03-rooms-inventory.md#pms-03-01) | Physical vs sellable inventory | PARTIAL | P0 |
| [PMS-03-02](03-rooms-inventory.md#pms-03-02) | Restrictions engine | PARTIAL | P0 |
| [PMS-03-03](03-rooms-inventory.md#pms-03-03) | Building, wing, floor, section structure | PARTIAL | P1 |
| [PMS-03-04](03-rooms-inventory.md#pms-03-04) | Restriction scoping | MISSING | P1 |
| [PMS-03-05](03-rooms-inventory.md#pms-03-05) | Sell limits | MISSING | P1 |
| [PMS-03-07](03-rooms-inventory.md#pms-03-07) | Room discrepancy detection | PARTIAL | P1 |
| [PMS-03-09](03-rooms-inventory.md#pms-03-09) | Availability rebuild job | MISSING | P1 |
| [PMS-14-05](14-distribution.md#pms-14-05) | Channel-specific restrictions and sell limits | MISSING | P1 |
| [PMS-14-10](14-distribution.md#pms-14-10) | Stop-sell propagation SLA | MISSING | P1 |
| [PMS-03-15](03-rooms-inventory.md#pms-03-15) | Sellable availability by channel | MISSING | P2 |

---

<a id="ws-03"></a>

## WS-03 — Rate resolution at quote time

**Why.** Rates are a flat list. There is no eligibility gate, no derivation, no hierarchy, no BAR
ladder — so negotiated rates, member rates, channel rates and yieldability are all blocked on the
same missing layer.

**Schema** — `rate-eligibility-rules.ts` (rate_id, rule_type, value), `rate-strategy-tiers.ts`,
`negotiated-rates.ts`; `rates.derived_from_rate_id` + adjustment; `rates.is_yieldable`.

**Service** — `resolveRates(context)` in `schema/src/api/rate-resolution.ts`, returning eligible
rates with resolved amounts per night. Context: dates, occupancy, room type, company/agent,
membership tier, channel, promo code, booking lead time. This is the function the look-to-book
screen (PMS-01-11) renders and the one `createReservation` prices against — never two
implementations.

**Order of resolution** — property default → season → rate → date override → derivation →
eligibility filter → yield tier.

**Done when** the same reservation quoted by an agent, a member and an OTA returns three different
correct prices from one code path.

**Closes 15 gap items** — P0 2 · P1 10 · P2 3

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-05-01](05-rates-pricing.md#pms-05-01) | Day-of-week pricing | PARTIAL | P0 |
| [PMS-05-02](05-rates-pricing.md#pms-05-02) | Rate change log | PARTIAL | P0 |
| [PMS-05-03](05-rates-pricing.md#pms-05-03) | Rate categories and groups | PARTIAL | P1 |
| [PMS-05-04](05-rates-pricing.md#pms-05-04) | Derived and dynamic rates | PARTIAL | P1 |
| [PMS-05-05](05-rates-pricing.md#pms-05-05) | Rate strategies / BAR tiers | MISSING | P1 |
| [PMS-05-06](05-rates-pricing.md#pms-05-06) | Negotiated rates | PARTIAL | P1 |
| [PMS-05-07](05-rates-pricing.md#pms-05-07) | Rate eligibility rules | MISSING | P1 |
| [PMS-05-08](05-rates-pricing.md#pms-05-08) | Rate availability by channel | MISSING | P1 |
| [PMS-05-09](05-rates-pricing.md#pms-05-09) | Yieldable vs non-yieldable flags | MISSING | P1 |
| [PMS-05-10](05-rates-pricing.md#pms-05-10) | Rounding and minor-unit rules | PARTIAL | P1 |
| [PMS-07-05](07-guest-profiles.md#pms-07-05) | Negotiated rates on the profile | PARTIAL | P1 |
| [PMS-08-05](08-loyalty.md#pms-08-05) | Member-only rates | MISSING | P1 |
| [PMS-05-11](05-rates-pricing.md#pms-05-11) | Rate hierarchy and inheritance | MISSING | P2 |
| [PMS-05-12](05-rates-pricing.md#pms-05-12) | Rate parity monitoring | PARTIAL | P2 |
| [PMS-18-10](18-guest-digital.md#pms-18-10) | Attribute-based selling | MISSING | P2 |

---

<a id="ws-04"></a>

## WS-04 — Reservation lifecycle: reversals and bulk operations

**Why.** There is no way to undo a check-in, undo a check-out, or reinstate a cancellation. On a
busy arrival day the only recovery from a mis-key is direct database work. Separately, every bulk
action an agent expects (mass cancel, mass check-in, duplicate) is absent.

**Two halves, do them in this order:**

1. **Reversals** — `reverse-check-in`, `reverse-check-out`, `reinstate-reservation`. Each is a
   command with a mandatory `reason_code` (the `reason_codes` reference table already exists), and
   each must reverse its financial side: void the auto-posted room charge, reopen the folio, restore
   the availability hold. A reversal that leaves a posting behind is worse than no reversal.
2. **Batch envelope** — one `BatchCommand<T>` shape in `schema/src/events/commands/`, one
   transaction per target, an aggregated result with per-item success/failure. Mass update, mass
   cancel, mass check-in and group bulk actions (WS-15) all reuse it. Do not write four batch
   handlers.

**Also here** — duplicate reservation, early departure with penalty, do-not-move, scheduled room
moves, queue rooms, room swap, safe deposit boxes, room-level DND, and turnaway capture.

**Turnaway capture deserves its own note:** `lost_business` is a table with no route. Writing a row
on every failed availability search is what makes unconstrained demand (WS-21) possible. It is a
small change that unblocks a whole revenue-management capability.

**Done when** a check-in can be reversed and the folio balance returns to exactly what it was.

**Closes 20 gap items** — P0 2 · P1 15 · P2 3

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-02-01](02-front-desk.md#pms-02-01) | Check-in reversal | MISSING | P0 |
| [PMS-02-02](02-front-desk.md#pms-02-02) | Room move for in-house guest | PARTIAL | P0 |
| [PMS-01-19](01-reservations.md#pms-01-19) | Copy and duplicate reservation | MISSING | P1 |
| [PMS-01-20](01-reservations.md#pms-01-20) | Reinstate cancelled reservation | MISSING | P1 |
| [PMS-01-21](01-reservations.md#pms-01-21) | Mass update | MISSING | P1 |
| [PMS-01-22](01-reservations.md#pms-01-22) | Mass cancellation | MISSING | P1 |
| [PMS-01-23](01-reservations.md#pms-01-23) | Early departure with penalty | MISSING | P1 |
| [PMS-01-24](01-reservations.md#pms-01-24) | Do-not-move flag | MISSING | P1 |
| [PMS-01-25](01-reservations.md#pms-01-25) | Turnaway / denial capture | PARTIAL | P1 |
| [PMS-02-04](02-front-desk.md#pms-02-04) | Advance check-in | MISSING | P1 |
| [PMS-02-05](02-front-desk.md#pms-02-05) | Mass check-in | MISSING | P1 |
| [PMS-02-10](02-front-desk.md#pms-02-10) | Queue rooms | MISSING | P1 |
| [PMS-02-11](02-front-desk.md#pms-02-11) | Rooms on hold | PARTIAL | P1 |
| [PMS-02-12](02-front-desk.md#pms-02-12) | Room swap / shift | MISSING | P1 |
| [PMS-02-13](02-front-desk.md#pms-02-13) | Early check-out | PARTIAL | P1 |
| [PMS-02-14](02-front-desk.md#pms-02-14) | Reinstate checked-out reservation | MISSING | P1 |
| [PMS-02-18](02-front-desk.md#pms-02-18) | Do-not-disturb and privacy flags | PARTIAL | P1 |
| [PMS-01-26](01-reservations.md#pms-01-26) | Scheduled room moves | MISSING | P2 |
| [PMS-01-27](01-reservations.md#pms-01-27) | Move reservation to another property | MISSING | P2 |
| [PMS-02-21](02-front-desk.md#pms-02-21) | Safe deposit box tracking | MISSING | P2 |

---

<a id="ws-05"></a>

## WS-05 — What hangs off a reservation

**Why.** Alerts, fixed charges, rentable items, cancellation policy, deposit schedules, guarantee
behaviour and preferences are all either absent or stored-but-inert. These are the small things an
agent uses constantly.

**Schema** — `reservation-alerts.ts`, `reservation-fixed-charges.ts`, `rentable-items.ts` +
`item-bookings.ts`, `cancellation-policies.ts`, `reservation-links.ts`.

**Two that are more than CRUD:**

- **Cancellation policy engine.** Today `billing-service/services/billing-commands/cancellation-penalty.ts`
  reads a `cancellation_policy_snapshot` off the reservation, and falls back to the live rate plan
  when it is absent (there is an explicit "ACCT-12 legacy fallback" comment at line 134). The policy
  itself — notice windows, tiered penalties, first-night vs full-stay vs percentage — does not
  exist as a configurable thing. Build `cancellation_policies`, resolve it **at booking**, and
  snapshot the resolved policy so the fallback path can be deleted.
- **Guarantee behaviour.** `guarantee_type` is a free field. Make it a policy with a release time
  and a deposit requirement, and add the release job that cancels unguaranteed holds at 6PM. Without
  the job the field means nothing.

**Also here** — packages attached to a live reservation, upsell accept, per-reservation confirmation
resend with delivery history, deposit due-date runner and forfeit rules.

**Done when** a fixed charge attached to a reservation posts every night through night audit
(WS-19), and a cancellation inside the notice window charges the configured penalty without
touching the legacy fallback.

**Closes 20 gap items** — P0 5 · P1 9 · P2 6

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-01-05](01-reservations.md#pms-01-05) | Guarantee and payment instructions | PARTIAL | P0 |
| [PMS-01-06](01-reservations.md#pms-01-06) | Cancellation policy engine | PARTIAL | P0 |
| [PMS-01-07](01-reservations.md#pms-01-07) | Deposit request and schedule | PARTIAL | P0 |
| [PMS-01-08](01-reservations.md#pms-01-08) | Preferences | PARTIAL | P0 |
| [PMS-01-09](01-reservations.md#pms-01-09) | Confirmation letters | PARTIAL | P0 |
| [PMS-01-10](01-reservations.md#pms-01-10) | Rate shopping / look-to-book screen | MISSING | P1 |
| [PMS-01-12](01-reservations.md#pms-01-12) | Linked / connected reservations | MISSING | P1 |
| [PMS-01-14](01-reservations.md#pms-01-14) | Reservation alerts | MISSING | P1 |
| [PMS-01-15](01-reservations.md#pms-01-15) | Fixed charges | MISSING | P1 |
| [PMS-01-16](01-reservations.md#pms-01-16) | Packages on the reservation | PARTIAL | P1 |
| [PMS-01-17](01-reservations.md#pms-01-17) | Item / inventory rentals | MISSING | P1 |
| [PMS-01-18](01-reservations.md#pms-01-18) | Upsell and upgrade offers | PARTIAL | P1 |
| [PMS-03-08](03-rooms-inventory.md#pms-03-08) | Item inventory availability | MISSING | P1 |
| [PMS-18-05](18-guest-digital.md#pms-18-05) | Pre-arrival upsell | PARTIAL | P1 |
| [PMS-01-28](01-reservations.md#pms-01-28) | Loyalty award redemption at booking | PARTIAL | P2 |
| [PMS-01-29](01-reservations.md#pms-01-29) | e-Certificate / voucher redemption | MISSING | P2 |
| [PMS-01-30](01-reservations.md#pms-01-30) | Pro-forma folio | MISSING | P2 |
| [PMS-01-31](01-reservations.md#pms-01-31) | Trip composer | MISSING | P2 |
| [PMS-01-32](01-reservations.md#pms-01-32) | Call history and caller information | PARTIAL | P2 |
| [PMS-02-25](02-front-desk.md#pms-02-25) | Vouchers | PARTIAL | P2 |

---

<a id="ws-06"></a>

## WS-06 — Document renderer

**Why.** Folio data, invoice data and registration-card data are all complete and correct. There is
no PDF path anywhere in the repository. Folio printing, emailed folios, statements, dunning letters,
batch registration cards, the night-audit report pack, pro-forma billing and every export beyond GL
batch CSV/XML all terminate at this one missing piece. **Thirteen gap items, one build.**

**Shape.** One document service (next free port is **3080** per the AGENTS.md port map) that takes a
typed payload plus a template id and returns PDF and HTML. Templates are data, not code.

**Schema** — `schema/src/api/documents.ts`: the render request, template id enum, the payload types
per document (`FolioDocument`, `InvoiceDocument`, `RegistrationCardDocument`, `StatementDocument`,
`AuditPackDocument`). Every payload is assembled by the owning service and handed over whole — the
renderer never queries the database.

**Templates** — locale-aware, currency-aware, and carrying the property's tax registration IDs
(a legal requirement in most EU jurisdictions and its own gap item, PMS-15-17).

**Start with the folio.** It is the highest-value template, it exercises multi-currency and
multi-language, and it unblocks contactless check-out, receipt history and chargeback evidence.

**Done when** a closed folio renders to PDF through the gateway, in two languages, with the correct
tax registration line.

**Closes 13 gap items** — P0 3 · P1 7 · P2 3

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-11-01](11-cashiering-folios.md#pms-11-01) | Folio generation and printing | PARTIAL | P0 |
| [PMS-13-01](13-night-audit.md#pms-13-01) | Audit report pack | PARTIAL | P0 |
| [PMS-16-02](16-reporting.md#pms-16-02) | Export formats | PARTIAL | P0 |
| [PMS-02-07](02-front-desk.md#pms-02-07) | eSignature registration card | PARTIAL | P1 |
| [PMS-02-08](02-front-desk.md#pms-02-08) | Batch registration card printing | MISSING | P1 |
| [PMS-11-02](11-cashiering-folios.md#pms-11-02) | Folio styles | MISSING | P1 |
| [PMS-11-03](11-cashiering-folios.md#pms-11-03) | Multi-language and multi-currency folios | PARTIAL | P1 |
| [PMS-11-10](11-cashiering-folios.md#pms-11-10) | Receipt history | PARTIAL | P1 |
| [PMS-15-17](15-payments-fiscal.md#pms-15-17) | Tax registration IDs on documents | PARTIAL | P1 |
| [PMS-18-02](18-guest-digital.md#pms-18-02) | Contactless check-out and emailed folio | PARTIAL | P1 |
| [PMS-11-14](11-cashiering-folios.md#pms-11-14) | Pro-forma and advance billing | MISSING | P2 |
| [PMS-12-06](12-accounts-receivable.md#pms-12-06) | Invoice compression and decompression | MISSING | P2 |
| [PMS-18-09](18-guest-digital.md#pms-18-09) | Kiosk check-in | MISSING | P2 |

---

<a id="ws-07"></a>

## WS-07 — Payments: talk to an actual PSP

**Why.** A real Stripe adapter exists in
`Apps/guests-service/src/services/stripe-payment-gateway.ts` — PaymentIntents with manual capture,
correct authorize→capture flow, idempotency keys. It is used only by the guest self-service booking
path. `Apps/billing-service/src/services/billing-commands/payment.ts` and `payment-authorize.ts`
store `gateway_name`, `gateway_reference` and `gateway_response` **supplied by the caller** and never
call a PSP. Authorize, increment and void are ledger writes. A front desk cannot take a card.

**Step 1 — move the interface.** `PaymentGateway`, `AuthorizationResult`, `CaptureResult` and
`RefundResult` currently live in `Apps/guests-service/src/services/booking-service.ts`. That is a
provider contract used by more than one service, which AGENTS.md puts in
`schema/src/api/payment-gateway.ts`. Move it, build schemas, re-import both sides.

**Step 2 — adapter registry.** Keyed by `payment_gateway_configurations` (the table already exists)
so a property can pick its acquirer. Stripe is the first entry, not the only shape.

**Step 3 — billing calls it.** Authorize, increment, capture, void and refund go through the adapter.
`payment_tokens` gets tokens **from the PSP**, never from a caller.

**Step 4 — webhooks.** `POST /v1/billing/webhooks/payment-gateway` exists as a route; make it verify
signatures and reconcile async outcomes. See `accounts-gaps/04-payment-gateway-webhooks.md`, which
already specs this.

**Then** 3-D Secure / SCA (mandatory for EEA card-not-present), EMV/P2PE for card-present, and the
PCI scope statement — which is only defensible once no PAN can reach Tartware.

**Done when** a card is authorized at check-in and captured at check-out against a real PSP sandbox,
and the folio balance matches the PSP's.

**Closes 14 gap items** — P0 6 · P1 7 · P2 1

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-02-03](02-front-desk.md#pms-02-03) | Credit card pre-authorization | PARTIAL | P0 |
| [PMS-15-01](15-payments-fiscal.md#pms-15-01) | PCI DSS v4.0 alignment | PARTIAL | P0 |
| [PMS-15-02](15-payments-fiscal.md#pms-15-02) | Payment gateway integration | PARTIAL | P0 |
| [PMS-15-03](15-payments-fiscal.md#pms-15-03) | Card tokenization | PARTIAL | P0 |
| [PMS-15-04](15-payments-fiscal.md#pms-15-04) | Encryption in transit and at rest | PARTIAL | P0 |
| [PMS-17-03](17-integrations.md#pms-17-03) | Payment gateway | PARTIAL | P0 |
| [PMS-12-01](12-accounts-receivable.md#pms-12-01) | Payment reversal and unapply | PARTIAL | P1 |
| [PMS-15-05](15-payments-fiscal.md#pms-15-05) | EMV / P2PE terminal integration | MISSING | P1 |
| [PMS-15-06](15-payments-fiscal.md#pms-15-06) | 3-D Secure and SCA | MISSING | P1 |
| [PMS-15-07](15-payments-fiscal.md#pms-15-07) | Alternative payment methods | MISSING | P1 |
| [PMS-15-08](15-payments-fiscal.md#pms-15-08) | Pre-authorization strategy | PARTIAL | P1 |
| [PMS-15-09](15-payments-fiscal.md#pms-15-09) | Chargeback evidence packaging | PARTIAL | P1 |
| [PMS-15-10](15-payments-fiscal.md#pms-15-10) | Surcharge and convenience fees | MISSING | P1 |
| [PMS-15-12](15-payments-fiscal.md#pms-15-12) | Multi-acquirer / gateway abstraction | PARTIAL | P2 |

---

<a id="ws-08"></a>

## WS-08 — Fiscalization and legal invoicing

**Why.** "Fiscal" in this codebase means accounting periods — `fiscal_periods`, close, lock, reopen.
There is no TSE/KassenSichV, no SdI, no NF-e, no India GST e-invoicing, and no gapless legal invoice
sequence. Germany, Italy, Portugal, Poland, Brazil and India are closed markets until this exists.
**This is a legal gate, not a feature gap** — a hotel operating in those jurisdictions without it is
non-compliant from day one.

**Schema** — `schema/src/api/fiscal-device.ts`: a `FiscalDevice` provider interface
(`sign(document)`, `status()`, `exportAuditFile(range)`), a submission record, and a per-jurisdiction
config type.

**Sequence first.** Gapless legal invoice numbering per property per jurisdiction is a prerequisite
for every adapter, and it is already specced in
`accounts-gaps/11-invoice-sequential-numbering.md`. Allocate the number before the document renders
(WS-06), never after.

**Then adapters**, one jurisdiction at a time, driven by which market you actually intend to sell
into. Each needs a submission queue with retry, a stored signature on the invoice, and a DLQ replay
path — the same outbox pattern the rest of the system already uses.

**Done when** an invoice in the target jurisdiction carries a valid signature and the audit file
export validates.

**Closes 6 gap items** — P0 0 · P1 6 · P2 0

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-14-12](14-distribution.md#pms-14-12) | Cancellation and no-show policy sync | MISSING | P1 |
| [PMS-15-11](15-payments-fiscal.md#pms-15-11) | Legal invoice numbering | PARTIAL | P1 |
| [PMS-15-13](15-payments-fiscal.md#pms-15-13) | Fiscalization integration | MISSING | P1 |
| [PMS-15-14](15-payments-fiscal.md#pms-15-14) | e-Invoicing submission | MISSING | P1 |
| [PMS-15-15](15-payments-fiscal.md#pms-15-15) | Fiscal audit file export | MISSING | P1 |
| [PMS-15-16](15-payments-fiscal.md#pms-15-16) | Failed fiscal payload replay | MISSING | P1 |

---

<a id="ws-09"></a>

## WS-09 — Real channel transport

**Why.** `Apps/reservations-command-service/src/services/reservation-commands/ota-integration.ts` is
775 lines of queueing, mapping, logging and retry around a transport its own comment (line 29)
describes as simulated: *"Actual push to the OTA API is simulated — replace the stub with a real…"*.
Rates and inventory are computed, recorded, and go nowhere. The surrounding machinery is genuinely
good — this is a transport swap, not a rewrite.

**Schema** — `schema/src/api/channel-transport.ts`: `pushRates()`, `pushInventory()`,
`pushContent()`, `fetchReservations()`, `ack()`, with a typed result carrying the channel's own
reference and error.

**Service** — replace the simulated call in `otaSyncRequest`, `otaRatePush` and `otaContentSync` with
the adapter. `processOtaReservationQueue` and `webhookRetry` need no structural change, but the retry
needs a DLQ once it is retrying against something real.

**Inbound gaps that only matter once it is real** — duplicate detection on channel reference (a
redelivery would double-book today), and modify/cancel mapping onto the reservation commands.

**Done when** an availability change in Tartware appears on one live channel sandbox, and a booking
made there appears in Tartware exactly once.

**Closes 16 gap items** — P0 4 · P1 7 · P2 5

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-14-01](14-distribution.md#pms-14-01) | Channel manager connectivity | PARTIAL | P0 |
| [PMS-14-02](14-distribution.md#pms-14-02) | Reservation delivery with retry | PARTIAL | P0 |
| [PMS-14-03](14-distribution.md#pms-14-03) | Modification and cancellation handling | PARTIAL | P0 |
| [PMS-18-01](18-guest-digital.md#pms-18-01) | Booking modification and cancellation self-service | PARTIAL | P0 |
| [PMS-14-04](14-distribution.md#pms-14-04) | OTA connectivity | PARTIAL | P1 |
| [PMS-14-06](14-distribution.md#pms-14-06) | Duplicate detection | MISSING | P1 |
| [PMS-14-07](14-distribution.md#pms-14-07) | OTA virtual credit card handling | MISSING | P1 |
| [PMS-14-08](14-distribution.md#pms-14-08) | Channel production reporting | PARTIAL | P1 |
| [PMS-14-09](14-distribution.md#pms-14-09) | Content distribution | PARTIAL | P1 |
| [PMS-14-11](14-distribution.md#pms-14-11) | Commission reconciliation per channel | PARTIAL | P1 |
| [PMS-17-04](17-integrations.md#pms-17-04) | Channel manager and CRS | PARTIAL | P1 |
| [PMS-14-13](14-distribution.md#pms-14-13) | GDS connectivity | PARTIAL | P2 |
| [PMS-14-14](14-distribution.md#pms-14-14) | Metasearch | PARTIAL | P2 |
| [PMS-14-15](14-distribution.md#pms-14-15) | Wholesale and bedbank contracts | MISSING | P2 |
| [PMS-14-16](14-distribution.md#pms-14-16) | Corporate booking tools / TMC | MISSING | P2 |
| [PMS-17-21](17-integrations.md#pms-17-21) | HTNG / OTA XML message support | MISSING | P2 |

---

<a id="ws-10"></a>

## WS-10 — Outbound interface framework, then adapters

**Why.** 26 gap items are "connect to an external system", and they are currently 26 unrelated
tables. Build the frame once.

**The frame** — `schema/src/api/interfaces.ts`: a provider registration, a health contract, and a
message log shape. Reuse the service-registry heartbeat pattern already in
`Apps/*/src/routes/registry`. `data_sync_status` is the table for interface health and is currently
unused.

**Then adapters, in value order:**

1. **Door lock** (`AccessControl`: issue, cancel, read audit). The single most-asked-about PMS
   interface, and the one with no groundwork at all. `mobile_keys` and room-move both wire to it.
2. **POS.** `POST /v1/billing/charges/pos` already accepts postings — add a vendor adapter and health.
   Minibar consumption, spa and F&B all post through this path once it exists.
3. **PBX / call accounting** — `pbx_configurations` and `call_records` exist; needs ingest, posting
   rules, the operator console and wake-up dispatch.
4. **ID / passport scanning**, writing to `guest_documents` with MRZ parse.
5. Everything else — RMS, CRM, reputation, ERP, energy, parking, labour — same frame, business value
   order.

**Done when** two adapters run on the same frame and both report health through one endpoint.

**Closes 26 gap items** — P0 2 · P1 13 · P2 11

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-17-01](17-integrations.md#pms-17-01) | Door lock system | MISSING | P0 |
| [PMS-17-02](17-integrations.md#pms-17-02) | Point of sale | PARTIAL | P0 |
| [PMS-02-06](02-front-desk.md#pms-02-06) | ID and passport scanning | MISSING | P1 |
| [PMS-02-09](02-front-desk.md#pms-02-09) | Room key encoding | PARTIAL | P1 |
| [PMS-04-07](04-housekeeping.md#pms-04-07) | Minibar posting | PARTIAL | P1 |
| [PMS-11-04](11-cashiering-folios.md#pms-11-04) | POS interface postings | PARTIAL | P1 |
| [PMS-12-05](12-accounts-receivable.md#pms-12-05) | Accounting / ERP integration | PARTIAL | P1 |
| [PMS-17-05](17-integrations.md#pms-17-05) | Revenue management system | MISSING | P1 |
| [PMS-17-06](17-integrations.md#pms-17-06) | CRM and marketing automation | PARTIAL | P1 |
| [PMS-17-08](17-integrations.md#pms-17-08) | Guest Wi-Fi / captive portal | MISSING | P1 |
| [PMS-17-09](17-integrations.md#pms-17-09) | Reputation management | PARTIAL | P1 |
| [PMS-17-10](17-integrations.md#pms-17-10) | Accounting / ERP | PARTIAL | P1 |
| [PMS-17-11](17-integrations.md#pms-17-11) | Identity verification | MISSING | P1 |
| [PMS-17-12](17-integrations.md#pms-17-12) | Sandbox environment | MISSING | P1 |
| [PMS-17-13](17-integrations.md#pms-17-13) | Interface health monitoring | PARTIAL | P1 |
| [PMS-02-19](02-front-desk.md#pms-02-19) | Wake-up calls | PARTIAL | P2 |
| [PMS-02-20](02-front-desk.md#pms-02-20) | Telephone operator console | PARTIAL | P2 |
| [PMS-17-14](17-integrations.md#pms-17-14) | PBX and call accounting | PARTIAL | P2 |
| [PMS-17-15](17-integrations.md#pms-17-15) | Spa, golf, and activity systems | PARTIAL | P2 |
| [PMS-17-16](17-integrations.md#pms-17-16) | In-room technology | PARTIAL | P2 |
| [PMS-17-17](17-integrations.md#pms-17-17) | Minibar systems | PARTIAL | P2 |
| [PMS-17-18](17-integrations.md#pms-17-18) | Parking and valet | MISSING | P2 |
| [PMS-17-19](17-integrations.md#pms-17-19) | Procurement and materials control | MISSING | P2 |
| [PMS-17-20](17-integrations.md#pms-17-20) | Labour management and payroll | MISSING | P2 |
| [PMS-17-22](17-integrations.md#pms-17-22) | Partner certification programme | MISSING | P2 |
| [PMS-18-08](18-guest-digital.md#pms-18-08) | Mobile key | PARTIAL | P2 |

---

<a id="ws-11"></a>

## WS-11 — Guest communications

**Why.** Email works (Resend and SendGrid providers, real). SMS and WhatsApp are declared as
supported channels on `console-provider.ts` and `webhook-provider.ts` and implemented by neither.
There is no guest↔staff message thread — `in_app_notifications` is staff-facing only.

**Providers** — Twilio-shaped SMS and WhatsApp providers next to the existing email ones in
`Apps/notification-service/src/providers/`. The `ProviderInterface` already supports the channels.

**Thread model** — `guest_message_threads` + messages, visible in the guest portal and on the
reservation. This is what "in-stay messaging", "guest messages" and "service request tracking" all
resolve to.

**Unify the request log** — `contactless_requests` and `guest_feedback` are two halves of one thing.
One request log with status, department routing and a guest-visible track.

**Also here** — multi-language selection by guest language with property fallback, amenity delivery
orders, transportation dispatch, and the digital compendium.

**Closes 13 gap items** — P0 0 · P1 6 · P2 7

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-02-15](02-front-desk.md#pms-02-15) | Guest messages | MISSING | P1 |
| [PMS-02-16](02-front-desk.md#pms-02-16) | Service requests and complaint log | PARTIAL | P1 |
| [PMS-17-07](17-integrations.md#pms-17-07) | Guest messaging platforms | MISSING | P1 |
| [PMS-18-03](18-guest-digital.md#pms-18-03) | In-stay messaging | MISSING | P1 |
| [PMS-18-04](18-guest-digital.md#pms-18-04) | Service request tracking | PARTIAL | P1 |
| [PMS-18-06](18-guest-digital.md#pms-18-06) | Multi-language guest communications | PARTIAL | P1 |
| [PMS-02-22](02-front-desk.md#pms-02-22) | Guest locator | MISSING | P2 |
| [PMS-02-23](02-front-desk.md#pms-02-23) | Transportation requests | PARTIAL | P2 |
| [PMS-02-24](02-front-desk.md#pms-02-24) | Welcome offers and amenity delivery | MISSING | P2 |
| [PMS-07-10](07-guest-profiles.md#pms-07-10) | External CRM lookup and download | MISSING | P2 |
| [PMS-18-11](18-guest-digital.md#pms-18-11) | Digital compendium | MISSING | P2 |
| [PMS-18-12](18-guest-digital.md#pms-18-12) | In-room and F&B ordering | MISSING | P2 |
| [PMS-18-13](18-guest-digital.md#pms-18-13) | Digital tipping | MISSING | P2 |

---

<a id="ws-12"></a>

## WS-12 — Housekeeping depth

**Why.** The core is solid — board, status reconciliation, work orders, inspections, lost and found,
incidents, SLA reporting, productivity. What is missing is the attendant's own working day.

**Build** — task sheets generated per attendant per day with credits; an attendant console with
start/pause/complete; auto-priority as a rule (due-out, VIP, queue room, arrival time) rather than a
stored constant; a housekeeping forecast from arrivals/departures/stayovers with credit-based
staffing; turndown scheduling; preventive maintenance schedules that generate work orders; par
levels; and a route for `room_status_codes`, which is a reference table nothing can read.

**Discrepancy detection** belongs here too but depends on WS-02's rebuild job.

**Closes 12 gap items** — P0 1 · P1 7 · P2 4

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-16-01](16-reporting.md#pms-16-01) | Housekeeping status and discrepancy reports | PARTIAL | P0 |
| [PMS-03-06](03-rooms-inventory.md#pms-03-06) | Room condition codes | PARTIAL | P1 |
| [PMS-04-01](04-housekeeping.md#pms-04-01) | Task sheets | MISSING | P1 |
| [PMS-04-02](04-housekeeping.md#pms-04-02) | Attendant console | PARTIAL | P1 |
| [PMS-04-03](04-housekeeping.md#pms-04-03) | Mobile attendant app | MISSING | P1 |
| [PMS-04-04](04-housekeeping.md#pms-04-04) | Auto-priority | PARTIAL | P1 |
| [PMS-04-05](04-housekeeping.md#pms-04-05) | Housekeeping forecast | MISSING | P1 |
| [PMS-04-06](04-housekeeping.md#pms-04-06) | Turndown scheduling | PARTIAL | P1 |
| [PMS-03-10](03-rooms-inventory.md#pms-03-10) | Floor plans and site maps | PARTIAL | P2 |
| [PMS-03-12](03-rooms-inventory.md#pms-03-12) | Room rotation | MISSING | P2 |
| [PMS-04-08](04-housekeeping.md#pms-04-08) | Preventative maintenance schedules | PARTIAL | P2 |
| [PMS-04-09](04-housekeeping.md#pms-04-09) | Linen, amenity, and consumable par levels | MISSING | P2 |

---

<a id="ws-13"></a>

## WS-13 — Profile model

**Why.** Guests, companies and travel agents are three unrelated tables. The benchmark's "profile
types" means one model with a type discriminator — and every other item in this domain (relationships,
negotiated rates on the profile, default routing, commission setup, AR link, sales accounts) assumes
it.

**Decide first:** one `profiles` spine that the three specialise, or a type discriminator on a merged
table. Do not start the dependent items until this is settled — it is the most expensive thing to
change twice.

**Then** relationships, per-profile routing defaults, duplicate detection (merge already works; what
is missing is surfacing likely duplicates *before* they multiply), a per-profile change timeline over
`audit_logs`, consolidated stay history, de-identification that keeps statistics and drops identity,
and batch update.

**Closes 12 gap items** — P0 3 · P1 4 · P2 5

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-07-01](07-guest-profiles.md#pms-07-01) | Profile types | PARTIAL | P0 |
| [PMS-07-02](07-guest-profiles.md#pms-07-02) | Stay history | PARTIAL | P0 |
| [PMS-07-03](07-guest-profiles.md#pms-07-03) | Profile search and duplicate detection | PARTIAL | P0 |
| [PMS-07-04](07-guest-profiles.md#pms-07-04) | Profile relationships | MISSING | P1 |
| [PMS-07-06](07-guest-profiles.md#pms-07-06) | Default routing on the profile | PARTIAL | P1 |
| [PMS-07-07](07-guest-profiles.md#pms-07-07) | Profile change log | PARTIAL | P1 |
| [PMS-07-08](07-guest-profiles.md#pms-07-08) | Batch profile update | MISSING | P1 |
| [PMS-07-09](07-guest-profiles.md#pms-07-09) | Profile anonymization / de-identification | PARTIAL | P2 |
| [PMS-07-11](07-guest-profiles.md#pms-07-11) | Commission setup on the profile | PARTIAL | P2 |
| [PMS-07-12](07-guest-profiles.md#pms-07-12) | AR account linked to the profile | PARTIAL | P2 |
| [PMS-07-13](07-guest-profiles.md#pms-07-13) | Guest photo | MISSING | P2 |
| [PMS-07-14](07-guest-profiles.md#pms-07-14) | Sales account management | MISSING | P2 |

---

<a id="ws-14"></a>

## WS-14 — Loyalty engine

**Why.** The data model is complete — programmes, tier rules, point transactions, reward catalog,
redemptions, programme economics. The money-to-points and points-to-money calculators exist as
endpoints. **Nothing triggers them.** No stay accrues points.

**Build** — an earn-rule engine that fires on stay close: eligible revenue × tier multiplier ×
promotion. Then expiry with an expiry job, enrolment in the booking and check-in flows, tier
recognition on the check-in brief, certificate issue/hold/burn, and points liability reporting
(a finance requirement, not a marketing one).

Member-only rates and automatic member discounting are **WS-03** items — they need the eligibility
gate, not loyalty code.

**Closes 11 gap items** — P0 0 · P1 4 · P2 7

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-08-01](08-loyalty.md#pms-08-01) | Point earn rules | PARTIAL | P1 |
| [PMS-08-02](08-loyalty.md#pms-08-02) | Point expiry and extension | MISSING | P1 |
| [PMS-08-03](08-loyalty.md#pms-08-03) | Enrollment at booking and check-in | MISSING | P1 |
| [PMS-08-04](08-loyalty.md#pms-08-04) | Recognition at arrival | PARTIAL | P1 |
| [PMS-08-06](08-loyalty.md#pms-08-06) | Certificates and vouchers | PARTIAL | P2 |
| [PMS-08-07](08-loyalty.md#pms-08-07) | Automatic member discounting | MISSING | P2 |
| [PMS-08-08](08-loyalty.md#pms-08-08) | Missing-stay claims | MISSING | P2 |
| [PMS-08-09](08-loyalty.md#pms-08-09) | Suspended and unmatched stays | MISSING | P2 |
| [PMS-08-10](08-loyalty.md#pms-08-10) | External loyalty integration | MISSING | P2 |
| [PMS-08-11](08-loyalty.md#pms-08-11) | Partner earn and exchange rates | MISSING | P2 |
| [PMS-08-12](08-loyalty.md#pms-08-12) | Points liability reporting | PARTIAL | P2 |

---

<a id="ws-15"></a>

## WS-15 — Groups and blocks

**Why.** Block creation, status flow, pickup tracking, rooming lists and the group master folio all
work. Cut-off is stored and nothing releases against it — an expired block holds its rooms forever.

**Start there:** a night-audit step that releases unpicked rooms back to inventory at cut-off. It is
small and it is the difference between blocks being usable and being a slow inventory leak.

**Then** elastic vs non-elastic, per-date sell limits and shoulder dates, wash schedules,
block-level deposit and cancellation terms, block traces/notes/attachments, block production history,
and master/sub hierarchy for city-wide groups. Group bulk actions reuse WS-04's batch envelope.

**Closes 15 gap items** — P0 1 · P1 8 · P2 6

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-09-01](09-groups-blocks.md#pms-09-01) | Cut-off date and auto-release | PARTIAL | P0 |
| [PMS-09-02](09-groups-blocks.md#pms-09-02) | Elastic vs non-elastic blocks | MISSING | P1 |
| [PMS-09-03](09-groups-blocks.md#pms-09-03) | Sell limits and shoulder dates | MISSING | P1 |
| [PMS-09-04](09-groups-blocks.md#pms-09-04) | Wash schedule | PARTIAL | P1 |
| [PMS-09-05](09-groups-blocks.md#pms-09-05) | Block deposit and cancellation schedule | PARTIAL | P1 |
| [PMS-09-06](09-groups-blocks.md#pms-09-06) | Group bulk actions | MISSING | P1 |
| [PMS-09-07](09-groups-blocks.md#pms-09-07) | Booking code / access exclusion | PARTIAL | P1 |
| [PMS-09-08](09-groups-blocks.md#pms-09-08) | Block notes, traces, and attachments | PARTIAL | P1 |
| [PMS-09-09](09-groups-blocks.md#pms-09-09) | Block change log and production changes | PARTIAL | P1 |
| [PMS-09-10](09-groups-blocks.md#pms-09-10) | Master and sub blocks | MISSING | P2 |
| [PMS-09-11](09-groups-blocks.md#pms-09-11) | Master and sub allocations | PARTIAL | P2 |
| [PMS-09-12](09-groups-blocks.md#pms-09-12) | Tour series | MISSING | P2 |
| [PMS-09-13](09-groups-blocks.md#pms-09-13) | Group rooms control | MISSING | P2 |
| [PMS-09-14](09-groups-blocks.md#pms-09-14) | Block date shift and exchange | MISSING | P2 |
| [PMS-09-15](09-groups-blocks.md#pms-09-15) | Opportunities and leads | MISSING | P2 |

---

<a id="ws-16"></a>

## WS-16 — Events and catering

**Why.** Function space, the diary, event bookings, BEO generation with versioning, and event charge
posting all work — which is more than most PMS products at this stage. What is missing is the
catering side: menus live inside BEO content rather than as a master, and there is no resource model.

**Build** — a menu master with items, pricing and cost; catering packages over menu items; event
resources (setup styles, equipment, staffing) with their own availability; then sub-events,
alternate space, templates, copy/move, waitlist and revenue recalculation on guarantee change.

Entirely Phase 5 unless you are selling into conference hotels.

**Closes 11 gap items** — P0 0 · P1 0 · P2 11

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-10-01](10-events-catering.md#pms-10-01) | Alternate space events | MISSING | P2 |
| [PMS-10-02](10-events-catering.md#pms-10-02) | Sub events | MISSING | P2 |
| [PMS-10-03](10-events-catering.md#pms-10-03) | Event templates and quick events | MISSING | P2 |
| [PMS-10-04](10-events-catering.md#pms-10-04) | Menus and menu items | PARTIAL | P2 |
| [PMS-10-05](10-events-catering.md#pms-10-05) | Beverage and catering packages | PARTIAL | P2 |
| [PMS-10-06](10-events-catering.md#pms-10-06) | Event resources | MISSING | P2 |
| [PMS-10-07](10-events-catering.md#pms-10-07) | Event revenue forecast and actuals | PARTIAL | P2 |
| [PMS-10-08](10-events-catering.md#pms-10-08) | Copy and move events | MISSING | P2 |
| [PMS-10-09](10-events-catering.md#pms-10-09) | Sales allowances | MISSING | P2 |
| [PMS-10-10](10-events-catering.md#pms-10-10) | Event waitlist | MISSING | P2 |
| [PMS-10-11](10-events-catering.md#pms-10-11) | Catering revenue recalculation | MISSING | P2 |

---

<a id="ws-17"></a>

## WS-17 — Cashiering depth

**Why.** Cashiering is the strongest domain in the product (30 of 33). The gaps are specific.

**The one that matters:** the **deposit ledger**. Deposits post as payments today. They are
liabilities until arrival, and they need their own ledger with a transfer-to-revenue step. Already
specced in `accounts-gaps/02-advance-deposit-ledger.md` — build that spec.

**Then** auto folio settlement at check-out (needs WS-07), a real currency-exchange transaction with
a till and spread (`fx_rates` is only the rate table), batch charges, rebate/service-recovery codes
distinct from comps, folio archive, gift cards and internal charge numbers.

**Closes 9 gap items** — P0 0 · P1 7 · P2 2

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-02-17](02-front-desk.md#pms-02-17) | Currency exchange at the desk | PARTIAL | P1 |
| [PMS-11-05](11-cashiering-folios.md#pms-11-05) | Rebates, allowances, and service recovery | PARTIAL | P1 |
| [PMS-11-06](11-cashiering-folios.md#pms-11-06) | Folio history and archive | PARTIAL | P1 |
| [PMS-11-07](11-cashiering-folios.md#pms-11-07) | Deposit ledger | PARTIAL | P1 |
| [PMS-11-08](11-cashiering-folios.md#pms-11-08) | Auto folio settlement | MISSING | P1 |
| [PMS-11-09](11-cashiering-folios.md#pms-11-09) | Currency exchange and rate management | PARTIAL | P1 |
| [PMS-11-11](11-cashiering-folios.md#pms-11-11) | Batch charges | MISSING | P1 |
| [PMS-11-12](11-cashiering-folios.md#pms-11-12) | Gift and prepaid cards | MISSING | P2 |
| [PMS-11-13](11-cashiering-folios.md#pms-11-13) | Internal charge numbers | MISSING | P2 |

---

<a id="ws-18"></a>

## WS-18 — Accounts receivable depth

**Why.** AR is the second-strongest domain. Four specific holes: an applied payment cannot be
unapplied; a credit hold does not actually block anything; there are no per-account follow-up tasks;
and commissions calculate and report but cannot be held or paid in a run.

All four are small. The ERP connector on top of the existing GL batch export is the larger one and is
already specced in `accounts-gaps/06-gl-erp-export.md`.

**Closes 5 gap items** — P0 0 · P1 3 · P2 2

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-12-02](12-accounts-receivable.md#pms-12-02) | Credit hold | PARTIAL | P1 |
| [PMS-12-03](12-accounts-receivable.md#pms-12-03) | AR traces and follow-up | MISSING | P1 |
| [PMS-12-04](12-accounts-receivable.md#pms-12-04) | Commission holds and payment run | PARTIAL | P1 |
| [PMS-12-07](12-accounts-receivable.md#pms-12-07) | AR credit card transfer | MISSING | P2 |
| [PMS-12-08](12-accounts-receivable.md#pms-12-08) | Owner statements and rental pool | MISSING | P2 |

---

<a id="ws-19"></a>

## WS-19 — Night audit completeness

**Why.** The audit itself is solid — business date, pre-audit checklist, room and tax posting,
no-show processing, date roll, trial balance, bucket-check, checkpoints and re-run protection.

**Three holes:** it does not post fixed charges or package elements (needs WS-05); the trigger is
manual (add a schedule on top of the existing re-run protection); and there is no report pack or
distribution (needs WS-06 to render, WS-11 to deliver).

**Closes 5 gap items** — P0 0 · P1 3 · P2 2

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-13-02](13-night-audit.md#pms-13-02) | Fixed charge and package posting | PARTIAL | P1 |
| [PMS-13-03](13-night-audit.md#pms-13-03) | Automatic scheduled EOD | PARTIAL | P1 |
| [PMS-13-04](13-night-audit.md#pms-13-04) | Report distribution | MISSING | P1 |
| [PMS-13-05](13-night-audit.md#pms-13-05) | Income audit | MISSING | P2 |
| [PMS-13-06](13-night-audit.md#pms-13-06) | Multi-property staged rollover | MISSING | P2 |

---

<a id="ws-20"></a>

## WS-20 — Reporting platform

**Why.** The report *content* is good — arrivals, departures, in-house, flash, pace, forecast,
segment production, commissions, KPIs, SLA. The *platform* around it is missing.

**`report_schedules` is a table with no route and no runner.** Add both; then reuse the WS-06
renderer for output and WS-11 for delivery, and scheduled distribution, export formats and the audit
pack all land together.

**Then** a custom report builder over a constrained query surface — a saved definition model, never
raw SQL from the UI — saved ad-hoc views, period statistics (today's KPIs are point-in-time),
USALI-aligned statements (`usali_category` already sits on charge codes and GL entries), and a
warehouse feed off the outbox.

**Closes 8 gap items** — P0 0 · P1 3 · P2 5

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-16-03](16-reporting.md#pms-16-03) | Statistics by month and year | PARTIAL | P1 |
| [PMS-16-04](16-reporting.md#pms-16-04) | Scheduled report distribution | MISSING | P1 |
| [PMS-16-05](16-reporting.md#pms-16-05) | Custom report builder | MISSING | P1 |
| [PMS-16-06](16-reporting.md#pms-16-06) | USALI-aligned statements | PARTIAL | P2 |
| [PMS-16-07](16-reporting.md#pms-16-07) | Data warehouse / BI feed | MISSING | P2 |
| [PMS-16-08](16-reporting.md#pms-16-08) | Ad-hoc query and custom views | MISSING | P2 |
| [PMS-16-09](16-reporting.md#pms-16-09) | Benchmarking feed | MISSING | P2 |
| [PMS-16-10](16-reporting.md#pms-16-10) | Embedded analytics | MISSING | P2 |

---

<a id="ws-21"></a>

## WS-21 — Revenue management depth

**Why.** Forecasting, pace, displacement, competitor rates, hurdle rates and channel profitability
all exist. What is missing is anything that *acts*.

**Automated yield triggers** are the item: hurdle rates and competitive-response rules are stored and
nothing executes them. Build the runner that moves the BAR tier (WS-03) when occupancy or pace
crosses a hurdle.

**Unconstrained demand** needs turnaway capture from WS-04 — the tables are ready, the input is not.

**Then** budget entry (the variance endpoint reads `revenue_goals`; there is no way to enter one),
LOS optimisation on top of WS-02, GOPPAR (needs a cost side), what-if simulation, and an RMS
connector.

**Closes 8 gap items** — P0 0 · P1 3 · P2 5

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-06-01](06-revenue-management.md#pms-06-01) | Budget entry and variance | PARTIAL | P1 |
| [PMS-06-02](06-revenue-management.md#pms-06-02) | RMS integration | MISSING | P1 |
| [PMS-06-03](06-revenue-management.md#pms-06-03) | TRevPAR and RevPAG | PARTIAL | P1 |
| [PMS-06-04](06-revenue-management.md#pms-06-04) | Unconstrained demand | PARTIAL | P2 |
| [PMS-06-05](06-revenue-management.md#pms-06-05) | Length-of-stay optimization | MISSING | P2 |
| [PMS-06-06](06-revenue-management.md#pms-06-06) | Automated yield triggers | PARTIAL | P2 |
| [PMS-06-07](06-revenue-management.md#pms-06-07) | GOPPAR and departmental profitability | PARTIAL | P2 |
| [PMS-06-08](06-revenue-management.md#pms-06-08) | What-if pricing simulation | PARTIAL | P2 |

---

<a id="ws-22"></a>

## WS-22 — Administration and security hardening

**Why.** RBAC, screen permissions, MFA, feature flags, approval workflows, break-glass, module
entitlement and data retention are all built and good. The gaps are configurability and enforcement.

**Build** — per-tenant password and session policy (enforced in code today, not configurable);
enforcement for `field_configurations`, which is a table with no enforcement path; row-level
restrictions by department or market on top of the existing tenant/property scoping; a configured
OIDC/SSO flow with provisioning; a template editor over `communication_templates` with preview
through WS-06; content translation keyed by entity + locale (UI strings are localised, content is
not); config export/promote between environments; and a resettable training property.

**Closes 9 gap items** — P0 1 · P1 6 · P2 2

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-19-01](19-administration.md#pms-19-01) | Password and session policy | PARTIAL | P0 |
| [PMS-19-02](19-administration.md#pms-19-02) | Screen and field-level permissions | PARTIAL | P1 |
| [PMS-19-03](19-administration.md#pms-19-03) | Data-level restrictions | PARTIAL | P1 |
| [PMS-19-04](19-administration.md#pms-19-04) | Single sign-on | PARTIAL | P1 |
| [PMS-19-05](19-administration.md#pms-19-05) | Template and stationery editor | PARTIAL | P1 |
| [PMS-19-06](19-administration.md#pms-19-06) | Multi-language content management | PARTIAL | P1 |
| [PMS-19-07](19-administration.md#pms-19-07) | Report and export scheduling | MISSING | P1 |
| [PMS-19-08](19-administration.md#pms-19-08) | Configuration migration | MISSING | P2 |
| [PMS-19-09](19-administration.md#pms-19-09) | Training / sandbox property | MISSING | P2 |

---

<a id="ws-23"></a>

## WS-23 — Multi-property and chain

**Why.** Multi-tenancy is strong. Multi-*property* barely exists: every availability query, every
report and every business date is scoped to one property.

**Cross-property availability is the prerequisite** for almost everything else here — CRO, cross-property
itineraries, moving a reservation between properties, alternate property availability.

Central profiles depend on WS-13, central rates on WS-03's hierarchy, central loyalty on WS-14.

**This is Phase 5 and it is defensible to skip entirely** unless the product targets chains. 15 of
its 18 items are enterprise-tier.

**Closes 18 gap items** — P0 0 · P1 3 · P2 15

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-20-01](20-multi-property.md#pms-20-01) | Cross-property availability | MISSING | P1 |
| [PMS-20-02](20-multi-property.md#pms-20-02) | Enterprise reporting rollups | MISSING | P1 |
| [PMS-20-03](20-multi-property.md#pms-20-03) | Property onboarding workflow | PARTIAL | P1 |
| [PMS-03-13](03-rooms-inventory.md#pms-03-13) | Room ownership | MISSING | P2 |
| [PMS-03-14](03-rooms-inventory.md#pms-03-14) | Alternate property availability | MISSING | P2 |
| [PMS-14-17](14-distribution.md#pms-14-17) | Central reservation system | MISSING | P2 |
| [PMS-20-04](20-multi-property.md#pms-20-04) | Central reservation office | MISSING | P2 |
| [PMS-20-05](20-multi-property.md#pms-20-05) | Central profiles | MISSING | P2 |
| [PMS-20-06](20-multi-property.md#pms-20-06) | Central rate management | MISSING | P2 |
| [PMS-20-07](20-multi-property.md#pms-20-07) | Central loyalty | MISSING | P2 |
| [PMS-20-08](20-multi-property.md#pms-20-08) | Central sales and lead sending | MISSING | P2 |
| [PMS-20-09](20-multi-property.md#pms-20-09) | Cross-property posting and routing | MISSING | P2 |
| [PMS-20-10](20-multi-property.md#pms-20-10) | Cross-property itinerary | MISSING | P2 |
| [PMS-20-11](20-multi-property.md#pms-20-11) | Brand standards governance | MISSING | P2 |
| [PMS-20-12](20-multi-property.md#pms-20-12) | Franchise and management fee calculation | MISSING | P2 |
| [PMS-20-13](20-multi-property.md#pms-20-13) | Mixed-use support | MISSING | P2 |
| [PMS-20-14](20-multi-property.md#pms-20-14) | Vacation ownership | MISSING | P2 |
| [PMS-20-15](20-multi-property.md#pms-20-15) | Data residency per region | MISSING | P2 |

---

<a id="ws-24"></a>

## WS-24 — Platform and non-functional

**Why.** The platform layer is genuinely strong — business dates, idempotency (37 schema files, 57
service files), the transactional outbox, OpenTelemetry, event-driven writes, i18n across 175 UI
files, and realistic test data generation. Four specific weaknesses.

1. **Optimistic concurrency.** `version` columns are incremented (`version = version + 1` in
   `tenant-module-service.ts`, `charge.ts`, `webhook-dispatcher.ts`) but **no write asserts the
   expected version**. Concurrent edits still last-write-win. Add `WHERE version = $expected` and a
   typed 409. Small change, real correctness bug.
2. **Timezone correctness.** Business dates are handled well; property timezone is not consistently
   applied. One conversion utility in `schema/src/api/`, used everywhere.
3. **Key management.** No KMS, no rotation. This is a prerequisite for the PCI claim in WS-07, not an
   independent nice-to-have.
4. **Rate limiting.** Process-local `Map` — resets on restart, does not hold across replicas.
   Currently token-gated behind an unproxied endpoint so it is not load-bearing; it becomes so the
   moment that route is proxied.

**Also here** — a restore rehearsal in CI (DR is documented, never exercised), a performance budget
wired to the existing `loadtest/` and `performance_thresholds`, one WCAG 2.2 AA audit of the staff UI
(broad ARIA use, no audit), degraded-mode front desk operation, and SDKs generated from the published
OpenAPI spec.

**Closes 14 gap items** — P0 3 · P1 7 · P2 4

| ID | Capability | Status | Pri |
|---|---|---|---|
| [PMS-21-01](21-platform.md#pms-21-01) | Optimistic concurrency | PARTIAL | P0 |
| [PMS-21-02](21-platform.md#pms-21-02) | Backup and tested restore | PARTIAL | P0 |
| [PMS-21-03](21-platform.md#pms-21-03) | Timezone correctness | PARTIAL | P0 |
| [PMS-18-07](18-guest-digital.md#pms-18-07) | Accessibility to WCAG 2.2 AA | PARTIAL | P1 |
| [PMS-21-04](21-platform.md#pms-21-04) | Zero-downtime deployment | PARTIAL | P1 |
| [PMS-21-05](21-platform.md#pms-21-05) | Performance targets | PARTIAL | P1 |
| [PMS-21-06](21-platform.md#pms-21-06) | Horizontal scalability | PARTIAL | P1 |
| [PMS-21-07](21-platform.md#pms-21-07) | Staff UI accessibility | PARTIAL | P1 |
| [PMS-21-08](21-platform.md#pms-21-08) | Rate limiting and abuse protection | PARTIAL | P1 |
| [PMS-21-12](21-platform.md#pms-21-12) | Encryption key management and rotation | MISSING | P1 |
| [PMS-21-09](21-platform.md#pms-21-09) | Degraded-mode front desk operation | MISSING | P2 |
| [PMS-21-10](21-platform.md#pms-21-10) | Availability SLA and DR | PARTIAL | P2 |
| [PMS-21-11](21-platform.md#pms-21-11) | Regional deployment topology | MISSING | P2 |
| [PMS-21-13](21-platform.md#pms-21-13) | API SDKs and developer portal | PARTIAL | P2 |

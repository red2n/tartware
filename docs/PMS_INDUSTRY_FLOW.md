# The PMS flow a property actually runs

What a property management system has to do, in the order a hotel does it, with
the state each step must leave behind. This is the reference to read the E2E
output against: every stage names the command that performs it, the evidence
that it worked, and whether Tartware covers it today.

It is written for two audiences at once — an operator judging whether the system
can run their front office, and an engineer deciding whether a test proves what
it claims. Where the product does not do something, that is stated rather than
softened; a gap named is worth more than a stage quietly missing from a suite.

**Multi-tenancy is a property of every line below.** Every command carries a
`tenant_id`, every read is scoped to it, and a stage is only proven when it has
been proven for a tenant that is not the seed. `test-stay-lifecycle.sh` takes
`STAY_TENANT_ID` for that reason: the same walk, any tenant.

Legend: **Covered** — driven end to end by a suite that runs, asserting database
state. **Partial** — driven, but something material is unasserted. **Not
covered** — the capability exists and no suite calls it. **Missing** — the
product does not do it.

---

## 1. Shop — what can be sold, and for how much

A guest, an agent or a channel asks what is free. Nothing is reserved yet, and
the answer has to be fast and correct at the same time.

| Step | How | Evidence it worked | Status |
|---|---|---|---|
| Room types and rooms | `GET /v1/rooms`, `/v1/room-types` | The property's sellable inventory is listed | **Covered** |
| Availability search | `GET /v1/rooms/availability` | Free rooms for the window, less holds and unassigned sold nights | **Covered** |
| Rate lookup | `GET /v1/rates`, rate calendar | A price per night, per room type | **Covered** |
| Restrictions | Min-stay, closed-to-arrival, cutoffs | A refused stay states which restriction refused it | **Covered** |
| Contracted blocks hold inventory | `POST /v1/allotments` | A 2-room block removes exactly 2 rooms from the search, immediately | **Covered** |

**What a buyer should check.** Ask for a search, then create a block, then
search again *without waiting*. If the second search still offers the blocked
rooms, the funnel is reading a cache — that was a real defect here, fixed on
1 Sep 2026 by invalidating the funnel reads on every allotment write.

---

## 2. Enquiry, quote and conversion

The half of the funnel that turns interest into a booking. Most PMS
demonstrations skip it; a corporate or group desk lives in it.

| Step | Command | Evidence | Status |
|---|---|---|---|
| Take an enquiry | `reservation.create` with `status: INQUIRY` | A booking exists in INQUIRY | **Covered** |
| Send a quote | `reservation.send_quote` | Status QUOTED, `quoted_at` set, `quote_expires_at` set | **Covered** |
| Convert it | `reservation.convert_quote` | Status PENDING — a booking awaiting its deposit | **Covered** |
| Quote expiry | `reservation.expire` | The quote lapses rather than being honoured forever | **Not covered** |

**Worth knowing.** Until 1 Sep 2026 this path was dead in a way that answered
`202` at every step: `send_quote` emitted `reservation.quoted`,
notification-service consumed it and would have emailed the guest, and nothing
applied it to the booking — which stayed INQUIRY, so `convert_quote` refused it
for not being QUOTED. A suite that stops at the HTTP code would have called this
green.

---

## 3. Book

| Step | Command | Evidence | Status |
|---|---|---|---|
| Create the booking | `reservation.create` | Row persisted, confirmation number issued, status CONFIRMED | **Covered** |
| Rooms and nights | — | One `reservation_rooms` row per room, one `reservation_nights` row per night | **Covered** |
| Per-night pricing | — | Nights carry their own rate, so a mid-stay rate change is expressible | **Covered** |
| Deposit taken | `reservation.add_deposit` | The deposit is recorded against the booking | **Covered** |
| Deposit released | `reservation.release_deposit` | The release is recorded, not the deposit erased | **Covered** |
| Blacklisted guest refused | `reservation.create` | `GUEST_BLACKLISTED`, unless overridden under a BLACKLIST reason code whose approval level the caller's role clears | **Covered** |
| Group booking | `group.create`, `group.add_rooms` | A group with rooms attached | **Partial** — created, but rooming list and group check-in are **Not covered** |
| Waitlist a sold-out date | `reservation.waitlist_add` → `waitlist_offer` → `waitlist_convert` | Entry, then OFFERED, then CONVERTED | **Covered** |

---

## 4. Before arrival

| Step | Command | Evidence | Status |
|---|---|---|---|
| Assign a room | `reservation.assign_room` | The room is held for the booking | **Covered** |
| Unassign it | `reservation.unassign_room` | The room returns to inventory | **Partial** — accepted; the release is not yet observed |
| Registration card | `reservation.generate_registration_card` | A `digital_registration_cards` row | **Covered** |
| Modify the booking | `reservation.modify` | Dates, guests, rate change; **status changes only along legal edges** | **Covered** |
| Cancel | `reservation.cancel` | Status CANCELLED under a CANCELLATION reason code; penalty posted if the policy says so | **Covered** |
| No-show | `reservation.no_show` | Status NO_SHOW, no-show charge posted | **Covered** |

---

## 5. Arrival

| Step | Command | Evidence | Status |
|---|---|---|---|
| Check in | `reservation.check_in` | Status CHECKED_IN, `actual_check_in` stamped, room OCCUPIED, folio opened | **Covered** |
| Deposit gate | — | Arrival refuses while a blocking deposit is unpaid | **Covered** |
| Walk-in | `reservation.walkin_checkin` | Booking created *and* checked in in one command | **Partial** — driven; fails on rate resolution when the room type has no rate |
| Pre-authorise a card | `billing.payment.authorize` | An AUTHORIZED payment, credit limit enforced | **Covered** |
| Group arrival | `group.check_in` | Every room in the group in-house | **Not covered** |
| Cut a key | `rooms.key.issue` / `rooms.key.revoke` | A `mobile_keys` row, then inactive | **Partial** — driven; enum mismatch found and corrected |
| Undo a check-in | `reservation.reverse_check_in` | Back to CONFIRMED, folio charges the check-in posted are reversed, others refuse | **Covered** |

---

## 6. In-house — the stay

| Step | Command | Evidence | Status |
|---|---|---|---|
| Post a charge | `billing.charge.post` | The folio balance moves by the charge | **Covered** |
| Take a payment | `billing.payment.capture` | Balance reduced; credit limit enforced with an authorised override path | **Covered** |
| Room move | `reservation.room_move` | New room OCCUPIED, old one released, availability hold moved, decision recorded | **Covered** |
| Extend the stay | `reservation.extend_stay` | Nights added, priced | **Covered** |
| **Shorten the stay** | — | — | **Missing as a distinct operation.** `extend_stay` accepts an earlier date, so a reduction is recorded as an extension, with no early-departure fee, no re-pricing rule and no reason code |
| Rate override | `reservation.rate_override` | New rate on the booking, recorded under a RATE_OVERRIDE code the caller's role clears | **Covered** |
| **Share a room between two bookings** | — | — | **Missing** (PMS-01-11) — OPERA's *sharers*: two reservations in one room, each with its own folio and a split rate. Note this is not the same as extra people on one booking, which `reservation_occupants` does support |
| Split a folio / billing windows | `billing.folio.split`, `folio.transfer`, `charge.transfer`, `folio_window.create` | Charges land on the intended folio or window | **Partial** — split and transfer covered; `folio_window.create` is not, so the company-pays-one-window case is untested |
| Route charges to a company | `billing.routing_rule.*` | Charges route by rule | **Not covered** — `folio_routing_rules` and `folio_windows` both exist in the schema; no suite drives either, which is OPERA's routing-instruction equivalent going unproven |
| Housekeeping | `housekeeping.task.*` | Task created, assigned, completed; room status follows | **Partial** — create/assign/complete covered; reassign, reopen, notes are not |
| Room out of order | `rooms.out_of_order`, `rooms.out_of_service` | The room leaves the sellable set | **Partial** — driven; assertion depends on a free room being available |

---

## 7. Departure

| Step | Command | Evidence | Status |
|---|---|---|---|
| Settle | `billing.payment.capture` / `folio.close` | Folio balance zero | **Covered** |
| Check out | `reservation.check_out` | Status CHECKED_OUT, `actual_check_out` stamped, room no longer OCCUPIED | **Covered** |
| Late checkout | `billing.late_checkout.charge` | Fee posted | **Covered** |
| Express checkout | `billing.express_checkout` | Settled without the desk | **Covered** |
| **Undo a check-out** | `reservation.reverse_check_out` | Back to CHECKED_IN, departure stamp cleared, folio reopened, the reversal recorded | **Covered** |
| Transfer the balance to a company | `ar.city_ledger.transfer` | A city-ledger entry; refused past the account's credit unless overridden under a CREDIT_LIMIT code | **Covered** |

---

## 8. Back office — the day close

| Step | Command | Evidence | Status |
|---|---|---|---|
| Cashier shift | `billing.cashier.open` / `close` / `handover` | Counted variance recorded | **Covered** |
| Night audit | `billing.night_audit.execute` | Room and tax charges posted, no-shows marked, trial balance produced, date rolled | **Covered** |
| Audit preconditions | — | Open arrivals, open departures and unbalanced folios block the audit; a bypass needs a NIGHT_AUDIT reason code that exists, and writes one row per gate | **Covered** |
| GL export | `billing.gl_batch.export` | A balanced batch | **Covered** |
| Fiscal period | `billing.fiscal_period.create` / `close` / `lock` / `reopen` | A closed period refuses postings; reopening needs two people | **Partial** — create/close covered; lock and reopen are **Not covered** |
| AR and collections | `billing.ar.post`, `ar.age`, dunning, disputes | Balances age, dunning escalates | **Partial** — post and write-off covered; aging, dunning and disputes are **Not covered** |
| Write off a debt | `ar.city_ledger.write_off` | Ledger moved, under a WRITE_OFF reason code, released by a second owner | **Covered** |

---

## 9. The controls a buyer should test

These are what separate a system that records work from one an auditor accepts.
Each has a suite phase behind it.

| Control | What to try | What should happen |
|---|---|---|
| Per-command authority | A clerk runs a manager's command | Refused, and the refusal does not disclose the required role |
| Grants and denies | Grant one command to one membership | That command only; a deny beats even an owner |
| Dual control | One owner writes off a debt | Queued, not executed. A second owner releases it, and *that* dispatches it |
| Four eyes | The requester approves their own request | Refused |
| Override authority | A clerk names a GM-level reason code | Refused before anything is recorded |
| Override record | Any override | One row, naming the code, the real role, and marked forced |
| Legal transitions | Modify a checked-out booking back to confirmed | Refused; only the owning command may make that move |
| Credit limit | Transfer past an account's credit | Refused, unless overridden under a CREDIT_LIMIT code — then one row and the transfer actually happens |
| Blacklist | Book a blacklisted guest | Refused, unless overridden under a BLACKLIST code the role clears |
| Tenant isolation | Read another tenant's data with your token | Nothing comes back |

---

## 10. How to read a test run against this document

1. **A 202 is not a pass.** Commands are accepted long before they are applied.
   Every stage above names database state; a suite that asserts only HTTP codes
   proves the gateway is up. Three defects this month were 202-accepted and did
   nothing: the quote path, the city-ledger transfer, and the night-audit
   bypass's reason code.
2. **A skip is a gap, not a pass.** `test-stay-lifecycle.sh` skips loudly and
   names the missing capability. Count skips as uncovered.
3. **Coverage is measured, not assumed.** `pnpm run check:command-coverage`
   reports how many catalogued commands any running suite drives. On
   1 Sep 2026 that was 70 of 202 before this work.
4. **Run it for a second tenant.** `STAY_TENANT_ID=<uuid>` walks the identical
   flow for another tenant. A flow proven only against the seed tenant has
   proven the seed data.

---

## 11. Measured against OPERA

Oracle Hospitality OPERA is what a buyer will compare this to, so this section
maps its functional model onto ours module by module. Every "present" claim below
was checked against the running schema and the command catalogue rather than
recalled — the table or command that backs it is named so you can verify it in a
demo.

### Where the product stands up

| OPERA module | What it means operationally | Here |
|---|---|---|
| **Profiles** — guest, company, travel agent, source | One record per party, reusable across stays, with preferences and negotiated terms | `guests`, `companies`, `travel_agents`, `booking_sources`, `guest_preferences`, `guest_documents`, `guest_notes` |
| **Loyalty / membership** | Tiers, points earn and burn | `guest_loyalty_programs`, `loyalty_tier_rules`, `loyalty_point_transactions` |
| **Reservations** | Book, modify, cancel, no-show, waitlist | Full command set; `reservations`, `reservation_rooms`, `reservation_nights` (per-night pricing) |
| **Accompanying guests** | More than one person in the room | `reservation_occupants` with `occupant_type` |
| **Traces** | A note routed to a department for a date — OPERA's operational nervous system | `reservation_traces` |
| **Packages** | Rate-inclusive elements with their own posting rhythm | `packages`, `package_components`, `package_bookings` |
| **Blocks / groups** | Contracted room blocks, pickup, cutoff | `allotments`, `group_bookings`, `group_room_blocks` — with the hold proven against live availability |
| **Deposits & cancellation policy** | Schedules that decide what is owed and when | `deposit_schedules`, cancellation penalty command |
| **Front desk** | Arrival, walk-in, room assignment, registration card, keys | Commands for each; `digital_registration_cards`, `mobile_keys` |
| **Room status & housekeeping** | Clean/dirty/inspected, out of order vs out of service, task sheets | Room status commands, `housekeeping_tasks`, `maintenance_requests` |
| **Cashiering — folio windows** | Several billing windows per folio, so a company pays one and the guest the other | `folio_windows` |
| **Cashiering — routing** | Instructions that send charges to another window or account automatically | `folio_routing_rules` |
| **Transaction codes → GL** | Every posting classified and mapped to the general ledger | `charge_codes`, `charge_code_gl_mapping`, `gl_chart_of_accounts` |
| **Cashier shifts** | Open, count, hand over, close with variance | `cashier_sessions`, shift commands |
| **Night audit** | Room and tax posting, no-shows, trial balance, date roll | `night_audit_runs`, `night_audit_checkpoints`, `general_ledger_batches` |
| **Fiscal control** | Period close, locking, invoice numbering | `fiscal_periods`, `invoice_sequences` |
| **AR / city ledger** | Direct bill, aging, dunning, disputes, write-off | `ar_accounts`, `ar_city_ledger`, aging/dunning/dispute tables |
| **Commissions** | Travel agent and channel commission, statements | `travel_agent_commissions`, `commission_rules`, `commission_statements`, `commission_tracking` |
| **Distribution** | OTA, GDS, channel manager, parity, restrictions | `channel_mappings`, `ota_*`, `gds_*`, `rate_restrictions`, `channel_rate_parity` |
| **Revenue management** | Forecast, pace, compset, recommendations | `rate_recommendations` plus 32 `revenue.*` commands |
| **Walk / turnaway** | Oversold: who was walked, and the business lost | `walk_history`, `lost_business` |
| **Multi-currency** | Foreign currency postings at a held rate | `fx_rates`, rate locked at posting |
| **Compliance** | Police/guest registration, ID capture, retention, GDPR | `police_reports`, `guest_documents`, `data_retention_policies`, GDPR commands |
| **Interfaces** | Door lock, minibar, in-room devices | `mobile_keys`, `minibar_consumption`, `smart_room_devices`, `device_events_log` |

On breadth, this is OPERA-class. The audit of 28 Aug 2026 reached the same
conclusion from the other direction: the divergence from OPERA was never *what*
the system can do, it was **who is allowed to do it** — and that is what findings
A01–A11 have been closing.

### Where OPERA does something this does not

Named in OPERA's vocabulary, because that is how the question will be asked.
Each was verified absent from both the schema and the command catalogue.

| OPERA capability | What it is | Why a buyer cares | Effort |
|---|---|---|---|
| **Share reservations (sharers)** | Two *reservations* in one room, each with its own folio, the rate split between them | Standard for corporate twin-share and for conference delegates booked individually. `reservation_occupants` is not this — that is extra people on one booking, one folio | Large: a room becomes a many-to-many, and rate splitting is a pricing rule |
| **Posting master / PM accounts** | A non-guest folio that charges post to — group masters, house accounts, staff, wastage | Every group's master bill and every internal charge lands here. Today there is no folio without a reservation | Medium |
| **Fixed charges** | A recurring nightly charge on a reservation (parking, pet, crib) | Set once at booking, posts itself every night; without it the desk posts by hand nightly | Small–medium |
| **Room queue** | Arrivals waiting for a room to be cleaned, with the wait visible to housekeeping | The busiest hour of the day at a full house; OPERA prioritises cleaning from this queue | Medium |
| **Shorten a stay / early departure** | A first-class operation with its own fee and re-pricing rule | Departures move as often as extensions. Here it rides `extend_stay` with an earlier date — recorded as an extension, no fee, no reason code, and the `EARLY_DEPARTURE` reason category has no codes seeded | Small, and the highest value per hour on this list |
| **Wake-up calls** | Scheduled, with delivery and acknowledgement | Expected at any full-service property; usually a PBX interface | Small |
| **Day use** | Arrival and departure the same day, priced differently | Airport and city properties sell this daily | Small |
| **Tour series** | Repeating group blocks under one contract | Tour operators contract this way | Medium |
| **Connecting rooms** | Rooms that physically join, sold as a pair to families | Asked for constantly at resorts; needs a room-adjacency model | Medium |
| **Upsell at check-in** | Offer and record a paid upgrade at arrival | A measurable revenue line most properties track | Small |

None of these is exotic. The first two are the ones that would come up in the
first hour of an OPERA-literate evaluation: a group's master bill has nowhere to
post, and two colleagues sharing a twin cannot each have their own folio.

### The controls, which is where this is ahead

OPERA's authority model is configuration-driven and mature. What this product now
has, and what is worth demonstrating because most systems cannot show it:

- **Per-command authority** with per-membership grants and denies, where a deny
  beats an owner and an undeclared command is refused outright.
- **Dual control** on the five commands that undo a completed accounting control,
  where approving *dispatches the stored payload* rather than annotating a row.
- **Override authority** — a reason code's `approval_level` is checked against the
  operator's real role before the override is allowed, not after.
- **A closed vocabulary for overrides**: every gate name written to the audit
  trail must be declared in the flow registry, with file-and-token evidence that
  the code enforcing it still exists.
- **Legal transitions** for the reservation lifecycle, with each edge owned by the
  command entitled to make it.

### Reading this section honestly

Three caveats a serious evaluator should apply to the table above, and to any
vendor's equivalent:

1. **Present in the schema is not present in the product.** A table proves a
   shape, not a working path. `check:command-coverage` reports that 92 of 202
   commands are driven end to end by a suite that runs; the rest are built and
   unproven. Ask which side of that line a feature is on.
2. **Depth is not breadth.** Packages, traces and commissions exist as tables and
   commands; whether they behave the way OPERA's do under a real month of
   operations is not something any of the evidence here establishes.
3. **The gaps above are the verified ones.** They are what was checked against
   OPERA's model on 1 Sep 2026, not an exhaustive difference — OPERA is decades
   of accumulated operational detail, and a like-for-like claim would be false.

---

## 12. Known gaps, in one list

- **Share reservations**, **posting master accounts**, **fixed charges**, **room
  queue**, **wake-up calls**, **day use**, **tour series**, **connecting rooms**
  and **upsell** do not exist (section 11).
- **Shortening a stay** has no command of its own.
- **Group operations** stop at creation: rooming list upload, group check-in,
  group billing setup and cutoff enforcement are built and untested.
- **AR long tail** — aging, dunning, disputes — is built and untested.
- **Revenue management** is the largest untested area at 32 commands.
- **Charge routing** (`folio_routing_rules`) and **folio windows** exist in the
  schema and are driven by no suite.
- Nine reason-code categories are declared with no codes seeded: COMP, REFUND,
  WALK, OVERBOOKING, EARLY_DEPARTURE, LATE_CHECKOUT, MAINTENANCE, COMPLAINT,
  OTHER — so those overrides have no vocabulary to name.

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
| **Share a room between guests** | — | — | **Missing** (PMS-01-11). One guest per reservation; no sharer model |
| Split a folio | `billing.folio.split`, `folio.transfer`, `charge.transfer` | Charges land on the intended folio | **Covered** |
| Route charges to a company | `billing.routing_rule.*` | Charges route by rule | **Not covered** |
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

## 11. Known gaps, plainly

- **Shared reservations** (two guests, one room) do not exist.
- **Shortening a stay** has no command of its own; it rides `extend_stay`, with
  no early-departure fee and no reason code.
- **Group operations** stop at creation: rooming list upload, group check-in,
  group billing setup and cutoff enforcement are built and untested.
- **AR long tail** — aging, dunning, disputes — is built and untested.
- **Revenue management** (compset, forecasting, pace) is the largest untested
  area at ~32 commands.
- Nine reason-code categories are declared and have no codes seeded: COMP,
  REFUND, WALK, OVERBOOKING, EARLY_DEPARTURE, LATE_CHECKOUT, MAINTENANCE,
  COMPLAINT, OTHER — so those overrides have no vocabulary to name.

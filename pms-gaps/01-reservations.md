# Domain 01 — Reservations & Booking

> **Benchmark:** 47 capabilities · **Built** 15 · **Partial** 12 · **Missing** 20
> **Gap items in this file:** 32
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Reservation create, modify, cancel, Reservation status lifecycle, Confirmation number generation, Reservation search, Room assignment, No-show processing, Reservation notes, Reservation change log, Traces, Routing instructions, Rate override, Promotion and promo code redemption, Travel agent / source / company attachment, Rooming list import, Waitlist reservations

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-01-01](#pms-01-01) | Availability search | PARTIAL | Table stakes | P0 | M | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-02](#pms-01-02) | Multi-room reservation | MISSING | Table stakes | P0 | XL | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-03](#pms-01-03) | Multi-segment / split-rate stay | MISSING | Table stakes | P0 | XL | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-04](#pms-01-04) | Extend and shorten stay | PARTIAL | Table stakes | P0 | M | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-05](#pms-01-05) | Guarantee and payment instructions | PARTIAL | Table stakes | P0 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-06](#pms-01-06) | Cancellation policy engine | PARTIAL | Table stakes | P0 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-07](#pms-01-07) | Deposit request and schedule | PARTIAL | Table stakes | P0 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-08](#pms-01-08) | Preferences | PARTIAL | Table stakes | P0 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-09](#pms-01-09) | Confirmation letters | PARTIAL | Table stakes | P0 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-10](#pms-01-10) | Rate shopping / look-to-book screen | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-11](#pms-01-11) | Share reservations | MISSING | Competitive | P1 | M | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-12](#pms-01-12) | Linked / connected reservations | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-13](#pms-01-13) | Accompanying guests | MISSING | Competitive | P1 | M | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-01-14](#pms-01-14) | Reservation alerts | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-15](#pms-01-15) | Fixed charges | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-16](#pms-01-16) | Packages on the reservation | PARTIAL | Competitive | P1 | S | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-17](#pms-01-17) | Item / inventory rentals | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-18](#pms-01-18) | Upsell and upgrade offers | PARTIAL | Competitive | P1 | S | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-19](#pms-01-19) | Copy and duplicate reservation | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-20](#pms-01-20) | Reinstate cancelled reservation | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-21](#pms-01-21) | Mass update | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-22](#pms-01-22) | Mass cancellation | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-23](#pms-01-23) | Early departure with penalty | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-24](#pms-01-24) | Do-not-move flag | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-25](#pms-01-25) | Turnaway / denial capture | PARTIAL | Competitive | P1 | S | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-26](#pms-01-26) | Scheduled room moves | MISSING | Enterprise | P2 | L | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-27](#pms-01-27) | Move reservation to another property | MISSING | Enterprise | P2 | L | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-01-28](#pms-01-28) | Loyalty award redemption at booking | PARTIAL | Enterprise | P2 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-29](#pms-01-29) | e-Certificate / voucher redemption | MISSING | Enterprise | P2 | L | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-30](#pms-01-30) | Pro-forma folio | MISSING | Enterprise | P2 | L | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-31](#pms-01-31) | Trip composer | MISSING | Enterprise | P2 | L | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-01-32](#pms-01-32) | Call history and caller information | PARTIAL | Enterprise | P2 | M | [WS-05](WORKSTREAMS.md#ws-05) |

---

### PMS-01-01

**Availability search** — PARTIAL · Table stakes · P0 · Effort M · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** Room-level availability only (83-line query). No LOS, occupancy or rate-aware sell query.

**Fix:** Rewrite `available-rooms-source.ts` to take (dates, LOS, occupancy, rate_id) and join `rate_calendar` — it currently returns rooms with no price and no restriction awareness.

### PMS-01-02

**Multi-room reservation** — MISSING · Table stakes · P0 · Effort XL · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** reservations holds a single room_id / room_type_id. One booking = one room.

**Fix:** Add `reservation_rooms` (one row per room held) and move `room_id`/`room_type_id`/occupancy onto it. `reservations` keeps the guarantee, guest and confirmation number.

### PMS-01-03

**Multi-segment / split-rate stay** — MISSING · Table stakes · P0 · Effort XL · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** Flat room_rate column, no per-night rate rows. Rate cannot change mid-stay.

**Fix:** Add `reservation_nights` (reservation_room_id, stay_date, rate_id, rate_amount, currency). Every price read moves off `reservations.room_rate` onto a SUM over this table.

### PMS-01-04

**Extend and shorten stay** — PARTIAL · Table stakes · P0 · Effort M · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** Extend command exists; shortening has no penalty path.

**Fix:** With per-night rows, extend = insert nights, shorten = delete nights + fire the early-departure penalty from WS-04.

### PMS-01-05

**Guarantee and payment instructions** — PARTIAL · Table stakes · P0 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** guarantee_type is a free field. No 6PM release job, no instruction-driven behaviour.

**Fix:** Turn `guarantee_type` into a policy: release time, deposit requirement, and a release job that cancels unguaranteed holds.

### PMS-01-06

**Cancellation policy engine** — PARTIAL · Table stakes · P0 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** Penalty is computed from a snapshot at cancel time; no notice-window / tiered policy config.

**Fix:** Add `cancellation_policies` (notice windows, tiered penalties, first-night / full-stay / percentage) and snapshot the resolved policy at booking, not at cancel.

### PMS-01-07

**Deposit request and schedule** — PARTIAL · Table stakes · P0 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** deposit_schedules table + deposit/add command; no due-date automation or forfeit run.

**Fix:** `deposit_schedules` needs a due-date runner and a forfeit rule; today only ad-hoc deposits post.

### PMS-01-08

**Preferences** — PARTIAL · Table stakes · P0 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** Preferences live on the guest profile; nothing consumes them (no auto-assign).

**Fix:** Preferences exist on the profile — copy them onto the reservation at booking and have auto-assign read them.

### PMS-01-09

**Confirmation letters** — PARTIAL · Table stakes · P0 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** Templates, automated messages and Resend/SendGrid delivery exist; no per-reservation resend or delivery history.

**Fix:** Per-reservation resend action + delivery history view over `guest_communications`.

### PMS-01-10

**Rate shopping / look-to-book screen** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No grid of eligible rates x room types across the stay — the agent's primary sell screen.

**Fix:** The agent's primary sell screen: eligible rates × room types × stay dates in one grid. Depends on WS-03 for resolution.

### PMS-01-11

**Share reservations** — MISSING · Competitive · P1 · Effort M · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** No shared-room model; one guest per reservation.

**Fix:** Once `reservation_rooms` exists, allow >1 named guest per room row with a `share_pct` and its own folio link.

### PMS-01-12

**Linked / connected reservations** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `reservation_links` (type: ADJOINING / FAMILY / TRAVELLING_PARTY); room-move and upgrade must keep links together.

### PMS-01-13

**Accompanying guests** — MISSING · Competitive · P1 · Effort M · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Add `reservation_occupants` (reservation_room_id, guest_id, is_primary) — feeds registration cards, key issue and police reporting.

### PMS-01-14

**Reservation alerts** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `reservation_alerts` (trigger_point, message, acknowledged_by). Fired at check-in, check-out and on open.

### PMS-01-15

**Fixed charges** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `reservation_fixed_charges` (charge_code, amount, frequency). Night audit posts them — pairs with WS-19.

### PMS-01-16

**Packages on the reservation** — PARTIAL · Competitive · P1 · Effort S · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** packages / package_components / package_bookings exist; attach-and-post on a live reservation is not wired.

**Fix:** `package_bookings` exists; wire attach/detach commands and posting through the existing allowance calculators.

### PMS-01-17

**Item / inventory rentals** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `rentable_items` + `item_bookings` with their own availability calendar.

### PMS-01-18

**Upsell and upgrade offers** — PARTIAL · Competitive · P1 · Effort S · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** recommendations service ranks offers; nothing converts one into a reservation change.

**Fix:** Turn a ranked recommendation into an accept action that modifies the reservation and posts the delta.

### PMS-01-19

**Copy and duplicate reservation** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `duplicate` command taking a date offset — one of the highest-use agent shortcuts.

### PMS-01-20

**Reinstate cancelled reservation** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `reinstate` command: re-check availability, re-take the lock, reverse the cancellation penalty.

### PMS-01-21

**Mass update** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Batch command over a reservation id list, one transaction per reservation, aggregate result.

### PMS-01-22

**Mass cancellation** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Same batch envelope, cancel handler, with a penalty preview before commit.

### PMS-01-23

**Early departure with penalty** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Shorten stay + penalty posting; pairs with WS-01's night rows.

### PMS-01-24

**Do-not-move flag** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Boolean on the reservation room; auto-assign and room-move must refuse it.

### PMS-01-25

**Turnaway / denial capture** — PARTIAL · Competitive · P1 · Effort S · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** lost_business table exists with no route and no screen.

**Fix:** `lost_business` has no route. Add capture on a failed availability search — this is the input revenue management is missing.

### PMS-01-26

**Scheduled room moves** — MISSING · Enterprise · P2 · Effort L · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** A dated move on `reservation_rooms`, executed by night audit.

### PMS-01-27

**Move reservation to another property** — MISSING · Enterprise · P2 · Effort L · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Depends on WS-23.

### PMS-01-28

**Loyalty award redemption at booking** — PARTIAL · Enterprise · P2 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** Redemption exists in the guest self-service path only, not in staff booking.

**Fix:** Redemption exists guest-side only; expose the same path in the staff booking command.

### PMS-01-29

**e-Certificate / voucher redemption** — MISSING · Enterprise · P2 · Effort L · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Depends on WS-14 certificates.

### PMS-01-30

**Pro-forma folio** — MISSING · Enterprise · P2 · Effort L · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Projected folio from reservation_nights + fixed charges; needs WS-06 to render.

### PMS-01-31

**Trip composer** — MISSING · Enterprise · P2 · Effort L · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Multi-property itinerary — depends on WS-23.

### PMS-01-32

**Call history and caller information** — PARTIAL · Enterprise · P2 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** call_records table only — no route, no console.

**Fix:** `call_records` has no route; expose it and link records to the reservation (needs WS-10 for PBX capture).


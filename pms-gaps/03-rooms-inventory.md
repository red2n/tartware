# Domain 03 — Rooms & Inventory

> **Benchmark:** 23 capabilities · **Built** 8 · **Partial** 6 · **Missing** 9
> **Gap items in this file:** 15
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Room master, Room type definitions, Availability calendar, Out of order, Out of service, Inventory hold during booking, Room class and feature codes, Overbooking allowance

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-03-01](#pms-03-01) | Physical vs sellable inventory | PARTIAL | Table stakes | P0 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-02](#pms-03-02) | Restrictions engine | PARTIAL | Table stakes | P0 | L | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-03](#pms-03-03) | Building, wing, floor, section structure | PARTIAL | Competitive | P1 | S | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-04](#pms-03-04) | Restriction scoping | MISSING | Competitive | P1 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-05](#pms-03-05) | Sell limits | MISSING | Competitive | P1 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-06](#pms-03-06) | Room condition codes | PARTIAL | Competitive | P1 | S | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-03-07](#pms-03-07) | Room discrepancy detection | PARTIAL | Competitive | P1 | S | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-08](#pms-03-08) | Item inventory availability | MISSING | Competitive | P1 | M | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-03-09](#pms-03-09) | Availability rebuild job | MISSING | Competitive | P1 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-03-10](#pms-03-10) | Floor plans and site maps | PARTIAL | Enterprise | P2 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-03-11](#pms-03-11) | Suite component rooms | MISSING | Enterprise | P2 | L | [WS-01](WORKSTREAMS.md#ws-01) |
| [PMS-03-12](#pms-03-12) | Room rotation | MISSING | Enterprise | P2 | L | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-03-13](#pms-03-13) | Room ownership | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-03-14](#pms-03-14) | Alternate property availability | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-03-15](#pms-03-15) | Sellable availability by channel | MISSING | Enterprise | P2 | L | [WS-02](WORKSTREAMS.md#ws-02) |

---

### PMS-03-01

**Physical vs sellable inventory** — PARTIAL · Table stakes · P0 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** rooms_to_sell lives on rate_calendar but nothing reads it when booking.

**Fix:** `rooms_to_sell` minus `rooms_sold` becomes the sellable ceiling the guard checks, not the physical room count.

### PMS-03-02

**Restrictions engine** — PARTIAL · Table stakes · P0 · Effort L · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** rate_calendar carries CTA, CTD, min/max LOS and advance windows. createReservation validates dates and takes a lock — it never reads them. Restrictions are stored, not enforced.

**Fix:** Build `evaluateRestrictions(tenant, property, roomType, rateId, arrival, departure)` in `schema/src/api/` and call it from `createReservation` before `lockReservationHold`. Return a typed refusal (`RESTRICTION_CTA`, `RESTRICTION_MIN_LOS`, …), not a boolean.

### PMS-03-03

**Building, wing, floor, section structure** — PARTIAL · Competitive · P1 · Effort S · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** Buildings and floors; no wing or section level.

**Fix:** Buildings and floors exist; add wing and section if the physical model needs them.

### PMS-03-04

**Restriction scoping** — MISSING · Competitive · P1 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Add `scope` + `scope_ref` to the restriction row so a restriction can target a rate, a room type, a channel or the whole property.

### PMS-03-05

**Sell limits** — MISSING · Competitive · P1 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Per-scope sell ceilings on top of `rooms_to_sell`; evaluated by the same function.

### PMS-03-06

**Room condition codes** — PARTIAL · Competitive · P1 · Effort S · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** room_status_codes reference table with no route.

**Fix:** `room_status_codes` is a reference table with no route.

### PMS-03-07

**Room discrepancy detection** — PARTIAL · Competitive · P1 · Effort S · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** Referenced in reporting; no detection job.

**Fix:** Nightly job comparing front-office status against housekeeping status; writes discrepancies for the report that already expects them.

### PMS-03-08

**Item inventory availability** — MISSING · Competitive · P1 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Availability calendar over `rentable_items`.

### PMS-03-09

**Availability rebuild job** — MISSING · Competitive · P1 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** A replayable job that recomputes `rooms_sold` from reservation_nights — needed the moment availability can drift.

### PMS-03-10

**Floor plans and site maps** — PARTIAL · Enterprise · P2 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** floor_plan fields exist; no plan view.

**Fix:** Floor plan fields exist; a plan view is a UI build.

### PMS-03-11

**Suite component rooms** — MISSING · Enterprise · P2 · Effort L · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Add `room_components` (parent room_id, child room_id). Selling the parent must hold the children in the availability guard.

### PMS-03-12

**Room rotation** — MISSING · Enterprise · P2 · Effort L · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Rotate assignment across rooms to even out wear.

### PMS-03-13

**Room ownership** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Owner per room — pairs with owner statements.

### PMS-03-14

**Alternate property availability** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Depends on cross-property availability.

### PMS-03-15

**Sellable availability by channel** — MISSING · Enterprise · P2 · Effort L · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Channel-scoped availability view over the same ceiling.


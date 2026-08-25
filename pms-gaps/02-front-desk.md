# Domain 02 — Front Desk & Front Office

> **Benchmark:** 40 capabilities · **Built** 15 · **Partial** 13 · **Missing** 12
> **Gap items in this file:** 25
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Arrivals worklist, Walk-in reservation, Check-in, Registration card, In-house guest list, Departures / due-out list, Check-out with settlement, Deposit and prepayment at check-in, Express / quick check-out, Incremental / top-up authorization, Authorization reversal, Scheduled and late check-out, Post-stay charging / open folio, Available room search, Cashier shift management

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-02-01](#pms-02-01) | Check-in reversal | MISSING | Table stakes | P0 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-02](#pms-02-02) | Room move for in-house guest | PARTIAL | Table stakes | P0 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-03](#pms-02-03) | Credit card pre-authorization | PARTIAL | Table stakes | P0 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-02-04](#pms-02-04) | Advance check-in | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-05](#pms-02-05) | Mass check-in | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-06](#pms-02-06) | ID and passport scanning | MISSING | Competitive | P1 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-02-07](#pms-02-07) | eSignature registration card | PARTIAL | Competitive | P1 | S | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-02-08](#pms-02-08) | Batch registration card printing | MISSING | Competitive | P1 | M | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-02-09](#pms-02-09) | Room key encoding | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-02-10](#pms-02-10) | Queue rooms | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-11](#pms-02-11) | Rooms on hold | PARTIAL | Competitive | P1 | S | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-12](#pms-02-12) | Room swap / shift | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-13](#pms-02-13) | Early check-out | PARTIAL | Competitive | P1 | S | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-14](#pms-02-14) | Reinstate checked-out reservation | MISSING | Competitive | P1 | M | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-15](#pms-02-15) | Guest messages | MISSING | Competitive | P1 | M | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-02-16](#pms-02-16) | Service requests and complaint log | PARTIAL | Competitive | P1 | S | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-02-17](#pms-02-17) | Currency exchange at the desk | PARTIAL | Competitive | P1 | S | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-02-18](#pms-02-18) | Do-not-disturb and privacy flags | PARTIAL | Competitive | P1 | S | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-19](#pms-02-19) | Wake-up calls | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-02-20](#pms-02-20) | Telephone operator console | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-02-21](#pms-02-21) | Safe deposit box tracking | MISSING | Enterprise | P2 | L | [WS-04](WORKSTREAMS.md#ws-04) |
| [PMS-02-22](#pms-02-22) | Guest locator | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-02-23](#pms-02-23) | Transportation requests | PARTIAL | Enterprise | P2 | M | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-02-24](#pms-02-24) | Welcome offers and amenity delivery | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-02-25](#pms-02-25) | Vouchers | PARTIAL | Enterprise | P2 | M | [WS-05](WORKSTREAMS.md#ws-05) |

---

### PMS-02-01

**Check-in reversal** — MISSING · Table stakes · P0 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No undo path once a reservation is checked in.

**Fix:** `reverse-check-in` command: revert status, release the room to its prior housekeeping state, void auto-posted room charges for the night, write a reason code.

### PMS-02-02

**Room move for in-house guest** — PARTIAL · Table stakes · P0 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** assign / unassign room commands only; no move with charge and key follow-through.

**Fix:** Move with charge follow-through and key re-issue (needs WS-10 for the key).

### PMS-02-03

**Credit card pre-authorization** — PARTIAL · Table stakes · P0 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** billing records an AUTHORIZED payment with gateway fields supplied by the caller; nothing calls a PSP.

**Fix:** Route authorize / increment / void through the adapter so the ledger reflects a real hold.

### PMS-02-04

**Advance check-in** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Allow check-in before the room is ready — status `ARRIVED` distinct from `IN_HOUSE`, room assigned later.

### PMS-02-05

**Mass check-in** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Same batch envelope over the arrivals list.

### PMS-02-06

**ID and passport scanning** — MISSING · Competitive · P1 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Scan provider writing to `guest_documents`; MRZ parse fills the profile.

### PMS-02-07

**eSignature registration card** — PARTIAL · Competitive · P1 · Effort S · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Signature column on digital_registration_cards; no capture surface.

**Fix:** Capture surface writing to the existing signature column, embedded in the rendered card.

### PMS-02-08

**Batch registration card printing** — MISSING · Competitive · P1 · Effort M · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Batch job over an arrivals list through the renderer.

### PMS-02-09

**Room key encoding** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** mobile_keys table; no door-lock vendor interface of any kind.

**Fix:** Desk encoder path through the same provider.

### PMS-02-10

**Queue rooms** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Queue a waiting arrival against a dirty room; housekeeping sees the queue and priority rises.

### PMS-02-11

**Rooms on hold** — PARTIAL · Competitive · P1 · Effort S · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** Covered indirectly by room block / out-of-service.

**Fix:** Distinguish a sales hold from out-of-service; hold has an expiry and a holder.

### PMS-02-12

**Room swap / shift** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Two-sided move in one transaction so neither room is double-held.

### PMS-02-13

**Early check-out** — PARTIAL · Competitive · P1 · Effort S · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No early-departure penalty or settlement variant.

**Fix:** Settlement variant of early departure.

### PMS-02-14

**Reinstate checked-out reservation** — MISSING · Competitive · P1 · Effort M · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** `reverse-check-out`: reopen the folio, restore status, re-hold the room.

### PMS-02-15

**Guest messages** — MISSING · Competitive · P1 · Effort M · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** A guest↔staff thread model; `in_app_notifications` is staff-only today.

### PMS-02-16

**Service requests and complaint log** — PARTIAL · Competitive · P1 · Effort S · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** contactless_requests and guest_feedback exist separately; no unified request log.

**Fix:** Unify `contactless_requests` and `guest_feedback` behind one request log with status and department routing.

### PMS-02-17

**Currency exchange at the desk** — PARTIAL · Competitive · P1 · Effort S · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** fx_rates and a conversion calculator; no exchange posting or till.

**Fix:** Same transaction from the desk.

### PMS-02-18

**Do-not-disturb and privacy flags** — PARTIAL · Competitive · P1 · Effort S · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** Privacy flags on the guest profile; no room-level DND.

**Fix:** Privacy flags exist on the profile; room-level DND belongs on the room and must gate housekeeping.

### PMS-02-19

**Wake-up calls** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** Table only.

**Fix:** Schedule table plus PBX dispatch.

### PMS-02-20

**Telephone operator console** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** pbx_configurations and call_records tables; no route.

**Fix:** Expose call records and guest lookup as an operator surface.

### PMS-02-21

**Safe deposit box tracking** — MISSING · Enterprise · P2 · Effort L · [WS-04](WORKSTREAMS.md#ws-04)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Box assignment, access log and release at check-out.

### PMS-02-22

**Guest locator** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Where an in-house guest can be reached — pairs with the operator console.

### PMS-02-23

**Transportation requests** — PARTIAL · Enterprise · P2 · Effort M · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** transportation_requests / shuttle_schedules tables with a thin route surface.

**Fix:** Tables exist with a thin route surface; needs dispatch and status.

### PMS-02-24

**Welcome offers and amenity delivery** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Amenity order attached to the reservation, routed to the delivering department.

### PMS-02-25

**Vouchers** — PARTIAL · Enterprise · P2 · Effort M · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** Schema references only.

**Fix:** Voucher issue-and-burn against `reward_catalog`.


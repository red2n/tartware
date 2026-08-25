# Domain 09 — Groups, Blocks & Allotments

> **Benchmark:** 21 capabilities · **Built** 6 · **Partial** 7 · **Missing** 8
> **Gap items in this file:** 15
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Block creation, Block status flow, Pickup tracking, Rooming list entry, Posting master account, Group commission

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-09-01](#pms-09-01) | Cut-off date and auto-release | PARTIAL | Table stakes | P0 | M | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-02](#pms-09-02) | Elastic vs non-elastic blocks | MISSING | Competitive | P1 | M | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-03](#pms-09-03) | Sell limits and shoulder dates | MISSING | Competitive | P1 | M | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-04](#pms-09-04) | Wash schedule | PARTIAL | Competitive | P1 | S | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-05](#pms-09-05) | Block deposit and cancellation schedule | PARTIAL | Competitive | P1 | S | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-06](#pms-09-06) | Group bulk actions | MISSING | Competitive | P1 | M | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-07](#pms-09-07) | Booking code / access exclusion | PARTIAL | Competitive | P1 | S | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-08](#pms-09-08) | Block notes, traces, and attachments | PARTIAL | Competitive | P1 | S | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-09](#pms-09-09) | Block change log and production changes | PARTIAL | Competitive | P1 | S | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-10](#pms-09-10) | Master and sub blocks | MISSING | Enterprise | P2 | L | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-11](#pms-09-11) | Master and sub allocations | PARTIAL | Enterprise | P2 | M | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-12](#pms-09-12) | Tour series | MISSING | Enterprise | P2 | L | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-13](#pms-09-13) | Group rooms control | MISSING | Enterprise | P2 | L | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-14](#pms-09-14) | Block date shift and exchange | MISSING | Enterprise | P2 | L | [WS-15](WORKSTREAMS.md#ws-15) |
| [PMS-09-15](#pms-09-15) | Opportunities and leads | MISSING | Enterprise | P2 | L | [WS-15](WORKSTREAMS.md#ws-15) |

---

### PMS-09-01

**Cut-off date and auto-release** — PARTIAL · Table stakes · P0 · Effort M · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Cut-off is stored; no job releases the block.

**Fix:** Cut-off is stored but nothing releases. Add a night-audit step that releases unpicked rooms back to inventory.

### PMS-09-02

**Elastic vs non-elastic blocks** — MISSING · Competitive · P1 · Effort M · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Blocks are fixed-size.

**Fix:** Elastic blocks grow on pickup; non-elastic refuse beyond the block.

### PMS-09-03

**Sell limits and shoulder dates** — MISSING · Competitive · P1 · Effort M · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Not modelled.

**Fix:** Per-date block limits plus shoulder-night allowances.

### PMS-09-04

**Wash schedule** — PARTIAL · Competitive · P1 · Effort S · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Wash appears in fields; no schedule.

**Fix:** Scheduled reductions of the block ahead of cut-off.

### PMS-09-05

**Block deposit and cancellation schedule** — PARTIAL · Competitive · P1 · Effort S · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Reservation-level deposits only.

**Fix:** Block-level deposit and cancellation terms, distinct from the reservation's.

### PMS-09-06

**Group bulk actions** — MISSING · Competitive · P1 · Effort M · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No bulk operations across a block's reservations.

**Fix:** Batch commands scoped to a block — reuses WS-04's batch envelope.

### PMS-09-07

**Booking code / access exclusion** — PARTIAL · Competitive · P1 · Effort S · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Promo codes cover part of this; no block access code.

**Fix:** Block access code, and exclusion of the block from public availability.

### PMS-09-08

**Block notes, traces, and attachments** — PARTIAL · Competitive · P1 · Effort S · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Reservation traces exist; blocks have none.

**Fix:** Reservation traces exist; give blocks the same.

### PMS-09-09

**Block change log and production changes** — PARTIAL · Competitive · P1 · Effort S · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** Generic audit only; no production change history.

**Fix:** Production history: what the block held and picked up over time.

### PMS-09-10

**Master and sub blocks** — MISSING · Enterprise · P2 · Effort L · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Block hierarchy for city-wide and multi-hotel groups.

### PMS-09-11

**Master and sub allocations** — PARTIAL · Enterprise · P2 · Effort M · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** allotments exist; no master/sub hierarchy.

**Fix:** Allotment hierarchy over `allotments`.

### PMS-09-12

**Tour series** — MISSING · Enterprise · P2 · Effort L · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Repeating blocks on a pattern.

### PMS-09-13

**Group rooms control** — MISSING · Enterprise · P2 · Effort L · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** A control screen for the whole block across dates.

### PMS-09-14

**Block date shift and exchange** — MISSING · Enterprise · P2 · Effort L · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Move a block's dates with re-check of availability.

### PMS-09-15

**Opportunities and leads** — MISSING · Enterprise · P2 · Effort L · [WS-15](WORKSTREAMS.md#ws-15)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Pre-block sales pipeline.


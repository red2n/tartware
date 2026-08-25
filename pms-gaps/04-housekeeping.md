# Domain 04 — Housekeeping & Maintenance

> **Benchmark:** 20 capabilities · **Built** 11 · **Partial** 5 · **Missing** 4
> **Gap items in this file:** 9
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Room status, Front-office / housekeeping status reconciliation, Housekeeping board, Maintenance / work orders, Service schedule per reservation, Inspection workflow, Lost and found, Incident reporting, Housekeeping productivity reporting, Deep clean and preventative cycles, Engineering escalation and SLA

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-04-01](#pms-04-01) | Task sheets | MISSING | Competitive | P1 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-02](#pms-04-02) | Attendant console | PARTIAL | Competitive | P1 | S | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-03](#pms-04-03) | Mobile attendant app | MISSING | Competitive | P1 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-04](#pms-04-04) | Auto-priority | PARTIAL | Competitive | P1 | S | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-05](#pms-04-05) | Housekeeping forecast | MISSING | Competitive | P1 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-06](#pms-04-06) | Turndown scheduling | PARTIAL | Competitive | P1 | S | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-07](#pms-04-07) | Minibar posting | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-04-08](#pms-04-08) | Preventative maintenance schedules | PARTIAL | Enterprise | P2 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-04-09](#pms-04-09) | Linen, amenity, and consumable par levels | MISSING | Enterprise | P2 | L | [WS-12](WORKSTREAMS.md#ws-12) |

---

### PMS-04-01

**Task sheets** — MISSING · Competitive · P1 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Generated per attendant per day from assignments, with credits and a print/export.

### PMS-04-02

**Attendant console** — PARTIAL · Competitive · P1 · Effort S · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** Assignment and schedules exist; no attendant-facing console.

**Fix:** Attendant-facing task view with start / pause / complete and running credit total.

### PMS-04-03

**Mobile attendant app** — MISSING · Competitive · P1 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Responsive attendant console rather than a separate app.

### PMS-04-04

**Auto-priority** — PARTIAL · Competitive · P1 · Effort S · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** Priority is a stored field, not a rule.

**Fix:** Priority as a rule (due-out, VIP, queue room, arrival time) not a stored constant.

### PMS-04-05

**Housekeeping forecast** — MISSING · Competitive · P1 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Rooms to clean per day from arrivals, departures and stayovers with credit-based staffing.

### PMS-04-06

**Turndown scheduling** — PARTIAL · Competitive · P1 · Effort S · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** Turndown appears as a task type; no schedule.

**Fix:** Evening service schedule with its own task generation.

### PMS-04-07

**Minibar posting** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** minibar_items / minibar_consumption tables; consumption never posts to a folio.

**Fix:** `minibar_consumption` must post to the folio through the POS posting path.

### PMS-04-08

**Preventative maintenance schedules** — PARTIAL · Enterprise · P2 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** predictive_maintenance_alerts exists; no recurring schedule generator.

**Fix:** Recurring schedule generating work orders; `predictive_maintenance_alerts` is the reactive half.

### PMS-04-09

**Linen, amenity, and consumable par levels** — MISSING · Enterprise · P2 · Effort L · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Par levels and consumption per room type.


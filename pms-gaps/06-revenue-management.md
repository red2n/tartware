# Domain 06 — Revenue Management & Forecasting

> **Benchmark:** 18 capabilities · **Built** 10 · **Partial** 6 · **Missing** 2
> **Gap items in this file:** 8
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Occupancy, ADR, RevPAR, On-the-books position, Pace and pickup, Demand forecast, Market segment and source statistics, Revenue forecast by stream, Channel profitability, Group displacement analysis, Overbooking optimization, Competitive rate shopping

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-06-01](#pms-06-01) | Budget entry and variance | PARTIAL | Competitive | P1 | S | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-02](#pms-06-02) | RMS integration | MISSING | Competitive | P1 | M | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-03](#pms-06-03) | TRevPAR and RevPAG | PARTIAL | Competitive | P1 | S | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-04](#pms-06-04) | Unconstrained demand | PARTIAL | Enterprise | P2 | M | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-05](#pms-06-05) | Length-of-stay optimization | MISSING | Enterprise | P2 | L | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-06](#pms-06-06) | Automated yield triggers | PARTIAL | Enterprise | P2 | M | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-07](#pms-06-07) | GOPPAR and departmental profitability | PARTIAL | Enterprise | P2 | M | [WS-21](WORKSTREAMS.md#ws-21) |
| [PMS-06-08](#pms-06-08) | What-if pricing simulation | PARTIAL | Enterprise | P2 | M | [WS-21](WORKSTREAMS.md#ws-21) |

---

### PMS-06-01

**Budget entry and variance** — PARTIAL · Competitive · P1 · Effort S · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** A variance endpoint reads revenue_goals; no budget entry surface.

**Fix:** The variance endpoint reads `revenue_goals`; there is no way to enter a budget.

### PMS-06-02

**RMS integration** — MISSING · Competitive · P1 · Effort M · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** No external revenue-management system connector.

**Fix:** Export the demand and constraint picture; import recommendations.

### PMS-06-03

**TRevPAR and RevPAG** — PARTIAL · Competitive · P1 · Effort S · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** Room revenue only; non-room streams are not aggregated.

**Fix:** Aggregate non-room revenue streams — depends on POS postings landing (WS-10).

### PMS-06-04

**Unconstrained demand** — PARTIAL · Enterprise · P2 · Effort M · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** demand_calendar / demand_scenarios store it; nothing derives it.

**Fix:** Derive from denials (WS-04 turnaway capture) plus regret — the tables are ready, the input is not.

### PMS-06-05

**Length-of-stay optimization** — MISSING · Enterprise · P2 · Effort L · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** LOS controls on top of the restriction engine (WS-02).

### PMS-06-06

**Automated yield triggers** — PARTIAL · Enterprise · P2 · Effort M · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** hurdle_rates and competitive-response rules are stored; no trigger runs them.

**Fix:** A runner that moves the BAR tier when occupancy or pace crosses a hurdle. Rules are stored; nothing executes them.

### PMS-06-07

**GOPPAR and departmental profitability** — PARTIAL · Enterprise · P2 · Effort M · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** Departmental revenue report exists; no cost side.

**Fix:** Departmental revenue exists; the cost side does not.

### PMS-06-08

**What-if pricing simulation** — PARTIAL · Enterprise · P2 · Effort M · [WS-21](WORKSTREAMS.md#ws-21)

**Today:** pricing_experiments / demand_scenarios tables, no simulator.

**Fix:** Simulator over `demand_scenarios` and `pricing_experiments`.


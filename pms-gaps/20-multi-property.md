# Domain 20 — Multi-Property, Chain & Enterprise

> **Benchmark:** 16 capabilities · **Built** 1 · **Partial** 1 · **Missing** 14
> **Gap items in this file:** 15
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Multi-property tenancy

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-20-01](#pms-20-01) | Cross-property availability | MISSING | Competitive | P1 | XL | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-02](#pms-20-02) | Enterprise reporting rollups | MISSING | Competitive | P1 | M | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-03](#pms-20-03) | Property onboarding workflow | PARTIAL | Competitive | P1 | S | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-04](#pms-20-04) | Central reservation office | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-05](#pms-20-05) | Central profiles | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-06](#pms-20-06) | Central rate management | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-07](#pms-20-07) | Central loyalty | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-08](#pms-20-08) | Central sales and lead sending | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-09](#pms-20-09) | Cross-property posting and routing | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-10](#pms-20-10) | Cross-property itinerary | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-11](#pms-20-11) | Brand standards governance | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-12](#pms-20-12) | Franchise and management fee calculation | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-13](#pms-20-13) | Mixed-use support | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-14](#pms-20-14) | Vacation ownership | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |
| [PMS-20-15](#pms-20-15) | Data residency per region | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |

---

### PMS-20-01

**Cross-property availability** — MISSING · Competitive · P1 · Effort XL · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** Availability queries are per property.

**Fix:** Availability across properties in one tenant; the first real chain capability and the prerequisite for most of this domain.

### PMS-20-02

**Enterprise reporting rollups** — MISSING · Competitive · P1 · Effort M · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** Every report is scoped to one property.

**Fix:** Every report is property-scoped; add a portfolio scope.

### PMS-20-03

**Property onboarding workflow** — PARTIAL · Competitive · P1 · Effort S · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** tenants/bootstrap creates a tenant; no guided property onboarding.

**Fix:** `tenants/bootstrap` creates a tenant; a guided property onboarding is a different thing.

### PMS-20-04

**Central reservation office** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** A CRO booking surface over cross-property availability.

### PMS-20-05

**Central profiles** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** One profile across properties — depends on WS-13.

### PMS-20-06

**Central rate management** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Rates defined centrally, inherited per property — depends on WS-03 hierarchy.

### PMS-20-07

**Central loyalty** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Depends on WS-14.

### PMS-20-08

**Central sales and lead sending** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Leads routed between properties.

### PMS-20-09

**Cross-property posting and routing** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Charge posted at one property, routed to a folio at another.

### PMS-20-10

**Cross-property itinerary** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** One itinerary spanning properties.

### PMS-20-11

**Brand standards governance** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Config templates enforced from the chain level.

### PMS-20-12

**Franchise and management fee calculation** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Fee calculation over property revenue.

### PMS-20-13

**Mixed-use support** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Residential and commercial units alongside hotel rooms.

### PMS-20-14

**Vacation ownership** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Ownership intervals and exchange.

### PMS-20-15

**Data residency per region** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Per-region storage — pairs with WS-24 deployment topology.


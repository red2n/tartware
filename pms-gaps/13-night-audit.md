# Domain 13 — Night Audit & Day Close

> **Benchmark:** 14 capabilities · **Built** 8 · **Partial** 3 · **Missing** 3
> **Gap items in this file:** 6
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Business date management, Pre-audit validation, Room and tax posting, No-show processing, Date roll, Trial balance, Out-of-balance detection and reporting, Re-run protection and full audit trail

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-13-01](#pms-13-01) | Audit report pack | PARTIAL | Table stakes | P0 | M | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-13-02](#pms-13-02) | Fixed charge and package posting | PARTIAL | Competitive | P1 | S | [WS-19](WORKSTREAMS.md#ws-19) |
| [PMS-13-03](#pms-13-03) | Automatic scheduled EOD | PARTIAL | Competitive | P1 | S | [WS-19](WORKSTREAMS.md#ws-19) |
| [PMS-13-04](#pms-13-04) | Report distribution | MISSING | Competitive | P1 | M | [WS-19](WORKSTREAMS.md#ws-19) |
| [PMS-13-05](#pms-13-05) | Income audit | MISSING | Enterprise | P2 | L | [WS-19](WORKSTREAMS.md#ws-19) |
| [PMS-13-06](#pms-13-06) | Multi-property staged rollover | MISSING | Enterprise | P2 | L | [WS-19](WORKSTREAMS.md#ws-19) |

---

### PMS-13-01

**Audit report pack** — PARTIAL · Table stakes · P0 · Effort M · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Individual reports exist; no bundled night-audit pack.

**Fix:** Bundle the night-audit reports into one rendered pack.

### PMS-13-02

**Fixed charge and package posting** — PARTIAL · Competitive · P1 · Effort S · [WS-19](WORKSTREAMS.md#ws-19)

**Today:** Package allocation calculators exist; night audit does not post recurring or package charges.

**Fix:** Night audit must post `reservation_fixed_charges` (WS-05) and package elements; today it posts room and tax only.

### PMS-13-03

**Automatic scheduled EOD** — PARTIAL · Competitive · P1 · Effort S · [WS-19](WORKSTREAMS.md#ws-19)

**Today:** Runs are recorded and re-run protected; the trigger is manual.

**Fix:** Scheduled trigger with the existing re-run protection; the run itself is solid.

### PMS-13-04

**Report distribution** — MISSING · Competitive · P1 · Effort M · [WS-19](WORKSTREAMS.md#ws-19)

**Today:** No distribution step.

**Fix:** Email the rendered pack (WS-06) to a distribution list.

### PMS-13-05

**Income audit** — MISSING · Enterprise · P2 · Effort L · [WS-19](WORKSTREAMS.md#ws-19)

**Today:** Not modelled.

**Fix:** Revenue verification pass over the closed day.

### PMS-13-06

**Multi-property staged rollover** — MISSING · Enterprise · P2 · Effort L · [WS-19](WORKSTREAMS.md#ws-19)

**Today:** Business date is per property; no staged chain rollover.

**Fix:** Depends on WS-23.


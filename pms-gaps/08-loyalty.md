# Domain 08 — Loyalty & Memberships

> **Benchmark:** 16 capabilities · **Built** 4 · **Partial** 4 · **Missing** 8
> **Gap items in this file:** 12
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Multiple membership programmes, Tier definitions and qualification, Point statement and history, Award redemption

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-08-01](#pms-08-01) | Point earn rules | PARTIAL | Competitive | P1 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-02](#pms-08-02) | Point expiry and extension | MISSING | Competitive | P1 | M | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-03](#pms-08-03) | Enrollment at booking and check-in | MISSING | Competitive | P1 | M | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-04](#pms-08-04) | Recognition at arrival | PARTIAL | Competitive | P1 | S | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-05](#pms-08-05) | Member-only rates | MISSING | Competitive | P1 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-08-06](#pms-08-06) | Certificates and vouchers | PARTIAL | Enterprise | P2 | M | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-07](#pms-08-07) | Automatic member discounting | MISSING | Enterprise | P2 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-08](#pms-08-08) | Missing-stay claims | MISSING | Enterprise | P2 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-09](#pms-08-09) | Suspended and unmatched stays | MISSING | Enterprise | P2 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-10](#pms-08-10) | External loyalty integration | MISSING | Enterprise | P2 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-11](#pms-08-11) | Partner earn and exchange rates | MISSING | Enterprise | P2 | L | [WS-14](WORKSTREAMS.md#ws-14) |
| [PMS-08-12](#pms-08-12) | Points liability reporting | PARTIAL | Enterprise | P2 | M | [WS-14](WORKSTREAMS.md#ws-14) |

---

### PMS-08-01

**Point earn rules** — PARTIAL · Competitive · P1 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** loyalty_program_economics plus money-to-points calculators; no rule engine that accrues on stay close.

**Fix:** A rule engine that accrues on stay close: eligible revenue × tier multiplier × promo. Calculators exist; nothing triggers them.

### PMS-08-02

**Point expiry and extension** — MISSING · Competitive · P1 · Effort M · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No expiry model.

**Fix:** Expiry policy per programme with an expiry job and extension on qualifying activity.

### PMS-08-03

**Enrollment at booking and check-in** — MISSING · Competitive · P1 · Effort M · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No enrol action in either flow.

**Fix:** Enrol action in both flows, writing to `guest_loyalty_programs`.

### PMS-08-04

**Recognition at arrival** — PARTIAL · Competitive · P1 · Effort S · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** VIP and loyalty appear on the check-in brief; no tier-driven treatment.

**Fix:** Tier-driven treatment on the check-in brief — amenities, upgrade eligibility, rate.

### PMS-08-05

**Member-only rates** — MISSING · Competitive · P1 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Depends on rate eligibility rules, which do not exist.

**Fix:** An eligibility rule of type `MEMBERSHIP_TIER`.

### PMS-08-06

**Certificates and vouchers** — PARTIAL · Enterprise · P2 · Effort M · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** reward_catalog covers awards; no certificate issue-and-burn.

**Fix:** Certificate issue, hold and burn against `reward_catalog`.

### PMS-08-07

**Automatic member discounting** — MISSING · Enterprise · P2 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** An eligibility rule (WS-03) plus a discount applied at quote time.

### PMS-08-08

**Missing-stay claims** — MISSING · Enterprise · P2 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Claim workflow matching a past stay to a member.

### PMS-08-09

**Suspended and unmatched stays** — MISSING · Enterprise · P2 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Queue of stays that could not be matched to a member.

### PMS-08-10

**External loyalty integration** — MISSING · Enterprise · P2 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Provider interface for a chain loyalty system.

### PMS-08-11

**Partner earn and exchange rates** — MISSING · Enterprise · P2 · Effort L · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Partner programmes and exchange rates.

### PMS-08-12

**Points liability reporting** — PARTIAL · Enterprise · P2 · Effort M · [WS-14](WORKSTREAMS.md#ws-14)

**Today:** Economics table exists; no liability report.

**Fix:** Outstanding point liability from `loyalty_program_economics` — a finance requirement, not a marketing one.


# Domain 05 — Rates & Pricing

> **Benchmark:** 26 capabilities · **Built** 14 · **Partial** 7 · **Missing** 5
> **Gap items in this file:** 12
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Rate code master, Rate seasons and date ranges, Rate detail by room type, Occupancy-based pricing, Tax and fee configuration, City / tourist / occupancy tax, VAT / GST handling, Packages and package elements, Package revenue allocation, Promotions with usage caps, Rate calendar bulk edit, Multi-currency rates, Tax exemption handling, Best-rate / rate recommendation

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-05-01](#pms-05-01) | Day-of-week pricing | PARTIAL | Table stakes | P0 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-02](#pms-05-02) | Rate change log | PARTIAL | Table stakes | P0 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-03](#pms-05-03) | Rate categories and groups | PARTIAL | Competitive | P1 | S | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-04](#pms-05-04) | Derived and dynamic rates | PARTIAL | Competitive | P1 | S | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-05](#pms-05-05) | Rate strategies / BAR tiers | MISSING | Competitive | P1 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-06](#pms-05-06) | Negotiated rates | PARTIAL | Competitive | P1 | S | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-07](#pms-05-07) | Rate eligibility rules | MISSING | Competitive | P1 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-08](#pms-05-08) | Rate availability by channel | MISSING | Competitive | P1 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-09](#pms-05-09) | Yieldable vs non-yieldable flags | MISSING | Competitive | P1 | M | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-10](#pms-05-10) | Rounding and minor-unit rules | PARTIAL | Competitive | P1 | S | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-11](#pms-05-11) | Rate hierarchy and inheritance | MISSING | Enterprise | P2 | L | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-05-12](#pms-05-12) | Rate parity monitoring | PARTIAL | Enterprise | P2 | M | [WS-03](WORKSTREAMS.md#ws-03) |

---

### PMS-05-01

**Day-of-week pricing** — PARTIAL · Table stakes · P0 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** pricing_rules can express it; rate_calendar is per stay_date so DOW is implied, not modelled.

**Fix:** Express DOW in `pricing_rules` and have the resolver apply it when generating `rate_calendar` rows, so the calendar stays the single read surface.

### PMS-05-02

**Rate change log** — PARTIAL · Table stakes · P0 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** rate_overrides plus generic audit_logs; no rate-specific history view.

**Fix:** Write every rate and rate_calendar mutation to a `rate_change_log` — auditors ask for this first.

### PMS-05-03

**Rate categories and groups** — PARTIAL · Competitive · P1 · Effort S · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** rate_types only.

**Fix:** Extend `rate_types` into a category tree the rate list groups by.

### PMS-05-04

**Derived and dynamic rates** — PARTIAL · Competitive · P1 · Effort S · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** A derived-rate calculator and ML pricing tables; no derived rate that resolves at quote time.

**Fix:** `rates.derived_from_rate_id` + adjustment; resolve at quote time, never store the derived amount.

### PMS-05-05

**Rate strategies / BAR tiers** — MISSING · Competitive · P1 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** No BAR ladder.

**Fix:** Add `rate_strategy_tiers` + an active tier per date on `rate_calendar`; the resolver picks the tier's rate.

### PMS-05-06

**Negotiated rates** — PARTIAL · Competitive · P1 · Effort S · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** companies and contract_agreements exist; no profile-to-rate resolution at booking.

**Fix:** Link `companies`/`travel_agents` to rates through `negotiated_rates`; resolution reads it when the reservation carries a company_id.

### PMS-05-07

**Rate eligibility rules** — MISSING · Competitive · P1 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** No gating by membership, corporate ID, promo, geography or advance purchase.

**Fix:** Add `rate_eligibility_rules` (rate_id, rule_type, value). Resolution refuses ineligible rates at quote time; this is the gate member-only and negotiated rates both hang off.

### PMS-05-08

**Rate availability by channel** — MISSING · Competitive · P1 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Rates are property-wide.

**Fix:** An eligibility rule of type `CHANNEL`.

### PMS-05-09

**Yieldable vs non-yieldable flags** — MISSING · Competitive · P1 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** No yieldability flag on the rate.

**Fix:** Boolean on `rates`; the yield trigger runner in WS-21 only touches yieldable ones.

### PMS-05-10

**Rounding and minor-unit rules** — PARTIAL · Competitive · P1 · Effort S · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Known gap — FX conversion and minor-unit rounding are inconsistent across services.

**Fix:** Centralise minor-unit handling in one schema-side money utility and route every service through it. Known live inconsistency — see the multi-currency findings memory.

### PMS-05-11

**Rate hierarchy and inheritance** — MISSING · Enterprise · P2 · Effort L · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Flat rate list.

**Fix:** Parent rate + override layers, resolved in order: property default → season → rate → date.

### PMS-05-12

**Rate parity monitoring** — PARTIAL · Enterprise · P2 · Effort M · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** channel_rate_parity table with almost no consumer.

**Fix:** `channel_rate_parity` already exists; needs a comparison job against `competitor_rates` and an alert rule.


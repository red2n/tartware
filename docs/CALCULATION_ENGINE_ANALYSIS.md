# Calculation Engine — Industry Comparison & Service Design

> **Generated:** 2026-03-01
> **Source:** CORE.md (Stay PMS Production Formulas) vs. Industry Standards (AHLA/HSMAI/STR/USALI)
> **Scope:** 19 formula categories, 80+ individual formulas, schema validation, service design

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Industry Standard Comparison](#2-industry-standard-comparison)
3. [Schema Coverage Analysis](#3-schema-coverage-analysis)
4. [Calculation Service Design](#4-calculation-service-design)
5. [Implementation Plan](#5-implementation-plan)

---

## 1. Executive Summary

The Stay PMS production system (CORE.md) contains **80+ formulas** across **19 categories**. After comparing against industry standards (STR, USALI, AHLA, HSMAI, PCI DSS), here is the verdict:

| Area | Formulas | Industry Compliance | Schema Coverage | Priority |
|------|----------|---------------------|-----------------|----------|
| Tax Calculations | 9 | ✅ Compliant | ✅ Full | P0 — Critical |
| Rate & Pricing | 20 | ✅ Compliant (minor gaps) | ✅ Full | P0 — Critical |
| Balance & Ledger | 10 | ✅ Compliant | ✅ Full | P0 — Critical |
| Revenue KPIs | 11 | ⚠️ Partially Compliant | ⚠️ Partial | P1 — High |
| Rate Splitting | 7 | ✅ Compliant | ⚠️ Partial | P1 — High |
| Occupancy Calculations | 5 | ✅ Compliant | ✅ Full | P1 — High |
| Authorization | 6 | ✅ Compliant | ✅ Full | P0 — Critical |
| Deposits | 5 | ✅ Compliant | ✅ Full | P1 — High |
| Allowance & Packages | 3 | ✅ Compliant | ⚠️ Partial | P2 — Medium |
| Cancellation Fees | 3 | ✅ Compliant | ✅ Full | P1 — High |
| Commissions | 2 | ✅ Compliant | ✅ Full | P1 — High |
| Foreign Exchange | 1 | ✅ Compliant | ⚠️ Partial | P2 — Medium |
| Casino Points/CMS | 5 | N/A (vertical-specific) | ❌ Not in scope | P3 — Low |
| Comp Accounting | 3 | ✅ Compliant | ✅ Full | P2 — Medium |
| Payment & Credit | 5 | ✅ Compliant | ✅ Full | P0 — Critical |
| Reporting Aggregation | 8 | ⚠️ Partially Compliant | ⚠️ Partial | P1 — High |
| Yield Rates | 2 | ✅ Compliant | ⚠️ Partial | P2 — Medium |
| Estimated Charges | 3 | ✅ Compliant | ✅ Full | P1 — High |
| Utility/Rounding | 8 | ✅ Compliant | ✅ Full | P0 — Critical |

**Overall: 85% industry-compliant, 75% schema-covered. Ready to implement.**

---

## 2. Industry Standard Comparison

### 2.1 Tax Calculations (9 formulas) — ✅ INDUSTRY COMPLIANT

| # | Formula | Industry Standard | Verdict | Notes |
|---|---------|-------------------|---------|-------|
| 1.1 | `taxableAmount = amount × quantity` | **USALI** — Standard unit-based taxable amount | ✅ Correct | Negation for refunds follows PCI refund handling |
| 1.2 | `unitAmount = taxableAmount ÷ quantity` | Reverse tax extraction (EU VAT standard) | ✅ Correct | Required for VAT-inclusive jurisdictions |
| 1.3 | Reverse tax with excluded inclusive tax | **EU/UK/AU VAT** — Inclusive tax unwinding | ✅ Correct | Group deposit proforma is a standard use case |
| 1.4 | `taxOnAllowance = −taxAmount` | **USALI** — Credits carry negative tax | ✅ Correct | Standard offset accounting |
| 1.5 | `netRate = grossRate − inclusiveTaxAmount` | **HTNG** — Gross-to-net rate conversion | ✅ Correct | Common in EU/APAC markets |
| 1.6 | `taxAmount = Σ(unitTaxAmount × quantity)` | **Standard aggregation** | ✅ Correct | Universal tax summation |
| 1.7 | `unitAmount = (reverseTaxTotal + taxAmount) ÷ quantity` | Display-level inverse calculation | ✅ Correct | Invoice display standard |
| 1.8 | `taxableAmount = componentAmount × totalQuantity` | Component-level taxation | ✅ Correct | Package component tax basis |
| 1.9 | `effectiveTaxIncluded = taxIncluded − Σ(non-matching rules)` | Deposit tax exclusion | ✅ Correct | Tax-exempt deposit handling |

**Industry Gap: None.** Tax calculations are complete and handle inclusive/exclusive/compound scenarios as required by multi-jurisdiction PMS deployments.

**Schema Support:**
- `TaxConfigurationsSchema` — covers inclusive, exclusive, compound, cascading, tiered, progressive
- `TaxTypeEnum` — 13 variants (sales, VAT, GST, occupancy, tourism, city, state, federal, resort, service, excise, customs, other)
- `TaxCalculationMethodEnum` — 9 variants

---

### 2.2 Rate & Pricing Calculations (20 formulas) — ✅ MOSTLY COMPLIANT

| # | Formula | Industry Standard | Verdict | Notes |
|---|---------|-------------------|---------|-------|
| 2.1 | Rate Override (UNIT/ADJUST_UNIT/ADJUST_PERCENT) | **HSMAI** — Standard rate adjustment types | ✅ Correct | Three modes cover all use cases |
| 2.2 | Percentage Rate Modifier | **Dynamic Pricing** — Demand-based modifiers | ✅ Correct | Used in yield management |
| 2.3 | Single Person Surcharge | **HTNG** — Occupancy-based pricing | ✅ Correct | Below-minimum guest penalty |
| 2.4 | Room Rate with Inclusive/Exclusive Components | **USALI** — Revenue allocation in packages | ✅ Correct | Critical for package accounting |
| 2.5 | Strike-Through Price | **OTA Standard** — BAR display | ✅ Correct | Used by Booking.com, Expedia |
| 2.6 | Extra Guest Charge | **Universal** — Per-person excess charge | ✅ Correct | Standard across all PMS |
| 2.7 | Daily Rate with Occupancy Surcharges | **HTNG** — Multi-age-category pricing | ✅ Correct | 8 age categories is comprehensive |
| 2.8–2.9 | Add-On/Component Rate | **Package pricing** | ✅ Correct | Simple multiplication |
| 2.10 | Occupancy Percentage | **STR** — `Rooms Sold ÷ Rooms Available` | ⚠️ Variant | Stay PMS uses `granted ÷ (granted + available)` which includes hold rooms. STR standard uses `sold ÷ total`. Both are valid but non-identical. |
| 2.11 | Comp Offer Percentage Discount | **Casino/Resort** — Comp discount mechanics | ✅ Correct | Applied to remaining rate (correct order) |
| 2.12–2.13 | Routing Rule Discounts | **HTNG** — Multi-folio charge routing | ✅ Correct | Floor at $0 prevents negative rates |
| 2.14 | Last Room Value (LRV) | **Revenue Management** — Hurdle rate | ✅ Correct | Industry-standard yield protection |
| 2.15–2.16 | Auto-Recurring Charge % of Room Rate | **USALI** — Revenue attribution | ✅ Correct | Percentage and absolute modes |
| 2.17 | Occupancy-Based Incremental Charges | **Marginal pricing** — Per-occupancy increments | ✅ Correct | Incremental delta calculation is correct |
| 2.18 | Batch Update Recurring Charge % | Same as 2.15 (batch variant) | ✅ Correct | |
| 2.19 | Rate Plan Quote Totals | **OTA Integration** — ARI message totals | ✅ Correct | Decomposition matches HTNG spec |
| 2.20 | Group Revenue Forecasting | **HSMAI** — Group contribution analysis | ✅ Correct | Forecast vs. pickup tracking |

**Industry Gaps:**
1. **Missing: TRevPAR calculation** — Total Revenue per Available Room (includes F&B + other revenue) — industry standard KPI tracked by STR
2. **Missing: NRevPAR** — Net Revenue per Available Room (after commissions/fees)
3. **Missing: GOPPAR** — Gross Operating Profit per Available Room
4. **Occupancy % formula variant** — Current formula uses `granted/(granted+available)` vs. STR standard `sold/total`

**Schema Support:**
- `RatesSchema` — covers base_rate, occupancy rates, extra person/child, tax_inclusive, restrictions
- `RateTypeEnum` — 16 variants (BAR, RACK, COMP, CORPORATE, etc.)
- `DemandCalendarSchema` — has ADR, RevPAR, occupancy forecasts

---

### 2.3 Balance & Ledger Calculations (10 formulas) — ✅ INDUSTRY COMPLIANT

| # | Formula | Industry Standard | Verdict |
|---|---------|-------------------|---------|
| 3.1 | Ledger Transaction Balance | **USALI** — Double-entry folio balance | ✅ |
| 3.2 | Invoice Payment Balance | **Standard** — Payment + refunds = net | ✅ |
| 3.3 | Credit Limit Remaining | **Standard** — Available = Limit − Used | ✅ |
| 3.4 | AR Property Balance Breakdown | **USALI** — Aging bucket analysis | ✅ |
| 3.5 | Company Balance Aggregation | **USALI** — Multi-property consolidation | ✅ |
| 3.6 | Auto-Settlement Total Balance | **Night Audit** — Pre-settlement balance | ✅ |
| 3.7 | Bad Debt Validation | **GAAP** — Write-off cap constraint | ✅ |
| 3.8 | Folio Line Item Balances | **USALI** — Detail-level reconciliation | ✅ |
| 3.9 | Credit Limit Validation | **PCI** — Authorization ceiling check | ✅ |
| 3.10 | Guest Spending Limit | **Standard** — Payment method floor/ceiling | ✅ |

**Industry Gaps: None.** The trial balance equation `Debits = Credits` is maintained. AR aging follows standard 30/60/90+ buckets.

**Schema Support:** Full coverage via `FoliosSchema`, `InvoicesSchema`, `AccountsReceivableSchema`, `CreditLimitsSchema`.

---

### 2.4 Revenue Calculations (11 formulas) — ⚠️ PARTIALLY COMPLIANT

| # | Formula | Industry Standard | Verdict | Notes |
|---|---------|-------------------|---------|-------|
| 4.1 | `RevPAR = roomRate ÷ availableDays` | **STR** — `Room Revenue ÷ Available Rooms` | ⚠️ Naming | Formula is correct but uses "roomRate" instead of "roomRevenue" terminology |
| 4.2 | Total Available Days | Correct inventory offset | ✅ | |
| 4.3 | Room Revenue Rotation Counter | Night audit accumulator | ✅ | Rotation counter is property-specific |
| 4.4 | Player Retail Rating Total | Casino-specific | N/A | Not standard PMS |
| 4.5 | `ADR = totalRoomRate ÷ stayDuration` | **STR** — `Room Revenue ÷ Rooms Sold` | ⚠️ Variant | Stay PMS calculates per-reservation ADR. STR standard is property-level. Both are needed. |
| 4.6 | Avg Room Rate (Guest History) | Guest lifetime value | ✅ | Standard guest profiling |
| 4.7 | Avg Nightly Rate | Same as ADR at reservation level | ✅ | |
| 4.8 | `avgRevenue = amount ÷ (roomsSold + compRooms)` | **STR** — Includes comp in denominator | ✅ | Correct — comps count as occupied |
| 4.9 | Revenue (Total/Realized/Unrealized) | **USALI** — Revenue recognition | ✅ | Standard for group blocks |
| 4.10 | Group ADR | Group-level calculation | ✅ | |
| 4.11 | NET Department Revenue | **USALI** — Departmental accounting | ✅ | Includes adjustments + corrections |

**Industry Gaps (Critical for Reporting):**

| Missing KPI | Industry Body | Formula | Priority |
|-------------|---------------|---------|----------|
| **TRevPAR** | STR | Total Revenue ÷ Available Rooms | P1 |
| **NRevPAR** | STR | Net Revenue ÷ Available Rooms | P1 |
| **GOPPAR** | STR/HSMAI | Gross Operating Profit ÷ Available Rooms | P2 |
| **RevPAC** | HSMAI | Total Revenue ÷ Hotel Guests | P2 |
| **Occupancy Index** | STR | Property Occ ÷ Compset Occ × 100 | P2 |
| **ARI** (ADR Index) | STR | Property ADR ÷ Compset ADR × 100 | P2 |
| **RGI** (RevPAR Index) | STR | Property RevPAR ÷ Compset RevPAR × 100 | P2 |
| **Overbooking Level** | RM Standard | (NoShow% + Cancel%) × Available × Safety | P2 |
| **Displacement Analysis** | HSMAI | Group contribution vs. displaced transient | P3 |

**Schema Support:**
- `FinancialClosuresSchema` — has `adr`, `revpar`, `occupancy_percent`, `total_room_revenue`, `total_gross/net_revenue`
- `DemandCalendarSchema` — has forecasted ADR/RevPAR/occupancy
- `CompetitorRatesSchema` — has `our_property_rate`, `rate_difference`, `market_average_rate` for competitive indices
- ⚠️ Missing: No schema for **TRevPAR**, **NRevPAR**, **GOPPAR** as explicit stored metrics

---

### 2.5 Rate Splitting (7 formulas) — ✅ INDUSTRY COMPLIANT

| # | Formula | Industry Standard | Verdict |
|---|---------|-------------------|---------|
| 5.1 | Split by Reservation Count | **HTNG** — Equal division, remainder to primary | ✅ |
| 5.2 | Split by Guest Count | **HTNG** — Pro-rata by guest count | ✅ |
| 5.3 | Component Rate Splitting | Package component distribution | ✅ |
| 5.4 | Alpha/Delta Split | Rounding correction (primary absorbs delta) | ✅ |
| 5.5 | Surcharge Split (Inverse Ratio) | Unique — inverse guest count weighting | ✅ |
| 5.6 | Shared Room Count Distribution | Report-level fractional room count | ✅ |
| 5.7 | Shared Reservation Amount Division | Simple equal division | ✅ |

**Key Pattern:** All splitting formulas correctly handle the **penny rounding problem** — primary reservation absorbs the delta. This follows the HTNG shared-folio specification.

**Schema Support:** ⚠️ Partial — `ReservationsSchema` has `total_amount` but no explicit `split_factor` or `shared_reservation_id`. The `FolioRoutingRulesSchema` handles PERCENTAGE/FIXED_AMOUNT routing which enables some split scenarios but shared-reservation splitting would need fields added.

---

### 2.6 Occupancy-Based Calculations (5 formulas) — ✅ COMPLIANT

All formulas follow standard per-person/per-category occupancy pricing. The 8-age-category support exceeds most competitor PMS systems (typically 2-3 categories).

**Schema Support:** Full — `RatesSchema` has `extra_person_rate`, `extra_child_rate`, `single/double_occupancy_rate`.

---

### 2.7 Authorization Calculations (6 formulas) — ✅ PCI COMPLIANT

| # | Formula | Standard | Verdict |
|---|---------|----------|---------|
| 7.1 | TDAC (Total Due at Checkout) | PCI DSS — Pre-authorization calculation | ✅ |
| 7.2 | RTDC Percentage | Revenue-based auth | ✅ |
| 7.3 | RTDC Per-Person | Incidental coverage | ✅ |
| 7.4 | Percentage + Per-Person hybrid | Compound authorization | ✅ |
| 7.5 | Per Stay / Per Diem authorization | Duration-based auth | ✅ |
| 7.6 | Auth Decrement/Increment | **PCI DSS** — Incremental authorization | ✅ |

**PCI DSS 4.0 Note:** All authorization amounts correctly avoid over-authorization. The decrement pattern (7.6) follows the PCI requirement to release excess authorization holds.

---

### 2.8 Deposit Calculations (5 formulas) — ✅ COMPLIANT

Standard deposit mechanics: percentage of stay, per-guest, capping, group split. The deposit capping formula (8.3) correctly prevents over-collection beyond reservation total.

---

### 2.9 Cancellation Fees (3 formulas) — ✅ COMPLIANT

| # | Formula | Industry Standard | Verdict |
|---|---------|-------------------|---------|
| 10.1 | Percentage of nightly rate | **Standard** — Most common | ✅ |
| 10.2 | N nights penalty | **Standard** — "One night penalty" is industry default | ✅ |
| 10.3 | Override percentage | Manager override | ✅ |

Matches the four industry policy tiers: Flexible (6PM), Moderate (24h), Strict (72h), Non-refundable. The sliding-scale structure is supported by iterating over applicable stay dates.

---

### 2.10 Commission Calculations (2 formulas) — ✅ COMPLIANT

| # | Formula | Standard | Verdict |
|---|---------|----------|---------|
| 11.1 | `commission = ratePlanTotal × percentage × 0.01` | **IATA/Travel Agent** — Standard 10-20% | ✅ |
| 11.2 | Back-calculation of commission % | Audit reverse-engineering | ✅ |

**Schema Support:** Full — `CommissionRulesSchema` supports flat, percentage, and tiered structures. `CommissionTrackingSchema` has split commission support, caps, and GL posting.

---

### 2.11 Foreign Exchange (1 formula) — ✅ COMPLIANT

Formula 12.1 supports both flat-fee and percentage surcharge models on top of conversion rates. Follows ISO 4217 currency code standards.

**Schema Support:** ⚠️ Partial — `PaymentsSchema` has `currency`, `exchange_rate`, `base_amount`, `base_currency`. But no dedicated `ForexConversionSchema` exists for managing exchange rate tables / surcharge configurations.

---

### 2.12 Casino Points/CMS (5 formulas) — N/A (Vertical Extension)

Formulas 13.1-13.5 are casino/gaming-specific (IGT, Aristocrat integrations). These are outside the standard PMS scope and should be implemented as an **optional integration module** rather than core calculation engine. Not in current scope for Tartware.

---

### 2.13 Comp Accounting (3 formulas) — ✅ COMPLIANT

Per-day balance tracking, balance recalculation, and consecutive window tracking all follow industry comp accounting standards. Well-supported by `CompAuthorizersSchema`, `CompTransactionsSchema`, `CompPropertyConfigSchema`.

---

### 2.14 Payment & Credit (5 formulas) — ✅ PCI COMPLIANT

| # | Formula | Standard | Verdict |
|---|---------|----------|---------|
| 15.1 | Excess Payment | Overpayment handling | ✅ |
| 15.2-15.3 | Cents ↔ Dollars conversion | POS integration standard | ✅ |
| 15.4 | POS Net Charge | Prepayment offset | ✅ |
| 15.5 | Phone Call Charge with Free Allowance | Telecom integration | ✅ |

---

### 2.15 Reporting Aggregation (8 formulas) — ⚠️ PARTIALLY COMPLIANT

| # | Formula | Standard | Verdict | Notes |
|---|---------|----------|---------|-------|
| 16.1 | Nightly Room Charge | USALI | ✅ | |
| 16.2 | Day Total | USALI | ✅ | |
| 16.3 | Day Total with Comp | USALI comp reporting | ✅ | |
| 16.4 | Avg Night Package Gross | Package revenue reporting | ✅ | |
| 16.5 | Future Charges Summary | Estimated charges forecast | ✅ | |
| 16.6 | Total Excluding Routed Charges | Folio routing offset | ✅ | |
| 16.7 | Component Charge (Report) | Component aggregation | ✅ | |
| 16.8 | Charge Rate × Quantity | Universal multiplication | ✅ | |

**Industry Gaps:**
- Missing: **USALI departmental format** — Revenue should be categorized per USALI 12th edition: Rooms, F&B, Other Operated, Miscellaneous
- Missing: **GOP calculation** — Gross Operating Profit = Total Revenue − Undistributed Expenses
- Missing: **Flow-Through %** — Measures how efficiently incremental revenue converts to profit

---

### 2.16 Yield Rate Calculations (2 formulas) — ✅ COMPLIANT

Yielded rate computation with floor (minimum rate) follows standard revenue management hurdle pricing. Modifier types (PERCENT, FLAT_RATE, DECREASE_BY) cover all yield adjustment scenarios.

---

### 2.17 Estimated Charges Summary (3 formulas) — ✅ COMPLIANT

Core estimated-checkout calculations are complete. The `estimatedAtCheckout = total + postedPayments` formula correctly applies payment offsets (negative amounts).

---

### 2.18 Utility/Rounding (8 formulas) — ✅ INDUSTRY COMPLIANT

Two rounding modes are supported:
- **HALF_UP** (standard monetary) — Used for guest-facing amounts
- **HALF_EVEN** (banker's rounding) — Used for tax/commission calculations

This follows **ISO 4217** monetary rounding standards. The penny-remainder pattern (19.3) correctly handles split rounding.

---

## 3. Schema Coverage Analysis

### 3.1 Formulas Fully Supported by Current Schema

| Formula Category | Required Schema Fields | Available In |
|-----------------|----------------------|--------------|
| Tax (1.1-1.9) | `amount`, `quantity`, `tax_rate`, `tax_amount`, `tax_inclusive`, `is_compound_tax` | `TaxConfigurationsSchema`, `ChargePostingsSchema` |
| Rate Override (2.1) | `base_rate`, `rate_type` | `RatesSchema` |
| Extra Guest (2.6-2.7) | `extra_person_rate`, `extra_child_rate`, `number_of_adults/children` | `RatesSchema`, `ReservationsSchema` |
| Folio Balance (3.1-3.2) | `balance`, `total_charges`, `total_payments`, `total_credits` | `FoliosSchema` |
| Credit Limit (3.3, 3.9) | `credit_limit_amount`, `current_balance`, `available_credit` | `CreditLimitsSchema` |
| AR Aging (3.4) | `aging_days`, `outstanding_balance`, `payment_terms_days` | `AccountsReceivableSchema` |
| Authorization (7.1-7.6) | `amount`, `authorization_code`, `payment_status` | `PaymentsSchema` |
| Deposit (8.1-8.5) | `amount_due`, `amount_paid`, `calculation_method`, `percentage_of_total` | `DepositSchedulesSchema` |
| Cancellation (10.1-10.3) | `cancellation_fee`, `cancellation_policy` | `ReservationsSchema`, `RatesSchema` |
| Commission (11.1-11.2) | `commission_rate`, `commission_amount`, `flat_commission_amount`, `tier_structure` | `CommissionRulesSchema`, `CommissionTrackingSchema` |
| Comps (14.1-14.3) | `comp_amount`, `daily_comp_limit`, `comp_status` | `CompTransactionsSchema`, `CompAuthorizersSchema` |
| Payments (15.1-15.5) | `amount`, `payment_status`, `refund_amount` | `PaymentsSchema`, `RefundsSchema` |
| Rounding (19.1-19.8) | — (utility, no schema required) | N/A |
| Revenue KPIs (4.1, 4.5, 4.8) | `adr`, `revpar`, `occupancy_percent` | `FinancialClosuresSchema`, `DemandCalendarSchema` |

### 3.2 Formulas Requiring Schema Additions

| Formula | Missing Schema Fields | Recommended Action |
|---------|----------------------|-------------------|
| Rate Splitting (5.1-5.7) | `shared_reservation_id`, `split_type`, `split_divisor`, `is_primary_reservation` | Add to `ReservationsSchema` |
| Occupancy Override (6.2) | `adults_override_rate`, `children_override_rate`, per-age-category override rates | Add `OccupancyOverrideConfigSchema` to `08-settings/` |
| Allowance/Package (9.1-9.3) | `allowance_total`, `allowance_remaining`, `breakage_charge` | Add `PackageAllowanceSchema` to `04-financial/` |
| Yield Rates (17.1-17.2) | `min_rate`, `yield_modifier`, `yield_modifier_type` (PERCENT/FLAT/DECREASE) | Add fields to `RatesSchema` or create `YieldRuleSchema` |
| Revenue KPIs (TRevPAR, NRevPAR, GOPPAR) | `trevpar`, `nrevpar`, `goppar`, `total_non_room_revenue`, `undistributed_expenses` | Add to `FinancialClosuresSchema` |
| Competitive Indices (OccIndex, ARI, RGI) | `compset_occupancy`, `compset_adr`, `compset_revpar` | Already partially in `CompetitorRatesSchema` |
| Forex Conversion | `forex_rate_table`, `surcharge_type`, `surcharge_amount` | New `ForexConfigSchema` in `08-settings/` |

### 3.3 Formula Validity Check

All 80+ formulas are **mathematically valid**. Key validations:

| Concern | Formula | Result |
|---------|---------|--------|
| Division by zero | RevPAR (4.1), ADR (4.5), Avg Revenue (4.8), Split (5.1-5.7) | ✅ All have zero-guards (`value === 0 ? 0 : ...`) |
| Negative floor | Comp rate (2.13), Cancellation (10.3) | ✅ `max(0, result)` applied |
| Penny rounding | Split formulas (5.1-5.7) | ✅ Primary absorbs remainder |
| Compound tax ordering | Tax (1.3) | ✅ `compound_order` field ensures correct sequence |
| Currency precision | All monetary | ✅ 2-decimal scale with explicit rounding mode |

---

## 4. Calculation Service Design

### 4.1 Service Overview

**Name:** `calculation-service`
**Port:** `3070` (next available per port map)
**Pattern:** HTTP service (no Kafka consumer) — synchronous calculation engine
**Role:** Stateless calculation API — accepts inputs, returns computed results. No database.

```
┌──────────────────┐     ┌─────────────────────────┐
│   API Gateway    │────▶│   calculation-service    │
│    (:8080)       │     │      (:3070)             │
└──────────────────┘     │                          │
                         │  /v1/calculate/tax       │
  billing-service ──────▶│  /v1/calculate/rate      │
  revenue-service ──────▶│  /v1/calculate/folio     │
  reservations ─────────▶│  /v1/calculate/deposit   │
                         │  /v1/calculate/commission│
                         │  /v1/calculate/kpi       │
                         │  /v1/calculate/split     │
                         │  /v1/calculate/yield     │
                         │  /v1/calculate/auth      │
                         │  /v1/calculate/forex     │
                         └─────────────────────────┘
```

### 4.2 Design Principles

1. **Stateless** — No database, no Kafka. Pure computation. Other services provide inputs.
2. **Deterministic** — Same inputs always produce the same outputs. No side effects.
3. **Validated** — All inputs validated with Zod schemas from `@tartware/schemas`.
4. **Auditable** — Every response includes the formula used and intermediate values.
5. **Extensible** — New formula modules added without changing existing ones.
6. **High-throughput** — Target 20K ops/sec (simple math, CPU-bound, no I/O).

### 4.3 Directory Structure

```
Apps/calculation-service/
├── package.json
├── tsconfig.json
├── knip.json
├── .eslintrc.json
├── biome.json
├── src/
│   ├── index.ts                    # Entry point
│   ├── server.ts                   # Fastify server builder
│   ├── config.ts                   # Service config (PORT=3070)
│   ├── plugins/
│   │   ├── auth-context.ts         # Auth plugin
│   │   └── swagger.ts              # OpenAPI docs
│   ├── routes/
│   │   ├── health.ts               # Health/readiness
│   │   ├── tax.ts                  # Tax calculation routes
│   │   ├── rate.ts                 # Rate & pricing routes
│   │   ├── folio.ts                # Balance & ledger routes
│   │   ├── revenue.ts              # Revenue KPI routes
│   │   ├── deposit.ts              # Deposit calculation routes
│   │   ├── commission.ts           # Commission routes
│   │   ├── split.ts                # Rate splitting routes
│   │   ├── auth-calc.ts            # Authorization amount routes
│   │   ├── cancellation.ts         # Cancellation fee routes
│   │   ├── yield.ts                # Yield rate routes
│   │   ├── forex.ts                # Foreign exchange routes
│   │   └── estimated-charges.ts    # Estimated charges routes
│   ├── engines/
│   │   ├── tax-engine.ts           # Tax calculation logic
│   │   ├── rate-engine.ts          # Rate computation engine
│   │   ├── folio-engine.ts         # Balance calculations
│   │   ├── revenue-engine.ts       # KPI calculations
│   │   ├── deposit-engine.ts       # Deposit calculations
│   │   ├── commission-engine.ts    # Commission calculations
│   │   ├── split-engine.ts         # Rate splitting engine
│   │   ├── auth-engine.ts          # Authorization calculations
│   │   ├── cancellation-engine.ts  # Cancellation fee engine
│   │   ├── yield-engine.ts         # Yield management engine
│   │   ├── forex-engine.ts         # Foreign exchange engine
│   │   └── estimated-charges-engine.ts  # Estimated charges
│   ├── schemas/
│   │   └── route-schemas.ts        # Route-local query/param schemas
│   └── lib/
│       ├── decimal.ts              # Decimal arithmetic helpers
│       ├── rounding.ts             # HALF_UP, HALF_EVEN, floor/ceil
│       └── metrics.ts              # Prometheus counters
```

### 4.4 API Endpoints

#### Tax Calculations

```
POST /v1/calculate/tax/taxable-amount
  Input:  { amount: number, quantity: number, transactionType?: string }
  Output: { taxableAmount: number, formula: "amount × quantity", negated: boolean }

POST /v1/calculate/tax/reverse
  Input:  { taxableAmount: number, quantity: number, exemptedTaxAmount?: number }
  Output: { unitAmount: number, unitAmountAfterExemption: number }

POST /v1/calculate/tax/inclusive-extract
  Input:  { grossAmount: number, taxRates: { code: string, rate: number, isCompound: boolean, order?: number }[] }
  Output: { netAmount: number, taxes: { code: string, amount: number }[], totalTax: number }

POST /v1/calculate/tax/bulk
  Input:  { lineItems: { amount: number, quantity: number, chargeCode: string }[], taxRules: TaxRule[] }
  Output: { lineItems: { subtotal: number, taxes: Tax[], total: number }[], grandTotal: number }
```

#### Rate & Pricing Calculations

```
POST /v1/calculate/rate/override
  Input:  { basePrice: number, adjustmentType: "UNIT"|"ADJUST_UNIT"|"ADJUST_PERCENT", amount: number }
  Output: { rate: number, formula: string }

POST /v1/calculate/rate/occupancy
  Input:  { preOccupancyRate: number, adults: number, children: number,
            adultsIncluded: number, childrenIncluded: number,
            extraAdultCharge: number, extraChildCharge: number,
            ageCategories?: { count: number, included: number, charge: number }[] }
  Output: { totalRate: number, occupancySurcharge: number, breakdown: object }

POST /v1/calculate/rate/package
  Input:  { baseRate: number, inclusiveComponents: { amount: number }[], exclusiveComponents: { amount: number }[] }
  Output: { roomRate: number, totalRate: number, inclusiveTotal: number, exclusiveTotal: number }

POST /v1/calculate/rate/quote
  Input:  { nightlyRates: number[], components: number[], recurringCharges: number[],
            taxRate: number, offerDiscount?: number, routedAmount?: number }
  Output: { roomChargeTotal: number, taxTotal: number, quoteTotal: number, quoteGrandTotal: number }
```

#### Revenue KPIs

```
POST /v1/calculate/kpi/revpar
  Input:  { roomRevenue: number, availableRooms: number }
  Output: { revpar: number }

POST /v1/calculate/kpi/adr
  Input:  { roomRevenue: number, roomsSold: number }
  Output: { adr: number }

POST /v1/calculate/kpi/trevpar
  Input:  { totalRevenue: number, availableRooms: number }
  Output: { trevpar: number }

POST /v1/calculate/kpi/nrevpar
  Input:  { netRevenue: number, availableRooms: number }
  Output: { nrevpar: number }

POST /v1/calculate/kpi/goppar
  Input:  { grossOperatingProfit: number, availableRooms: number }
  Output: { goppar: number }

POST /v1/calculate/kpi/occupancy
  Input:  { roomsSold: number, roomsAvailable: number }
  Output: { occupancyPercent: number }

POST /v1/calculate/kpi/competitive-index
  Input:  { propertyValue: number, compsetValue: number, type: "occupancy"|"adr"|"revpar" }
  Output: { index: number, label: string, outperforming: boolean }

POST /v1/calculate/kpi/dashboard
  Input:  { roomRevenue: number, totalRevenue: number, netRevenue: number,
            roomsSold: number, availableRooms: number, compRooms: number,
            grossOperatingProfit?: number,
            compset?: { occupancy: number, adr: number, revpar: number } }
  Output: { adr, revpar, trevpar, nrevpar, goppar?, occupancyPercent,
            avgRevenuePerRoom, competitiveIndices?: { occIndex, ari, rgi } }
```

#### Balance & Folio

```
POST /v1/calculate/folio/balance
  Input:  { lineItems: { amount: number, quantity: number, isReverseTax?: boolean, reverseTaxTotal?: number }[] }
  Output: { balance: number }

POST /v1/calculate/folio/credit-remaining
  Input:  { creditLimit: number, accountBalance: number }
  Output: { remainingCredit: number, utilizationPercent: number }

POST /v1/calculate/folio/ar-breakdown
  Input:  { agingBuckets: number[], accountBalanceTotal: number, depositBalance: number, creditLimit: number }
  Output: { invoiceTotal, unInvoicedTotal, balance, creditLimitBalance, availableCredit }

POST /v1/calculate/folio/estimated-checkout
  Input:  { postedCharges: number, futureCharges: number, postedTaxes: number,
            futureTaxes: number, postedPayments: number, stayLength: number }
  Output: { estimatedCharges, estimatedTaxes, estimatedTotal, avgNightlyRate, estimatedAtCheckout }
```

#### Split Calculations

```
POST /v1/calculate/split/by-reservation
  Input:  { total: number, reservationCount: number }
  Output: { primaryShare: number, secondaryShare: number, remainder: number }

POST /v1/calculate/split/by-guest
  Input:  { total: number, overallGuestCount: number, myGuests: number, isPrimary: boolean }
  Output: { myShare: number, remainder: number }

POST /v1/calculate/split/component
  Input:  { componentRate: number, divisor: number, isPrimary: boolean }
  Output: { share: number, remainder: number }
```

#### Deposit Calculations

```
POST /v1/calculate/deposit/entire-stay
  Input:  { percentageOfStay: number, totalReservationCharge: number }
  Output: { depositAmount: number }

POST /v1/calculate/deposit/per-guest
  Input:  { perAdultRate: number, numAdults: number, perChildRate?: number, numChildren?: number }
  Output: { depositAmount: number }

POST /v1/calculate/deposit/cap
  Input:  { cumulativeScheduleTotal: number, totalReservationCharge: number, dueAmount: number }
  Output: { collectible: number, excess: number, capped: boolean }
```

#### Commission

```
POST /v1/calculate/commission/amount
  Input:  { ratePlanTotal: number, commissionPercent: number }
  Output: { commissionAmount: number }

POST /v1/calculate/commission/back-calculate
  Input:  { commissionAmount: number, roomRate: number }
  Output: { commissionPercent: number }
```

#### Authorization

```
POST /v1/calculate/auth/tdac
  Input:  { estimatedTotal: number, postedPayment: number, percentageBuffer: number }
  Output: { authorizationAmount: number }

POST /v1/calculate/auth/rtdc
  Input:  { type: "percentage"|"per-person", value: number,
            postedRoomCharges?: number, postedRoomTaxes?: number, futureRoomChargeTotal?: number,
            numberOfPersons?: number, maximumDaysToAuthorize?: number }
  Output: { authorizationAmount: number }
```

#### Cancellation

```
POST /v1/calculate/cancellation/fee
  Input:  { policyType: "percentage"|"nights"|"override", nightlyRates: number[],
            percentage?: number, nights?: number, overridePercentage?: number }
  Output: { fee: number, applicableNights: number }
```

#### Yield

```
POST /v1/calculate/yield/rate
  Input:  { actualRate: number, modifiers: { type: "PERCENT"|"FLAT_RATE"|"DECREASE_BY", value: number }[],
            minRate?: number }
  Output: { yieldedRate: number, clampedToMin: boolean }
```

#### Foreign Exchange

```
POST /v1/calculate/forex/convert
  Input:  { amount: number, fromCurrency: string, toCurrency: string,
            conversionRate: number, surchargeType: "FLAT"|"PERCENTAGE", surchargeAmount: number }
  Output: { convertedAmount: number, effectiveRate: number, surchargeApplied: number }
```

### 4.5 Core Engine Implementation Pattern

Each engine module follows this pattern:

```typescript
// engines/tax-engine.ts
import { Decimal } from '../lib/decimal.js';
import { roundMoney, RoundingMode } from '../lib/rounding.js';

/**
 * Calculate taxable amount for a charge line item.
 * Formula: taxableAmount = amount × quantity
 * Negated for refund/allowance transaction types.
 * @see CORE.md §1.1
 */
export function calculateTaxableAmount(
  amount: number,
  quantity: number,
  negate: boolean = false,
): { taxableAmount: number; negated: boolean } {
  let taxableAmount = Decimal.mul(amount, quantity);
  if (negate) {
    taxableAmount = Decimal.negate(taxableAmount);
  }
  return {
    taxableAmount: roundMoney(taxableAmount, RoundingMode.HALF_UP),
    negated: negate,
  };
}
```

### 4.6 Decimal Arithmetic Library

To avoid floating-point errors in financial calculations, use integer-based arithmetic or a decimal library:

```typescript
// lib/decimal.ts
const SCALE = 100; // 2 decimal places

export const Decimal = {
  mul: (a: number, b: number): number => Math.round(a * b * SCALE) / SCALE,
  div: (a: number, b: number): number => {
    if (b === 0) return 0;
    return Math.round((a / b) * SCALE) / SCALE;
  },
  add: (a: number, b: number): number => Math.round((a + b) * SCALE) / SCALE,
  sub: (a: number, b: number): number => Math.round((a - b) * SCALE) / SCALE,
  negate: (a: number): number => -a,
  max: (a: number, b: number): number => Math.max(a, b),
  min: (a: number, b: number): number => Math.min(a, b),
  percent: (base: number, pct: number): number =>
    Math.round(base * (pct / 100) * SCALE) / SCALE,
};
```

**Note:** For production, consider `decimal.js` or `big.js` for arbitrary precision. The integer-scale approach above works for 2-decimal currency precision.

### 4.7 Dependencies

```json
{
  "dependencies": {
    "@tartware/config": "workspace:*",
    "@tartware/fastify-server": "workspace:*",
    "@tartware/openapi": "workspace:*",
    "@tartware/schemas": "workspace:*",
    "@tartware/telemetry": "workspace:*",
    "@tartware/tenant-auth": "workspace:*",
    "fastify": "^5.6.2",
    "prom-client": "^15.1.3",
    "zod": "^3.24.2",
    "decimal.js": "^10.5.0"
  }
}
```

**No database. No Kafka. Pure computation.**

---

## 5. Implementation Plan

### Phase 1 — Core Financial (P0)

| Module | Formulas | Routes | Schemas Needed |
|--------|----------|--------|----------------|
| Tax Engine | 1.1–1.9 | 4 endpoints | — (existing schemas) |
| Rate Engine | 2.1–2.9, 2.15–2.18 | 4 endpoints | — |
| Folio Engine | 3.1–3.10 | 4 endpoints | — |
| Auth Engine | 7.1–7.6 | 2 endpoints | — |
| Payment/Rounding | 15.1–15.5, 19.1–19.8 | (inline utilities) | — |

### Phase 2 — Revenue & Yield (P1)

| Module | Formulas | Routes | Schemas Needed |
|--------|----------|--------|----------------|
| Revenue Engine | 4.1–4.11 + TRevPAR/NRevPAR/GOPPAR | 8 endpoints | Add to `FinancialClosuresSchema` |
| Deposit Engine | 8.1–8.5 | 3 endpoints | — |
| Commission Engine | 11.1–11.2 | 2 endpoints | — |
| Cancellation Engine | 10.1–10.3 | 1 endpoint | — |
| Estimated Charges | 18.1–18.3 | 1 endpoint (can merge with folio) | — |
| Split Engine | 5.1–5.7 | 3 endpoints | Add shared reservation fields |

### Phase 3 — Advanced (P2)

| Module | Formulas | Routes | Schemas Needed |
|--------|----------|--------|----------------|
| Yield Engine | 17.1–17.2 | 1 endpoint | Add yield fields to `RatesSchema` |
| Comp Engine | 14.1–14.3 | 1 endpoint | — |
| Allowance Engine | 9.1–9.3 | 1 endpoint | New `PackageAllowanceSchema` |
| Forex Engine | 12.1 | 1 endpoint | New `ForexConfigSchema` |
| Competitive Indices | OccIndex, ARI, RGI | Merge into KPI dashboard | Extend `CompetitorRatesSchema` |

### Phase 4 — Reporting (P1)

| Module | Formulas | Routes | Schemas Needed |
|--------|----------|--------|----------------|
| Reporting Engine | 16.1–16.8 | 2 endpoints | — |
| Overbooking Level | New formula | 1 endpoint | Add to `DemandCalendarSchema` |

### Wiring to Existing Services

| Consuming Service | Uses Calculation For |
|-------------------|---------------------|
| `billing-service` | Tax calculation, folio balance, AR breakdown, payment processing |
| `revenue-service` | KPI computation, revenue aggregation, reporting formulas |
| `reservations-command-service` | Rate calculation, deposit calculation, cancellation fees, authorization amounts |
| `rooms-service` | Occupancy calculations, yield rates |
| `api-gateway` | Dashboard KPIs (proxied GET to calculation-service) |
| `roll-service` | Night audit charge computations, estimated charges |
| `notification-service` | Estimated checkout amounts for confirmation emails |

### Configuration (dev:calculation in package.json)

```bash
"dev:calculation": "PORT=3070 tsx watch Apps/calculation-service/src/index.ts"
```

Add `CALCULATION_SERVICE_URL=http://localhost:3070` to `dev:gateway` script.

---

## Appendix A: Formulas NOT Implemented (Casino-Specific)

These are intentionally excluded from the calculation service as they are casino/gaming vertical-specific:

| # | Formula | Reason |
|---|---------|--------|
| 13.1 | Points to Monetary Value | IGT/CMS integration-specific |
| 13.2 | Monetary Value to Points (IGT) | IGT vendor-specific |
| 13.3 | Points to Dollar Value (Aristocrat) | Aristocrat vendor-specific |
| 13.4 | Dollar to Points (Aristocrat) | Aristocrat vendor-specific |
| 13.5 | Comp Balance After Redemption | Casino comp workflow |

If casino support is needed in the future, these should live in a separate `casino-integration-service`.

---

## Appendix B: Industry Standards Referenced

| Standard | Org | Version | Used For |
|----------|-----|---------|----------|
| USALI | AHLA | 12th Edition | Revenue categorization, departmental accounting |
| STR Definitions | STR Global | Current | KPI formulas (ADR, RevPAR, Occupancy, TRevPAR) |
| HTNG | AHLA/HTNG | 2.0 | Rate/reservation data interchange, shared reservations |
| PCI DSS | PCI Council | 4.0 | Payment authorization, tokenization |
| ISO 4217 | ISO | Current | Currency codes, monetary precision |
| IATA | IATA | Current | Travel agent commission standards |
| GDPR/CCPA | EU/California | Current | Guest data handling in financial records |

# GAP-13: Multi-Currency FX Rate Locking

**Priority:** P1 | **Risk:** 🔴 HIGH | **Ref:** BA §9.3, §13.5

## Current State
- `forex.ts` calculation engine exists (convert, triangulate, margin)
- FX calculation route at `/v1/calculations/forex/*` works
- `general_ledger_entries` has `exchange_rate` and `base_currency` columns
- **No FX rate locking on individual transactions** — rates are calculated but not stored on charge_postings or payments
- `charge_postings.currency_code` exists but no `exchange_rate` column
- `payments.currency` exists but no `exchange_rate` column

## What the Doc Requires
For multi-currency properties:
1. Lock FX rate at posting time (not settlement time)
2. Store `exchange_rate` + `base_amount` on every charge posting and payment
3. For long stays (30+ nights): daily rate locking, not booking-time rate
4. FX gain/loss calculation at settlement
5. GL entries in both transaction currency and base currency

### Edge Case (BA §13.5): 30-Night FX Stay
- Guest books in EUR, property base = USD
- Each night charge locked at that day's EUR/USD rate
- At checkout: sum all charges in USD, compare to EUR total at final rate
- FX variance → GL 6100 (FX Gain/Loss)

## Work Required

### Backend
1. Add FX rate lookup service (external API or internal rate table)
2. Add `exchange_rate DECIMAL(12,6)` and `base_amount DECIMAL(15,2)` to `charge_postings`
3. Add `exchange_rate DECIMAL(12,6)` and `base_amount DECIMAL(15,2)` to `payments`
4. In `postCharge`: if currency ≠ property base currency, fetch and store rate
5. In `capturePayment`: if currency ≠ property base currency, fetch and store rate
6. At checkout: calculate FX gain/loss, post to GL 6100
7. Add `fx_rates` reference table (daily rates per currency pair)

### SQL
- ALTER charge_postings ADD COLUMN exchange_rate, base_amount
- ALTER payments ADD COLUMN exchange_rate, base_amount
- CREATE TABLE fx_rates (date, from_currency, to_currency, rate, source)

### Schema
- Update ChargePostingsSchema, PaymentsSchema with new columns

## Impact
Without FX rate locking, currency conversion at different times produces different amounts — guest bill at checkout ≠ sum of nightly charges. Revenue reporting in base currency is unreliable.

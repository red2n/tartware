# GAP-10: Overpayment Handling

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §4.1

## Current State
- `capturePayment` in `payment.ts` updates folio balance: `balance = balance - amount`
- Balance can go negative (overpayment) — no detection or handling
- No credit balance tracking on folios
- No automatic refund or credit transfer mechanism

## What the Doc Requires
When payment amount > folio outstanding balance:
1. Apply payment up to balance → folio balance = 0
2. Remainder options (configurable per property):
   - **Option A:** Automatic refund of overpayment
   - **Option B:** Hold as credit on folio (for future charges)
   - **Option C:** Transfer to advance deposit liability account
3. GL: overpayment → DR 1100 / CR 2200 (Guest Credit Liability)
4. Notify front desk of overpayment
5. At checkout: if credit balance remains, prompt for refund

## Work Required

### Backend
1. In `capturePayment`: detect when `amount > folio.balance`
2. Add property setting: `billing.overpayment_action` (refund | credit | hold)
3. If refund: auto-create refund for excess
4. If credit: track as folio credit_balance column
5. At checkout: check for remaining credits, prompt user
6. Add `credit_balance` column to folios table

### Schema
- Add setting definition for `billing.overpayment_action`
- Add `credit_balance` to FoliosSchema if missing

### SQL
- `ALTER TABLE folios ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12,2) DEFAULT 0`

## Impact
Without overpayment handling, negative folio balances cause confusion. Guests may overpay without notification or refund, leading to disputes.

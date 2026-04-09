# GAP-02: Advance Deposit Ledger — Liability vs Revenue

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §1.1, §4, §15

## Current State
- `deposit_schedules` table exists with full schema (scripts/tables/03-bookings/30)
- `deposit.ts` calculation engine exists (entire-stay, per-guest, cap)
- Calculation route at `/v1/calculations/deposit/*` exists
- **No command handler manages deposit lifecycle.** Deposits are currently processed as regular `billing.payment.capture` — they go directly to the folio as a credit, treated as revenue.

## What the Doc Requires
Advance deposits are **liabilities, not revenue** (ASC 606, GAAP):
1. At booking: deposit received → DR 1100 (Cash) / CR 2200 (Advance Deposit Liability)
2. At check-in: liability transfers to guest ledger → DR 2200 / CR 1200 (Guest Ledger)
3. On cancellation: refund from liability → DR 2200 / CR 1100

The four ledgers must always balance: Advance Deposit + Guest Ledger + City Ledger + Settlement = 0

## Work Required

### Backend
1. Add commands: `billing.deposit.record`, `billing.deposit.transfer_to_folio`, `billing.deposit.refund`
2. Create `billing-service/src/services/billing-commands/deposit.ts` — command handler
3. Wire deposit_schedules table: UPDATE status on payment, track amount_paid/amount_remaining
4. At check-in (via reservation event listener): auto-transfer deposit from liability to guest ledger
5. On cancellation: auto-refund deposit per cancellation policy

### Schema
- `schema/src/events/commands/billing.ts` — add deposit command schemas
- Seed `command_templates` for new deposit commands

### UI
- Add deposit schedule viewer in billing folio detail
- Show deposit status (PENDING → PAID → APPLIED → REFUNDED) in reservation detail

## Impact
Without proper deposit accounting, advance payments inflate revenue prematurely. This causes incorrect financial statements and potential tax reporting issues.

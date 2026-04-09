# GAP-01: GL Journal Entry Posting — Not Wired

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §2, §6, §10, §14.3

## Current State
- SQL tables exist: `general_ledger_batches`, `general_ledger_entries` (scripts/tables/04-financial/70, 71)
- Zod schemas exist: `schema/src/schemas/04-financial/general-ledger-*.ts`
- **No billing-service code writes to these tables.** Zero INSERT statements for GL in any command handler.

## What the Doc Requires
Every financial posting must generate a double-entry GL journal:
- Room charge → DR 1200 (Guest Ledger) / CR 4000 (Rooms Revenue)
- Payment capture → DR 1100 (Cash/Bank) / CR 1200 (Guest Ledger)
- Tax posting → DR 1200 (Guest Ledger) / CR 2100 (Tax Payable)
- Refund → DR 4000 (Revenue) / CR 1100 (Cash/Bank)
- Comp → DR 5100 (Comp Expense) / CR 4000 (Rooms Revenue) — gross revenue + offset
- AR transfer → DR 1300 (City Ledger) / CR 1200 (Guest Ledger)
- Advance deposit → DR 1100 (Cash/Bank) / CR 2200 (Advance Deposits Liability)
- Night audit GL batch export to ERP (BA §14.3)

## Work Required

### Backend
1. Create `billing-service/src/services/gl-journal-service.ts` — utility to INSERT GL entries
2. Wire GL posting into every financial command handler:
   - `charge.ts` → postCharge, voidCharge
   - `payment.ts` → capturePayment, refundPayment, voidPayment
   - `comp-post.ts` → postComp
   - `accounts-receivable.ts` → postArEntry, writeOffAr
   - `night-audit.ts` → batch GL generation at step 6
   - `tax-exemption.ts` → tax reversal GL
3. Create USALI chart of accounts reference table (`scripts/tables/09-reference-data/08_gl_chart_of_accounts.sql`)
4. Create charge_code → GL account mapping table
5. Add night audit step: "Generate GL batch" after trial balance
6. Add GL batch export endpoint: `GET /v1/billing/gl-batches`, `GET /v1/billing/gl-batches/:batchId/entries`
7. Add command: `billing.gl_batch.export` for ERP integration

### Schema
- `schema/src/events/commands/billing.ts` — add GL batch export command
- `schema/src/api/billing.ts` — add GL batch list/detail response types

### UI
- New accounts sub-feature: `accounts/general-ledger/` — GL batch viewer, entry drill-down

### SQL
- `scripts/tables/09-reference-data/08_gl_chart_of_accounts.sql` — USALI 12th Ed chart
- `scripts/tables/09-reference-data/09_charge_code_gl_mapping.sql` — charge_code → GL account

## Impact
Without GL posting, the trial balance is cosmetic (summing charge_postings) rather than a true debit=credit GL verification. Financial reporting, ERP integration, and USALI compliance are blocked.

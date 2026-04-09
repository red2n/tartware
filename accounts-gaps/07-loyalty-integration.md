# GAP-07: Loyalty Program Integration

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §11, §14.4

## Current State
- `loyalty.ts` calculation engine exists (points accrual, redemption value, tier bonus)
- Calculation route at `/v1/calculations/loyalty/*` works
- **No loyalty commands** (no accrue, redeem, re-credit, balance check)
- **No loyalty provider API integration** (no external API calls)
- No loyalty_transactions or loyalty_accounts table

## What the Doc Requires

### Points Accrual (BA §11.1)
- At checkout: calculate eligible spend → accrual rate → points earned
- Exclude taxes, comps, discounts from accrual base
- Tier multiplier (Gold 1.5x, Platinum 2x)
- Async POST to loyalty provider (5s timeout, queue on failure)

### Points Redemption (BA §11.2)
- At check-in or charge time: guest redeems points
- Sync validation with loyalty provider (3s timeout, block on failure)
- Post as REDEMPTION_CREDIT on folio (not a payment)
- GL: DR 2300 (Loyalty Liability) / CR 1200 (Guest Ledger)

### Re-credit on Cancellation
- On cancellation/refund: reverse accrual, re-credit redeemed points
- Async to loyalty provider, queue for retry

## Work Required

### Backend
1. Add commands: `billing.loyalty.accrue`, `billing.loyalty.redeem`, `billing.loyalty.re_credit`
2. Create command handler: `billing-service/src/services/billing-commands/loyalty.ts`
3. Add loyalty provider client: HTTP adapter with timeout/retry/circuit breaker
4. Add loyalty_transactions table for local tracking

### Schema
- `schema/src/events/commands/billing.ts` — loyalty commands
- `scripts/tables/04-financial/78_loyalty_transactions.sql`

### UI
- Loyalty points display in guest profile
- Redemption option at checkout
- Points history viewer

## Impact
Loyalty is a guest experience differentiator. Without it, points accrual/redemption is manual or unsupported. Re-credit failures on cancellation cause guest disputes.

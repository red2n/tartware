# GAP-15: Concurrent Payment + Checkout Locking

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §13.2, §16

## Current State
- Payment capture updates folio balance: `balance = balance - amount`
- Express checkout settles folio and transitions reservation
- **No mutual exclusion** between payment operations and checkout on the same folio
- Race condition: Guest pays at kiosk while front desk checks out → double payment or zero-balance mismatch

## What the Doc Requires
Concurrent operations on the same folio must be serialized:
1. Acquire advisory lock on folio_id before any financial mutation
2. `SELECT ... FOR UPDATE` on folio row (already done in some handlers, not all)
3. Checkout must acquire lock before settlement calculation
4. If lock contention > 5s, return 409 Conflict, let client retry
5. Payment gateway callback must also acquire folio lock

### Critical Race Scenarios
| Scenario | Risk | Current Behavior |
|----------|------|-----------------|
| Payment + Checkout simultaneous | Double payment | Both succeed, balance goes negative |
| Two payments on same folio | Overpayment | Both succeed independently |
| Charge post during checkout | Missed charge | Charge posts after balance calc |
| Refund during checkout | Balance mismatch | Refund applied to closed folio |

## Work Required

### Backend
1. Add folio-level advisory lock utility: `pg_advisory_xact_lock(folio_id_hash)`
2. Apply lock in: `capturePayment`, `refundPayment`, `postCharge`, `expressCheckout`, `closeFolio`
3. In `expressCheckout`: acquire lock first, then calculate balance, then settle
4. Timeout: if lock not acquired in 5s, throw BillingCommandError('FOLIO_LOCKED')
5. Ensure all folio-mutating operations use `FOR UPDATE` on folio row

### Testing
- Load test: concurrent payment + checkout on same folio
- Verify no double payments or negative balances

## Impact
Without locking, concurrent operations cause financial inconsistencies that are extremely difficult to detect and reconcile. P0 because it directly causes double payments.

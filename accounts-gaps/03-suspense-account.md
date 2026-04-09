# GAP-03: Suspense Account for Unroutable Charges

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §2.2, §3.3, §8 (Principle 8)

## Current State
- `routing-rule-service.ts` evaluates routing rules and returns `remainderAmount`
- In `charge.ts` → `applyChargePost`: if `remainderAmount > 0` OR no routing rules match, remainder is posted to the source folio
- **No suspense account handling.** If a charge cannot be routed (e.g., guest checked out, folio closed, no matching rule), the system either throws `FOLIO_NOT_FOUND` or silently posts to source folio.

## What the Doc Requires
- Integration failures and unroutable charges go to a **suspense account** (BA §8, Principle 8)
- POS charges that can't reach PMS → suspense
- Charges where the folio is closed → suspense
- Suspense items must be reviewed and cleared daily (night audit pre-check)

## Work Required

### Backend
1. Create suspense folio concept: each property has a system-owned "SUSPENSE" folio (folio_type = 'SUSPENSE')
2. Auto-create suspense folio per property on first use
3. In `charge.ts`: when folio is CLOSED or not found, route to suspense folio instead of throwing
4. Add pre-audit check: "Uncleared suspense items" in night audit pre-audit checklist
5. Add route: `GET /v1/billing/suspense-items` — list all charges in suspense folios
6. Add command: `billing.suspense.resolve` — move charge from suspense to correct folio

### SQL
- Seed a SUSPENSE folio type in enum or folio_type column
- Add `is_suspense` flag to folios table or rely on folio_type

### UI
- Night audit pre-audit checklist already exists — add suspense count
- Add suspense resolution workflow in billing page

## Impact
Without suspense, charges can be silently lost (revenue leakage) or cause hard errors that block POS integration.

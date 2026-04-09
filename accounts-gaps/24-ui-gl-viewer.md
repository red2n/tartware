# GAP-24: UI — General Ledger Batch Viewer

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §14.3

## Current State
- GL tables exist (batches + entries)
- **No backend routes for GL data** (see GAP-01, GAP-06)
- **No UI for GL viewing or export**

## Work Required (depends on GAP-01 + GAP-06)

### UI — `accounts/general-ledger/`
1. GL batch list: batch number, date, period, status, debit/credit totals, variance
2. Batch detail: drill-down to individual GL entries
3. Entry detail: GL account, department, amount, source reference
4. Export actions: CSV, XML download per batch
5. Batch status transitions: OPEN → REVIEW → POSTED
6. Trial balance summary view (already exists in night-audit, could cross-link)

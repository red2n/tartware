# GAP-06: GL/ERP Batch Export After Night Audit

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §14.3

## Current State
- `general_ledger_batches` and `general_ledger_entries` tables exist
- Night audit runs but does NOT generate GL entries (see GAP-01)
- No export mechanism exists (no endpoint, no scheduled job, no file generation)

## What the Doc Requires
After each night audit:
1. Generate a GL batch containing all day's financial entries
2. Group by accounting period and source module
3. Verify debit_total = credit_total (zero-variance check)
4. Export to ERP via:
   - File export (CSV/XML in USALI format)
   - API push to accounting system
   - Manual download option

Timing: Within 30 minutes of night audit completion
Format: USALI 12th Edition standard chart of accounts
Retry: If ERP export fails, mark batch as ERROR, retry next audit

## Work Required

### Backend (depends on GAP-01 being completed first)
1. Night audit step: after trial balance, generate GL batch
2. Batch generation: aggregate charge_postings + payments → GL entries
3. Add route: `GET /v1/billing/gl-batches` (list), `GET /v1/billing/gl-batches/:id` (detail with entries)
4. Add route: `POST /v1/billing/gl-batches/:id/export` — trigger export
5. Add command: `billing.gl_batch.export`
6. File generation: CSV and XML formats
7. Webhook notification to ERP on batch ready

### UI
- GL batch list viewer in accounts/general-ledger
- Batch detail with entry drill-down
- Export button (CSV/XML download)
- Batch status tracking (OPEN → REVIEW → POSTED → ERROR)

## Dependency
Requires GAP-01 (GL journal entries) to be implemented first.

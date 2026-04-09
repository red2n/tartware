# GAP-14: Night Audit Atomicity & Rollback

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §13.1, §16

## Current State
- Night audit in `night-audit.ts` runs 8 steps sequentially
- Uses `try/finally` — on failure, unlocks postings with `FAILED` status
- Individual steps are **not individually rollbackable** — partial charges may be posted before failure
- Idempotency: uses `ON CONFLICT DO NOTHING` for audit log, but posted charges/taxes are NOT idempotent
- If step 2 (room charges) succeeds but step 3 (packages) fails → some charges posted, some not

## What the Doc Requires
- **Atomicity**: all-or-nothing per audit run (if step N fails, roll back steps 1..N-1)
- **Idempotency**: re-running audit for same date produces identical results (no double charges)
- **Recovery**: on mid-run failure:
  1. Log failure with step detail
  2. Roll back all posted charges for this audit_run_id
  3. Unlock property
  4. Allow manual retry
- **Checkpoint**: each step completion is checkpointed to allow resume-from-failure

## Work Required

### Backend
1. Wrap entire night audit in a single DB transaction (`withTransaction`)
   - All room charges, tax charges, package charges, commission accruals in one TX
   - If any step fails → entire TX rolls back atomically
2. Add `audit_run_id` to all charge_postings created during audit
3. For idempotency: before posting room charges, check if charges already exist for `(reservation_id, business_date, charge_code='ROOM')`
4. Checkpoint table: `night_audit_checkpoints` — track step completion for resume
5. If TX too large (1000+ reservations), batch into sub-transactions with checkpoint

### SQL
- Add `audit_run_id UUID` to charge_postings (nullable, set only for audit-generated charges)
- CREATE TABLE night_audit_checkpoints (audit_run_id, step_number, status, started_at, completed_at)

### Current Risk
If night audit fails after posting 500 room charges but before trial balance, those 500 charges are orphaned — they'll be double-posted on retry. This directly impacts revenue accuracy.

## Impact
Night audit atomicity is P0 because a failed mid-run audit with partial charges causes revenue discrepancies that cascade through trial balance, GL, and financial reporting.

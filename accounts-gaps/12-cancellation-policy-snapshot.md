# GAP-12: Cancellation Policy Snapshot at Booking Time

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §1.3

## Current State
- `cancellation-penalty.ts` handler exists — charges penalty on cancellation
- Penalty amount is passed in the command payload at cancellation time
- **No snapshot of cancellation policy stored at booking time**
- Policy terms could change between booking and cancellation — guest disputes

## What the Doc Requires
At booking time:
1. Snapshot the active cancellation policy for the rate plan
2. Store: penalty type (flat/percentage/nights), amount, deadline, grace period
3. At cancellation: reference the **snapshotted** policy, not the current one
4. If inside grace period → no penalty
5. If outside deadline → full penalty per snapshot

Required fields on booking:
- `cancellation_policy_snapshot JSONB` on reservations table
- Contains: policy_code, penalty_type, penalty_amount, deadline_hours, grace_period_hours

## Work Required

### Backend
1. At reservation creation: fetch active cancellation policy for rate plan
2. Store snapshot on reservation record (JSONB or dedicated columns)
3. In `cancellation-penalty.ts`: read snapshot from reservation, not from command payload
4. Calculate penalty based on snapshot terms + cancellation timing

### SQL
- Add `cancellation_policy_snapshot JSONB` to reservations table (or dedicated columns)
- This is in reservations-command-service domain

### Cross-Service
- reservations-command-service stores the snapshot at booking
- billing-service reads it at cancellation penalty time

## Impact
Without policy snapshot, changing a cancellation policy retroactively affects existing bookings — guest disputes and potential legal issues.

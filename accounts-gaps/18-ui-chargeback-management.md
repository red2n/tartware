# GAP-18: UI — Chargeback Management Screen

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §4.4

## Current State (Backend ✅ → UI ❌)
- Backend has `chargeback.record` and `chargeback.update_status` commands
- Full chargeback state machine: RECEIVED → EVIDENCE_SUBMITTED → WON/LOST
- Evidence package support (metadata JSONB)
- Auto-reopen folio on LOST chargeback
- **No UI screen for chargeback management**

## Work Required

### UI — `accounts/chargebacks/`
1. Chargeback list with status filters (RECEIVED, EVIDENCE_SUBMITTED, WON, LOST)
2. Record new chargeback form (payment reference, amount, reason, date)
3. Status transition actions (Submit Evidence, Mark Won, Mark Lost)
4. Evidence upload/attachment
5. Linked payment and folio details
6. KPIs: total chargebacks, win rate, exposure amount
7. Aging: chargebacks by days since received

### Routes Already Available
- Chargebacks are in `refunds` table with `is_chargeback = true`
- Need: `GET /v1/billing/chargebacks` — filtered query on refunds

# GAP-22: UI — Deposit Schedule Management

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §1.1

## Current State
- `deposit_schedules` table exists with full schema
- Calculation engines for deposit amounts exist
- **No UI for viewing or managing deposit schedules**
- **No backend routes for deposit schedule CRUD** (only calculation endpoints)

## Work Required

### Backend (prerequisite)
1. Add read routes: `GET /v1/billing/deposit-schedules?reservation_id=X`
2. Add commands for deposit lifecycle (see GAP-02)

### UI
1. Deposit schedule viewer in reservation detail sidebar
2. Show: due date, amount due, amount paid, status (PENDING/PAID/OVERDUE)
3. Record payment against schedule
4. Waive deposit option
5. Overdue deposit alerts (badge on reservation)

# AI Task Queue - Code Quality Fixes

> **Usage**: Ask the AI to complete any task by referencing its ID (e.g., "Fix LOW-001")
> **Generated**: 2026-01-27
> **Branch**: fix/code-quality-issues
> **Status**: All CRIT, HIGH, MEDIUM tasks completed. PR review comments addressed.

---

## ✅ COMPLETED - CRITICAL (P0) - Data Loss/Integrity

### ~~CRIT-001~~: Non-atomic folio transfer causes money loss ✅ FIXED
### ~~CRIT-002~~: Cancel releases availability lock before transaction commit ✅ FIXED
### ~~CRIT-003~~: Command consumer lacks idempotency enforcement ✅ FIXED
### ~~CRIT-004~~: DLQ publish is fire-and-forget ✅ FIXED

---

## ✅ COMPLETED - HIGH (P1) - Security/Financial

### ~~HIGH-001~~: Hardcoded default passwords in config ✅ FIXED
### ~~HIGH-002~~: JWT secret in repository allowed ✅ FIXED (multiple services)
### ~~HIGH-003~~: Refund amount > original payment allowed ✅ FIXED
### ~~HIGH-004~~: Floating-point in currency calculations ✅ FIXED (money.ts utilities)
### ~~HIGH-005~~: GDPR erase leaves guest PII in related tables ✅ FIXED (7-table cascade)
### ~~HIGH-006~~: Password enumeration via timing/response ✅ FIXED (check is_active first)
### ~~HIGH-007~~: TOCTOU race in user creation ✅ FIXED (ON CONFLICT DO NOTHING)

---

## ✅ COMPLETED - MEDIUM (P2) - Business Logic

### ~~MED-001~~: extendStay bypasses availability guard ✅ FIXED
### ~~MED-002~~: assignRoom doesn't verify room availability ✅ FIXED
### ~~MED-003~~: Missing check_in < check_out date validation ✅ FIXED
### ~~MED-004~~: Housekeeping assignment overwrites completed status ✅ FIXED
### ~~MED-005~~: Guest merge creates VIP + Blacklisted contradiction ✅ FIXED
### ~~MED-006~~: Room unavailability uses conflicting mechanisms ✅ FIXED
### ~~MED-007~~: Rate fallback silently reprices reservation ✅ FIXED
### ~~MED-008~~: Cross-tenant property_id validation missing ✅ FIXED

---

## ✅ COMPLETED - PR Review Comments

### ~~PR-001~~: System-users username/email conflict handling ✅ FIXED
- Pre-validate both fields with Promise.all, return specific conflict error message

### ~~PR-002~~: Production JWT secret enforcement ✅ FIXED (6 services)
- api-gateway, core-service, guests, billing, housekeeping, command-center
- Fail fast in production if AUTH_JWT_SECRET not set

### ~~PR-003~~: Release hold failure logging ✅ FIXED
- reservation-command-service wraps releaseReservationHold in try-catch with warning log

### ~~PR-004~~: GDPR cascade audit trail ✅ FIXED
- guest-command-service collects rowCount from each cascade UPDATE, logs per-table audit

### ~~PR-005~~: Idempotency callback validation ✅ FIXED
- command-consumer-utils validates both callbacks provided together or neither

### ~~PR-006~~: Transaction wrapper improvements ✅ FIXED (5 services)
- api-gateway, billing, command-center, guests, reservations-command-service
- Track transactionStarted state, catch rollback errors, signal failures to pool

---

## 🔵 LOW (P3) - Code Quality
- **Files**:
  - `Apps/api-gateway/src/...` uses `"local-dev-secret"`
  - `Apps/core-service/src/...` uses `"local-dev-secret-change-me"`
- **Risk**: Auth tokens from one service rejected by another
- **Fix Required**: Unify to single env variable `JWT_SECRET` with consistent default for dev
- **Test**: Generate token from core-service, verify api-gateway accepts it

---

### HIGH-003: Refund can exceed original payment amount
- **File**: `Apps/billing-service/src/services/billing-command-service.ts`
- **Lines**: ~100-106
- **Current Code**:
  ```typescript
  const refundTotal = Number(original.refund_amount ?? 0) + command.amount;
  const refundStatus = refundTotal >= Number(original.amount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
  ```
- **Risk**: Allows refunding $200 on a $100 payment
- **Fix Required**: Add validation before processing:
  ```typescript
  if (refundTotal > Number(original.amount)) {
    throw new BillingCommandError("REFUND_EXCEEDS_PAYMENT", "Refund amount would exceed original payment");
  }
  ```
- **Test**: Attempt refund > original amount, verify rejection

---

### HIGH-004: Floating-point precision for currency calculations
- **Files**:
  - `Apps/billing-service/src/services/billing-command-service.ts`
  - `Apps/guests-service/src/services/guest-command-service.ts`
- **Current Behavior**: Uses JavaScript `Number` for money: `Number(original.refund_amount ?? 0) + command.amount`
- **Risk**: `0.1 + 0.2 !== 0.3` - precision errors accumulate in financial calculations
- **Fix Required**: Either:
  1. Store/calculate in smallest currency unit (cents as integers), OR
  2. Use decimal library like `decimal.js` or `bignumber.js`
- **Scope**: Audit all money operations across billing and guest revenue tracking

---

### HIGH-005: GDPR erase doesn't cascade to related tables
- **File**: `Apps/guests-service/src/services/guest-command-service.ts`
- **Lines**: ~303-340
- **Current Behavior**: Only anonymizes `guests` table
- **Risk**: PII remains in `reservations.guest_name`, `reservations.guest_email`, etc.
- **Fix Required**: Add cascading updates to all tables with guest PII:
  ```sql
  UPDATE reservations SET guest_name = 'Deleted Guest', guest_email = NULL WHERE guest_id = $1;
  -- Add similar for any other tables storing guest PII
  ```
- **Test**: Run GDPR erase, query all tables for any remaining PII by guest_id

---

### HIGH-006: Password enumeration via timing/response
- **File**: `Apps/core-service/src/services/auth-service.ts` (or similar)
- **Current Behavior**: Checks if user is active AFTER validating password
- **Risk**: Attacker can determine valid passwords for inactive accounts
- **Fix Required**: Check active status BEFORE password validation, or use constant-time comparison for both paths
- **Test**: Verify same response time/message for invalid-password vs inactive-account

---

### HIGH-007: TOCTOU race in user creation
- **File**: `Apps/core-service/src/services/user-service.ts` (or similar)
- **Current Behavior**:
  1. Check if email exists (SELECT)
  2. Create user if not (INSERT)
- **Risk**: Two concurrent requests with same email - both pass check, both insert
- **Fix Required**: Use `INSERT ... ON CONFLICT` or database-level unique constraint with proper error handling
- **Test**: Send concurrent user creation requests with same email, verify only one succeeds

---

## 🟡 MEDIUM (P2) - Business Logic

### MED-001: extendStay bypasses availability guard
- **File**: `Apps/reservations-command-service/src/services/reservation-command-service.ts`
- **Lines**: ~339-355
- **Current Behavior**: `extendStay` changes `check_out_date` without calling `lockReservationHold()`
- **Compare To**: `modifyReservation()` which properly checks `hasStayCriticalChanges()` and locks
- **Risk**: Extending stay can cause overbooking
- **Fix Required**: Add availability check before extending:
  ```typescript
  if (newCheckOutDate > originalCheckOutDate) {
    await lockReservationHold({ tenantId, roomId, checkIn: originalCheckOut, checkOut: newCheckOut });
  }
  ```
- **Test**: Extend stay into dates with existing reservation, verify rejection

---

### MED-002: assignRoom doesn't verify room availability
- **File**: `Apps/reservations-command-service/src/services/reservation-command-service.ts`
- **Lines**: ~310-324
- **Current Code**: Only checks `if (!roomNumber) throw new Error("ROOM_NOT_FOUND")`
- **Risk**: Can assign room already occupied by another reservation
- **Fix Required**: Add availability check for the reservation's date range before assignment
- **Test**: Assign room with overlapping reservation, verify rejection

---

### MED-003: Missing check_in < check_out date validation
- **File**: `Apps/reservations-command-service/src/services/reservation-command-service.ts`
- **Lines**: ~48-50
- **Current Code**:
  ```typescript
  const stayStart = new Date(command.check_in_date);
  const stayEnd = new Date(command.check_out_date);
  ```
- **Risk**: Reservation with checkout before checkin breaks availability calculations
- **Fix Required**: Add validation:
  ```typescript
  if (stayEnd <= stayStart) {
    throw new ReservationCommandError("INVALID_DATES", "Check-out must be after check-in");
  }
  ```
- **Test**: Create reservation with check_out <= check_in, verify rejection

---

### MED-004: Housekeeping assignment overwrites completed status
- **File**: `Apps/housekeeping-service/src/services/housekeeping-command-service.ts`
- **Lines**: ~67-87
- **Current Code**: `SET status = 'IN_PROGRESS'` unconditionally on assignment
- **Risk**: Reassigning a completed/inspected task marks it incomplete
- **Fix Required**: Add condition:
  ```sql
  SET status = CASE
    WHEN status IN ('CLEAN', 'INSPECTED') THEN status
    ELSE 'IN_PROGRESS'
  END
  ```
- **Test**: Assign already-INSPECTED task, verify status unchanged

---

### MED-005: Guest merge creates VIP + Blacklisted contradiction
- **File**: `Apps/guests-service/src/services/guest-command-service.ts`
- **Lines**: ~398-399
- **Current Code**:
  ```typescript
  vip_status: Boolean(primary.vip_status || duplicate.vip_status),
  is_blacklisted: Boolean(primary.is_blacklisted || duplicate.is_blacklisted),
  ```
- **Risk**: Merging VIP with blacklisted guest creates impossible state
- **Fix Required**: Either:
  1. Blacklist takes precedence: `vip_status: primary.vip_status && !is_blacklisted`
  2. Throw error requiring manual resolution if both flags present
- **Test**: Merge VIP with blacklisted guest, verify sensible outcome

---

### MED-006: Room unavailability uses conflicting mechanisms
- **File**: `Apps/rooms-service/src/services/room-command-service.ts`
- **Scope**: Multiple functions handling `is_blocked`, `is_out_of_order`, and `status` field
- **Risk**: Room can be `status=AVAILABLE`, `is_blocked=true`, `is_out_of_order=true` simultaneously
- **Fix Required**: Consolidate to single source of truth, or define clear precedence:
  1. Add `effective_status` computed column, OR
  2. Update `status` whenever `is_blocked` or `is_out_of_order` changes
- **Test**: Set room to blocked then out-of-order, verify consistent state

---

### MED-007: Rate fallback silently reprices reservation
- **File**: `Apps/reservations-command-service/src/services/rate-plan-service.ts`
- **Lines**: ~45-62
- **Current Behavior**: Falls back to BAR rate ($200) if requested PROMO50 rate ($50) not found
- **Risk**: Guest billed 4x expected without notification
- **Fix Required**: Either:
  1. Return error when requested rate unavailable, OR
  2. Add explicit confirmation requirement when fallback applied
- **Test**: Request unavailable rate, verify either error or confirmation flow

---

### MED-008: Cross-tenant property_id validation missing
- **File**: `Apps/reservations-command-service/src/services/reservation-event-handler.ts`
- **Lines**: ~44-78
- **Current Behavior**: Inserts `property_id` from payload without validating it belongs to `tenantId`
- **Risk**: Malformed event creates cross-tenant data pollution
- **Fix Required**: Add validation:
  ```typescript
  const property = await getProperty(tenantId, payload.property_id);
  if (!property) throw new Error("PROPERTY_NOT_FOUND_FOR_TENANT");
  ```
- **Test**: Send event with mismatched tenant/property, verify rejection

---

## 🔵 LOW (P3) - Code Quality

### LOW-001: JWT secret minimum too weak
- **File**: `Apps/config/src/index.ts`
- **Current**: 8 character minimum for JWT_SECRET
- **Fix**: Increase to 32+ characters minimum for production

---

### LOW-002: Silent JSON parse failures in telemetry
- **File**: `Apps/telemetry/src/...`
- **Current**: `try/catch` swallows parse errors
- **Fix**: Log warning when JSON parsing fails

---

### LOW-003: Memory leak in bootstrap rate limiter
- **Files**: `Apps/core-service/...`, `Apps/api-gateway/...`
- **Current**: Rate limit map only cleaned on request
- **Fix**: Add interval-based cleanup of stale entries

---

### LOW-004: N+1 query patterns in list operations
- **File**: `Apps/core-service/src/services/...`
- **Current**: Multiple subqueries in tenant/user list queries
- **Fix**: Use JOINs or batch fetching

---

### LOW-005: Unbounded throttler map in outbox
- **File**: `Apps/outbox/src/...`
- **Current**: No cleanup for old tenant throttler entries
- **Fix**: Add max-age eviction for inactive tenants

---

### LOW-006: Promise ordering race in fastify-server
- **File**: `Apps/fastify-server/src/...`
- **Current**: `beforeRoutes` may not complete before `registerRoutes`
- **Fix**: Ensure proper await chain in server bootstrap

---

### LOW-007: Duplicate LogRecordProcessor registration
- **File**: `Apps/telemetry/src/...`
- **Current**: Processor registered twice in some configurations
- **Fix**: Add guard to prevent double registration

---

### LOW-008: Loyalty points silently clamped
- **File**: `Apps/guests-service/src/services/guest-command-service.ts`
- **Lines**: ~229-232
- **Current**: Adding -100 to 50 points = 0 with no error
- **Fix**: Either reject negative result or log/audit the clamping

---

## Completion Tracking

| ID | Status | Completed Date | PR |
|----|--------|----------------|-----|
| CRIT-001 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| CRIT-002 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| CRIT-003 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| CRIT-004 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-001 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-002 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-003 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-004 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-005 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-006 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| HIGH-007 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-001 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-002 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-003 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-004 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-005 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-006 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-007 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| MED-008 | ✅ Done | 2026-01-27 | fix/code-quality-issues |
| LOW-001 | ⬜ Pending | | |
| LOW-002 | ⬜ Pending | | |
| LOW-003 | ⬜ Pending | | |
| LOW-004 | ⬜ Pending | | |
| LOW-005 | ⬜ Pending | | |
| LOW-006 | ⬜ Pending | | |
| LOW-007 | ⬜ Pending | | |
| LOW-008 | ⬜ Pending | | |

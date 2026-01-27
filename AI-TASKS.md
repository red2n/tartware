# AI Task Queue - Code Quality Fixes

> **Usage**: Ask the AI to complete any task by referencing its ID (e.g., "Fix CRIT-001")
> **Generated**: 2026-01-27
> **Branch**: saas-enforcement

---

## 🔴 CRITICAL (P0) - Data Loss/Integrity

### CRIT-001: Non-atomic folio transfer causes money loss
- **File**: `Apps/billing-service/src/services/billing-command-service.ts`
- **Lines**: ~315-355
- **Current Behavior**: Folio transfer uses two separate UPDATE queries without transaction wrapping
- **Risk**: If second query fails, first folio is debited but second isn't credited - money disappears
- **Fix Required**: Wrap both queries in `withTransaction()` from the database utilities
- **Test**: Simulate failure after first UPDATE, verify rollback occurs

---

### CRIT-002: Cancel releases availability lock before transaction commit
- **File**: `Apps/reservations-command-service/src/services/reservation-command-service.ts`
- **Lines**: ~418-424
- **Current Behavior**: `releaseReservationHold()` is called BEFORE the database transaction
- **Risk**: If transaction fails/rolls back, the availability lock is already released but reservation isn't cancelled
- **Fix Required**: Either:
  1. Move `releaseReservationHold()` inside the transaction as the final step, OR
  2. Implement saga pattern with compensating transaction
- **Test**: Simulate DB failure during cancel, verify availability guard state matches DB state

---

### CRIT-003: Command consumer lacks idempotency enforcement
- **File**: `Apps/command-consumer-utils/src/index.ts` (or main consumer file)
- **Scope**: All command consumers using this utility
- **Current Behavior**: Commands are processed without checking for duplicate delivery
- **Risk**: Kafka redelivery can cause duplicate charges, reservations, etc.
- **Fix Required**:
  1. Add idempotency key field to command schema
  2. Create `processed_commands` table with (idempotency_key, tenant_id, processed_at)
  3. Check for existing key before processing, skip if found
  4. Insert key after successful processing (inside same transaction)
- **Reference**: AGENTS.md requires "Every new command must support idempotency keys and deduplication"

---

### CRIT-004: DLQ publish is fire-and-forget
- **File**: `Apps/command-consumer-utils/src/index.ts`
- **Function**: `publishToDlq()` or similar
- **Current Behavior**: DLQ publish doesn't await confirmation
- **Risk**: Message can be lost if publish fails silently
- **Fix Required**: Await the Kafka producer `send()` result and handle errors appropriately
- **Test**: Verify DLQ message count matches expected after simulated failures

---

## 🟠 HIGH (P1) - Security/Financial

### HIGH-001: Hardcoded default passwords in config
- **File**: `Apps/config/src/index.ts`
- **Current Code**:
  ```typescript
  DB_PASSWORD: env.DB_PASSWORD ?? "postgres"
  AUTH_DEFAULT_PASSWORD: env.AUTH_DEFAULT_PASSWORD ?? "ChangeMe123!"
  ```
- **Risk**: Production deployments may accidentally use default credentials
- **Fix Required**:
  1. Remove default values for sensitive config
  2. Throw error if required secrets not provided in production
  3. Add `NODE_ENV` check: `if (isProduction && !env.DB_PASSWORD) throw new Error(...)`
- **Test**: Verify app fails to start in production mode without required secrets

---

### HIGH-002: JWT secret mismatch between services
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
| HIGH-001 | ⬜ Pending | | |
| HIGH-002 | ⬜ Pending | | |
| HIGH-003 | ⬜ Pending | | |
| HIGH-004 | ⬜ Pending | | |
| HIGH-005 | ⬜ Pending | | |
| HIGH-006 | ⬜ Pending | | |
| HIGH-007 | ⬜ Pending | | |
| MED-001 | ⬜ Pending | | |
| MED-002 | ⬜ Pending | | |
| MED-003 | ⬜ Pending | | |
| MED-004 | ⬜ Pending | | |
| MED-005 | ⬜ Pending | | |
| MED-006 | ⬜ Pending | | |
| MED-007 | ⬜ Pending | | |
| MED-008 | ⬜ Pending | | |
| LOW-001 | ⬜ Pending | | |
| LOW-002 | ⬜ Pending | | |
| LOW-003 | ⬜ Pending | | |
| LOW-004 | ⬜ Pending | | |
| LOW-005 | ⬜ Pending | | |
| LOW-006 | ⬜ Pending | | |
| LOW-007 | ⬜ Pending | | |
| LOW-008 | ⬜ Pending | | |

# GAP-05: POS/HTNG Integration Endpoint

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §2.2, §14.1

## Current State
- Generic `billing.charge.post` command handles all charge posting
- No dedicated POS endpoint or HTNG message format support
- No POS idempotency key handling (POS systems retry aggressively)

## What the Doc Requires
HTNG-standard POS integration:
- `POST /api/v1/charges/pos` — dedicated endpoint
- POS transaction ID as idempotency key (no duplicate charges)
- Room number → reservation → folio lookup
- Guest verification (name match)
- Timeout: 3s response, queue on failure
- On PMS unreachable: POS queues charge, retries with exponential backoff
- Failed POS charges → suspense account (GAP-03)

Required fields per HTNG:
- `pos_transaction_id` (idempotency key)
- `room_number` or `reservation_id`
- `outlet_code` (F&B, SPA, etc.)
- `check_number`
- `covers` (number of guests)
- `charge_items[]` (itemized list)
- `service_charge`, `tax_amount`

## Work Required

### Backend
1. Add route: `POST /v1/billing/charges/pos` — HTNG-compatible POS charge endpoint
2. Room number → reservation → folio resolution logic
3. POS idempotency: check `pos_transaction_id` in idempotency table
4. Guest name verification (fuzzy match)
5. Itemized charge posting (multiple line items per POS check)
6. POS outlet → department_code → USALI GL mapping
7. Failure → suspense folio (depends on GAP-03)

### Schema
- Add POS charge input schema in `schema/src/api/billing.ts`
- Add `pos_transaction_id`, `outlet_code`, `check_number` to charge_postings if missing

### SQL
- Add `pos_transaction_id` column to `charge_postings` if not present
- Add index on `(tenant_id, pos_transaction_id)` for dedup

## Impact
POS is the #2 revenue stream after room charges. Without proper integration, F&B/SPA charges require manual posting — error-prone and slow. POS retry without idempotency causes duplicate charges.

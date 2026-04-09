# GAP-04: Payment Gateway Webhook Handling

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §4.4, §14.2

## Current State
- `payment_gateway_configurations` table exists (scripts/tables/04-financial/73)
- Payment capture/refund/void commands exist and work
- **No webhook endpoint** to receive async notifications from payment gateways
- All payment processing is currently synchronous (command → direct DB write)

## What the Doc Requires
Payment gateways send async webhooks for:
- `payment.captured` → update payment status, post to folio
- `payment.failed` → mark FAILED, alert front desk
- `refund.completed` → confirm refund processed
- `chargeback.received` → auto-create chargeback record
- `authorization.expired` → release hold

Required endpoint: `POST /webhooks/payment-gateway`
- Verify HMAC signature (PCI-DSS v4.0)
- Idempotent processing (webhook_id dedup)
- 200 OK within 5s (queue for async processing)
- Retry tolerance (gateways retry on non-200)

## Work Required

### Backend
1. Add route: `POST /v1/webhooks/payment-gateway` in billing-service or api-gateway
2. Implement HMAC signature verification per gateway
3. Webhook event dispatcher → map event type to existing commands
4. Idempotency: check webhook_id in `idempotency_keys` table before processing
5. Add `payment_gateway_webhooks` table for event log

### Schema
- `schema/src/api/billing.ts` — webhook payload types
- `scripts/tables/04-financial/77_payment_gateway_webhooks.sql`

### Security (PCI-DSS v4.0)
- HMAC signature verification (SHA-256)
- IP allowlist for gateway webhooks
- No PAN/CVV in webhook payload (gateway handles tokenization)
- Webhook payload encryption at rest

## Impact
Without webhooks, payment status is never confirmed async. Refunds may show as pending forever. Chargebacks are never automatically detected — manual discovery only.

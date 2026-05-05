/**
 * DEV DOC
 * Module: api/payment-gateway.ts
 * Purpose: Cross-service Payment Gateway provider contract.
 *          Single source of truth for the authorize → capture → refund →
 *          void lifecycle and webhook-event shapes used by the billing
 *          service to talk to any external PSP (Stripe, Adyen, Worldpay…).
 * Ownership: Schema package
 *
 * Why this lives in `schema/`:
 *   - Provider contracts are explicitly required to live in `@tartware/schemas`
 *     per AGENTS.md ("Provider contracts / service interfaces used cross-layer").
 *   - The same shapes are consumed by billing-service (authorize/capture),
 *     api-gateway (webhook proxy), revenue-service (settlement reconciliation)
 *     and analytics. Defining them locally would fragment the integration.
 *
 * Performance note (20K ops/sec):
 *   - All schemas here are validated at the system boundary only (gateway
 *     adapter inputs/outputs and webhook ingress). Hot-path payment commands
 *     stay on their existing Zod schemas in `events/commands/billing-payment.ts`.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// ---------------------------------------------------------------------------
// Provider identifiers + lifecycle states
// ---------------------------------------------------------------------------

/** Supported payment gateway providers. Extend as new PSPs are integrated. */
export const BillingPaymentGatewayProviderEnum = z.enum([
	"STRIPE",
	"ADYEN",
	"WORLDPAY",
	"SQUARE",
	"BRAINTREE",
	"AUTHORIZE_NET",
	"MANUAL", // ops-managed offline payments — no external API
]);
export type BillingPaymentGatewayProvider = z.infer<typeof BillingPaymentGatewayProviderEnum>;

/**
 * PSP-side authorization lifecycle. Mirrors the subset of states every major
 * gateway exposes; service-specific intermediate states must be mapped down
 * to one of these by the adapter.
 */
export const BillingPaymentGatewayStatusEnum = z.enum([
	"REQUIRES_ACTION", // 3DS / SCA challenge required
	"AUTHORIZED", // funds reserved, not yet captured
	"CAPTURED", // funds settled
	"PARTIALLY_CAPTURED", // multi-capture authorize remaining
	"VOIDED", // authorization released without capture
	"REFUNDED", // full refund applied
	"PARTIALLY_REFUNDED", // partial refund applied
	"FAILED", // PSP declined
	"EXPIRED", // authorization timed out
]);
export type BillingPaymentGatewayStatus = z.infer<typeof BillingPaymentGatewayStatusEnum>;

// ---------------------------------------------------------------------------
// Money — must match billing service's NUMERIC(19,4) representation
// ---------------------------------------------------------------------------

/**
 * Money amount as a positive decimal string. Strings are used (not number) to
 * avoid IEEE-754 rounding when ferrying between PSP REST APIs and Postgres
 * NUMERIC(19,4). Adapters MUST not perform float arithmetic on these values.
 */
export const PaymentAmountSchema = z
	.string()
	.regex(/^\d{1,15}(?:\.\d{1,4})?$/, "Amount must be a non-negative decimal with up to 4 fractional digits");
export type PaymentAmount = z.infer<typeof PaymentAmountSchema>;

/** ISO-4217 currency code, normalised to uppercase. */
export const PaymentCurrencySchema = z
	.string()
	.length(3)
	.transform((s) => s.toUpperCase());
export type PaymentCurrency = z.infer<typeof PaymentCurrencySchema>;

// ---------------------------------------------------------------------------
// Provider operation: AUTHORIZE
// ---------------------------------------------------------------------------

export const AuthorizePaymentRequestSchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	/** Stable client-supplied key. Forwarded to PSP `Idempotency-Key`. */
	idempotency_key: z.string().min(8).max(128),
	amount: PaymentAmountSchema,
	currency: PaymentCurrencySchema,
	/** PSP token (e.g. Stripe `pm_…`, Adyen `additionalData.recurring.recurringDetailReference`). */
	payment_method_token: z.string().min(1).max(512),
	statement_descriptor: z.string().max(22).optional(),
	/** Free-form passthrough metadata returned on the webhook. */
	metadata: z.record(z.string()).optional(),
	/** Whether to capture immediately (true) or hold (false). */
	capture: z.boolean().default(false),
});
export type AuthorizePaymentRequest = z.infer<typeof AuthorizePaymentRequestSchema>;

export const BillingPaymentGatewayResultSchema = z.object({
	provider: BillingPaymentGatewayProviderEnum,
	/** PSP-assigned identifier (e.g. Stripe `pi_…`). Stored in `payments.gateway_reference`. */
	gateway_reference: z.string().min(1).max(255),
	status: BillingPaymentGatewayStatusEnum,
	authorized_amount: PaymentAmountSchema,
	captured_amount: PaymentAmountSchema.optional(),
	currency: PaymentCurrencySchema,
	/** Optional 3DS / SCA next-action URL or client secret. */
	next_action: z
		.object({
			type: z.enum(["redirect_to_url", "use_stripe_sdk", "use_adyen_action"]),
			payload: z.record(z.unknown()),
		})
		.nullable()
		.optional(),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			declined_by_issuer: z.boolean().default(false),
		})
		.optional(),
	/** Raw PSP response, JSONB-stored on `payments.gateway_response`. */
	raw_response: z.record(z.unknown()).optional(),
});
export type BillingPaymentGatewayResult = z.infer<typeof BillingPaymentGatewayResultSchema>;

// ---------------------------------------------------------------------------
// CAPTURE / VOID / REFUND
// ---------------------------------------------------------------------------

export const CapturePaymentRequestSchema = z.object({
	tenant_id: uuid,
	gateway_reference: z.string().min(1).max(255),
	idempotency_key: z.string().min(8).max(128),
	/** Optional partial-capture amount. Omit to capture full authorized amount. */
	amount: PaymentAmountSchema.optional(),
});
export type CapturePaymentRequest = z.infer<typeof CapturePaymentRequestSchema>;

export const VoidPaymentRequestSchema = z.object({
	tenant_id: uuid,
	gateway_reference: z.string().min(1).max(255),
	idempotency_key: z.string().min(8).max(128),
	reason: z.string().max(255).optional(),
});
export type VoidPaymentRequest = z.infer<typeof VoidPaymentRequestSchema>;

export const RefundPaymentRequestSchema = z.object({
	tenant_id: uuid,
	gateway_reference: z.string().min(1).max(255),
	idempotency_key: z.string().min(8).max(128),
	amount: PaymentAmountSchema.optional(), // full refund if omitted
	reason: z.enum(["requested_by_customer", "duplicate", "fraudulent", "other"]).default("requested_by_customer"),
});
export type RefundPaymentRequest = z.infer<typeof RefundPaymentRequestSchema>;

// ---------------------------------------------------------------------------
// Webhook envelope (already validated at the route boundary)
// ---------------------------------------------------------------------------

/** Canonical webhook event shape persisted to `payment_gateway_webhook_events`. */
export const BillingPaymentGatewayWebhookEventSchema = z.object({
	provider: BillingPaymentGatewayProviderEnum,
	tenant_id: uuid,
	property_id: uuid.optional(),
	gateway_event_id: z.string().min(1).max(255),
	event_type: z.string().min(1).max(100),
	gateway_reference: z.string().max(255).optional(),
	occurred_at: z.string(), // ISO-8601 timestamp from PSP
	payload: z.record(z.unknown()),
});
export type BillingPaymentGatewayWebhookEvent = z.infer<typeof BillingPaymentGatewayWebhookEventSchema>;

// ---------------------------------------------------------------------------
// Provider interface — the contract every adapter must implement
// ---------------------------------------------------------------------------

/**
 * `BillingPaymentGateway` is the abstraction the billing service depends on. Concrete
 * adapters (Stripe, Adyen, Worldpay…) live in
 * `Apps/billing-service/src/gateways/<provider>/` and are selected by the
 * `payment_gateway_configurations.provider` column at runtime.
 *
 * Adapter implementation rules:
 *   1. Use the supplied `idempotency_key` as the PSP's idempotency header
 *      verbatim. Do NOT regenerate.
 *   2. NEVER throw on declines — return `result.status = "FAILED"` with
 *      `result.error.declined_by_issuer = true`. Throw only on infrastructure
 *      failures (network, malformed gateway response).
 *   3. NEVER persist money as floats. Strings only.
 *   4. `verifyWebhook()` MUST use a constant-time HMAC comparison.
 */
export interface BillingPaymentGateway {
	readonly provider: BillingPaymentGatewayProvider;

	/** Authorize (and optionally capture) a payment. */
	authorize(request: AuthorizePaymentRequest): Promise<BillingPaymentGatewayResult>;

	/** Capture a previously authorized payment. */
	capture(request: CapturePaymentRequest): Promise<BillingPaymentGatewayResult>;

	/** Void / cancel an uncaptured authorization. */
	void(request: VoidPaymentRequest): Promise<BillingPaymentGatewayResult>;

	/** Refund a captured payment (full or partial). */
	refund(request: RefundPaymentRequest): Promise<BillingPaymentGatewayResult>;

	/**
	 * Verify an inbound webhook signature.
	 * MUST use a constant-time comparison and reject events older than the
	 * configured tolerance window (default 5 minutes).
	 *
	 * @param rawBody - Exact bytes the gateway signed (NEVER re-stringify the parsed JSON)
	 * @param signatureHeader - Provider-specific signature header value
	 * @param secret - Tenant-scoped webhook secret loaded from `payment_gateway_configurations`
	 */
	verifyWebhook(
		rawBody: Buffer,
		signatureHeader: string,
		secret: string,
	): { valid: boolean; reason?: string };
}

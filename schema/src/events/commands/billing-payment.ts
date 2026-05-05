/**
 * Billing command schemas — Payment domain
 * Covers capture, refund, apply, authorize, void, increment-auth, and overpayment.
 * @category commands
 */

import { z } from "zod";

import { PaymentMethodEnum } from "../../shared/enums.js";

export const BillingPaymentCaptureCommandSchema = z
	.object({
		payment_reference: z.string().trim().min(3).max(100),
		property_id: z.string().uuid(),
		/** Target folio directly — use for standalone folios without a reservation. */
		folio_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		guest_id: z.string().uuid().optional(),
		amount: z.coerce.number().positive(),
		currency: z.string().length(3).optional(),
		payment_method: PaymentMethodEnum,
		/** Transaction type — ADVANCE_DEPOSIT records to deposit liability account, not revenue. */
		transaction_type: z
			.enum(["PAYMENT", "ADVANCE_DEPOSIT", "DEPOSIT_APPLIED", "SECURITY_DEPOSIT"])
			.default("PAYMENT"),
		/** Exchange rate to the property's base currency when paying in a foreign currency. */
		exchange_rate: z.coerce.number().positive().optional(),
		/** ISO-4217 currency code of the original payment before conversion. */
		original_currency: z.string().length(3).optional(),
		gateway: z
			.object({
				name: z.string().max(100).optional(),
				reference: z.string().max(150).optional(),
				response: z.record(z.unknown()).optional(),
			})
			.optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingPaymentCaptureCommand = z.infer<
	typeof BillingPaymentCaptureCommandSchema
>;

export const BillingPaymentRefundCommandSchema = z
	.object({
		payment_id: z.string().uuid().optional(),
		payment_reference: z.string().trim().max(100).optional(),
		property_id: z.string().uuid(),
		reservation_id: z.string().uuid(),
		guest_id: z.string().uuid(),
		amount: z.coerce.number().positive(),
		currency: z.string().length(3).optional(),
		reason: z.string().max(500).optional(),
		refund_reference: z.string().trim().max(120).optional(),
		payment_method: PaymentMethodEnum.optional(),
	})
	.refine(
		(value) => Boolean(value.payment_id || value.payment_reference),
		"payment_id or payment_reference is required",
	);

export type BillingPaymentRefundCommand = z.infer<
	typeof BillingPaymentRefundCommandSchema
>;

export const BillingPaymentApplyCommandSchema = z
	.object({
		payment_id: z.string().uuid(),
		invoice_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		amount: z.coerce.number().positive().optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.invoice_id || value.reservation_id),
		"invoice_id or reservation_id is required",
	);

export type BillingPaymentApplyCommand = z.infer<
	typeof BillingPaymentApplyCommandSchema
>;

/**
 * Pre-authorize a payment hold (AUTHORIZE) without capturing funds.
 * Used for deposit guarantees at check-in.
 */
export const BillingPaymentAuthorizeCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	payment_method: PaymentMethodEnum,
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentAuthorizeCommand = z.infer<
	typeof BillingPaymentAuthorizeCommandSchema
>;

/**
 * Increment an existing pre-authorization by a specified amount.
 * Used when a guest extends their stay or incurs additional charges
 * that exceed the original authorization hold.
 */
export const BillingPaymentIncrementAuthCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	additional_amount: z.coerce.number().positive(),
	reason: z.string().max(500).optional(),
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentIncrementAuthCommand = z.infer<
	typeof BillingPaymentIncrementAuthCommandSchema
>;

/**
 * Void a previously authorized payment.
 * Only AUTHORIZED payments can be voided.
 */
export const BillingPaymentVoidCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentVoidCommand = z.infer<
	typeof BillingPaymentVoidCommandSchema
>;

/**
 * Handle an overpayment on a folio.
 * Actions: REFUND (auto-refund the credit), CREDIT (keep on account), HOLD (flag for front desk).
 * Standard: USALI 12th Ed §7.3 (Guest Credit Balance), GAAP credit liability.
 */
export const BillingOverpaymentHandleCommandSchema = z.object({
	property_id: z.string().uuid(),
	folio_id: z.string().uuid(),
	/**
	 * REFUND: issue refund to original payment method for the credit_balance amount.
	 * CREDIT: leave credit_balance on folio for future charges.
	 * HOLD: flag for front-desk manual review without auto-action.
	 */
	action: z.enum(["REFUND", "CREDIT", "HOLD"]),
	/** Override the amount to act on (must be ≤ credit_balance). Omit to use full credit_balance. */
	amount: z.coerce.number().positive().optional(),
	notes: z.string().max(1000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingOverpaymentHandleCommand = z.infer<
	typeof BillingOverpaymentHandleCommandSchema
>;

/**
 * DEV DOC
 * Module: events/commands/billing.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { PaymentMethodEnum } from "../../shared/enums.js";

export const BillingPaymentCaptureCommandSchema = z.object({
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
});

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

export const BillingInvoiceCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	invoice_number: z.string().max(50).optional(),
	invoice_date: z.coerce.date().optional(),
	due_date: z.coerce.date().optional(),
	total_amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceCreateCommand = z.infer<
	typeof BillingInvoiceCreateCommandSchema
>;

export const BillingInvoiceAdjustCommandSchema = z
	.object({
		invoice_id: z.string().uuid(),
		adjustment_amount: z.coerce.number(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => value.adjustment_amount !== 0,
		"adjustment_amount cannot be zero",
	);

export type BillingInvoiceAdjustCommand = z.infer<
	typeof BillingInvoiceAdjustCommandSchema
>;

export const BillingChargePostCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	charge_code: z.string().max(50).optional(),
	department_code: z.string().max(20).optional(),
	description: z.string().max(2000).optional(),
	posted_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargePostCommand = z.infer<
	typeof BillingChargePostCommandSchema
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

export const BillingFolioTransferCommandSchema = z.object({
	from_reservation_id: z.string().uuid(),
	to_reservation_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioTransferCommand = z.infer<
	typeof BillingFolioTransferCommandSchema
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
 * Execute night audit: post room charges for in-house guests,
 * mark no-shows, and advance the business date.
 */
export const BillingNightAuditCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.string().optional(),
	post_room_charges: z.boolean().optional(),
	mark_no_shows: z.boolean().optional(),
	advance_date: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingNightAuditCommand = z.infer<
	typeof BillingNightAuditCommandSchema
>;

/**
 * Close/settle a folio. Sets folio_status to CLOSED or SETTLED
 * depending on balance. Zero balance → SETTLED, otherwise CLOSED.
 */
export const BillingFolioCloseCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	close_reason: z.string().max(500).optional(),
	force: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioCloseCommand = z.infer<
	typeof BillingFolioCloseCommandSchema
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

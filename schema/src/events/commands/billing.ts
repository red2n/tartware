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
	charge_code: z.string().max(50).default("MISC"),
	department_code: z.string().max(20).optional(),
	posting_type: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
	quantity: z.coerce.number().int().positive().default(1),
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
 * Transfer a specific charge posting from one folio to another.
 * Creates TRANSFER-type audit records on both folios.
 */
export const BillingChargeTransferCommandSchema = z.object({
	posting_id: z.string().uuid(),
	to_folio_id: z.string().uuid().optional(),
	to_reservation_id: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
}).refine(
	(v) => Boolean(v.to_folio_id || v.to_reservation_id),
	"to_folio_id or to_reservation_id is required",
);

export type BillingChargeTransferCommand = z.infer<
	typeof BillingChargeTransferCommandSchema
>;

/**
 * Split a charge across multiple folios.
 * Creates partial-amount postings on each target folio.
 */
export const BillingFolioSplitCommandSchema = z.object({
	posting_id: z.string().uuid(),
	splits: z.array(z.object({
		folio_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		amount: z.coerce.number().positive(),
		description: z.string().max(500).optional(),
	})).min(2, "At least two split targets are required"),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioSplitCommand = z.infer<
	typeof BillingFolioSplitCommandSchema
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

/**
 * Void a charge posting on a folio.
 * Creates a reversal VOID posting and adjusts folio balance.
 */
export const BillingChargeVoidCommandSchema = z.object({
	posting_id: z.string().uuid(),
	void_reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargeVoidCommand = z.infer<
	typeof BillingChargeVoidCommandSchema
>;

/**
 * Finalize an invoice, locking it for editing.
 * Only DRAFT or SENT invoices can be finalized.
 */
export const BillingInvoiceFinalizeCommandSchema = z.object({
	invoice_id: z.string().uuid(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceFinalizeCommand = z.infer<
	typeof BillingInvoiceFinalizeCommandSchema
>;

// ─── Commission Commands ─────────────────────────────────────────────────────

/**
 * Calculate and record commission for a reservation.
 * Typically triggered on checkout when a travel_agent_id or booking_source
 * with commission config is present.
 */
export const CommissionCalculateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	travel_agent_id: z.string().uuid().optional(),
	booking_source_id: z.string().uuid().optional(),
	room_revenue: z.coerce.number().nonnegative(),
	total_revenue: z.coerce.number().nonnegative(),
	nights: z.coerce.number().int().positive(),
	currency: z.string().length(3).default("USD"),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionCalculateCommand = z.infer<
	typeof CommissionCalculateCommandSchema
>;

/**
 * Approve a pending commission for payout.
 */
export const CommissionApproveCommandSchema = z.object({
	commission_id: z.string().uuid(),
	approved_by: z.string().uuid(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionApproveCommand = z.infer<
	typeof CommissionApproveCommandSchema
>;

/**
 * Mark a commission as paid.
 */
export const CommissionMarkPaidCommandSchema = z.object({
	commission_id: z.string().uuid(),
	payment_reference: z.string().max(100),
	payment_date: z.coerce.date().optional(),
	payment_method: z.string().max(50).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionMarkPaidCommand = z.infer<
	typeof CommissionMarkPaidCommandSchema
>;

/**
 * Generate a periodic commission statement for an agent/company.
 */
export const CommissionStatementGenerateCommandSchema = z.object({
	property_id: z.string().uuid(),
	company_id: z.string().uuid().optional(),
	agent_id: z.string().uuid().optional(),
	period_start: z.coerce.date(),
	period_end: z.coerce.date(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionStatementGenerateCommand = z.infer<
	typeof CommissionStatementGenerateCommandSchema
>;

// ─── Accounts Receivable Command Schemas ─────────────────────────────────────

/**
 * Post an AR entry (typically on checkout for direct-bill guests).
 */
export const BillingArPostCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	folio_id: z.string().uuid().optional(),
	account_type: z.enum([
		"guest",
		"corporate",
		"travel_agent",
		"group",
		"direct_bill",
		"city_ledger",
		"other",
	]),
	account_id: z.string().uuid(),
	account_name: z.string().max(255),
	amount: z.number().positive(),
	payment_terms: z.string().max(50).default("NET_30"),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArPostCommand = z.infer<typeof BillingArPostCommandSchema>;

/**
 * Apply a payment against an outstanding AR balance.
 */
export const BillingArApplyPaymentCommandSchema = z.object({
	ar_id: z.string().uuid(),
	amount: z.number().positive(),
	payment_reference: z.string().max(100),
	payment_method: z.string().max(50).optional(),
	payment_date: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArApplyPaymentCommand = z.infer<
	typeof BillingArApplyPaymentCommandSchema
>;

/**
 * Recalculate aging buckets for all open AR entries.
 */
export const BillingArAgeCommandSchema = z.object({
	property_id: z.string().uuid(),
	as_of_date: z.coerce.date().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArAgeCommand = z.infer<typeof BillingArAgeCommandSchema>;

/**
 * Write off an uncollectible AR entry.
 */
export const BillingArWriteOffCommandSchema = z.object({
	ar_id: z.string().uuid(),
	write_off_amount: z.number().positive(),
	reason: z.string().max(2000),
	approved_by: z.string().uuid().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArWriteOffCommand = z.infer<
	typeof BillingArWriteOffCommandSchema
>;

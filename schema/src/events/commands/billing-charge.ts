/**
 * Billing command schemas — Charge domain
 * Covers charge posting, void, chargeback (record + status update), and comp.
 * @category commands
 */

import { z } from "zod";

export const BillingChargePostCommandSchema = z
	.object({
		property_id: z.string().uuid(),
		/** Target folio directly — use for standalone folios without a reservation. */
		folio_id: z.string().uuid().optional(),
		/** Resolves to the guest folio for this reservation. Optional when folio_id is provided. */
		reservation_id: z.string().uuid().optional(),
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
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingChargePostCommand = z.infer<
	typeof BillingChargePostCommandSchema
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
 * Record a processor-initiated chargeback against a completed payment.
 * Updates the refunds table with chargeback fields and adjusts folio balance.
 */
export const BillingChargebackRecordCommandSchema = z.object({
	property_id: z.string().uuid(),
	payment_reference: z.string().trim().min(3).max(100),
	chargeback_amount: z.coerce.number().positive(),
	chargeback_reason: z.string().max(200),
	chargeback_reference: z.string().max(100).optional(),
	chargeback_date: z.coerce.date().optional(),
	/**
	 * Initial status when recording. Defaults to RECEIVED.
	 * Use billing.chargeback.update_status to advance through the state machine.
	 */
	initial_status: z
		.enum(["RECEIVED", "EVIDENCE_SUBMITTED"])
		.default("RECEIVED"),
	/** Supporting evidence documents (file URLs or base64 refs). */
	evidence: z
		.array(
			z.object({
				type: z.enum(["RECEIPT", "CORRESPONDENCE", "CONTRACT", "PHOTO", "OTHER"]),
				description: z.string().max(500).optional(),
				url: z.string().max(2048).optional(),
			}),
		)
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargebackRecordCommand = z.infer<
	typeof BillingChargebackRecordCommandSchema
>;

/**
 * Advance a chargeback through its state machine:
 *   RECEIVED → EVIDENCE_SUBMITTED → WON | LOST
 * When transitioning to LOST the folio is automatically reopened.
 */
export const BillingChargebackUpdateStatusCommandSchema = z.object({
	refund_id: z.string().uuid(),
	chargeback_status: z.enum(["EVIDENCE_SUBMITTED", "WON", "LOST"]),
	evidence: z
		.array(
			z.object({
				type: z.enum(["RECEIPT", "CORRESPONDENCE", "CONTRACT", "PHOTO", "OTHER"]),
				description: z.string().max(500).optional(),
				url: z.string().max(2048).optional(),
			}),
		)
		.optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargebackUpdateStatusCommand = z.infer<
	typeof BillingChargebackUpdateStatusCommandSchema
>;

/**
 * Post a complimentary (comp) charge to a reservation or folio.
 * Records against the comp_accounting table for budget tracking.
 * The comp_type must match an active comp category in the property config.
 * Blocks if the property's comp budget for the period is exhausted.
 */
export const BillingCompPostCommandSchema = z
	.object({
		property_id: z.string().uuid(),
		folio_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		comp_type: z.enum(["ROOM", "FOOD_BEVERAGE", "SPA", "ACTIVITY", "MISCELLANEOUS"]),
		amount: z.coerce.number().positive(),
		currency: z.string().length(3).optional(),
		charge_code: z.string().max(50).optional(),
		description: z.string().max(500).optional(),
		/** Manager authorizing the comp. Required for ROOM comps. */
		authorized_by: z.string().uuid().optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingCompPostCommand = z.infer<typeof BillingCompPostCommandSchema>;

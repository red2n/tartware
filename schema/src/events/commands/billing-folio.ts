/**
 * Billing command schemas — Folio domain
 * Covers transfer, split, create, close, reopen, merge, window, and charge transfer.
 * @category commands
 */

import { z } from "zod";

import { FolioTypeEnum } from "../../shared/enums.js";

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
export const BillingChargeTransferCommandSchema = z
	.object({
		posting_id: z.string().uuid(),
		to_folio_id: z.string().uuid().optional(),
		to_reservation_id: z.string().uuid().optional(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
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
	splits: z
		.array(
			z.object({
				folio_id: z.string().uuid().optional(),
				reservation_id: z.string().uuid().optional(),
				amount: z.coerce.number().positive(),
				description: z.string().max(500).optional(),
			}),
		)
		.min(2, "At least two split targets are required"),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioSplitCommand = z.infer<
	typeof BillingFolioSplitCommandSchema
>;

/**
 * Close/settle a folio. Sets folio_status to CLOSED or SETTLED
 * depending on balance. Zero balance → SETTLED, otherwise CLOSED.
 */
export const BillingFolioCloseCommandSchema = z
	.object({
		property_id: z.string().uuid(),
		/** Close a specific folio by ID — use for standalone folios. */
		folio_id: z.string().uuid().optional(),
		/** Resolves to the guest folio for this reservation. */
		reservation_id: z.string().uuid().optional(),
		close_reason: z.string().max(500).optional(),
		force: z.boolean().optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingFolioCloseCommand = z.infer<
	typeof BillingFolioCloseCommandSchema
>;

/**
 * Reopen a SETTLED or CLOSED folio to allow further charge postings or adjustments.
 * Typically triggered automatically when a chargeback is raised against the folio.
 * Requires a reason for audit trail.
 */
export const BillingFolioReopenCommandSchema = z
	.object({
		property_id: z.string().uuid(),
		folio_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		reason: z.string().min(1).max(500),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingFolioReopenCommand = z.infer<
	typeof BillingFolioReopenCommandSchema
>;

/**
 * Merge a source folio into a target folio.
 * All charge postings from the source folio are re-attributed to the target.
 * The source folio is moved to CLOSED status. Irreversible — only Finance Manager
 * or above may merge folios. Both folios must be OPEN.
 */
export const BillingFolioMergeCommandSchema = z.object({
	property_id: z.string().uuid(),
	source_folio_id: z.string().uuid(),
	target_folio_id: z.string().uuid(),
	reason: z.string().min(1).max(500),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioMergeCommand = z.infer<
	typeof BillingFolioMergeCommandSchema
>;

/**
 * Create a standalone folio (house account, city ledger, walk-in, incidental).
 * Industry standard: PMS systems support folios independent of reservations
 * for walk-in POS charges, company direct-bill, internal house accounts, etc.
 * reservation_id is optional — only required for GUEST-type folios.
 */
export const BillingFolioCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	folio_type: FolioTypeEnum,
	/** Required for GUEST folios, optional for others. */
	reservation_id: z.string().uuid().optional(),
	/** Guest or company contact. */
	guest_id: z.string().uuid().optional(),
	/** Descriptive label for the folio (e.g., "Acme Corp City Ledger"). */
	folio_name: z.string().max(200).optional(),
	/** Billing address for the folio. */
	billing_address: z.record(z.unknown()).optional(),
	/** Tax exemption reference, if applicable. */
	tax_exempt_id: z.string().max(100).optional(),
	currency: z.string().length(3).default("USD"),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioCreateCommand = z.infer<
	typeof BillingFolioCreateCommandSchema
>;

/**
 * Create a folio window for date-based split billing within a single stay.
 * E.g., "company pays Mon-Fri, guest pays Sat-Sun".
 */
export const BillingFolioWindowCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	folio_id: z.string().uuid(),
	window_start: z.coerce.date(),
	window_end: z.coerce.date(),
	billed_to: z.string().max(255),
	billed_to_type: z.enum(["GUEST", "CORPORATE", "TRAVEL_AGENT", "OTHER"]),
	notes: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioWindowCreateCommand = z.infer<
	typeof BillingFolioWindowCreateCommandSchema
>;

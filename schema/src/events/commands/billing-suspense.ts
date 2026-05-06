/**
 * Billing command schemas — Suspense Account (ACCT-03)
 *
 * When a charge cannot be routed to a valid folio (folio closed, guest checked out,
 * no matching routing rule), it goes to the property's SUSPENSE folio instead of
 * failing or being silently lost. Suspense items must be reviewed and cleared daily.
 *
 * @category commands
 */

import { z } from "zod";

// ─── Resolve a suspense item ──────────────────────────────────────────────────

/**
 * Move a charge from the suspense folio to the correct target folio.
 *
 * The posting (charge_posting row) is re-targeted to `target_folio_id`.
 * The original suspense posting is voided (or a reversal is created if already
 * in a closed period). A note is appended to both entries explaining the transfer.
 */
export const BillingSuspenseResolveCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** The charge_postings.posting_id currently sitting in the suspense folio. */
	suspense_posting_id: z.string().uuid(),
	/** The folio to move this charge to. */
	target_folio_id: z.string().uuid(),
	/** Optional override note explaining why the charge is being moved. */
	resolution_notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingSuspenseResolveCommand = z.infer<
	typeof BillingSuspenseResolveCommandSchema
>;

// ─── Write off an unresolvable suspense item ──────────────────────────────────

/**
 * Write off a suspense item that cannot be attributed to any guest or folio.
 *
 * GL treatment: DR Bad Debt Expense / CR Suspense Account.
 * Requires MANAGER approval.
 */
export const BillingSuspenseWriteOffCommandSchema = z.object({
	property_id: z.string().uuid(),
	suspense_posting_id: z.string().uuid(),
	reason: z.string().min(10).max(2000),
	approved_by: z.string().uuid().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingSuspenseWriteOffCommand = z.infer<
	typeof BillingSuspenseWriteOffCommandSchema
>;

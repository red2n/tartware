/**
 * Billing command schemas — Group Master Billing (ACCT-17)
 *
 * Group bookings require a master folio that aggregates room charges for all
 * group members, with optional split between company master and individual folios.
 *
 * @category commands
 */

import { z } from "zod";

// ─── Setup group billing ──────────────────────────────────────────────────────

/**
 * Bootstrap group master billing when a group booking is created.
 *
 * Creates the master folio (folio_type = MASTER) linked to the group booking,
 * then auto-creates routing rules that direct all room charges for the group's
 * reservations to the master folio. Incidentals are left on individual folios
 * unless `route_incidentals_to_master` is true.
 *
 * Idempotent: safe to re-fire if the master folio already exists (ON CONFLICT DO NOTHING).
 */
export const BillingGroupSetupCommandSchema = z.object({
	property_id: z.string().uuid(),
	group_booking_id: z.string().uuid(),
	/** Company or travel-agent account to bill. Required for direct-bill groups. */
	company_id: z.string().uuid().optional(),
	/** If true, all charges (including incidentals) go to master folio. Default: false. */
	route_incidentals_to_master: z.boolean().default(false),
	/**
	 * Percentage of room charges routed to master folio. Remainder stays on
	 * individual folios (e.g. 80 = 80% company / 20% guest). Default: 100.
	 */
	master_billing_percent: z.number().min(0).max(100).default(100),
	payment_terms: z
		.enum(["NET30", "NET45", "NET60", "DUE_ON_RECEIPT"])
		.default("NET30"),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingGroupSetupCommand = z.infer<
	typeof BillingGroupSetupCommandSchema
>;

// ─── Group checkout ───────────────────────────────────────────────────────────

/**
 * Orchestrated group checkout.
 *
 * Steps (in order):
 *   1. Verify all individual folios are settled or zero-balance.
 *   2. Consolidate any unrouted charges from individual folios to master.
 *   3. Generate a group invoice against the master folio.
 *   4. If company_id + direct-bill: trigger `ar.city_ledger.transfer`.
 *   5. Update all group reservations to CHECKED_OUT status.
 */
export const BillingGroupCheckoutCommandSchema = z.object({
	property_id: z.string().uuid(),
	group_booking_id: z.string().uuid(),
	/** Force checkout even if some individual folios have non-zero balances. */
	force: z.boolean().default(false),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingGroupCheckoutCommand = z.infer<
	typeof BillingGroupCheckoutCommandSchema
>;

// ─── Add reservation to group billing ────────────────────────────────────────

/**
 * Add a late-added reservation to an existing group's billing setup.
 *
 * Creates routing rules for the new reservation to the existing master folio.
 */
export const BillingGroupAddReservationCommandSchema = z.object({
	property_id: z.string().uuid(),
	group_booking_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	route_incidentals_to_master: z.boolean().default(false),
	master_billing_percent: z.number().min(0).max(100).default(100),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingGroupAddReservationCommand = z.infer<
	typeof BillingGroupAddReservationCommandSchema
>;

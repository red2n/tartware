/**
 * DEV DOC
 * Module: events/commands/loyalty.ts
 * Description: Loyalty command schemas for point earn/redeem/expire operations
 * Primary exports: LoyaltyPointsEarnCommandSchema, LoyaltyPointsRedeemCommandSchema, LoyaltyPointsExpireSweepCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Command to earn loyalty points for a guest.
 * Inserts a ledger row into loyalty_point_transactions
 * and updates the running balance on the loyalty program.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const LoyaltyPointsEarnCommandSchema = z.object({
	// Target Guest & Program
	guest_id: uuid,
	program_id: uuid,

	// Points
	points: z.number().int().positive(),

	// Reference
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),

	// Expiry
	expires_at: z.coerce.date().optional(),

	// Metadata & Idempotency
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyPointsEarnCommand = z.infer<
	typeof LoyaltyPointsEarnCommandSchema
>;

/**
 * Command to redeem loyalty points for a guest.
 * Deducts points from the loyalty program balance
 * and records a redeem transaction in the ledger.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const LoyaltyPointsRedeemCommandSchema = z.object({
	// Target Guest & Program
	guest_id: uuid,
	program_id: uuid,

	// Points
	points: z.number().int().positive(),

	// Reference
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),

	// Metadata & Idempotency
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyPointsRedeemCommand = z.infer<
	typeof LoyaltyPointsRedeemCommandSchema
>;

/**
 * Sweep and expire loyalty points that have passed their expiry date.
 * Processes one tenant at a time, expiring un-expired ledger rows
 * where expires_at <= now, decrementing program balances accordingly.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const LoyaltyPointsExpireSweepCommandSchema = z.object({
	// Optionally scope to a single property
	property_id: uuid.optional(),

	// Batch size for the sweep (default handled by handler)
	batch_size: z.number().int().positive().max(5000).optional(),

	// Metadata & Idempotency
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyPointsExpireSweepCommand = z.infer<
	typeof LoyaltyPointsExpireSweepCommandSchema
>;

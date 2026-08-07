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

/**
 * Enrol a guest into a loyalty program, creating the guest_loyalty_programs row
 * that the points ledger commands (earn/redeem/expire) operate against.
 *
 * Without an enrolment row, loyalty.points.earn fails with
 * LOYALTY_PROGRAM_NOT_FOUND — this command is the entry point to that flow.
 *
 * @category commands
 * @synchronized 2026-08-07
 */
export const LoyaltyProgramEnrollCommandSchema = z.object({
	// Target guest
	guest_id: uuid,

	// Caller-supplied program id. Enrolment is processed asynchronously and no
	// read endpoint lists a guest's programs, so supplying the id up front is the
	// only way a caller can address the program afterwards (balance, ledger).
	// Mirrors reservation.create accepting reservation_id.
	program_id: uuid.optional(),

	// Optional property scope (null = tenant-wide membership)
	property_id: uuid.optional(),

	// Program identity
	program_name: z.string().min(1).max(100),
	program_tier: z.string().max(50).optional(),
	membership_number: z.string().max(100).optional(),

	// Opening balance / status
	points_balance: z.number().int().nonnegative().optional(),
	enrollment_channel: z.string().max(50).optional(),

	// Metadata & Idempotency
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyProgramEnrollCommand = z.infer<
	typeof LoyaltyProgramEnrollCommandSchema
>;

/**
 * Loyalty Command Schemas
 * Commands for loyalty point earn/redeem operations
 * @category commands
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Command to earn loyalty points for a guest
 * Inserts a ledger row and updates the running balance
 */
export const LoyaltyPointsEarnCommandSchema = z.object({
	guest_id: uuid,
	program_id: uuid,
	points: z.number().int().positive(),
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),
	expires_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyPointsEarnCommand = z.infer<
	typeof LoyaltyPointsEarnCommandSchema
>;

/**
 * Command to redeem loyalty points for a guest
 * Deducts points and updates the running balance
 */
export const LoyaltyPointsRedeemCommandSchema = z.object({
	guest_id: uuid,
	program_id: uuid,
	points: z.number().int().positive(),
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().optional(),
});

export type LoyaltyPointsRedeemCommand = z.infer<
	typeof LoyaltyPointsRedeemCommandSchema
>;

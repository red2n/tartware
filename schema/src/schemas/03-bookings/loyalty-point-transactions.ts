/**
 * LoyaltyPointTransactions Schema
 * @table loyalty_point_transactions
 * @category 03-bookings
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete LoyaltyPointTransactions schema
 */
export const LoyaltyPointTransactionsSchema = z.object({
	transaction_id: uuid,
	tenant_id: uuid,
	program_id: uuid,
	guest_id: uuid,
	transaction_type: z.enum([
		"earn",
		"redeem",
		"expire",
		"adjust",
		"bonus",
		"transfer_in",
		"transfer_out",
	]),
	points: z.number().int(),
	balance_after: z.number().int(),
	currency_value: money.optional(),
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),
	expires_at: z.coerce.date().optional(),
	expired: z.boolean().optional(),
	performed_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
});

export type LoyaltyPointTransactions = z.infer<
	typeof LoyaltyPointTransactionsSchema
>;

/**
 * Schema for creating a new loyalty point transaction
 */
export const CreateLoyaltyPointTransactionsSchema =
	LoyaltyPointTransactionsSchema.omit({
		transaction_id: true,
		created_at: true,
	});

export type CreateLoyaltyPointTransactions = z.infer<
	typeof CreateLoyaltyPointTransactionsSchema
>;

/**
 * DEV DOC
 * Module: schemas/03-bookings/loyalty-point-transactions.ts
 * Description: LoyaltyPointTransactions Schema - Loyalty points ledger
 * Table: loyalty_point_transactions
 * Category: 03-bookings
 * Primary exports: LoyaltyPointTransactionsSchema, CreateLoyaltyPointTransactionsSchema
 * @table loyalty_point_transactions
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * LoyaltyPointTransactions Schema
 * Immutable ledger of all loyalty point movements: earn, redeem,
 * expire, adjust, bonus, and inter-program transfers. Each row
 * records the delta and the running balance snapshot.
 *
 * @table loyalty_point_transactions
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const LoyaltyPointTransactionsSchema = z.object({
	// Primary Key
	transaction_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,

	// Linked Entities
	program_id: uuid,
	guest_id: uuid,

	// Transaction Details
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

	// Financial
	currency_value: money.optional(),

	// Reference
	reference_type: z.string().optional(),
	reference_id: uuid.optional(),
	description: z.string().max(500).optional(),

	// Expiry
	expires_at: z.coerce.date().optional(),
	expired: z.boolean().optional(),

	// Audit Fields
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

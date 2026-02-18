/**
 * DEV DOC
 * Module: schemas/04-financial/comp-transactions.ts
 * Description: CompTransactions Schema - Comp charge transactions
 * Table: comp_transactions
 * Category: 04-financial
 * Primary exports: CompTransactionsSchema, CreateCompTransactionsSchema, UpdateCompTransactionsSchema
 * @table comp_transactions
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * CompTransactions Schema
 * Individual complementary charge transactions linked
 * to guest folios and authorizers.
 *
 * @table comp_transactions
 * @category 04-financial
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

export const CompTransactionsSchema = z.object({
	// Primary Key
	comp_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Comp Details
	comp_number: z.string().min(1).max(50),
	comp_category: z.string().max(50),

	// Linked Entities
	guest_id: uuid,
	reservation_id: uuid.optional().nullable(),
	folio_id: uuid.optional().nullable(),
	charge_posting_id: uuid.optional().nullable(),

	// Authorization
	authorizer_id: uuid,
	reason_code: z.string().max(50).optional().nullable(),
	authorization_code: z.string().max(50).optional().nullable(),
	authorization_date: z.coerce.date().default(() => new Date()),

	// Financial
	original_amount: money,
	comp_amount: money,
	tax_amount: money.default(0),
	comp_offset_account: z.string().max(50).optional().nullable(),
	currency_code: z.string().max(3).default("USD"),

	// Status
	comp_status: z.string().max(20).default("PENDING"),
	posted_at: z.coerce.date().optional().nullable(),
	voided_at: z.coerce.date().optional().nullable(),
	void_reason: z.string().optional().nullable(),

	// Guest Context
	guest_tier: z.string().max(50).optional().nullable(),
	guest_lifetime_value: z.number().optional().nullable(),

	// Notes
	comp_description: z.string().optional().nullable(),
	internal_notes: z.string().optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),

	// Optimistic Locking
	version: z.number().int().default(0),
});

export type CompTransactions = z.infer<typeof CompTransactionsSchema>;

export const CreateCompTransactionsSchema = CompTransactionsSchema.omit({
	comp_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	version: true,
	posted_at: true,
	voided_at: true,
});

export type CreateCompTransactions = z.infer<
	typeof CreateCompTransactionsSchema
>;

export const UpdateCompTransactionsSchema =
	CompTransactionsSchema.partial().omit({
		comp_id: true,
		tenant_id: true,
		property_id: true,
		created_at: true,
		created_by: true,
	});

export type UpdateCompTransactions = z.infer<
	typeof UpdateCompTransactionsSchema
>;

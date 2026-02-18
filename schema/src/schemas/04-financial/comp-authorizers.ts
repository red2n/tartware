/**
 * DEV DOC
 * Module: schemas/04-financial/comp-authorizers.ts
 * Description: CompAuthorizers Schema - Staff authorized to issue comps
 * Table: comp_authorizers
 * Category: 04-financial
 * Primary exports: CompAuthorizersSchema, CreateCompAuthorizersSchema, UpdateCompAuthorizersSchema
 * @table comp_authorizers
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * CompAuthorizers Schema
 * Staff members authorized to issue complementary charges
 * with daily, monthly, and annual limits.
 *
 * @table comp_authorizers
 * @category 04-financial
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const CompAuthorizersSchema = z.object({
	// Primary Key
	authorizer_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Authorizer Information
	user_id: uuid,
	department: z.string().min(1).max(100),
	authorization_level: z.string().max(20),

	// Limits
	daily_comp_limit: money,
	single_comp_limit: money,
	monthly_comp_limit: money.optional().nullable(),
	annual_comp_limit: money.optional().nullable(),

	// Allowed Categories
	allowed_categories: z.array(z.string()).optional(),

	// Usage Tracking
	comps_issued_today_count: z.number().int().default(0),
	comps_issued_today_amount: money.default(0),
	comps_issued_mtd_amount: money.default(0),
	comps_issued_ytd_amount: money.default(0),
	last_comp_date: z.coerce.date().optional().nullable(),

	// Delegation
	can_delegate: z.boolean().default(false),
	delegated_by: uuid.optional().nullable(),

	// Status
	is_active: z.boolean().default(true),
	effective_from: z.coerce.date(),
	effective_to: z.coerce.date().optional().nullable(),

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
});

export type CompAuthorizers = z.infer<typeof CompAuthorizersSchema>;

export const CreateCompAuthorizersSchema = CompAuthorizersSchema.omit({
	authorizer_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	comps_issued_today_count: true,
	comps_issued_today_amount: true,
	comps_issued_mtd_amount: true,
	comps_issued_ytd_amount: true,
	last_comp_date: true,
});

export type CreateCompAuthorizers = z.infer<typeof CreateCompAuthorizersSchema>;

export const UpdateCompAuthorizersSchema = CompAuthorizersSchema.partial().omit(
	{
		authorizer_id: true,
		tenant_id: true,
		property_id: true,
		created_at: true,
		created_by: true,
	},
);

export type UpdateCompAuthorizers = z.infer<typeof UpdateCompAuthorizersSchema>;

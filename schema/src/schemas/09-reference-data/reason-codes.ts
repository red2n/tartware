/**
 * DEV DOC
 * Module: schemas/09-reference-data/reason-codes.ts
 * Description: ReasonCodes Schema - Configurable reason codes for operations
 * Table: reason_codes
 * Category: 09-reference-data
 * Primary exports: ReasonCodesSchema, CreateReasonCodesSchema, UpdateReasonCodesSchema
 * @table reason_codes
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * ReasonCodes Schema
 * Configurable reason codes for operational actions across
 * room moves, rate overrides, deposit overrides, cancellations,
 * comps, refunds, and more.
 *
 * @table reason_codes
 * @category 09-reference-data
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

export const ReasonCodesSchema = z.object({
	// Primary Key
	reason_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),

	// Reason Identification
	reason_code: z.string().min(1).max(50),
	reason_name: z.string().min(1).max(200),
	reason_description: z.string().optional().nullable(),

	// Classification
	reason_category: z.string().max(50),

	// Authorization
	requires_approval: z.boolean().default(false),
	approval_level: z.string().max(20).default("NONE"),

	// Financial Impact
	has_financial_impact: z.boolean().default(false),
	default_adjustment_percent: z.number().optional().nullable(),
	max_adjustment_amount: money.optional().nullable(),

	// Usage
	display_order: z.number().int().default(0),
	is_active: z.boolean().default(true),
	usage_count: z.number().int().default(0),

	// Notes
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
});

export type ReasonCodes = z.infer<typeof ReasonCodesSchema>;

export const CreateReasonCodesSchema = ReasonCodesSchema.omit({
	reason_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	usage_count: true,
});

export type CreateReasonCodes = z.infer<typeof CreateReasonCodesSchema>;

export const UpdateReasonCodesSchema = ReasonCodesSchema.partial().omit({
	reason_id: true,
	tenant_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateReasonCodes = z.infer<typeof UpdateReasonCodesSchema>;

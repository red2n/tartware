/**
 * DEV DOC
 * Module: schemas/02-inventory/rate-restrictions.ts
 * Description: RateRestrictions Schema — Yield management inventory controls (CTA/CTD/LOS/Closed)
 * Table: rate_restrictions
 * Category: 02-inventory
 * Primary exports: RateRestrictionsSchema, CreateRateRestrictionsSchema, UpdateRateRestrictionsSchema, RateRestrictionTypeEnum, RateRestrictionSourceEnum, RateRestrictionListQuerySchema
 * @table rate_restrictions
 * @category 02-inventory
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/** Restriction type enum aligned with rate_restrictions table CHECK constraint */
export const RateRestrictionTypeEnum = z.enum([
	"CTA",
	"CTD",
	"MIN_LOS",
	"MAX_LOS",
	"MIN_ADVANCE",
	"MAX_ADVANCE",
	"CLOSED",
]);

/** Source enum for how the restriction was created */
export const RateRestrictionSourceEnum = z.enum([
	"manual",
	"rule_engine",
	"channel_manager",
	"import",
]);

/**
 * Complete RateRestrictions schema
 */
export const RateRestrictionsSchema = z.object({
	restriction_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid.nullable().optional(),
	rate_plan_id: uuid.nullable().optional(),
	restriction_date: z.coerce.date(),
	restriction_type: RateRestrictionTypeEnum,
	restriction_value: z.number().int(),
	is_active: z.boolean(),
	source: RateRestrictionSourceEnum,
	reason: z.string().nullable().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	created_by: uuid.nullable().optional(),
	updated_by: uuid.nullable().optional(),
	is_deleted: z.boolean(),
	deleted_at: z.coerce.date().nullable().optional(),
	deleted_by: uuid.nullable().optional(),
});

export type RateRestrictions = z.infer<typeof RateRestrictionsSchema>;

/**
 * Create RateRestrictions input schema
 */
export const CreateRateRestrictionsSchema = RateRestrictionsSchema.omit({
	restriction_id: true,
	created_at: true,
	updated_at: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateRateRestrictions = z.infer<
	typeof CreateRateRestrictionsSchema
>;

/**
 * Update RateRestrictions input schema
 */
export const UpdateRateRestrictionsSchema = RateRestrictionsSchema.pick({
	restriction_value: true,
	is_active: true,
	reason: true,
	metadata: true,
}).partial();

export type UpdateRateRestrictions = z.infer<
	typeof UpdateRateRestrictionsSchema
>;

/**
 * Query schema for rate restrictions list endpoint
 */
export const RateRestrictionListQuerySchema = z.object({
	tenant_id: z.string().uuid(),
	property_id: z.string().uuid().optional(),
	room_type_id: z.string().uuid().optional(),
	rate_plan_id: z.string().uuid().optional(),
	restriction_type: RateRestrictionTypeEnum.optional(),
	date_from: z.string().date().optional(),
	date_to: z.string().date().optional(),
	is_active: z
		.string()
		.transform((v) => v === "true")
		.optional(),
	limit: z.coerce.number().int().min(1).max(1000).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type RateRestrictionListQuery = z.infer<
	typeof RateRestrictionListQuerySchema
>;

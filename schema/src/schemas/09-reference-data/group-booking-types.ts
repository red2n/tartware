/**
 * DEV DOC
 * Module: schemas/09-reference-data/group-booking-types.ts
 * Description: GroupBookingTypes Schema - Dynamic group booking type lookup table
 * Table: group_booking_types
 * Category: 09-reference-data
 * Primary exports: GroupBookingTypesSchema, CreateGroupBookingTypesSchema, UpdateGroupBookingTypesSchema
 * @table group_booking_types
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * GroupBookingTypes Schema
 * Configurable group booking types (CONFERENCE, WEDDING, TOUR, etc.)
 * replacing hardcoded ENUM. Includes cutoff policies, attrition percentages,
 * meeting/catering flags, and revenue classification.
 *
 * @table group_booking_types
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid, percentage } from "../../shared/base-schemas.js";

/**
 * Dynamic field validation - actual values enforced by database CHECK constraints.
 * Do NOT hardcode enum values here; they are configurable in the lookup table.
 */
const segmentCode = z.string().min(1).max(30);
const revenueCategoryCode = z.string().min(1).max(20);

/**
 * Complete GroupBookingTypes schema
 */
export const GroupBookingTypesSchema = z.object({
	// Primary Key
	type_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Group Type Identification
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	description: z.string().optional().nullable(),

	// Classification (values enforced by DB CHECK constraints)
	segment: segmentCode.default("CORPORATE"),
	revenue_category: revenueCategoryCode.default("ROOMS"),

	// Group Behavior
	requires_contract: z.boolean().default(true),
	requires_deposit: z.boolean().default(true),
	requires_rooming_list: z.boolean().default(true),
	requires_billing_instructions: z.boolean().default(false),

	// Cutoff & Policies
	default_cutoff_days: z.number().int().min(0).default(14),
	default_attrition_pct: percentage.default(20.0),
	default_deposit_pct: percentage.default(10.0),

	// Meeting/Catering Flags
	has_meeting_space: z.boolean().default(false),
	has_catering: z.boolean().default(false),
	has_av_equipment: z.boolean().default(false),
	has_exhibit_space: z.boolean().default(false),

	// Room Block Defaults
	min_rooms_pickup: z.number().int().min(0).default(10),
	default_comp_ratio: z.number().int().min(0).default(50),

	// Arrival/Departure Patterns
	typical_arrival_day: z.string().max(10).optional().nullable(),
	typical_departure_day: z.string().max(10).optional().nullable(),
	typical_length_nights: z.number().int().min(1).optional().nullable(),

	// Rate & Pricing
	rate_negotiable: z.boolean().default(true),
	allows_dynamic_pricing: z.boolean().default(false),
	default_discount_pct: percentage.optional().nullable(),

	// Sales Attribution
	requires_sales_manager: z.boolean().default(true),
	commission_eligible: z.boolean().default(true),
	default_commission_pct: percentage.default(10.0),

	// Mapping to Legacy Enum
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),

	// System vs Custom
	is_system: z.boolean().default(false),
	is_active: z.boolean().default(true),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type GroupBookingTypes = z.infer<typeof GroupBookingTypesSchema>;

/**
 * Schema for creating a new group booking type
 */
export const CreateGroupBookingTypesSchema = GroupBookingTypesSchema.omit({
	type_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
}).extend({
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
});

export type CreateGroupBookingTypes = z.infer<
	typeof CreateGroupBookingTypesSchema
>;

/**
 * Schema for updating a group booking type
 */
export const UpdateGroupBookingTypesSchema =
	GroupBookingTypesSchema.partial().omit({
		type_id: true,
		created_at: true,
		created_by: true,
		is_system: true,
	});

export type UpdateGroupBookingTypes = z.infer<
	typeof UpdateGroupBookingTypesSchema
>;

/**
 * DEV DOC
 * Module: schemas/09-reference-data/room-status-codes.ts
 * Description: RoomStatusCodes Schema - Dynamic room status lookup table
 * Table: room_status_codes
 * Category: 09-reference-data
 * Primary exports: RoomStatusCodesSchema, CreateRoomStatusCodesSchema, UpdateRoomStatusCodesSchema
 * @table room_status_codes
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * RoomStatusCodes Schema
 * Configurable room status codes replacing hardcoded ENUM.
 * Allows tenant-specific and property-specific status codes
 * while maintaining system defaults for core operational statuses.
 *
 * @table room_status_codes
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Room status category enum
 */
export const RoomStatusCategoryEnum = z.enum([
	"OPERATIONAL",
	"MAINTENANCE",
	"BLOCKED",
	"SPECIAL",
]);

export type RoomStatusCategory = z.infer<typeof RoomStatusCategoryEnum>;

/**
 * Complete RoomStatusCodes schema
 */
export const RoomStatusCodesSchema = z.object({
	// Primary Key
	status_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Status Identification
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	description: z.string().optional().nullable(),

	// Behavioral Flags (determines PMS logic)
	is_occupied: z.boolean().default(false),
	is_sellable: z.boolean().default(true),
	is_clean: z.boolean().default(false),
	requires_housekeeping: z.boolean().default(false),
	requires_inspection: z.boolean().default(false),
	is_out_of_inventory: z.boolean().default(false),

	// State Machine: Valid Transitions
	allowed_next_codes: z.array(z.string()).optional().nullable(),

	// Mapping to Legacy Enum (for migration)
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	badge_class: z.string().max(50).optional().nullable(),

	// Categorization
	category: RoomStatusCategoryEnum.default("OPERATIONAL"),

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

export type RoomStatusCodes = z.infer<typeof RoomStatusCodesSchema>;

/**
 * Schema for creating a new room status code
 */
export const CreateRoomStatusCodesSchema = RoomStatusCodesSchema.omit({
	status_id: true,
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

export type CreateRoomStatusCodes = z.infer<typeof CreateRoomStatusCodesSchema>;

/**
 * Schema for updating a room status code
 */
export const UpdateRoomStatusCodesSchema = RoomStatusCodesSchema.partial().omit(
	{
		status_id: true,
		created_at: true,
		created_by: true,
		is_system: true,
	},
);

export type UpdateRoomStatusCodes = z.infer<typeof UpdateRoomStatusCodesSchema>;

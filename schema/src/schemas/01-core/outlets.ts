/**
 * DEV DOC
 * Module: schemas/01-core/outlets.ts
 * Description: Outlets Schema - F&B outlets and service points
 * Table: outlets
 * Category: 01-core
 * Primary exports: OutletsSchema, CreateOutletsSchema, UpdateOutletsSchema
 * @table outlets
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Outlets Schema
 * F&B outlets, retail shops, spa reception, and other
 * revenue-generating service points within a property.
 *
 * @table outlets
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

export const OutletsSchema = z.object({
	// Primary Key
	outlet_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,
	building_id: uuid.optional().nullable(),

	// Outlet Identification
	outlet_code: z.string().min(1).max(50),
	outlet_name: z.string().min(1).max(200),
	outlet_type: z.string().max(50),

	// Cuisine
	cuisine_type: z.string().max(100).optional().nullable(),
	dining_style: z.string().max(50).optional().nullable(),

	// Capacity
	seating_capacity: z.number().int().optional().nullable(),
	indoor_seats: z.number().int().optional().nullable(),
	outdoor_seats: z.number().int().optional().nullable(),
	private_dining_capacity: z.number().int().optional().nullable(),
	bar_seats: z.number().int().optional().nullable(),

	// Location
	floor: z.number().int().optional().nullable(),
	location_description: z.string().max(200).optional().nullable(),

	// Operating Hours
	breakfast_open: z.string().optional().nullable(),
	breakfast_close: z.string().optional().nullable(),
	lunch_open: z.string().optional().nullable(),
	lunch_close: z.string().optional().nullable(),
	dinner_open: z.string().optional().nullable(),
	dinner_close: z.string().optional().nullable(),
	all_day_open: z.string().optional().nullable(),
	all_day_close: z.string().optional().nullable(),
	operating_days: z.string().max(50).optional().nullable(),
	seasonal: z.boolean().default(false),
	seasonal_open_date: z.coerce.date().optional().nullable(),
	seasonal_close_date: z.coerce.date().optional().nullable(),

	// Meal Periods
	serves_breakfast: z.boolean().default(false),
	serves_lunch: z.boolean().default(false),
	serves_dinner: z.boolean().default(false),
	serves_brunch: z.boolean().default(false),
	serves_afternoon_tea: z.boolean().default(false),
	serves_all_day: z.boolean().default(false),
	serves_room_service: z.boolean().default(false),

	// Financial
	revenue_center_code: z.string().max(50).optional().nullable(),
	gl_account: z.string().max(50).optional().nullable(),
	charge_code: z.string().max(50).optional().nullable(),
	average_check: money.optional().nullable(),
	currency_code: z.string().max(3).default("USD"),

	// Contact
	phone_extension: z.string().max(20).optional().nullable(),
	direct_phone: z.string().max(20).optional().nullable(),
	email: z.string().max(255).optional().nullable(),
	reservation_email: z.string().max(255).optional().nullable(),

	// Features
	dress_code: z.string().max(100).optional().nullable(),
	reservations_required: z.boolean().default(false),
	walk_ins_accepted: z.boolean().default(true),
	wheelchair_accessible: z.boolean().default(true),
	child_friendly: z.boolean().default(true),
	pet_friendly: z.boolean().default(false),
	live_entertainment: z.boolean().default(false),
	has_happy_hour: z.boolean().default(false),

	// POS Integration
	pos_system: z.string().max(100).optional().nullable(),
	pos_terminal_count: z.number().int().default(0),

	// Status
	is_active: z.boolean().default(true),
	outlet_status: z.string().max(20).default("OPEN"),

	// Media
	photo_url: z.string().max(500).optional().nullable(),
	menu_url: z.string().max(500).optional().nullable(),
	reservation_url: z.string().max(500).optional().nullable(),

	// Notes
	internal_notes: z.string().optional().nullable(),
	guest_description: z.string().optional().nullable(),

	// Display
	display_order: z.number().int().default(0),

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

export type Outlets = z.infer<typeof OutletsSchema>;

export const CreateOutletsSchema = OutletsSchema.omit({
	outlet_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	version: true,
});

export type CreateOutlets = z.infer<typeof CreateOutletsSchema>;

export const UpdateOutletsSchema = OutletsSchema.partial().omit({
	outlet_id: true,
	tenant_id: true,
	property_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateOutlets = z.infer<typeof UpdateOutletsSchema>;

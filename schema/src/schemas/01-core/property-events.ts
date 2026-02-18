/**
 * DEV DOC
 * Module: schemas/01-core/property-events.ts
 * Description: PropertyEvents Schema - Property-level events affecting operations
 * Table: property_events
 * Category: 01-core
 * Primary exports: PropertyEventsSchema, CreatePropertyEventsSchema, UpdatePropertyEventsSchema
 * @table property_events
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * PropertyEvents Schema
 * Property-level events (holidays, local events, property events)
 * that affect operations, pricing, and demand.
 *
 * @table property_events
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const PropertyEventsSchema = z.object({
	// Primary Key
	event_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Event Information
	event_code: z.string().min(1).max(50),
	event_name: z.string().min(1).max(200),
	event_description: z.string().optional().nullable(),

	// Classification
	event_type: z.string().max(50),

	// Date & Time
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	start_time: z.string().optional().nullable(),
	end_time: z.string().optional().nullable(),
	all_day: z.boolean().default(true),

	// Impact
	impact_level: z.string().max(20).default("LOW"),
	affects_pricing: z.boolean().default(false),
	affects_availability: z.boolean().default(false),
	affects_staffing: z.boolean().default(false),
	expected_occupancy_impact_percent: z.number().optional().nullable(),
	demand_multiplier: z.number().default(1.0),

	// Visibility
	is_public: z.boolean().default(true),
	show_on_website: z.boolean().default(false),
	show_in_app: z.boolean().default(false),
	show_to_staff: z.boolean().default(true),

	// Location
	event_location: z.string().max(200).optional().nullable(),
	distance_from_property_km: z.number().optional().nullable(),

	// Recurrence
	is_recurring: z.boolean().default(false),
	recurrence_pattern: z.string().max(50).optional().nullable(),
	parent_event_id: uuid.optional().nullable(),

	// Status
	event_status: z.string().max(20).default("SCHEDULED"),
	is_active: z.boolean().default(true),

	// Media
	image_url: z.string().max(500).optional().nullable(),
	external_url: z.string().max(500).optional().nullable(),

	// Notes
	internal_notes: z.string().optional().nullable(),
	guest_facing_notes: z.string().optional().nullable(),
	operational_notes: z.string().optional().nullable(),

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

export type PropertyEvents = z.infer<typeof PropertyEventsSchema>;

export const CreatePropertyEventsSchema = PropertyEventsSchema.omit({
	event_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
});

export type CreatePropertyEvents = z.infer<typeof CreatePropertyEventsSchema>;

export const UpdatePropertyEventsSchema = PropertyEventsSchema.partial().omit({
	event_id: true,
	tenant_id: true,
	property_id: true,
	created_at: true,
	created_by: true,
});

export type UpdatePropertyEvents = z.infer<typeof UpdatePropertyEventsSchema>;

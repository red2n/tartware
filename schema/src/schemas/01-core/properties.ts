/**
 * Property Schema - Core property metadata
 * @table properties
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import {
	uuid,
	money,
	jsonbMetadata,
	auditTimestamps,
	softDelete,
	nonEmptyString,
} from "../../shared/base-schemas.js";

const JsonbObject = z.record(z.unknown()).default({});

/**
 * Core property entity schema
 */
export const PropertySchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_name: nonEmptyString.max(255),
	property_code: nonEmptyString.max(50),
	address: JsonbObject.describe("Structured address object"),
	phone: z.string().optional(),
	email: z.string().email().optional(),
	website: z.string().url().optional(),
	property_type: z.string().optional(),
	star_rating: money.optional(),
	total_rooms: z.number().int().nonnegative().default(0),
	tax_id: z.string().optional(),
	license_number: z.string().optional(),
	currency: z.string().length(3).default("USD"),
	timezone: z.string().default("UTC"),
	config: JsonbObject.describe("Property-specific configuration"),
	integrations: JsonbObject.describe("Integration settings"),
	is_active: z.boolean().default(true),
	metadata: jsonbMetadata,
	...auditTimestamps,
	...softDelete,
	version: z.bigint().default(BigInt(0)),
});

export type Property = z.infer<typeof PropertySchema>;

export const CreatePropertySchema = PropertySchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	deleted_at: true,
	version: true,
});

export type CreateProperty = z.infer<typeof CreatePropertySchema>;

export const UpdatePropertySchema = PropertySchema.partial().extend({
	id: uuid,
});

export type UpdateProperty = z.infer<typeof UpdatePropertySchema>;

/**
 * Property stats extension for dashboards/API responses
 */
export const PropertyWithStatsSchema = PropertySchema.extend({
	room_count: z.number().int().nonnegative().default(0),
	occupied_rooms: z.number().int().nonnegative().default(0),
	available_rooms: z.number().int().nonnegative().default(0),
	occupancy_rate: z.number().min(0).max(1).default(0),
	current_guests: z.number().int().nonnegative().default(0),
	todays_arrivals: z.number().int().nonnegative().default(0),
	todays_departures: z.number().int().nonnegative().default(0),
});

export type PropertyWithStats = z.infer<typeof PropertyWithStatsSchema>;

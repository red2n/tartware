/**
 * DEV DOC
 * Module: schemas/06-integrations/metasearch-click-log.ts
 * Description: MetasearchClickLog Schema - Metasearch click tracking and conversion
 * Table: metasearch_click_log
 * Category: 06-integrations
 * Primary exports: MetasearchClickLogSchema, CreateMetasearchClickLogSchema
 * @table metasearch_click_log
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * MetasearchClickLog Schema
 * Tracks individual clicks from metasearch platforms (Google Hotel Ads,
 * TripAdvisor, Trivago, etc.) with cost, search context, device info,
 * and conversion attribution back to reservations.
 *
 * @table metasearch_click_log
 * @category 06-integrations
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const MetasearchClickLogSchema = z.object({
	// Primary Key
	click_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Linked Configuration
	config_id: uuid,
	platform: z.string(),

	// Click Details
	click_timestamp: z.coerce.date(),
	cost: z.number().nonnegative(),
	currency: z.string().max(3).optional(),

	// Search Context
	search_type: z
		.enum([
			"hotel_search",
			"map",
			"pointofsale",
			"room_bundle",
			"price_feed",
			"other",
		])
		.optional(),
	device: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional(),
	market: z.string().optional(),

	// Stay Details
	check_in_date: z.coerce.date().optional(),
	check_out_date: z.coerce.date().optional(),
	occupancy: z.number().int().optional(),

	// Conversion
	converted: z.boolean().optional(),
	reservation_id: uuid.optional(),
	conversion_value: money.optional(),
	conversion_timestamp: z.coerce.date().optional(),

	// Tracking
	tracking_id: z.string().optional(),
	landing_page_url: z.string().optional(),

	// Audit Fields
	created_at: z.coerce.date().optional(),
});

export type MetasearchClickLog = z.infer<typeof MetasearchClickLogSchema>;

/**
 * Schema for recording a new metasearch click
 */
export const CreateMetasearchClickLogSchema = MetasearchClickLogSchema.omit({
	click_id: true,
	created_at: true,
});

export type CreateMetasearchClickLog = z.infer<
	typeof CreateMetasearchClickLogSchema
>;

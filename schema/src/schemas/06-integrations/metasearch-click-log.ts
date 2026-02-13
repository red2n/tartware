/**
 * MetasearchClickLog Schema
 * @table metasearch_click_log
 * @category 06-integrations
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MetasearchClickLog schema
 */
export const MetasearchClickLogSchema = z.object({
	click_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	config_id: uuid,
	platform: z.string(),
	click_timestamp: z.coerce.date(),
	cost: z.number().nonnegative(),
	currency: z.string().max(3).optional(),
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
	check_in_date: z.coerce.date().optional(),
	check_out_date: z.coerce.date().optional(),
	occupancy: z.number().int().optional(),
	converted: z.boolean().optional(),
	reservation_id: uuid.optional(),
	conversion_value: money.optional(),
	conversion_timestamp: z.coerce.date().optional(),
	tracking_id: z.string().optional(),
	landing_page_url: z.string().optional(),
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

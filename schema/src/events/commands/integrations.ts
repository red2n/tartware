/**
 * DEV DOC
 * Module: events/commands/integrations.ts
 * Description: Integration command schemas for OTA sync, rate push, webhook retry, and mapping updates
 * Primary exports: IntegrationOtaSyncRequestCommandSchema, IntegrationOtaRatePushCommandSchema, IntegrationWebhookRetryCommandSchema, IntegrationMappingUpdateCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

export const IntegrationOtaSyncRequestCommandSchema = z.object({
	property_id: z.string().uuid(),
	ota_code: z.string().min(2).max(50),
	sync_scope: z.string().max(50).optional(),
	requested_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationOtaSyncRequestCommand = z.infer<
	typeof IntegrationOtaSyncRequestCommandSchema
>;

export const IntegrationOtaRatePushCommandSchema = z.object({
	property_id: z.string().uuid(),
	ota_code: z.string().min(2).max(50),
	rate_plan_id: z.string().uuid().optional(),
	effective_from: z.coerce.date().optional(),
	effective_to: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationOtaRatePushCommand = z.infer<
	typeof IntegrationOtaRatePushCommandSchema
>;

export const IntegrationWebhookRetryCommandSchema = z.object({
	subscription_id: z.string().uuid(),
	event_id: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationWebhookRetryCommand = z.infer<
	typeof IntegrationWebhookRetryCommandSchema
>;

export const IntegrationMappingUpdateCommandSchema = z.object({
	mapping_id: z.string().uuid(),
	mapping_payload: z.record(z.unknown()),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationMappingUpdateCommand = z.infer<
	typeof IntegrationMappingUpdateCommandSchema
>;

// =====================================================
// METASEARCH COMMANDS
// =====================================================

/**
 * Create a metasearch platform configuration (CPC/CPA bid strategy, budget, feed).
 */
export const MetasearchConfigCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	platform: z.enum([
		"google_hotel_ads",
		"tripadvisor",
		"kayak",
		"trivago",
		"skyscanner",
		"wego",
		"bing_hotel_ads",
		"other",
	]),
	platform_account_id: z.string().max(200).optional(),
	bid_strategy: z.enum([
		"manual_cpc",
		"auto_cpc",
		"target_roas",
		"cpa",
		"commission",
	]),
	max_cpc: z.number().nonnegative().optional(),
	default_cpc: z.number().nonnegative().optional(),
	cpc_multipliers: z.record(z.unknown()).optional(),
	target_cpa: z.number().nonnegative().optional(),
	cpa_commission_percent: z.number().min(0).max(100).optional(),
	budget_daily: z.number().nonnegative().optional(),
	budget_monthly: z.number().nonnegative().optional(),
	currency: z.string().max(3).optional(),
	rate_feed_url: z.string().url().optional(),
	rate_feed_format: z.string().max(50).optional(),
	rate_feed_frequency: z.string().max(50).optional(),
	target_roas: z.number().nonnegative().optional(),
	min_booking_value: z.number().nonnegative().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type MetasearchConfigCreateCommand = z.infer<
	typeof MetasearchConfigCreateCommandSchema
>;

/**
 * Update an existing metasearch configuration.
 */
export const MetasearchConfigUpdateCommandSchema = z.object({
	config_id: z.string().uuid(),
	is_active: z.boolean().optional(),
	bid_strategy: z
		.enum(["manual_cpc", "auto_cpc", "target_roas", "cpa", "commission"])
		.optional(),
	max_cpc: z.number().nonnegative().optional(),
	default_cpc: z.number().nonnegative().optional(),
	cpc_multipliers: z.record(z.unknown()).optional(),
	target_cpa: z.number().nonnegative().optional(),
	cpa_commission_percent: z.number().min(0).max(100).optional(),
	budget_daily: z.number().nonnegative().optional(),
	budget_monthly: z.number().nonnegative().optional(),
	rate_feed_url: z.string().url().optional(),
	rate_feed_format: z.string().max(50).optional(),
	rate_feed_frequency: z.string().max(50).optional(),
	target_roas: z.number().nonnegative().optional(),
	min_booking_value: z.number().nonnegative().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type MetasearchConfigUpdateCommand = z.infer<
	typeof MetasearchConfigUpdateCommandSchema
>;

/**
 * Record a click from a metasearch platform with cost and search context.
 */
export const MetasearchClickRecordCommandSchema = z.object({
	config_id: z.string().uuid(),
	property_id: z.string().uuid(),
	platform: z.string().max(100),
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
	market: z.string().max(10).optional(),
	check_in_date: z.coerce.date().optional(),
	check_out_date: z.coerce.date().optional(),
	occupancy: z.number().int().positive().optional(),
	tracking_id: z.string().max(255).optional(),
	landing_page_url: z.string().url().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type MetasearchClickRecordCommand = z.infer<
	typeof MetasearchClickRecordCommandSchema
>;

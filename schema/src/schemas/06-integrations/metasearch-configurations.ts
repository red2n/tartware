/**
 * DEV DOC
 * Module: schemas/06-integrations/metasearch-configurations.ts
 * Description: MetasearchConfigurations Schema - Metasearch platform bid and feed config
 * Table: metasearch_configurations
 * Category: 06-integrations
 * Primary exports: MetasearchConfigurationsSchema, CreateMetasearchConfigurationsSchema, UpdateMetasearchConfigurationsSchema
 * @table metasearch_configurations
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * MetasearchConfigurations Schema
 * Per-property configuration for metasearch advertising platforms:
 * bid strategies (manual CPC, auto CPC, target ROAS, CPA, commission),
 * budget caps, rate-feed URLs, and performance targets.
 *
 * @table metasearch_configurations
 * @category 06-integrations
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const MetasearchConfigurationsSchema = z.object({
	// Primary Key
	config_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Platform Identification
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
	platform_account_id: z.string().optional(),
	is_active: z.boolean().optional(),

	// Bid Strategy
	bid_strategy: z.enum([
		"manual_cpc",
		"auto_cpc",
		"target_roas",
		"cpa",
		"commission",
	]),
	max_cpc: money.optional(),
	default_cpc: money.optional(),
	cpc_multipliers: z.record(z.unknown()).optional(),
	target_cpa: money.optional(),
	cpa_commission_percent: z.number().optional(),

	// Budget
	budget_daily: money.optional(),
	budget_monthly: money.optional(),
	currency: z.string().max(3).optional(),

	// Rate Feed
	rate_feed_url: z.string().optional(),
	rate_feed_format: z.string().optional(),
	rate_feed_frequency: z.string().optional(),

	// Performance Targets
	target_roas: z.number().optional(),
	min_booking_value: money.optional(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type MetasearchConfigurations = z.infer<
	typeof MetasearchConfigurationsSchema
>;

/**
 * Schema for creating a new metasearch configuration
 */
export const CreateMetasearchConfigurationsSchema =
	MetasearchConfigurationsSchema.omit({
		config_id: true,
		created_at: true,
		updated_at: true,
	});

export type CreateMetasearchConfigurations = z.infer<
	typeof CreateMetasearchConfigurationsSchema
>;

/**
 * Schema for updating a metasearch configuration
 */
export const UpdateMetasearchConfigurationsSchema =
	MetasearchConfigurationsSchema.partial();

export type UpdateMetasearchConfigurations = z.infer<
	typeof UpdateMetasearchConfigurationsSchema
>;

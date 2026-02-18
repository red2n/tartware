/**
 * DEV DOC
 * Module: schemas/06-integrations/dynamic-pricing-rules-ml.ts
 * Description: DynamicPricingRulesMl Schema
 * Table: dynamic_pricing_rules_ml
 * Category: 06-integrations
 * Primary exports: DynamicPricingRulesMlSchema, CreateDynamicPricingRulesMlSchema, UpdateDynamicPricingRulesMlSchema
 * @table dynamic_pricing_rules_ml
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * DynamicPricingRulesMl Schema
 * @table dynamic_pricing_rules_ml
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete DynamicPricingRulesMl schema
 */
export const DynamicPricingRulesMlSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	rule_name: z.string(),
	rule_description: z.string().optional(),
	rule_priority: z.number().int().optional(),
	room_type_id: uuid.optional(),
	apply_to_all_room_types: z.boolean().optional(),
	applicable_market_segments: z.array(z.string()).optional(),
	applicable_booking_channels: z.array(z.string()).optional(),
	applicable_rate_codes: z.array(z.string()).optional(),
	effective_from: z.coerce.date(),
	effective_to: z.coerce.date().optional(),
	apply_monday: z.boolean().optional(),
	apply_tuesday: z.boolean().optional(),
	apply_wednesday: z.boolean().optional(),
	apply_thursday: z.boolean().optional(),
	apply_friday: z.boolean().optional(),
	apply_saturday: z.boolean().optional(),
	apply_sunday: z.boolean().optional(),
	pricing_strategy: z.string(),
	ml_model_name: z.string().optional(),
	ml_model_version: z.string().optional(),
	ml_model_endpoint: z.string().optional(),
	use_reinforcement_learning: z.boolean().optional(),
	learning_rate: money.optional(),
	exploration_rate: money.optional(),
	base_rate_source: z.string().optional(),
	custom_base_rate: money.optional(),
	min_rate: money,
	max_rate: money,
	floor_rate: money.optional(),
	ceiling_rate: money.optional(),
	occupancy_threshold_low: money.optional(),
	occupancy_threshold_medium: money.optional(),
	occupancy_threshold_high: money.optional(),
	low_occupancy_adjustment: money.optional(),
	medium_occupancy_adjustment: money.optional(),
	high_occupancy_adjustment: money.optional(),
	booking_window_rules: z.record(z.unknown()).optional(),
	last_minute_threshold_days: z.number().int().optional(),
	last_minute_adjustment: money.optional(),
	advance_booking_threshold_days: z.number().int().optional(),
	advance_booking_adjustment: money.optional(),
	monitor_competitors: z.boolean().optional(),
	competitor_ids: z.array(uuid).optional(),
	competitor_positioning: z.string().optional(),
	competitor_offset_percentage: money.optional(),
	competitor_offset_amount: money.optional(),
	event_impact_multiplier: money.optional(),
	high_demand_events: z.array(z.string()).optional(),
	low_demand_periods: z.array(z.string()).optional(),
	monday_adjustment: money.optional(),
	tuesday_adjustment: money.optional(),
	wednesday_adjustment: money.optional(),
	thursday_adjustment: money.optional(),
	friday_adjustment: money.optional(),
	saturday_adjustment: money.optional(),
	sunday_adjustment: money.optional(),
	los_rules: z.record(z.unknown()).optional(),
	adjustment_frequency: z.string().optional(),
	last_adjustment_at: z.coerce.date().optional(),
	max_price_increase_per_day: money.optional(),
	max_price_decrease_per_day: money.optional(),
	price_rounding_rule: z.string().optional(),
	ab_testing_enabled: z.boolean().optional(),
	control_group_percentage: money.optional(),
	test_variant: z.string().optional(),
	target_occupancy: money.optional(),
	target_adr: money.optional(),
	target_revpar: money.optional(),
	allow_manual_override: z.boolean().optional(),
	override_expiry_hours: z.number().int().optional(),
	is_active: z.boolean().optional(),
	is_automated: z.boolean().optional(),
	total_applications: z.number().int().optional(),
	successful_optimizations: z.number().int().optional(),
	revenue_generated: money.optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type DynamicPricingRulesMl = z.infer<typeof DynamicPricingRulesMlSchema>;

/**
 * Schema for creating a new dynamic pricing rules ml
 */
export const CreateDynamicPricingRulesMlSchema =
	DynamicPricingRulesMlSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateDynamicPricingRulesMl = z.infer<
	typeof CreateDynamicPricingRulesMlSchema
>;

/**
 * Schema for updating a dynamic pricing rules ml
 */
export const UpdateDynamicPricingRulesMlSchema =
	DynamicPricingRulesMlSchema.partial();

export type UpdateDynamicPricingRulesMl = z.infer<
	typeof UpdateDynamicPricingRulesMlSchema
>;

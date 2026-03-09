/**
 * DEV DOC
 * Module: events/commands/revenue.ts
 * Description: Revenue command schemas for pricing rules, recommendations, forecasting, and demand management
 * Primary exports: RevenueForecastComputeCommandSchema, RevenuePricingRule*CommandSchema, RevenueDemand*CommandSchema, RevenueCompetitor*CommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

// ── Shared enums ─────────────────────────────────────

/** Pricing rule types aligned with the pricing_rules table CHECK constraint */
const PricingRuleTypeEnum = z.enum([
	"occupancy_based",
	"demand_based",
	"day_of_week",
	"seasonal",
	"event_driven",
	"length_of_stay",
	"advance_purchase",
	"last_minute",
	"competitor_based",
	"segment_based",
	"channel_based",
	"time_based",
	"custom",
]);

/** Adjustment types aligned with the pricing_rules table */
const AdjustmentTypeEnum = z.enum([
	"percentage_increase",
	"percentage_decrease",
	"fixed_amount_increase",
	"fixed_amount_decrease",
	"set_to_amount",
	"set_to_market_rate",
	"match_competitor",
	"set_to_bar",
]);

/** Demand level aligned with demand_calendar.demand_level */
const DemandLevelEnum = z.enum(["LOW", "MODERATE", "HIGH", "PEAK", "BLACKOUT"]);

// ── Forecast Commands ────────────────────────────────

/**
 * Compute revenue forecasts for a property.
 * Analyzes historical reservation data (occupancy, ADR, room revenue)
 * over a training window and projects forward across multiple scenarios.
 *
 * @category commands
 */
export const RevenueForecastComputeCommandSchema = z.object({
	property_id: z.string().uuid(),
	forecast_period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
	horizon_days: z.number().int().min(1).max(365).default(30),
	training_days: z.number().int().min(30).max(730).default(90),
	scenarios: z
		.array(
			z.enum([
				"base",
				"optimistic",
				"pessimistic",
				"conservative",
				"aggressive",
			]),
		)
		.default(["base", "optimistic", "pessimistic"]),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueForecastComputeCommand = z.infer<
	typeof RevenueForecastComputeCommandSchema
>;

// ── Pricing Rule CRUD Commands ───────────────────────

/**
 * Create a new pricing rule.
 * Per industry standard (Oracle OPERA, IDeaS, Duetto), pricing rules
 * define automatic rate adjustments based on demand signals.
 */
export const RevenuePricingRuleCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_name: z.string().min(1).max(200),
	rule_type: PricingRuleTypeEnum,
	rule_category: z
		.enum(["dynamic", "promotional", "restriction", "yield", "strategic"])
		.optional(),
	description: z.string().max(1000).optional(),
	priority: z.number().int().min(1).max(9999).default(100),
	is_active: z.boolean().default(false),
	effective_from: z.string().date(),
	effective_until: z.string().date().optional(),
	applies_to_room_types: z.array(z.string().uuid()).optional(),
	applies_to_rate_plans: z.array(z.string().uuid()).optional(),
	applies_to_channels: z.array(z.string()).optional(),
	applies_to_segments: z.array(z.string()).optional(),
	applies_monday: z.boolean().optional(),
	applies_tuesday: z.boolean().optional(),
	applies_wednesday: z.boolean().optional(),
	applies_thursday: z.boolean().optional(),
	applies_friday: z.boolean().optional(),
	applies_saturday: z.boolean().optional(),
	applies_sunday: z.boolean().optional(),
	conditions: z.record(z.unknown()).default({}),
	adjustment_type: AdjustmentTypeEnum,
	adjustment_value: z.number(),
	adjustment_cap_min: z.number().optional(),
	adjustment_cap_max: z.number().optional(),
	min_rate: z.number().min(0).optional(),
	max_rate: z.number().min(0).optional(),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
	apply_closed_to_arrival: z.boolean().optional(),
	apply_closed_to_departure: z.boolean().optional(),
	apply_stop_sell: z.boolean().optional(),
	can_combine_with_other_rules: z.boolean().default(true),
	requires_approval: z.boolean().default(false),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenuePricingRuleCreateCommand = z.infer<
	typeof RevenuePricingRuleCreateCommandSchema
>;

/**
 * Update an existing pricing rule's parameters.
 */
export const RevenuePricingRuleUpdateCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_id: z.string().uuid(),
	rule_name: z.string().min(1).max(200).optional(),
	description: z.string().max(1000).optional(),
	priority: z.number().int().min(1).max(9999).optional(),
	effective_from: z.string().date().optional(),
	effective_until: z.string().date().optional(),
	applies_to_room_types: z.array(z.string().uuid()).optional(),
	applies_to_rate_plans: z.array(z.string().uuid()).optional(),
	applies_to_channels: z.array(z.string()).optional(),
	applies_to_segments: z.array(z.string()).optional(),
	applies_monday: z.boolean().optional(),
	applies_tuesday: z.boolean().optional(),
	applies_wednesday: z.boolean().optional(),
	applies_thursday: z.boolean().optional(),
	applies_friday: z.boolean().optional(),
	applies_saturday: z.boolean().optional(),
	applies_sunday: z.boolean().optional(),
	conditions: z.record(z.unknown()).optional(),
	adjustment_type: AdjustmentTypeEnum.optional(),
	adjustment_value: z.number().optional(),
	adjustment_cap_min: z.number().optional(),
	adjustment_cap_max: z.number().optional(),
	min_rate: z.number().min(0).optional(),
	max_rate: z.number().min(0).optional(),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
	apply_closed_to_arrival: z.boolean().optional(),
	apply_closed_to_departure: z.boolean().optional(),
	apply_stop_sell: z.boolean().optional(),
	can_combine_with_other_rules: z.boolean().optional(),
	requires_approval: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	last_modified_reason: z.string().max(500).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenuePricingRuleUpdateCommand = z.infer<
	typeof RevenuePricingRuleUpdateCommandSchema
>;

/**
 * Activate a pricing rule (set is_active = true, is_paused = false).
 */
export const RevenuePricingRuleActivateCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenuePricingRuleActivateCommand = z.infer<
	typeof RevenuePricingRuleActivateCommandSchema
>;

/**
 * Deactivate a pricing rule (set is_active = false).
 */
export const RevenuePricingRuleDeactivateCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenuePricingRuleDeactivateCommand = z.infer<
	typeof RevenuePricingRuleDeactivateCommandSchema
>;

/**
 * Soft-delete a pricing rule.
 */
export const RevenuePricingRuleDeleteCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenuePricingRuleDeleteCommand = z.infer<
	typeof RevenuePricingRuleDeleteCommandSchema
>;

// ── Demand Calendar Commands ─────────────────────────

/**
 * Update demand level and notes for specific dates.
 */
export const RevenueDemandUpdateCommandSchema = z.object({
	property_id: z.string().uuid(),
	dates: z.array(z.string().date()).min(1).max(365),
	demand_level: DemandLevelEnum,
	notes: z.string().max(500).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueDemandUpdateCommand = z.infer<
	typeof RevenueDemandUpdateCommandSchema
>;

/**
 * Bulk import local market events into the demand calendar with impact multipliers.
 */
export const RevenueDemandImportEventsCommandSchema = z.object({
	property_id: z.string().uuid(),
	events: z
		.array(
			z.object({
				event_name: z.string().min(1).max(200),
				event_type: z.enum([
					"convention",
					"holiday",
					"sports",
					"concert",
					"festival",
					"weather",
					"competitor_closure",
					"other",
				]),
				start_date: z.string().date(),
				end_date: z.string().date(),
				impact_multiplier: z.number().min(0.5).max(3.0).default(1.0),
				demand_level: DemandLevelEnum.optional(),
				notes: z.string().max(500).optional(),
			}),
		)
		.min(1)
		.max(100),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueDemandImportEventsCommand = z.infer<
	typeof RevenueDemandImportEventsCommandSchema
>;

// ── Competitor Rate Commands ─────────────────────────

/**
 * Manually record a competitor rate observation.
 */
export const RevenueCompetitorRecordCommandSchema = z.object({
	property_id: z.string().uuid(),
	competitor_name: z.string().min(1).max(200),
	competitor_property_name: z.string().min(1).max(200).optional(),
	room_type_category: z.string().max(100).optional(),
	rate_date: z.string().date(),
	rate_amount: z.number().min(0),
	currency: z.string().length(3).default("USD"),
	source: z.string().max(100).optional(),
	includes_breakfast: z.boolean().optional(),
	includes_parking: z.boolean().optional(),
	includes_wifi: z.boolean().optional(),
	taxes_included: z.boolean().optional(),
	notes: z.string().max(500).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueCompetitorRecordCommand = z.infer<
	typeof RevenueCompetitorRecordCommandSchema
>;

/**
 * Bulk import competitor rates from an external rate shopping tool.
 */
export const RevenueCompetitorBulkImportCommandSchema = z.object({
	property_id: z.string().uuid(),
	source: z.string().max(100).default("manual_import"),
	rates: z
		.array(
			z.object({
				competitor_name: z.string().min(1).max(200),
				competitor_property_name: z.string().max(200).optional(),
				room_type_category: z.string().max(100).optional(),
				rate_date: z.string().date(),
				rate_amount: z.number().min(0),
				currency: z.string().length(3).default("USD"),
				includes_breakfast: z.boolean().optional(),
				includes_parking: z.boolean().optional(),
				includes_wifi: z.boolean().optional(),
				taxes_included: z.boolean().optional(),
			}),
		)
		.min(1)
		.max(500),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueCompetitorBulkImportCommand = z.infer<
	typeof RevenueCompetitorBulkImportCommandSchema
>;

// ── Rate Restriction Commands ────────────────────────

/** Restriction type enum aligned with rate_restrictions table CHECK constraint */
const RestrictionTypeEnum = z.enum([
	"CTA",
	"CTD",
	"MIN_LOS",
	"MAX_LOS",
	"MIN_ADVANCE",
	"MAX_ADVANCE",
	"CLOSED",
]);

/** Source of restriction creation */
const RestrictionSourceEnum = z.enum([
	"manual",
	"rule_engine",
	"channel_manager",
	"import",
]);

/**
 * Set an inventory restriction per room_type × rate_plan × date range.
 * Industry standard: CTA/CTD/LOS/advance purchase controls (OPERA Cloud, Mews, Cloudbeds).
 */
export const RevenueRestrictionSetCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid().nullable().optional(),
	rate_plan_id: z.string().uuid().nullable().optional(),
	start_date: z.string().date(),
	end_date: z.string().date(),
	restriction_type: RestrictionTypeEnum,
	restriction_value: z.number().int().min(1).default(1),
	is_active: z.boolean().default(true),
	source: RestrictionSourceEnum.default("manual"),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRestrictionSetCommand = z.infer<
	typeof RevenueRestrictionSetCommandSchema
>;

/**
 * Remove a specific restriction for a room_type × rate_plan × date range.
 */
export const RevenueRestrictionRemoveCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid().nullable().optional(),
	rate_plan_id: z.string().uuid().nullable().optional(),
	start_date: z.string().date(),
	end_date: z.string().date(),
	restriction_type: RestrictionTypeEnum,
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRestrictionRemoveCommand = z.infer<
	typeof RevenueRestrictionRemoveCommandSchema
>;

/**
 * Bulk set restrictions across date ranges.
 * Example: "set Min LOS 3 for all weekends in Q4"
 */
export const RevenueRestrictionBulkSetCommandSchema = z.object({
	property_id: z.string().uuid(),
	restrictions: z
		.array(
			z.object({
				room_type_id: z.string().uuid().nullable().optional(),
				rate_plan_id: z.string().uuid().nullable().optional(),
				start_date: z.string().date(),
				end_date: z.string().date(),
				restriction_type: RestrictionTypeEnum,
				restriction_value: z.number().int().min(1).default(1),
				reason: z.string().max(500).optional(),
			}),
		)
		.min(1)
		.max(200),
	is_active: z.boolean().default(true),
	source: RestrictionSourceEnum.default("manual"),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRestrictionBulkSetCommand = z.infer<
	typeof RevenueRestrictionBulkSetCommandSchema
>;

// ── Hurdle Rate Commands ─────────────────────────────

/** Source enum for hurdle rates */
const HurdleRateSourceEnum = z.enum(["manual", "calculated", "imported"]);

/**
 * Set a minimum acceptable rate (hurdle/floor) per room_type × date.
 * Industry standard: hurdle rates represent the minimum rate below which
 * a room should not be sold — driven by segment displacement analysis.
 */
export const RevenueHurdleRateSetCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	start_date: z.string().date(),
	end_date: z.string().date(),
	hurdle_rate: z.number().min(0),
	currency: z.string().length(3).default("USD"),
	segment: z.string().max(50).optional(),
	source: HurdleRateSourceEnum.default("manual"),
	notes: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueHurdleRateSetCommand = z.infer<
	typeof RevenueHurdleRateSetCommandSchema
>;

/**
 * Auto-calculate hurdle rates based on displacement analysis.
 * Computes opportunity cost of selling a room at a given rate
 * vs holding for higher-value demand.
 */
export const RevenueHurdleRateCalculateCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid().optional(),
	start_date: z.string().date(),
	end_date: z.string().date(),
	segment: z.string().max(50).optional(),
	confidence_threshold: z.number().min(0).max(100).default(70),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueHurdleRateCalculateCommand = z.infer<
	typeof RevenueHurdleRateCalculateCommandSchema
>;

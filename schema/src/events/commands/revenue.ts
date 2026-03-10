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

// ── Revenue Goal/Budget Commands ─────────────────────

/** Goal type enum aligned with revenue_goals table CHECK constraint */
const GoalTypeEnum = z.enum([
	"total_revenue",
	"room_revenue",
	"fb_revenue",
	"other_revenue",
	"occupancy",
	"adr",
	"revpar",
	"rooms_sold",
	"arr",
]);

/** Goal period enum aligned with revenue_goals table CHECK constraint */
const GoalPeriodEnum = z.enum([
	"daily",
	"weekly",
	"monthly",
	"quarterly",
	"annual",
	"custom",
]);

/** Goal category enum aligned with revenue_goals table CHECK constraint */
const GoalCategoryEnum = z.enum([
	"budget",
	"forecast",
	"stretch",
	"minimum",
	"target",
]);

/**
 * Create a revenue goal/budget target.
 * Industry standard: property controllers set annual budgets during Q4
 * for next year; monthly/weekly targets derived from seasonal patterns.
 */
export const RevenueGoalCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	goal_name: z.string().min(1).max(200),
	goal_type: GoalTypeEnum,
	goal_period: GoalPeriodEnum.default("monthly"),
	goal_category: GoalCategoryEnum.default("budget"),
	period_start_date: z.string().date(),
	period_end_date: z.string().date(),
	fiscal_year: z.number().int().min(2000).max(2100).optional(),
	fiscal_quarter: z.number().int().min(1).max(4).optional(),
	goal_amount: z.number().min(0).optional(),
	goal_percent: z.number().min(0).max(100).optional(),
	goal_count: z.number().int().min(0).optional(),
	currency: z.string().length(3).default("USD"),
	baseline_amount: z.number().optional(),
	baseline_source: z.string().max(100).optional(),
	segment_goals: z.record(z.unknown()).optional(),
	channel_goals: z.record(z.unknown()).optional(),
	room_type_goals: z.record(z.unknown()).optional(),
	department: z.string().max(100).optional(),
	responsible_user_id: z.string().uuid().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueGoalCreateCommand = z.infer<
	typeof RevenueGoalCreateCommandSchema
>;

/**
 * Update an existing revenue goal/budget target.
 */
export const RevenueGoalUpdateCommandSchema = z.object({
	property_id: z.string().uuid(),
	goal_id: z.string().uuid(),
	goal_name: z.string().min(1).max(200).optional(),
	goal_amount: z.number().min(0).optional(),
	goal_percent: z.number().min(0).max(100).optional(),
	goal_count: z.number().int().min(0).optional(),
	period_start_date: z.string().date().optional(),
	period_end_date: z.string().date().optional(),
	status: z
		.enum([
			"draft",
			"pending_approval",
			"active",
			"completed",
			"cancelled",
			"revised",
		])
		.optional(),
	baseline_amount: z.number().optional(),
	segment_goals: z.record(z.unknown()).optional(),
	channel_goals: z.record(z.unknown()).optional(),
	room_type_goals: z.record(z.unknown()).optional(),
	department: z.string().max(100).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueGoalUpdateCommand = z.infer<
	typeof RevenueGoalUpdateCommandSchema
>;

/**
 * Soft-delete a revenue goal.
 */
export const RevenueGoalDeleteCommandSchema = z.object({
	property_id: z.string().uuid(),
	goal_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueGoalDeleteCommand = z.infer<
	typeof RevenueGoalDeleteCommandSchema
>;

/**
 * Scheduled command to snapshot actual performance data into revenue goals.
 * Reads from reservations/charge_postings for the goal period and updates
 * actual_amount, variance_amount, variance_percent, and progress tracking.
 */
export const RevenueGoalTrackActualCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.string().date(),
	goal_ids: z.array(z.string().uuid()).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueGoalTrackActualCommand = z.infer<
	typeof RevenueGoalTrackActualCommandSchema
>;

/**
 * End-of-day revenue processing triggered after night audit.
 * Snapshots goal actuals, re-evaluates forecasts, and updates
 * demand calendar with final day metrics.
 */
export const RevenueDailyCloseCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.string().date(),
	skip_forecast: z.boolean().optional(),
	skip_goal_tracking: z.boolean().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueDailyCloseCommand = z.infer<
	typeof RevenueDailyCloseCommandSchema
>;

// ── Booking Pace Commands (R11) ──────────────────────

/**
 * Snapshot current booking pace metrics for a property.
 * Computes OTB rooms/revenue vs same-time-last-year for each future date
 * and writes pickup_last_7_days, pickup_last_30_days, pace_vs_last_year
 * into the demand_calendar.
 */
export const RevenueBookingPaceSnapshotCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** Number of future days to snapshot pace for (default 90). */
	horizon_days: z.number().int().min(1).max(365).default(90),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueBookingPaceSnapshotCommand = z.infer<
	typeof RevenueBookingPaceSnapshotCommandSchema
>;

// ── Forecast Adjust Command (R12) ────────────────────

/**
 * Manual one-time forecast override by revenue manager.
 * Allows a revenue manager to adjust a forecasted value for a specific
 * date, period, and scenario. Records the original value and reason.
 */
export const RevenueForecastAdjustCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** The date of the forecast to adjust. */
	forecast_date: z.string().date(),
	forecast_period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
	forecast_scenario: z
		.enum(["base", "optimistic", "pessimistic", "conservative", "aggressive"])
		.default("base"),
	/** Fields to override — only provided fields are updated. */
	adjustments: z.object({
		occupancy_percent: z.number().min(0).max(100).optional(),
		adr: z.number().min(0).optional(),
		room_revenue: z.number().min(0).optional(),
	}),
	/** Reason for the adjustment (required for audit). */
	reason: z.string().min(1).max(2000),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueForecastAdjustCommand = z.infer<
	typeof RevenueForecastAdjustCommandSchema
>;

// ── Forecast Evaluate Command (R13) ──────────────────

/**
 * Compare forecasted values vs actuals for completed periods.
 * Updates actual_value, variance, variance_percent, and accuracy_score
 * in revenue_forecasts for all forecasts covering the given business date.
 */
export const RevenueForecastEvaluateCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** The past business date to evaluate forecasts for. */
	business_date: z.string().date(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueForecastEvaluateCommand = z.infer<
	typeof RevenueForecastEvaluateCommandSchema
>;

// ── Group Displacement Evaluate Command (R19) ────────

/**
 * Evaluate whether to accept or decline a proposed group block.
 * Computes displaced transient revenue, ancillary comparison, and
 * net displacement value with a recommendation.
 */
export const RevenueGroupEvaluateCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** The group booking ID to evaluate. */
	group_id: z.string().uuid(),
	/** Optional date range override — defaults to the group's block dates. */
	start_date: z.string().date().optional(),
	end_date: z.string().date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueGroupEvaluateCommand = z.infer<
	typeof RevenueGroupEvaluateCommandSchema
>;

// ── Rate Recommendation Engine Commands (R2) ─────────

/**
 * Batch-generate rate recommendations per property for a date range.
 * Analyzes occupancy vs forecast, booking pace, competitor rates, active
 * pricing rules, and demand calendar signals to produce one recommendation
 * per room_type × date with confidence scoring.
 *
 * @category commands
 */
export const RevenueRecommendationGenerateCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** Start of the date range to generate recommendations for. */
	start_date: z.string().date(),
	/** End of the date range (inclusive). */
	end_date: z.string().date(),
	/** Room types to evaluate. If omitted, evaluates all room types for the property. */
	room_type_ids: z.array(z.string().uuid()).optional(),
	/** Minimum confidence score to include in results (0-100). Default 50. */
	min_confidence: z.number().min(0).max(100).default(50),
	/** Whether to auto-apply recommendations above the auto_apply_threshold. Default false. */
	auto_apply: z.boolean().default(false),
	/** Confidence threshold above which recommendations can be auto-applied (0-100). Default 85. */
	auto_apply_threshold: z.number().min(0).max(100).default(85),
	/** Whether to supersede existing pending recommendations for the same date range. Default true. */
	supersede_existing: z.boolean().default(true),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRecommendationGenerateCommand = z.infer<
	typeof RevenueRecommendationGenerateCommandSchema
>;

// ── Rate Recommendation Approval Workflow Commands (R3) ──

/**
 * Approve a single rate recommendation.
 * Transitions status from pending/reviewed → accepted.
 */
export const RevenueRecommendationApproveCommandSchema = z.object({
	property_id: z.string().uuid(),
	recommendation_id: z.string().uuid(),
	/** Optional notes from the reviewer. */
	review_notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRecommendationApproveCommand = z.infer<
	typeof RevenueRecommendationApproveCommandSchema
>;

/**
 * Reject a rate recommendation with a reason.
 * Transitions status from pending/reviewed → rejected.
 */
export const RevenueRecommendationRejectCommandSchema = z.object({
	property_id: z.string().uuid(),
	recommendation_id: z.string().uuid(),
	/** Reason for rejection (required for audit trail). */
	rejection_reason: z.string().min(1).max(500),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRecommendationRejectCommand = z.infer<
	typeof RevenueRecommendationRejectCommandSchema
>;

/**
 * Apply an accepted recommendation — updates the actual rate in the rates table.
 * Only recommendations with status = 'accepted' can be applied.
 */
export const RevenueRecommendationApplyCommandSchema = z.object({
	property_id: z.string().uuid(),
	recommendation_id: z.string().uuid(),
	/** Optional override rate — if omitted, uses the recommendation's recommended_rate. */
	override_rate: z.number().min(0).optional(),
	/** Implementation notes. */
	implementation_notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRecommendationApplyCommand = z.infer<
	typeof RevenueRecommendationApplyCommandSchema
>;

/**
 * Bulk-approve multiple recommendations in one command.
 * Transitions all specified recommendations from pending/reviewed → accepted.
 */
export const RevenueRecommendationBulkApproveCommandSchema = z.object({
	property_id: z.string().uuid(),
	recommendation_ids: z.array(z.string().uuid()).min(1).max(500),
	/** Optional notes applied to all approved recommendations. */
	review_notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueRecommendationBulkApproveCommand = z.infer<
	typeof RevenueRecommendationBulkApproveCommandSchema
>;

// ── Competitor Comp Set Configuration Command (R5) ───

/**
 * Define or update the competitive set for a property.
 * Upserts competitor property entries — the set of hotels tracked
 * for rate shopping and STR-style benchmarking (ARI, MPI, RGI).
 *
 * @category commands
 */
export const RevenueCompetitorConfigureCompsetCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** List of competitors to add/update in the comp set. */
	competitors: z
		.array(
			z.object({
				competitor_name: z.string().min(1).max(255),
				competitor_external_id: z.string().max(100).optional(),
				competitor_brand: z.string().max(100).optional(),
				competitor_address: z.string().max(500).optional(),
				competitor_city: z.string().max(100).optional(),
				competitor_country: z.string().max(3).optional(),
				competitor_star_rating: z.number().min(1).max(5).optional(),
				competitor_total_rooms: z.number().int().min(1).optional(),
				competitor_url: z.string().max(500).optional(),
				/** Weighting factor for index calculations. Default 1.0. */
				weight: z.number().min(0.01).max(5).default(1.0),
				distance_km: z.number().min(0).optional(),
				market_segment: z.string().max(50).optional(),
				rate_shopping_source: z
					.enum(["manual", "ota_scrape", "rate_shopping_api", "str", "direct"])
					.optional(),
				is_primary: z.boolean().default(false),
				is_active: z.boolean().default(true),
				sort_order: z.number().int().min(0).default(0),
				notes: z.string().max(2000).optional(),
			}),
		)
		.min(1)
		.max(20),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueCompetitorConfigureCompsetCommand = z.infer<
	typeof RevenueCompetitorConfigureCompsetCommandSchema
>;

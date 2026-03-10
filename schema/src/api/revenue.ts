/**
 * DEV DOC
 * Module: api/revenue.ts
 * Purpose: Revenue management API query schemas (pricing, reports, KPIs)
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	propertyId,
	tenantId,
	TenantScopedListQuerySchema,
} from "../shared/base-schemas.js";

// =====================================================
// PRICING QUERY SCHEMAS (S12)
// =====================================================

/**
 * Query schema for listing dynamic pricing rules.
 */
export const PricingRuleListQuerySchema = TenantScopedListQuerySchema.extend({
	rule_type: z.string().optional().describe("Filter by rule type"),
	is_active: z.coerce.boolean().optional().describe("Filter by active status"),
});

export type PricingRuleListQuery = z.infer<typeof PricingRuleListQuerySchema>;

/**
 * Query schema for listing rate recommendations.
 */
export const RecommendationListQuerySchema = TenantScopedListQuerySchema.extend(
	{
		status: z.string().optional().describe("Filter by recommendation status"),
		recommendation_date: z
			.string()
			.optional()
			.describe("Filter by recommendation date (YYYY-MM-DD)"),
	},
);

export type RecommendationListQuery = z.infer<
	typeof RecommendationListQuerySchema
>;

/**
 * Query schema for listing competitor rates.
 */
export const CompetitorRateListQuerySchema = TenantScopedListQuerySchema.extend(
	{
		rate_date: z
			.string()
			.optional()
			.describe("Filter by rate date (YYYY-MM-DD)"),
	},
);

export type CompetitorRateListQuery = z.infer<
	typeof CompetitorRateListQuerySchema
>;

/**
 * Query schema for listing demand calendar entries.
 */
export const DemandCalendarListQuerySchema = TenantScopedListQuerySchema.extend(
	{
		date_from: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
		date_to: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
	},
);

export type DemandCalendarListQuery = z.infer<
	typeof DemandCalendarListQuerySchema
>;

// =====================================================
// REPORT QUERY SCHEMAS (S13)
// =====================================================

/**
 * Query schema for listing revenue forecasts.
 */
export const ForecastListQuerySchema = TenantScopedListQuerySchema.extend({
	forecast_period: z.string().optional().describe("Filter by forecast period"),
	scenario_type: z
		.string()
		.optional()
		.describe("Filter by scenario type (BEST_CASE, WORST_CASE, etc.)"),
});

export type ForecastListQuery = z.infer<typeof ForecastListQuerySchema>;

/**
 * Query schema for listing revenue goals.
 */
export const GoalListQuerySchema = TenantScopedListQuerySchema.extend({
	goal_type: z.string().optional().describe("Filter by goal type"),
	status: z.string().optional().describe("Filter by goal status"),
});

export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;

/**
 * Query schema for revenue KPI computation.
 * Requires tenant, property, and business date.
 */
export const KpiQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	business_date: z
		.string()
		.describe("Business date for KPI computation (YYYY-MM-DD)"),
});

export type KpiQuery = z.infer<typeof KpiQuerySchema>;

// =====================================================
// COMPSET BENCHMARKING SCHEMAS (IS-3)
// =====================================================

/**
 * Query schema for STR-style competitive set indices.
 * Computes Occupancy Index, ARI (ADR Index), and RGI (RevPAR Index).
 */
export const CompsetIndicesQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	business_date: z
		.string()
		.describe("Business date for compset comparison (YYYY-MM-DD)"),
});

export type CompsetIndicesQuery = z.infer<typeof CompsetIndicesQuerySchema>;

// =====================================================
// API RESPONSE SCHEMAS — Pricing
// =====================================================

/** API response shape for a pricing rule list item. */
export const PricingRuleListItemSchema = z.object({
	rule_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	rule_name: z.string(),
	rule_type: z.string(),
	priority: z.number(),
	is_active: z.boolean(),
	effective_from: z.string().optional(),
	effective_to: z.string().optional(),
	applies_to_room_types: z.array(z.string()).optional(),
	applies_to_rate_plans: z.array(z.string()).optional(),
	condition_type: z.string().optional(),
	adjustment_type: z.string().optional(),
	adjustment_value: z.number().optional(),
	min_rate: z.number().optional(),
	max_rate: z.number().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type PricingRuleListItem = z.infer<typeof PricingRuleListItemSchema>;

/** API response shape for a rate recommendation list item. */
export const RateRecommendationListItemSchema = z.object({
	recommendation_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	room_type_id: z.string().optional(),
	room_type_name: z.string().optional(),
	rate_plan_id: z.string().optional(),
	recommendation_date: z.string(),
	current_rate: z.number(),
	recommended_rate: z.number(),
	confidence_score: z.number().optional(),
	recommendation_reason: z.string().optional(),
	status: z.string().optional(),
	applied_at: z.string().optional(),
	created_at: z.string(),
});

export type RateRecommendationListItem = z.infer<
	typeof RateRecommendationListItemSchema
>;

/** API response shape for a competitor rate list item. */
export const CompetitorRateListItemSchema = z.object({
	competitor_rate_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	competitor_name: z.string(),
	competitor_property_name: z.string().optional(),
	room_type_category: z.string().optional(),
	rate_date: z.string(),
	rate_amount: z.number(),
	currency: z.string(),
	source: z.string().optional(),
	collected_at: z.string().optional(),
	created_at: z.string(),
});

export type CompetitorRateListItem = z.infer<
	typeof CompetitorRateListItemSchema
>;

/** API response shape for a demand calendar list item. */
export const DemandCalendarListItemSchema = z.object({
	calendar_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	calendar_date: z.string(),
	day_of_week: z.string().optional(),
	demand_level: z.string().optional(),
	occupancy_forecast: z.number().optional(),
	booking_pace: z.number().optional(),
	notes: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type DemandCalendarListItem = z.infer<
	typeof DemandCalendarListItemSchema
>;

/** API response shape for a rate restriction list item. */
export const RateRestrictionListItemSchema = z.object({
	restriction_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	room_type_id: z.string().optional(),
	room_type_name: z.string().optional(),
	rate_plan_id: z.string().optional(),
	restriction_date: z.string(),
	restriction_type: z.string(),
	restriction_value: z.number(),
	is_active: z.boolean(),
	source: z.string().optional(),
	reason: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type RateRestrictionListItem = z.infer<
	typeof RateRestrictionListItemSchema
>;

/** API response shape for a hurdle rate list item. */
export const HurdleRateListItemSchema = z.object({
	hurdle_rate_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	room_type_id: z.string(),
	room_type_name: z.string().optional(),
	hurdle_date: z.string(),
	hurdle_rate: z.number(),
	currency: z.string(),
	segment: z.string().optional(),
	source: z.string().optional(),
	displacement_analysis: z.record(z.unknown()).optional(),
	confidence_score: z.number().optional(),
	is_active: z.boolean(),
	notes: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type HurdleRateListItem = z.infer<typeof HurdleRateListItemSchema>;

// =====================================================
// API INPUT SCHEMAS — Pricing Rule CRUD
// =====================================================

/** Input schema for creating a pricing rule. */
export const CreatePricingRuleInputSchema = z.object({
	propertyId: z.string(),
	ruleName: z.string(),
	ruleType: z.string(),
	ruleCategory: z.string().nullish(),
	description: z.string().nullish(),
	priority: z.number(),
	isActive: z.boolean(),
	effectiveFrom: z.string(),
	effectiveUntil: z.string().nullish(),
	appliesToRoomTypes: z.array(z.string()).nullish(),
	appliesToRatePlans: z.array(z.string()).nullish(),
	appliesToChannels: z.array(z.string()).nullish(),
	appliesToSegments: z.array(z.string()).nullish(),
	appliesMonday: z.boolean().nullish(),
	appliesTuesday: z.boolean().nullish(),
	appliesWednesday: z.boolean().nullish(),
	appliesThursday: z.boolean().nullish(),
	appliesFriday: z.boolean().nullish(),
	appliesSaturday: z.boolean().nullish(),
	appliesSunday: z.boolean().nullish(),
	conditions: z.record(z.unknown()),
	adjustmentType: z.string(),
	adjustmentValue: z.number(),
	adjustmentCapMin: z.number().nullish(),
	adjustmentCapMax: z.number().nullish(),
	minRate: z.number().nullish(),
	maxRate: z.number().nullish(),
	minLengthOfStay: z.number().nullish(),
	maxLengthOfStay: z.number().nullish(),
	applyClosedToArrival: z.boolean().nullish(),
	applyClosedToDeparture: z.boolean().nullish(),
	applyStopSell: z.boolean().nullish(),
	canCombineWithOtherRules: z.boolean(),
	requiresApproval: z.boolean(),
	metadata: z.record(z.unknown()).nullish(),
});

export type CreatePricingRuleInput = z.infer<
	typeof CreatePricingRuleInputSchema
>;

/** Input schema for updating a pricing rule. */
export const UpdatePricingRuleInputSchema = z.object({
	ruleName: z.string().nullish(),
	description: z.string().nullish(),
	priority: z.number().nullish(),
	effectiveFrom: z.string().nullish(),
	effectiveUntil: z.string().nullish(),
	appliesToRoomTypes: z.array(z.string()).nullish(),
	appliesToRatePlans: z.array(z.string()).nullish(),
	appliesToChannels: z.array(z.string()).nullish(),
	appliesToSegments: z.array(z.string()).nullish(),
	appliesMonday: z.boolean().nullish(),
	appliesTuesday: z.boolean().nullish(),
	appliesWednesday: z.boolean().nullish(),
	appliesThursday: z.boolean().nullish(),
	appliesFriday: z.boolean().nullish(),
	appliesSaturday: z.boolean().nullish(),
	appliesSunday: z.boolean().nullish(),
	conditions: z.record(z.unknown()).nullish(),
	adjustmentType: z.string().nullish(),
	adjustmentValue: z.number().nullish(),
	adjustmentCapMin: z.number().nullish(),
	adjustmentCapMax: z.number().nullish(),
	minRate: z.number().nullish(),
	maxRate: z.number().nullish(),
	minLengthOfStay: z.number().nullish(),
	maxLengthOfStay: z.number().nullish(),
	applyClosedToArrival: z.boolean().nullish(),
	applyClosedToDeparture: z.boolean().nullish(),
	applyStopSell: z.boolean().nullish(),
	canCombineWithOtherRules: z.boolean().nullish(),
	requiresApproval: z.boolean().nullish(),
	lastModifiedReason: z.string().nullish(),
	metadata: z.record(z.unknown()).nullish(),
});

export type UpdatePricingRuleInput = z.infer<
	typeof UpdatePricingRuleInputSchema
>;

/** Input schema for creating a competitor rate entry. */
export const CreateCompetitorRateInputSchema = z.object({
	competitorName: z.string(),
	competitorPropertyName: z.string().nullish(),
	roomTypeCategory: z.string().nullish(),
	rateDate: z.string(),
	rateAmount: z.number(),
	currency: z.string(),
	source: z.string().nullish(),
	includesBreakfast: z.boolean().nullish(),
	includesParking: z.boolean().nullish(),
	includesWifi: z.boolean().nullish(),
	taxesIncluded: z.boolean().nullish(),
	roomsLeft: z.number().int().min(0).nullish(),
	estimatedOccupancyPercent: z.number().min(0).max(100).nullish(),
	notes: z.string().nullish(),
});

export type CreateCompetitorRateInput = z.infer<
	typeof CreateCompetitorRateInputSchema
>;

// =====================================================
// API RESPONSE SCHEMAS — Reports
// =====================================================

/** API response shape for a revenue forecast list item. */
export const RevenueForecastListItemSchema = z.object({
	forecast_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	forecast_date: z.string(),
	forecast_period: z.string().optional(),
	room_revenue_forecast: z.number().optional(),
	total_revenue_forecast: z.number().optional(),
	occupancy_forecast: z.number().optional(),
	adr_forecast: z.number().optional(),
	revpar_forecast: z.number().optional(),
	confidence_level: z.number().optional(),
	scenario_type: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type RevenueForecastListItem = z.infer<
	typeof RevenueForecastListItemSchema
>;

/** API response shape for a revenue goal list item. */
export const RevenueGoalListItemSchema = z.object({
	goal_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	goal_name: z.string(),
	goal_type: z.string().optional(),
	period_start: z.string(),
	period_end: z.string(),
	target_amount: z.number(),
	actual_amount: z.number().optional(),
	variance_amount: z.number().optional(),
	variance_percent: z.number().optional(),
	status: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type RevenueGoalListItem = z.infer<typeof RevenueGoalListItemSchema>;

/** API response shape for revenue KPIs. */
export const RevenueKpiSchema = z.object({
	property_id: z.string(),
	business_date: z.string(),
	occupied_rooms: z.number(),
	total_rooms: z.number(),
	occupancy_percent: z.number(),
	room_revenue: z.number(),
	total_revenue: z.number(),
	adr: z.number(),
	revpar: z.number(),
});

export type RevenueKpi = z.infer<typeof RevenueKpiSchema>;

/** API response shape for STR-style competitive set indices. */
export const CompsetIndicesSchema = z.object({
	property_id: z.string(),
	business_date: z.string(),
	own_occupancy_percent: z.number(),
	own_adr: z.number(),
	own_revpar: z.number(),
	compset_avg_adr: z.number().nullable(),
	compset_avg_occupancy: z.number().nullable(),
	compset_count: z.number(),
	/** Market Penetration Index = Own OCC% / Comp Set OCC% × 100 */
	mpi: z.number().nullable(),
	/** Average Rate Index = Own ADR / Comp Set ADR × 100 */
	ari: z.number().nullable(),
	/** Revenue Generation Index = Own RevPAR / Comp Set RevPAR × 100 */
	rgi: z.number().nullable(),
});

export type CompsetIndices = z.infer<typeof CompsetIndicesSchema>;

/** API response shape for group displacement analysis. */
export const DisplacementAnalysisItemSchema = z.object({
	group_id: z.string(),
	group_name: z.string(),
	group_rooms_booked: z.number(),
	group_room_nights: z.number(),
	group_total_revenue: z.number(),
	group_adr: z.number(),
	block_start: z.string().optional(),
	block_end: z.string().optional(),
	avg_transient_adr: z.number(),
	displaced_transient_revenue: z.number(),
	net_displacement_value: z.number(),
	adr_differential_pct: z.number(),
	recommendation: z.string(),
});

export type DisplacementAnalysisItem = z.infer<
	typeof DisplacementAnalysisItemSchema
>;

// =====================================================
// BUDGET VARIANCE QUERY & RESPONSE SCHEMAS (R9)
// =====================================================

/** Query schema for budget vs actual variance report. */
export const BudgetVarianceQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z
		.string()
		.describe("Start date for variance period (YYYY-MM-DD)"),
	end_date: z.string().describe("End date for variance period (YYYY-MM-DD)"),
	department: z.string().optional().describe("Filter by USALI department"),
	goal_type: z.string().optional().describe("Filter by goal type"),
	limit: z.coerce.number().int().min(1).max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type BudgetVarianceQuery = z.infer<typeof BudgetVarianceQuerySchema>;

/** API response shape for a budget variance row. */
export const BudgetVarianceItemSchema = z.object({
	goal_id: z.string(),
	goal_name: z.string(),
	goal_type: z.string(),
	goal_period: z.string(),
	goal_category: z.string().optional(),
	department: z.string().optional(),
	period_start: z.string(),
	period_end: z.string(),
	budgeted_amount: z.number().nullable(),
	actual_amount: z.number().nullable(),
	variance_amount: z.number().nullable(),
	variance_percent: z.number().nullable(),
	variance_status: z.string().optional(),
	progress_percent: z.number().nullable(),
	last_year_actual: z.number().nullable(),
	yoy_growth_percent: z.number().nullable(),
	daily_run_rate_required: z.number().nullable(),
	daily_run_rate_actual: z.number().nullable(),
});

export type BudgetVarianceItem = z.infer<typeof BudgetVarianceItemSchema>;

// =====================================================
// MANAGER'S DAILY REPORT SCHEMAS (R10)
// =====================================================

/** Query schema for Manager's Daily Report. */
export const ManagersDailyReportQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	business_date: z
		.string()
		.describe("Business date for the report (YYYY-MM-DD)"),
});

export type ManagersDailyReportQuery = z.infer<
	typeof ManagersDailyReportQuerySchema
>;

/** Segment mix entry in the Manager's Daily Report. */
export const SegmentMixItemSchema = z.object({
	segment: z.string(),
	reservations: z.number(),
	revenue: z.number(),
});

/** Budget comparison entry in the Manager's Daily Report. */
export const BudgetComparisonItemSchema = z.object({
	goal_type: z.string(),
	budgeted: z.number().nullable(),
	actual: z.number().nullable(),
	variance_pct: z.number().nullable(),
});

/** Forecast item in the Manager's Daily Report. */
export const ForecastItemSchema = z.object({
	forecast_date: z.string(),
	occupancy_forecast: z.number().nullable(),
	adr_forecast: z.number().nullable(),
	revpar_forecast: z.number().nullable(),
	room_revenue_forecast: z.number().nullable(),
	confidence_level: z.number().nullable(),
});

/** Full Manager's Daily Report response. */
export const ManagersDailyReportSchema = z.object({
	property_id: z.string(),
	business_date: z.string(),
	// Occupancy section
	occupancy: z.object({
		total_rooms: z.number(),
		rooms_sold: z.number(),
		rooms_available: z.number(),
		rooms_ooo: z.number(),
		rooms_oos: z.number(),
		occupancy_percent: z.number(),
	}),
	// Revenue section
	revenue: z.object({
		room_revenue: z.number(),
		fb_revenue: z.number(),
		other_revenue: z.number(),
		total_revenue: z.number(),
	}),
	// Rate metrics
	rate_metrics: z.object({
		adr: z.number(),
		revpar: z.number(),
		trevpar: z.number(),
	}),
	// Movements section
	movements: z.object({
		expected_arrivals: z.number(),
		actual_arrivals: z.number(),
		expected_departures: z.number(),
		actual_departures: z.number(),
		in_house_guests: z.number(),
		no_shows: z.number(),
	}),
	// Segment mix
	segment_mix: z.array(SegmentMixItemSchema),
	// Budget comparison
	budget_comparison: z.array(BudgetComparisonItemSchema),
	// Forecast (next 7 / 14 / 30 days)
	forecast: z.object({
		next_7_days: z.array(ForecastItemSchema),
		next_14_days: z.array(ForecastItemSchema),
		next_30_days: z.array(ForecastItemSchema),
	}),
	// Last year comparison
	last_year: z
		.object({
			rooms_sold: z.number(),
			total_rooms: z.number(),
			occupancy_percent: z.number(),
			room_revenue: z.number(),
			total_revenue: z.number(),
			adr: z.number(),
			revpar: z.number(),
		})
		.nullable(),
});

// =====================================================
// BOOKING PACE REPORT SCHEMAS (R11)
// =====================================================

/**
 * Query schema for the booking pace report endpoint.
 */
export const BookingPaceQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z.string().date().describe("Start of date range (YYYY-MM-DD)"),
	end_date: z.string().date().describe("End of date range (YYYY-MM-DD)"),
});

export type BookingPaceQuery = z.infer<typeof BookingPaceQuerySchema>;

/**
 * Single-date booking pace item returned by the pace report.
 */
export const BookingPaceItemSchema = z.object({
	calendar_date: z.string(),
	day_of_week: z.number(),
	otb_rooms: z.number(),
	otb_revenue: z.number().nullable(),
	ly_otb_rooms: z.number().nullable(),
	ly_otb_revenue: z.number().nullable(),
	pace_diff_rooms: z.number().nullable(),
	pace_diff_revenue: z.number().nullable(),
	pickup_last_7_days: z.number().nullable(),
	pickup_last_30_days: z.number().nullable(),
	pace_status: z
		.enum(["ahead", "on_track", "behind", "significantly_behind"])
		.nullable(),
	rooms_available: z.number().nullable(),
	occupancy_forecast_percent: z.number().nullable(),
});

export type BookingPaceItem = z.infer<typeof BookingPaceItemSchema>;

// =====================================================
// FORECAST ACCURACY SCHEMAS (R13)
// =====================================================

/**
 * Query schema for the forecast accuracy endpoint.
 */
export const ForecastAccuracyQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z.string().date().describe("Start of evaluation period"),
	end_date: z.string().date().describe("End of evaluation period"),
	forecast_scenario: z
		.enum(["base", "optimistic", "pessimistic", "conservative", "aggressive"])
		.optional()
		.describe("Filter by scenario"),
});

export type ForecastAccuracyQuery = z.infer<typeof ForecastAccuracyQuerySchema>;

/**
 * Single forecast accuracy record showing forecast vs actual.
 */
export const ForecastAccuracyItemSchema = z.object({
	forecast_id: z.string(),
	forecast_date: z.string(),
	period_start: z.string(),
	period_end: z.string(),
	forecast_scenario: z.string(),
	forecasted_occupancy: z.number().nullable(),
	forecasted_adr: z.number().nullable(),
	forecasted_revpar: z.number().nullable(),
	forecasted_room_revenue: z.number().nullable(),
	actual_occupancy: z.number().nullable(),
	actual_adr: z.number().nullable(),
	actual_revpar: z.number().nullable(),
	actual_room_revenue: z.number().nullable(),
	variance_percent: z.number().nullable(),
	accuracy_score: z.number().nullable(),
});

export type ForecastAccuracyItem = z.infer<typeof ForecastAccuracyItemSchema>;

/**
 * Summary accuracy metrics across a date range.
 */
export const ForecastAccuracySummarySchema = z.object({
	period_start: z.string(),
	period_end: z.string(),
	total_evaluated: z.number(),
	mape: z.number().nullable(),
	bias: z.number().nullable(),
	avg_accuracy_score: z.number().nullable(),
	items: z.array(ForecastAccuracyItemSchema),
});

// =====================================================
// SEGMENT ANALYSIS SCHEMAS (R17)
// =====================================================

/**
 * Query params for the segment performance analytics endpoint.
 */
export const SegmentAnalysisQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z.string().date().describe("Period start date"),
	end_date: z.string().date().describe("Period end date"),
	compare_ly: z
		.enum(["true", "false"])
		.optional()
		.default("true")
		.describe("Include last year comparison"),
});

export type SegmentAnalysisQuery = z.infer<typeof SegmentAnalysisQuerySchema>;

/**
 * Single segment performance record.
 */
export const SegmentAnalysisItemSchema = z.object({
	segment: z.string(),
	rooms_sold: z.number(),
	room_nights: z.number(),
	revenue: z.number(),
	adr: z.number(),
	pct_of_total_revenue: z.number(),
	pct_of_total_rooms: z.number(),
	ly_rooms_sold: z.number().nullable(),
	ly_revenue: z.number().nullable(),
	ly_adr: z.number().nullable(),
	revenue_change_pct: z.number().nullable(),
	adr_change_pct: z.number().nullable(),
});

export type SegmentAnalysisItem = z.infer<typeof SegmentAnalysisItemSchema>;

// =====================================================
// CHANNEL PROFITABILITY SCHEMAS (R18)
// =====================================================

/**
 * Query params for the channel profitability endpoint.
 */
export const ChannelProfitabilityQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z.string().date().describe("Period start date"),
	end_date: z.string().date().describe("Period end date"),
});

export type ChannelProfitabilityQuery = z.infer<
	typeof ChannelProfitabilityQuerySchema
>;

/**
 * Single channel profitability record.
 */
export const ChannelProfitabilityItemSchema = z.object({
	channel: z.string(),
	booking_count: z.number(),
	room_nights: z.number(),
	gross_revenue: z.number(),
	commission_pct: z.number(),
	commission_amount: z.number(),
	net_revenue: z.number(),
	net_adr: z.number(),
	pct_of_total_revenue: z.number(),
});

export type ChannelProfitabilityItem = z.infer<
	typeof ChannelProfitabilityItemSchema
>;

// =====================================================
// RATE SHOPPING — Comparison view (R15)
// =====================================================

/** Query for rate shopping comparison endpoint. */
export const RateShoppingQuerySchema = z.object({
	tenant_id: tenantId,
	property_id: propertyId,
	start_date: z.string().describe("Start of date range (YYYY-MM-DD)"),
	end_date: z.string().describe("End of date range (YYYY-MM-DD)"),
	competitor_name: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type RateShoppingQuery = z.infer<typeof RateShoppingQuerySchema>;

/** Single date row in the rate shopping comparison grid. */
export const RateShoppingItemSchema = z.object({
	rate_date: z.string(),
	own_rate: z.number().nullable(),
	competitor_name: z.string(),
	competitor_rate: z.number().nullable(),
	rate_difference: z.number().nullable(),
	rate_difference_pct: z.number().nullable(),
	competitor_rooms_left: z.number().nullable(),
	competitor_occupancy_pct: z.number().nullable(),
	source: z.string().nullable(),
	collected_at: z.string().nullable(),
});

export type RateShoppingItem = z.infer<typeof RateShoppingItemSchema>;

// =====================================================
// COMPETITIVE RESPONSE RULES (R16)
// =====================================================

/** Query for listing competitive response rules. */
export const CompetitiveResponseRuleQuerySchema =
	TenantScopedListQuerySchema.extend({
		property_id: propertyId.optional(),
		is_active: z.coerce.boolean().optional(),
	});

export type CompetitiveResponseRuleQuery = z.infer<
	typeof CompetitiveResponseRuleQuerySchema
>;

/** API response item for a competitive response rule. */
export const CompetitiveResponseRuleItemSchema = z.object({
	rule_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	rule_name: z.string(),
	rule_type: z.string(),
	track_competitor: z.string(),
	response_strategy: z.string(),
	response_value: z.number(),
	min_rate: z.number(),
	max_rate: z.number(),
	auto_apply: z.boolean(),
	trigger_threshold_percent: z.number(),
	is_active: z.boolean(),
	notes: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export type CompetitiveResponseRuleItem = z.infer<
	typeof CompetitiveResponseRuleItemSchema
>;

// =====================================================
// RATE SHOPPING PROVIDER TYPES (R15)
// =====================================================

/** Shape of a single competitor rate collected by a rate shopping provider. */
export const CollectedRateSchema = z.object({
	competitor_name: z.string(),
	competitor_property_name: z.string().optional(),
	room_type_category: z.string().optional(),
	rate_date: z.string(),
	rate_amount: z.number(),
	currency: z.string().optional(),
	rooms_left: z.number().int().min(0).optional(),
	estimated_occupancy_percent: z.number().min(0).max(100).optional(),
	source: z.string().optional(),
});

export type CollectedRate = z.infer<typeof CollectedRateSchema>;

/** Contract for a pluggable rate shopping provider. */
export interface RateShoppingProvider {
	readonly name: string;
	/** Collect rates from an external source for the given property and date range. */
	collectRates(
		tenantId: string,
		propertyId: string,
		startDate: string,
		endDate: string,
	): Promise<CollectedRate[]>;
}

// =====================================================
// COMPETITIVE RESPONSE RULE INPUT (R16)
// =====================================================

/** Input for creating/updating a competitive response rule. */
export const CompetitiveResponseRuleInputSchema = z.object({
	trackCompetitor: z.string(),
	roomTypeId: z.string().uuid().optional(),
	responseStrategy: z.string(),
	responseValue: z.number(),
	minRate: z.number(),
	maxRate: z.number(),
	autoApply: z.boolean(),
	triggerThresholdPercent: z.number(),
	isActive: z.boolean(),
	notes: z.string().optional(),
});

export type CompetitiveResponseRuleInput = z.infer<
	typeof CompetitiveResponseRuleInputSchema
>;

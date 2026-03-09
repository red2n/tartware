/**
 * DEV DOC
 * Module: api/revenue.ts
 * Purpose: Revenue management API query schemas (pricing, reports, KPIs)
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	propertyId,
	TenantScopedListQuerySchema,
	tenantId,
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
	compset_count: z.number(),
	occupancy_index: z.number().nullable(),
	ari: z.number().nullable(),
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

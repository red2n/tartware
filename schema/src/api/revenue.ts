/**
 * DEV DOC
 * Module: api/revenue.ts
 * Purpose: Revenue management API query schemas (pricing, reports, KPIs)
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	TenantScopedListQuerySchema,
	propertyId,
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
export const RecommendationListQuerySchema =
	TenantScopedListQuerySchema.extend({
		status: z.string().optional().describe("Filter by recommendation status"),
		recommendation_date: z
			.string()
			.optional()
			.describe("Filter by recommendation date (YYYY-MM-DD)"),
	});

export type RecommendationListQuery = z.infer<
	typeof RecommendationListQuerySchema
>;

/**
 * Query schema for listing competitor rates.
 */
export const CompetitorRateListQuerySchema =
	TenantScopedListQuerySchema.extend({
		rate_date: z
			.string()
			.optional()
			.describe("Filter by rate date (YYYY-MM-DD)"),
	});

export type CompetitorRateListQuery = z.infer<
	typeof CompetitorRateListQuerySchema
>;

/**
 * Query schema for listing demand calendar entries.
 */
export const DemandCalendarListQuerySchema =
	TenantScopedListQuerySchema.extend({
		date_from: z
			.string()
			.optional()
			.describe("Start date filter (YYYY-MM-DD)"),
		date_to: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
	});

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
	forecast_period: z
		.string()
		.optional()
		.describe("Filter by forecast period"),
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

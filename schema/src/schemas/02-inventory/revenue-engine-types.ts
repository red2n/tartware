/**
 * DEV DOC
 * Module: schemas/02-inventory/revenue-engine-types.ts
 * Description: Operational types for the revenue recommendation engine
 * Category: 02-inventory
 * Primary exports: RoomTypeInfoSchema, OccupancyDataSchema, DemandEntrySchema, CompetitorDataSchema, ForecastDataSchema, PricingRuleSchema, RecommendationResultSchema, ComputeInputSchema, ComputeResultSchema, CompsetCompetitorInputSchema
 * @category 02-inventory
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

// ── Recommendation Engine Input/Output Types ─────────

/** Room type metadata used during recommendation computation */
export const RoomTypeInfoSchema = z.object({
    room_type_id: uuid,
    type_name: z.string(),
    base_rate: z.number(),
    total_rooms: z.number().int(),
});
export type RoomTypeInfo = z.infer<typeof RoomTypeInfoSchema>;

/** Current occupancy snapshot for a room type on a given date */
export const OccupancyDataSchema = z.object({
    occupied_rooms: z.number().int(),
    avg_current_rate: z.number(),
});
export type OccupancyData = z.infer<typeof OccupancyDataSchema>;

/** Demand calendar entry for a single date */
export const DemandEntrySchema = z.object({
    calendar_date: z.string(),
    demand_level: z.string().nullable(),
    occupancy_forecast: z.number().nullable(),
    booking_pace: z.string().nullable(),
    pickup_last_7_days: z.number().nullable(),
    pace_vs_last_year: z.number().nullable(),
    events: z.unknown(),
});
export type DemandEntry = z.infer<typeof DemandEntrySchema>;

/** Aggregated competitor rate statistics for a date */
export const CompetitorDataSchema = z.object({
    avg_rate: z.number(),
    min_rate: z.number(),
    max_rate: z.number(),
    competitor_count: z.number().int(),
});
export type CompetitorData = z.infer<typeof CompetitorDataSchema>;

/** Revenue forecast data for a single date */
export const ForecastDataSchema = z.object({
    forecast_date: z.string(),
    occupancy_percent: z.number().nullable(),
    adr: z.number().nullable(),
});
export type ForecastData = z.infer<typeof ForecastDataSchema>;

/** Active pricing rule applied during recommendation computation */
export const PricingRuleSchema = z.object({
    rule_id: uuid,
    rule_type: z.string(),
    adjustment_type: z.string(),
    adjustment_value: z.number(),
    min_rate: z.number().nullable(),
    max_rate: z.number().nullable(),
    applies_to_room_types: z.array(uuid).nullable(),
});
export type PricingRule = z.infer<typeof PricingRuleSchema>;

/** A single recommendation result from the engine */
export const RecommendationResultSchema = z.object({
    recommendation_id: uuid,
    room_type_id: uuid,
    date: z.string(),
    current_rate: z.number(),
    recommended_rate: z.number(),
    action: z.string(),
    confidence: z.number(),
    auto_applied: z.boolean(),
});
export type RecommendationResult = z.infer<typeof RecommendationResultSchema>;

/** Input parameters for the weighted multi-factor rate computation */
export const ComputeInputSchema = z.object({
    currentRate: z.number(),
    baseRate: z.number(),
    occPercent: z.number(),
    forecastOccPercent: z.number().nullable(),
    forecastAdr: z.number().nullable(),
    demandLevel: z.string().nullable(),
    bookingPace: z.string().nullable(),
    paceVsLastYear: z.number().nullable(),
    competitorAvg: z.number().nullable(),
    competitorSpread: z.number().nullable(),
    daysUntilArrival: z.number().int(),
    applicableRules: z.array(PricingRuleSchema),
    minRate: z.number(),
    maxRate: z.number(),
});
export type ComputeInput = z.infer<typeof ComputeInputSchema>;

/** Contributing factor in a rate recommendation */
export const ContributingFactorSchema = z.object({
    factor: z.string(),
    weight: z.number(),
    description: z.string(),
});
export type ContributingFactor = z.infer<typeof ContributingFactorSchema>;

/** Output from the weighted multi-factor rate computation */
export const ComputeResultSchema = z.object({
    rate: z.number(),
    confidence: z.number(),
    primaryReason: z.string(),
    factors: z.array(ContributingFactorSchema),
});
export type ComputeResult = z.infer<typeof ComputeResultSchema>;

// ── Comp Set Input Types ─────────────────────────────

/** Input for configuring a single competitor in the comp set */
export const CompsetCompetitorInputSchema = z.object({
    competitorName: z.string(),
    competitorExternalId: z.string().nullish(),
    competitorBrand: z.string().nullish(),
    competitorAddress: z.string().nullish(),
    competitorCity: z.string().nullish(),
    competitorCountry: z.string().nullish(),
    competitorStarRating: z.number().nullish(),
    competitorTotalRooms: z.number().int().nullish(),
    competitorUrl: z.string().nullish(),
    weight: money,
    distanceKm: z.number().nullish(),
    marketSegment: z.string().nullish(),
    rateShoppingSource: z.string().nullish(),
    isPrimary: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
    notes: z.string().nullish(),
});
export type CompsetCompetitorInput = z.infer<typeof CompsetCompetitorInputSchema>;

/**
 * Billing command schemas — Pricing domain
 * Covers dynamic pricing rule evaluation and bulk rate recommendations.
 * @category commands
 */

import { z } from "zod";

/**
 * Evaluate active pricing rules for a given property/room type/date.
 * Loads applicable pricing_rules, evaluates conditions against provided
 * context (occupancy, demand, lead time, etc.), applies adjustments
 * with caps, and returns the recommended adjusted rate.
 */
export const BillingPricingEvaluateCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	/** The base rate to adjust (from rate table). */
	base_rate: z.coerce.number().nonnegative(),
	/** Target date for pricing evaluation. */
	stay_date: z.coerce.date(),
	/** Current property occupancy percentage (0-100). */
	occupancy_percent: z.coerce.number().min(0).max(100).optional(),
	/** Demand level for the day: very_low to exceptional. */
	demand_level: z
		.enum(["very_low", "low", "moderate", "high", "very_high", "exceptional"])
		.optional(),
	/** Days until arrival for advance-purchase / last-minute rules. */
	days_until_arrival: z.coerce.number().int().nonnegative().optional(),
	/** Guest's requested length of stay (nights). */
	length_of_stay: z.coerce.number().int().positive().optional(),
	/** Day of week (0=Sunday to 6=Saturday). */
	day_of_week: z.coerce.number().int().min(0).max(6).optional(),
	/** Booking channel for channel-based rules. */
	channel: z.string().max(50).optional(),
	/** Market segment for segment-based rules. */
	segment: z.string().max(50).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPricingEvaluateCommand = z.infer<
	typeof BillingPricingEvaluateCommandSchema
>;

/**
 * Bulk generate rate recommendations for a property/date range.
 * Evaluates pricing rules across all room types and dates, then
 * writes results to rate_recommendations for revenue manager review.
 */
export const BillingPricingBulkRecommendCommandSchema = z.object({
	property_id: z.string().uuid(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	/** Only evaluate for specific room types (all if omitted). */
	room_type_ids: z.array(z.string().uuid()).optional(),
	dry_run: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPricingBulkRecommendCommand = z.infer<
	typeof BillingPricingBulkRecommendCommandSchema
>;

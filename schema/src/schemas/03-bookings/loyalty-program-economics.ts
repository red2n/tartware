/**
 * DEV DOC
 * Module: schemas/03-bookings/loyalty-program-economics.ts
 * Description: Loyalty program economics aggregate tracking
 * Table: loyalty_program_economics
 * Category: 03-bookings
 * Primary exports: LoyaltyProgramEconomicsSchema
 * @table loyalty_program_economics
 * @category 03-bookings
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Loyalty Program Economics — aggregate tracking of point liability,
 * benefit delivery costs, and program profitability per property/period.
 */
export const LoyaltyProgramEconomicsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// Period
	period_start: z.coerce.date(),
	period_end: z.coerce.date(),

	// Point Liability
	total_points_outstanding: z.number().int().nonnegative().default(0),
	point_liability_value: money.default(0),
	cost_per_point: z.number().nonnegative().default(0),

	// Earning Metrics
	points_earned_period: z.number().int().nonnegative().default(0),
	points_earned_value: money.default(0),

	// Redemption Metrics
	points_redeemed_period: z.number().int().nonnegative().default(0),
	points_redeemed_value: money.default(0),
	redemption_rate: z.number().nonnegative().default(0),

	// Expiry & Breakage
	points_expired_period: z.number().int().nonnegative().default(0),
	breakage_rate: z.number().nonnegative().default(0),

	// Benefit Delivery Costs
	upgrade_cost: money.default(0),
	amenity_cost: money.default(0),
	late_checkout_cost: money.default(0),
	total_benefit_cost: money.default(0),

	// Program ROI
	incremental_revenue: money.default(0),
	program_roi: z.number().optional(),

	// Member counts
	active_members: z.number().int().nonnegative().default(0),
	new_enrollments: z.number().int().nonnegative().default(0),

	// Metadata
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type LoyaltyProgramEconomics = z.infer<
	typeof LoyaltyProgramEconomicsSchema
>;

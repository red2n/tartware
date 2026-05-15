/**
 * DEV DOC
 * Module: schemas/03-bookings/loyalty-tier-rules.ts
 * Description: LoyaltyTierRules Schema - Loyalty program tier configuration
 * Table: loyalty_tier_rules
 * Category: 03-bookings
 * Primary exports: LoyaltyTierRulesSchema, CreateLoyaltyTierRulesSchema, UpdateLoyaltyTierRulesSchema
 * @table loyalty_tier_rules
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * LoyaltyTierRules Schema
 * Configurable tier definitions for loyalty programs: qualification
 * thresholds (nights, stays, points, spend), earning rates,
 * bonus multipliers, expiry policies, and tier-specific benefits.
 *
 * @table loyalty_tier_rules
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const LoyaltyTierRulesSchema = z.object({
	// Primary Key
	rule_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid.optional(),

	// Tier Identification
	tier_name: z.enum([
		"bronze",
		"silver",
		"gold",
		"platinum",
		"diamond",
		"elite",
	]),
	tier_rank: z.number().int(),
	display_name: z.string().optional(),

	// Qualification Thresholds
	min_nights: z.coerce.number().int().optional(),
	min_stays: z.coerce.number().int().optional(),
	min_points: z.coerce.number().int().optional(),
	// min_spend is NUMERIC in PostgreSQL — pg returns it as string; coerce to number
	min_spend: z.coerce.number().nonnegative().optional(),
	qualification_period_months: z.coerce.number().int().optional(),

	// Earning & Multipliers
	// points_per_dollar and bonus_multiplier are NUMERIC — coerce from pg string
	points_per_dollar: z.coerce.number().nonnegative().optional(),
	bonus_multiplier: z.coerce.number().nonnegative().optional(),
	points_expiry_months: z.coerce.number().int().optional(),

	// Category-specific earning rates (MG-3)
	category_earning_rates: z
		.object({
			room: z.number().nonnegative().optional(),
			food_and_beverage: z.number().nonnegative().optional(),
			spa: z.number().nonnegative().optional(),
			retail: z.number().nonnegative().optional(),
			parking: z.number().nonnegative().optional(),
			other: z.number().nonnegative().optional(),
		})
		.optional(),

	// Benefits & Bonuses
	benefits: z.record(z.unknown()).optional(),
	welcome_bonus_points: z.number().int().optional(),

	// Status
	is_active: z.boolean().optional(),

	// Audit Fields
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type LoyaltyTierRules = z.infer<typeof LoyaltyTierRulesSchema>;

/**
 * Schema for creating a new loyalty tier rule
 */
export const CreateLoyaltyTierRulesSchema = LoyaltyTierRulesSchema.omit({
	rule_id: true,
	created_at: true,
	updated_at: true,
});

export type CreateLoyaltyTierRules = z.infer<
	typeof CreateLoyaltyTierRulesSchema
>;

/**
 * Schema for updating a loyalty tier rule
 */
export const UpdateLoyaltyTierRulesSchema = LoyaltyTierRulesSchema.partial();

export type UpdateLoyaltyTierRules = z.infer<
	typeof UpdateLoyaltyTierRulesSchema
>;

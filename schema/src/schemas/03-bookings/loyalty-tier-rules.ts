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

import { money, uuid } from "../../shared/base-schemas.js";

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
	min_nights: z.number().int().optional(),
	min_stays: z.number().int().optional(),
	min_points: z.number().int().optional(),
	min_spend: money.optional(),
	qualification_period_months: z.number().int().optional(),

	// Earning & Multipliers
	points_per_dollar: z.number().optional(),
	bonus_multiplier: z.number().optional(),
	points_expiry_months: z.number().int().optional(),

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

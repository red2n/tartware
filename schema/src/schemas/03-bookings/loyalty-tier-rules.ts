/**
 * LoyaltyTierRules Schema
 * @table loyalty_tier_rules
 * @category 03-bookings
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete LoyaltyTierRules schema
 */
export const LoyaltyTierRulesSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
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
	min_nights: z.number().int().optional(),
	min_stays: z.number().int().optional(),
	min_points: z.number().int().optional(),
	min_spend: money.optional(),
	qualification_period_months: z.number().int().optional(),
	points_per_dollar: z.number().optional(),
	bonus_multiplier: z.number().optional(),
	points_expiry_months: z.number().int().optional(),
	benefits: z.record(z.unknown()).optional(),
	welcome_bonus_points: z.number().int().optional(),
	is_active: z.boolean().optional(),
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

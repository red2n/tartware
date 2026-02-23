/**
 * DEV DOC
 * Module: schemas/03-bookings/reward-catalog.ts
 * Description: RewardCatalog Schema — available rewards for loyalty point redemption
 * Table: reward_catalog
 * Category: 03-bookings
 * Primary exports: RewardCatalogSchema, CreateRewardCatalogSchema, UpdateRewardCatalogSchema
 * @table reward_catalog
 * @category 03-bookings
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

const rewardCategoryEnum = z.enum([
	"room_upgrade",
	"free_night",
	"food_beverage",
	"spa",
	"amenity",
	"experience",
	"merchandise",
	"discount",
	"late_checkout",
	"early_checkin",
	"airport_transfer",
	"other",
]);

const fulfillmentTypeEnum = z.enum([
	"automatic",
	"manual",
	"approval_required",
	"voucher",
]);

const loyaltyTierEnum = z.enum([
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"elite",
]);

export const RewardCatalogSchema = z.object({
	reward_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),

	reward_code: z.string().max(50),
	reward_name: z.string().max(200),
	reward_description: z.string().optional(),
	reward_category: rewardCategoryEnum,

	points_required: z.number().int().positive(),
	points_variable: z.boolean().optional(),
	points_per_currency_unit: z.number().optional(),

	reward_value: money.optional(),
	currency: z.string().max(3).optional(),

	is_active: z.boolean().optional(),
	available_from: z.coerce.date().optional(),
	available_to: z.coerce.date().optional(),
	max_redemptions_per_guest: z.number().int().optional(),
	max_total_redemptions: z.number().int().optional(),
	current_redemption_count: z.number().int().optional(),
	min_tier: loyaltyTierEnum.optional(),
	blackout_dates: z.array(z.record(z.unknown())).optional(),
	day_of_week_restrictions: z.array(z.number().int().min(0).max(6)).optional(),

	fulfillment_type: fulfillmentTypeEnum.optional(),
	fulfillment_instructions: z.string().optional(),
	voucher_template_id: uuid.optional(),

	image_url: z.string().optional(),
	sort_order: z.number().int().optional(),
	featured: z.boolean().optional(),

	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type RewardCatalog = z.infer<typeof RewardCatalogSchema>;

export const CreateRewardCatalogSchema = RewardCatalogSchema.omit({
	reward_id: true,
	current_redemption_count: true,
	created_at: true,
	updated_at: true,
});

export type CreateRewardCatalog = z.infer<typeof CreateRewardCatalogSchema>;

export const UpdateRewardCatalogSchema = RewardCatalogSchema.partial();

export type UpdateRewardCatalog = z.infer<typeof UpdateRewardCatalogSchema>;

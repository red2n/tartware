/**
 * DEV DOC
 * Module: schemas/03-bookings/reward-redemptions.ts
 * Description: RewardRedemptions Schema — records of guest loyalty reward redemptions
 * Table: reward_redemptions
 * Category: 03-bookings
 * Primary exports: RewardRedemptionsSchema, CreateRewardRedemptionsSchema
 * @table reward_redemptions
 * @category 03-bookings
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

const redemptionStatusEnum = z.enum([
	"pending",
	"approved",
	"fulfilled",
	"cancelled",
	"expired",
	"rejected",
]);

export const RewardRedemptionsSchema = z.object({
	redemption_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	reward_id: uuid,
	program_id: uuid,
	guest_id: uuid,
	reservation_id: uuid.optional(),

	redemption_code: z.string().max(100),
	points_spent: z.number().int().positive(),
	reward_value: money.optional(),
	currency: z.string().max(3).optional(),

	redemption_status: redemptionStatusEnum,

	fulfilled_at: z.coerce.date().optional(),
	fulfilled_by: uuid.optional(),
	fulfillment_notes: z.string().optional(),

	cancelled_at: z.coerce.date().optional(),
	cancelled_by: uuid.optional(),
	cancellation_reason: z.string().optional(),
	points_refunded: z.boolean().optional(),

	expires_at: z.coerce.date().optional(),
	expired: z.boolean().optional(),

	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type RewardRedemptions = z.infer<typeof RewardRedemptionsSchema>;

export const CreateRewardRedemptionsSchema = RewardRedemptionsSchema.omit({
	redemption_id: true,
	fulfilled_at: true,
	fulfilled_by: true,
	fulfillment_notes: true,
	cancelled_at: true,
	cancelled_by: true,
	cancellation_reason: true,
	points_refunded: true,
	expired: true,
	created_at: true,
	updated_at: true,
});

export type CreateRewardRedemptions = z.infer<
	typeof CreateRewardRedemptionsSchema
>;

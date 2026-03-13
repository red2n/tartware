/**
 * DEV DOC
 * Module: schemas/02-inventory/rate-seasons.ts
 * Description: RateSeasons Schema
 * Table: rate_seasons
 * Category: 02-inventory
 * Primary exports: RateSeasonSchema, CreateRateSeasonSchema, UpdateRateSeasonSchema
 * @table rate_seasons
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * RateSeasons Schema
 * @table rate_seasons
 * @category 02-inventory
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";
import { SeasonTypeEnum } from "../../shared/enums.js";

const recurrenceTypeEnum = z.enum(["NONE", "YEARLY"]);

/**
 * Complete RateSeason schema
 */
export const RateSeasonSchema = z.object({
	season_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	season_name: z.string().max(100),
	season_type: SeasonTypeEnum,
	description: z.string().optional(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	rate_multiplier: money.default(1),
	min_stay: z.number().int().min(1).default(1),
	max_discount_percent: money.default(0),
	priority: z.number().int().default(0),
	recurrence_type: recurrenceTypeEnum.default("NONE"),
	is_active: z.boolean().default(true),
	applies_to_room_types: z.array(uuid).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type RateSeason = z.infer<typeof RateSeasonSchema>;

/**
 * Create RateSeason - required fields for insertion
 */
export const CreateRateSeasonSchema = RateSeasonSchema.omit({
	season_id: true,
	created_at: true,
	updated_at: true,
}).partial({
	rate_multiplier: true,
	min_stay: true,
	max_discount_percent: true,
	priority: true,
	recurrence_type: true,
	is_active: true,
	created_by: true,
	updated_by: true,
});

export type CreateRateSeason = z.infer<typeof CreateRateSeasonSchema>;

/**
 * Update RateSeason - all fields optional except identifiers
 */
export const UpdateRateSeasonSchema = RateSeasonSchema.pick({
	season_id: true,
	tenant_id: true,
}).merge(
	RateSeasonSchema.omit({
		season_id: true,
		tenant_id: true,
		created_at: true,
		updated_at: true,
	}).partial(),
);

export type UpdateRateSeason = z.infer<typeof UpdateRateSeasonSchema>;

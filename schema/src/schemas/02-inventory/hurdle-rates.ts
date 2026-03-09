/**
 * DEV DOC
 * Module: schemas/02-inventory/hurdle-rates.ts
 * Description: HurdleRates Schema — Minimum acceptable rates per room type × date
 * Table: hurdle_rates
 * Category: 02-inventory
 * Primary exports: HurdleRatesSchema, CreateHurdleRatesSchema, UpdateHurdleRatesSchema, HurdleRateSourceEnum, HurdleRateListQuerySchema
 * @table hurdle_rates
 * @category 02-inventory
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/** Source enum for how the hurdle rate was determined */
export const HurdleRateSourceEnum = z.enum([
	"manual",
	"calculated",
	"imported",
]);

/**
 * Complete HurdleRates schema
 */
export const HurdleRatesSchema = z.object({
	hurdle_rate_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	hurdle_date: z.coerce.date(),
	hurdle_rate: money,
	currency: z.string().max(3).default("USD"),
	segment: z.string().nullable().optional(),
	source: HurdleRateSourceEnum,
	displacement_analysis: z.record(z.unknown()).optional(),
	confidence_score: money.nullable().optional(),
	is_active: z.boolean(),
	notes: z.string().nullable().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	created_by: uuid.nullable().optional(),
	updated_by: uuid.nullable().optional(),
	is_deleted: z.boolean(),
	deleted_at: z.coerce.date().nullable().optional(),
	deleted_by: uuid.nullable().optional(),
});

export type HurdleRates = z.infer<typeof HurdleRatesSchema>;

/**
 * Create HurdleRates input schema
 */
export const CreateHurdleRatesSchema = HurdleRatesSchema.omit({
	hurdle_rate_id: true,
	created_at: true,
	updated_at: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateHurdleRates = z.infer<typeof CreateHurdleRatesSchema>;

/**
 * Update HurdleRates input schema
 */
export const UpdateHurdleRatesSchema = HurdleRatesSchema.pick({
	hurdle_rate: true,
	currency: true,
	segment: true,
	is_active: true,
	notes: true,
	metadata: true,
}).partial();

export type UpdateHurdleRates = z.infer<typeof UpdateHurdleRatesSchema>;

/**
 * Query schema for hurdle rates list endpoint
 */
export const HurdleRateListQuerySchema = z.object({
	tenant_id: z.string().uuid(),
	property_id: z.string().uuid().optional(),
	room_type_id: z.string().uuid().optional(),
	segment: z.string().optional(),
	date_from: z.string().date().optional(),
	date_to: z.string().date().optional(),
	source: HurdleRateSourceEnum.optional(),
	limit: z.coerce.number().int().min(1).max(1000).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type HurdleRateListQuery = z.infer<typeof HurdleRateListQuerySchema>;

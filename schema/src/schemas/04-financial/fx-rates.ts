/**
 * DEV DOC
 * Module: schemas/04-financial/fx-rates.ts
 * Description: FX Rate Reference Schema
 * Table: fx_rates
 * Category: 04-financial
 * Primary exports: FxRatesSchema, CreateFxRateSchema
 * @table fx_rates
 * @category 04-financial
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/** Complete FX rate row schema. */
export const FxRatesSchema = z.object({
	rate_id: uuid,
	tenant_id: uuid.optional(),
	from_currency: z.string().length(3),
	to_currency: z.string().length(3),
	rate: z.coerce.number().positive(),
	rate_date: z.coerce.date(),
	rate_source: z.string().max(60).default("MANUAL"),
	rate_source_ref: z.string().max(200).optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
});

export type FxRate = z.infer<typeof FxRatesSchema>;

/** Input for inserting a new FX rate. */
export const CreateFxRateSchema = FxRatesSchema.omit({
	rate_id: true,
	created_at: true,
});

export type CreateFxRate = z.infer<typeof CreateFxRateSchema>;

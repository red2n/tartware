/**
 * DEV DOC
 * Module: schemas/02-inventory/competitor-properties.ts
 * Description: CompetitorProperties Schema — comp set configuration
 * Table: competitor_properties
 * Category: 02-inventory
 * Primary exports: CompetitorPropertiesSchema, CreateCompetitorPropertiesSchema, UpdateCompetitorPropertiesSchema
 * @table competitor_properties
 * @category 02-inventory
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete CompetitorProperties schema
 */
export const CompetitorPropertiesSchema = z.object({
	competitor_property_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	competitor_name: z.string(),
	competitor_external_id: z.string().optional(),
	competitor_brand: z.string().optional(),
	competitor_address: z.string().optional(),
	competitor_city: z.string().optional(),
	competitor_country: z.string().optional(),
	competitor_star_rating: money.optional(),
	competitor_total_rooms: z.number().int().optional(),
	competitor_url: z.string().optional(),
	weight: money,
	relevance_score: money.optional(),
	distance_km: money.optional(),
	market_segment: z.string().optional(),
	rate_shopping_source: z.string().optional(),
	is_primary: z.boolean().optional(),
	is_active: z.boolean().optional(),
	sort_order: z.number().int().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type CompetitorProperties = z.infer<typeof CompetitorPropertiesSchema>;

/**
 * Create schema — fields required when adding a new competitor to the comp set
 */
export const CreateCompetitorPropertiesSchema = CompetitorPropertiesSchema.omit(
	{
		competitor_property_id: true,
		tenant_id: true,
		created_at: true,
		updated_at: true,
		created_by: true,
		updated_by: true,
	},
);

export type CreateCompetitorProperties = z.infer<
	typeof CreateCompetitorPropertiesSchema
>;

/**
 * Update schema — all fields optional except the identifier
 */
export const UpdateCompetitorPropertiesSchema = CompetitorPropertiesSchema.pick(
	{
		competitor_property_id: true,
	},
).merge(
	CompetitorPropertiesSchema.omit({
		competitor_property_id: true,
		tenant_id: true,
		created_at: true,
		updated_at: true,
		created_by: true,
		updated_by: true,
	}).partial(),
);

export type UpdateCompetitorProperties = z.infer<
	typeof UpdateCompetitorPropertiesSchema
>;

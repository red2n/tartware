/**
 * DEV DOC
 * Module: schemas/07-analytics/carbon-offset-programs.ts
 * Description: CarbonOffsetPrograms Schema
 * Table: carbon_offset_programs
 * Category: 07-analytics
 * Primary exports: CarbonOffsetProgramsSchema, CreateCarbonOffsetProgramsSchema, UpdateCarbonOffsetProgramsSchema
 * @table carbon_offset_programs
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * CarbonOffsetPrograms Schema
 * @table carbon_offset_programs
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete CarbonOffsetPrograms schema
 */
export const CarbonOffsetProgramsSchema = z.object({
	program_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	program_name: z.string(),
	program_type: z.string().optional(),
	provider_name: z.string().optional(),
	provider_url: z.string().optional(),
	total_credits_purchased: z.number().int().optional(),
	credits_remaining: z.number().int().optional(),
	cost_per_credit: money.optional(),
	total_cost: money.optional(),
	carbon_offset_kg: money.optional(),
	guest_opt_in_count: z.number().int().optional(),
	guest_donations_received: money.optional(),
	is_active: z.boolean().optional(),
	marketing_materials_url: z.string().optional(),
	certificate_template_url: z.string().optional(),
	impact_report_url: z.string().optional(),
	verified_impact: z.boolean().optional(),
	verification_body: z.string().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type CarbonOffsetPrograms = z.infer<typeof CarbonOffsetProgramsSchema>;

/**
 * Schema for creating a new carbon offset programs
 */
export const CreateCarbonOffsetProgramsSchema = CarbonOffsetProgramsSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateCarbonOffsetPrograms = z.infer<
	typeof CreateCarbonOffsetProgramsSchema
>;

/**
 * Schema for updating a carbon offset programs
 */
export const UpdateCarbonOffsetProgramsSchema =
	CarbonOffsetProgramsSchema.partial();

export type UpdateCarbonOffsetPrograms = z.infer<
	typeof UpdateCarbonOffsetProgramsSchema
>;

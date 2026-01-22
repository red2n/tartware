/**
 * DEV DOC
 * Module: schemas/07-analytics/sustainability-initiatives.ts
 * Description: SustainabilityInitiatives Schema
 * Table: sustainability_initiatives
 * Category: 07-analytics
 * Primary exports: SustainabilityInitiativesSchema, CreateSustainabilityInitiativesSchema, UpdateSustainabilityInitiativesSchema
 * @table sustainability_initiatives
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * SustainabilityInitiatives Schema
 * @table sustainability_initiatives
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete SustainabilityInitiatives schema
 */
export const SustainabilityInitiativesSchema = z.object({
	initiative_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	initiative_name: z.string(),
	initiative_description: z.string().optional(),
	category: z.string().optional(),
	start_date: z.coerce.date(),
	target_completion_date: z.coerce.date().optional(),
	actual_completion_date: z.coerce.date().optional(),
	status: z.string().optional(),
	goal_description: z.string().optional(),
	target_metric: z.string().optional(),
	baseline_value: money.optional(),
	target_value: money.optional(),
	current_value: money.optional(),
	progress_percentage: money.optional(),
	estimated_budget: money.optional(),
	actual_cost: money.optional(),
	roi_expected: money.optional(),
	roi_actual: money.optional(),
	environmental_impact: z.string().optional(),
	social_impact: z.string().optional(),
	financial_impact: z.string().optional(),
	project_lead: uuid.optional(),
	team_members: z.array(uuid).optional(),
	notes: z.string().optional(),
	lessons_learned: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type SustainabilityInitiatives = z.infer<
	typeof SustainabilityInitiativesSchema
>;

/**
 * Schema for creating a new sustainability initiatives
 */
export const CreateSustainabilityInitiativesSchema =
	SustainabilityInitiativesSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateSustainabilityInitiatives = z.infer<
	typeof CreateSustainabilityInitiativesSchema
>;

/**
 * Schema for updating a sustainability initiatives
 */
export const UpdateSustainabilityInitiativesSchema =
	SustainabilityInitiativesSchema.partial();

export type UpdateSustainabilityInitiatives = z.infer<
	typeof UpdateSustainabilityInitiativesSchema
>;

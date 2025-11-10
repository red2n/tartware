/**
 * AiModelPerformance Schema
 * @table ai_model_performance
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AiModelPerformance schema
 */
export const AiModelPerformanceSchema = z.object({
	performance_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	model_name: z.string(),
	model_version: z.string().optional(),
	model_type: z.string().optional(),
	evaluation_date: z.coerce.date(),
	evaluation_period_start: z.coerce.date(),
	evaluation_period_end: z.coerce.date(),
	total_predictions: z.number().int(),
	accurate_predictions: z.number().int().optional(),
	accuracy_percentage: money.optional(),
	mean_absolute_error: money.optional(),
	mean_squared_error: money.optional(),
	root_mean_squared_error: money.optional(),
	mean_absolute_percentage_error: money.optional(),
	r_squared: money.optional(),
	revenue_optimization_amount: money.optional(),
	revenue_optimization_percentage: money.optional(),
	retrain_recommended: z.boolean().optional(),
	feature_engineering_needed: z.boolean().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
});

export type AiModelPerformance = z.infer<typeof AiModelPerformanceSchema>;

/**
 * Schema for creating a new ai model performance
 */
export const CreateAiModelPerformanceSchema = AiModelPerformanceSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAiModelPerformance = z.infer<
	typeof CreateAiModelPerformanceSchema
>;

/**
 * Schema for updating a ai model performance
 */
export const UpdateAiModelPerformanceSchema =
	AiModelPerformanceSchema.partial();

export type UpdateAiModelPerformance = z.infer<
	typeof UpdateAiModelPerformanceSchema
>;

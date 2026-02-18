/**
 * DEV DOC
 * Module: schemas/07-analytics/forecasting-models.ts
 * Description: ForecastingModels Schema
 * Table: forecasting_models
 * Category: 07-analytics
 * Primary exports: ForecastingModelsSchema, CreateForecastingModelsSchema, UpdateForecastingModelsSchema
 * @table forecasting_models
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * ForecastingModels Schema
 * @table forecasting_models
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete ForecastingModels schema
 */
export const ForecastingModelsSchema = z.object({
	model_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	model_name: z.string(),
	model_type: z.string(),
	algorithm: z.string().optional(),
	is_active: z.boolean().optional(),
	accuracy_score: money.optional(),
	training_data_start: z.coerce.date().optional(),
	training_data_end: z.coerce.date().optional(),
	last_trained_at: z.coerce.date().optional(),
	parameters: z.record(z.unknown()).optional(),
	predictions: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ForecastingModels = z.infer<typeof ForecastingModelsSchema>;

/**
 * Schema for creating a new forecasting models
 */
export const CreateForecastingModelsSchema = ForecastingModelsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateForecastingModels = z.infer<
	typeof CreateForecastingModelsSchema
>;

/**
 * Schema for updating a forecasting models
 */
export const UpdateForecastingModelsSchema = ForecastingModelsSchema.partial();

export type UpdateForecastingModels = z.infer<
	typeof UpdateForecastingModelsSchema
>;

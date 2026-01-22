/**
 * DEV DOC
 * Module: schemas/05-operations/spa-treatments.ts
 * Description: SpaTreatments Schema
 * Table: spa_treatments
 * Category: 05-operations
 * Primary exports: SpaTreatmentsSchema, CreateSpaTreatmentsSchema, UpdateSpaTreatmentsSchema
 * @table spa_treatments
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * SpaTreatments Schema
 * @table spa_treatments
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete SpaTreatments schema
 */
export const SpaTreatmentsSchema = z.object({
	treatment_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	treatment_code: z.string(),
	treatment_name: z.string(),
	category: z.string(),
	description: z.string().optional(),
	duration_minutes: z.number().int(),
	base_price: money,
	currency: z.string().optional(),
	default_room_id: uuid.optional(),
	required_resources: z.record(z.unknown()).optional(),
	gender_restriction: z.string().optional(),
	max_guests: z.number().int().optional(),
	padding_before_minutes: z.number().int().optional(),
	padding_after_minutes: z.number().int().optional(),
	available_days: z.array(z.string()).optional(),
	available_time_windows: z.record(z.unknown()).optional(),
	lead_time_hours: z.number().int().optional(),
	cancellation_policy: z.string().optional(),
	spa_menu_category: z.string().optional(),
	highlights: z.string().optional(),
	image_url: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_active: z.boolean().optional(),
	start_date: z.coerce.date().optional(),
	end_date: z.coerce.date().optional(),
	created_at: z.coerce.date(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type SpaTreatments = z.infer<typeof SpaTreatmentsSchema>;

/**
 * Schema for creating a new spa treatments
 */
export const CreateSpaTreatmentsSchema = SpaTreatmentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSpaTreatments = z.infer<typeof CreateSpaTreatmentsSchema>;

/**
 * Schema for updating a spa treatments
 */
export const UpdateSpaTreatmentsSchema = SpaTreatmentsSchema.partial();

export type UpdateSpaTreatments = z.infer<typeof UpdateSpaTreatmentsSchema>;

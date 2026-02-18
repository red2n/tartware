/**
 * DEV DOC
 * Module: schemas/06-integrations/ota-rate-plans.ts
 * Description: OtaRatePlans Schema
 * Table: ota_rate_plans
 * Category: 06-integrations
 * Primary exports: OtaRatePlansSchema, CreateOtaRatePlansSchema, UpdateOtaRatePlansSchema
 * @table ota_rate_plans
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * OtaRatePlans Schema
 * @table ota_rate_plans
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete OtaRatePlans schema
 */
export const OtaRatePlansSchema = z.object({
	id: uuid,
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	ota_configuration_id: uuid,
	rate_id: uuid,
	ota_rate_plan_id: z.string(),
	ota_rate_plan_name: z.string().optional(),
	mapping_type: z.string().optional(),
	is_active: z.boolean().optional(),
	priority: z.number().int().optional(),
	min_advance_booking_days: z.number().int().optional(),
	max_advance_booking_days: z.number().int().optional(),
	min_length_of_stay: z.number().int().optional(),
	max_length_of_stay: z.number().int().optional(),
	include_breakfast: z.boolean().optional(),
	include_taxes: z.boolean().optional(),
	cancellation_policy_code: z.string().optional(),
	markup_percentage: money.optional(),
	markdown_percentage: money.optional(),
	fixed_adjustment_amount: money.optional(),
	configuration_json: z.record(z.unknown()).optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
});

export type OtaRatePlans = z.infer<typeof OtaRatePlansSchema>;

/**
 * Schema for creating a new ota rate plans
 */
export const CreateOtaRatePlansSchema = OtaRatePlansSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateOtaRatePlans = z.infer<typeof CreateOtaRatePlansSchema>;

/**
 * Schema for updating a ota rate plans
 */
export const UpdateOtaRatePlansSchema = OtaRatePlansSchema.partial();

export type UpdateOtaRatePlans = z.infer<typeof UpdateOtaRatePlansSchema>;

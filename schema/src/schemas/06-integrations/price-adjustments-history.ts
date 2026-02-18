/**
 * DEV DOC
 * Module: schemas/06-integrations/price-adjustments-history.ts
 * Description: PriceAdjustmentsHistory Schema
 * Table: price_adjustments_history
 * Category: 06-integrations
 * Primary exports: PriceAdjustmentsHistorySchema, CreatePriceAdjustmentsHistorySchema, UpdatePriceAdjustmentsHistorySchema
 * @table price_adjustments_history
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * PriceAdjustmentsHistory Schema
 * @table price_adjustments_history
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PriceAdjustmentsHistory schema
 */
export const PriceAdjustmentsHistorySchema = z.object({
	adjustment_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_code: z.string().optional(),
	target_date: z.coerce.date(),
	previous_rate: money,
	new_rate: money,
	adjustment_amount: money.optional(),
	adjustment_percentage: money.optional(),
	adjustment_trigger: z.string().optional(),
	rule_id: uuid.optional(),
	current_occupancy: money.optional(),
	predicted_occupancy: money.optional(),
	days_to_arrival: z.number().int().optional(),
	booking_pace: money.optional(),
	competitor_avg_rate: money.optional(),
	ml_model_used: z.string().optional(),
	model_confidence: money.optional(),
	feature_scores: z.record(z.unknown()).optional(),
	adjustment_status: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	rooms_sold_after_adjustment: z.number().int().optional(),
	revenue_after_adjustment: money.optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	applied_at: z.coerce.date().optional(),
});

export type PriceAdjustmentsHistory = z.infer<
	typeof PriceAdjustmentsHistorySchema
>;

/**
 * Schema for creating a new price adjustments history
 */
export const CreatePriceAdjustmentsHistorySchema =
	PriceAdjustmentsHistorySchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreatePriceAdjustmentsHistory = z.infer<
	typeof CreatePriceAdjustmentsHistorySchema
>;

/**
 * Schema for updating a price adjustments history
 */
export const UpdatePriceAdjustmentsHistorySchema =
	PriceAdjustmentsHistorySchema.partial();

export type UpdatePriceAdjustmentsHistory = z.infer<
	typeof UpdatePriceAdjustmentsHistorySchema
>;

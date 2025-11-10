/**
 * RevenueAttribution Schema
 * @table revenue_attribution
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete RevenueAttribution schema
 */
export const RevenueAttributionSchema = z.object({
	attribution_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid,
	touchpoint_sequence: z.number().int(),
	channel_type: z.string(),
	campaign_id: uuid.optional(),
	attribution_weight: money.optional(),
	attributed_revenue: money,
	touchpoint_date: z.coerce.date(),
	conversion_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type RevenueAttribution = z.infer<typeof RevenueAttributionSchema>;

/**
 * Schema for creating a new revenue attribution
 */
export const CreateRevenueAttributionSchema = RevenueAttributionSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRevenueAttribution = z.infer<
	typeof CreateRevenueAttributionSchema
>;

/**
 * Schema for updating a revenue attribution
 */
export const UpdateRevenueAttributionSchema =
	RevenueAttributionSchema.partial();

export type UpdateRevenueAttribution = z.infer<
	typeof UpdateRevenueAttributionSchema
>;

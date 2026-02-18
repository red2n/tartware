/**
 * DEV DOC
 * Module: schemas/06-integrations/pricing-experiments.ts
 * Description: PricingExperiments Schema
 * Table: pricing_experiments
 * Category: 06-integrations
 * Primary exports: PricingExperimentsSchema, CreatePricingExperimentsSchema, UpdatePricingExperimentsSchema
 * @table pricing_experiments
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * PricingExperiments Schema
 * @table pricing_experiments
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PricingExperiments schema
 */
export const PricingExperimentsSchema = z.object({
	experiment_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	experiment_name: z.string(),
	experiment_description: z.string().optional(),
	hypothesis: z.string().optional(),
	control_strategy: z.string(),
	test_strategy: z.string(),
	control_rule_id: uuid.optional(),
	test_rule_id: uuid.optional(),
	traffic_split_percentage: money.optional(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	control_bookings: z.number().int().optional(),
	test_bookings: z.number().int().optional(),
	control_revenue: money.optional(),
	test_revenue: money.optional(),
	control_avg_rate: money.optional(),
	test_avg_rate: money.optional(),
	control_occupancy: money.optional(),
	test_occupancy: money.optional(),
	statistical_significance: money.optional(),
	confidence_level: money.optional(),
	winner: z.string().optional(),
	status: z.string().optional(),
	notes: z.string().optional(),
	conclusion: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type PricingExperiments = z.infer<typeof PricingExperimentsSchema>;

/**
 * Schema for creating a new pricing experiments
 */
export const CreatePricingExperimentsSchema = PricingExperimentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePricingExperiments = z.infer<
	typeof CreatePricingExperimentsSchema
>;

/**
 * Schema for updating a pricing experiments
 */
export const UpdatePricingExperimentsSchema =
	PricingExperimentsSchema.partial();

export type UpdatePricingExperiments = z.infer<
	typeof UpdatePricingExperimentsSchema
>;

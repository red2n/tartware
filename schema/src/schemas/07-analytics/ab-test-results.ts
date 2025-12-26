/**
 * AbTestResults Schema
 * @table ab_test_results
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AbTestResults schema
 */
export const AbTestResultsSchema = z.object({
	result_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	test_name: z.string(),
	test_category: z.string().optional(),
	test_status: z.string().optional(),
	variant_a_config: z.record(z.unknown()),
	variant_b_config: z.record(z.unknown()),
	start_date: z.coerce.date(),
	end_date: z.coerce.date().optional(),
	variant_a_sample_size: z.number().int().optional(),
	variant_b_sample_size: z.number().int().optional(),
	variant_a_conversions: z.number().int().optional(),
	variant_b_conversions: z.number().int().optional(),
	variant_a_conversion_rate: money.optional(),
	variant_b_conversion_rate: money.optional(),
	winning_variant: z.string().optional(),
	confidence_level: money.optional(),
	statistical_significance: z.boolean().optional(),
	results: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type AbTestResults = z.infer<typeof AbTestResultsSchema>;

/**
 * Schema for creating a new ab test results
 */
export const CreateAbTestResultsSchema = AbTestResultsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAbTestResults = z.infer<typeof CreateAbTestResultsSchema>;

/**
 * Schema for updating a ab test results
 */
export const UpdateAbTestResultsSchema = AbTestResultsSchema.partial();

export type UpdateAbTestResults = z.infer<typeof UpdateAbTestResultsSchema>;

/**
 * DEV DOC
 * Module: schemas/06-integrations/review-response-templates.ts
 * Description: ReviewResponseTemplates Schema
 * Table: review_response_templates
 * Category: 06-integrations
 * Primary exports: ReviewResponseTemplatesSchema, CreateReviewResponseTemplatesSchema, UpdateReviewResponseTemplatesSchema
 * @table review_response_templates
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * ReviewResponseTemplates Schema
 * @table review_response_templates
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete ReviewResponseTemplates schema
 */
export const ReviewResponseTemplatesSchema = z.object({
	template_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	template_name: z.string(),
	template_description: z.string().optional(),
	sentiment_type: z.string().optional(),
	issue_categories: z.array(z.string()).optional(),
	template_text: z.string(),
	available_tokens: z.array(z.string()).optional(),
	use_count: z.number().int().optional(),
	effectiveness_score: money.optional(),
	is_active: z.boolean().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type ReviewResponseTemplates = z.infer<
	typeof ReviewResponseTemplatesSchema
>;

/**
 * Schema for creating a new review response templates
 */
export const CreateReviewResponseTemplatesSchema =
	ReviewResponseTemplatesSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateReviewResponseTemplates = z.infer<
	typeof CreateReviewResponseTemplatesSchema
>;

/**
 * Schema for updating a review response templates
 */
export const UpdateReviewResponseTemplatesSchema =
	ReviewResponseTemplatesSchema.partial();

export type UpdateReviewResponseTemplates = z.infer<
	typeof UpdateReviewResponseTemplatesSchema
>;

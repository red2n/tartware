/**
 * DEV DOC
 * Module: schemas/06-integrations/personalized-recommendations.ts
 * Description: PersonalizedRecommendations Schema
 * Table: personalized_recommendations
 * Category: 06-integrations
 * Primary exports: PersonalizedRecommendationsSchema, CreatePersonalizedRecommendationsSchema, UpdatePersonalizedRecommendationsSchema
 * @table personalized_recommendations
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * PersonalizedRecommendations Schema
 * @table personalized_recommendations
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PersonalizedRecommendations schema
 */
export const PersonalizedRecommendationsSchema = z.object({
	recommendation_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	reservation_id: uuid.optional(),
	recommendation_type: z.string(),
	recommendation_title: z.string(),
	recommendation_description: z.string().optional(),
	recommended_item_id: uuid.optional(),
	recommended_item_type: z.string().optional(),
	regular_price: money.optional(),
	recommended_price: money.optional(),
	discount_amount: money.optional(),
	discount_percentage: money.optional(),
	reasoning: z.string().optional(),
	based_on_factors: z.array(z.string()).optional(),
	ml_model_name: z.string().optional(),
	confidence_score: money.optional(),
	relevance_score: money.optional(),
	personalization_factors: z.record(z.unknown()).optional(),
	recommended_at: z.coerce.date().optional(),
	valid_until: z.coerce.date().optional(),
	delivery_channel: z.string().optional(),
	delivery_timing: z.string().optional(),
	presented_to_guest: z.boolean().optional(),
	presented_at: z.coerce.date().optional(),
	guest_action: z.string().optional(),
	action_taken_at: z.coerce.date().optional(),
	converted: z.boolean().optional(),
	conversion_value: money.optional(),
	experiment_id: uuid.optional(),
	variant: z.string().optional(),
	click_through_rate: money.optional(),
	conversion_rate: money.optional(),
	guest_feedback: z.string().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
});

export type PersonalizedRecommendations = z.infer<
	typeof PersonalizedRecommendationsSchema
>;

/**
 * Schema for creating a new personalized recommendations
 */
export const CreatePersonalizedRecommendationsSchema =
	PersonalizedRecommendationsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreatePersonalizedRecommendations = z.infer<
	typeof CreatePersonalizedRecommendationsSchema
>;

/**
 * Schema for updating a personalized recommendations
 */
export const UpdatePersonalizedRecommendationsSchema =
	PersonalizedRecommendationsSchema.partial();

export type UpdatePersonalizedRecommendations = z.infer<
	typeof UpdatePersonalizedRecommendationsSchema
>;

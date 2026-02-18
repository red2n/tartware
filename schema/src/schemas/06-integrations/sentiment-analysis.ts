/**
 * DEV DOC
 * Module: schemas/06-integrations/sentiment-analysis.ts
 * Description: SentimentAnalysis Schema
 * Table: sentiment_analysis
 * Category: 06-integrations
 * Primary exports: SentimentAnalysisSchema, CreateSentimentAnalysisSchema, UpdateSentimentAnalysisSchema
 * @table sentiment_analysis
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * SentimentAnalysis Schema
 * @table sentiment_analysis
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete SentimentAnalysis schema
 */
export const SentimentAnalysisSchema = z.object({
	sentiment_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	feedback_id: uuid.optional(),
	source_type: z.string(),
	source_platform: z.string().optional(),
	source_url: z.string().optional(),
	source_reference: z.string().optional(),
	original_text: z.string(),
	language_code: z.string().optional(),
	translated_text: z.string().optional(),
	overall_sentiment: z.string(),
	sentiment_score: money,
	confidence_level: money.optional(),
	primary_emotion: z.string().optional(),
	emotion_scores: z.record(z.unknown()).optional(),
	room_sentiment: money.optional(),
	staff_sentiment: money.optional(),
	cleanliness_sentiment: money.optional(),
	food_sentiment: money.optional(),
	location_sentiment: money.optional(),
	amenities_sentiment: money.optional(),
	value_sentiment: money.optional(),
	checkin_sentiment: money.optional(),
	checkout_sentiment: money.optional(),
	aspect_sentiments: z.record(z.unknown()).optional(),
	key_phrases: z.array(z.string()).optional(),
	topics: z.array(z.string()).optional(),
	positive_keywords: z.array(z.string()).optional(),
	negative_keywords: z.array(z.string()).optional(),
	staff_mentioned: z.array(z.string()).optional(),
	room_number_mentioned: z.string().optional(),
	service_mentioned: z.array(z.string()).optional(),
	urgency_level: z.string().optional(),
	requires_response: z.boolean().optional(),
	requires_immediate_action: z.boolean().optional(),
	issues_detected: z.array(z.string()).optional(),
	issue_categories: z.array(z.string()).optional(),
	compliments_detected: z.array(z.string()).optional(),
	customer_intent: z.string().optional(),
	action_items: z.array(z.string()).optional(),
	recommended_department: z.string().optional(),
	previous_sentiment_score: money.optional(),
	sentiment_trend: z.string().optional(),
	predicted_star_rating: money.optional(),
	actual_star_rating: money.optional(),
	nps_category: z.string().optional(),
	likelihood_to_recommend: z.number().int().optional(),
	model_name: z.string(),
	model_version: z.string().optional(),
	model_type: z.string().optional(),
	processing_time_ms: z.number().int().optional(),
	response_generated: z.boolean().optional(),
	response_text: z.string().optional(),
	response_sent_at: z.coerce.date().optional(),
	response_method: z.string().optional(),
	issue_resolved: z.boolean().optional(),
	resolution_notes: z.string().optional(),
	resolved_at: z.coerce.date().optional(),
	resolved_by: uuid.optional(),
	review_date: z.coerce.date().optional(),
	stay_date: z.coerce.date().optional(),
	days_since_stay: z.number().int().optional(),
	is_verified_guest: z.boolean().optional(),
	is_public_review: z.boolean().optional(),
	review_helpful_count: z.number().int().optional(),
	flagged_for_review: z.boolean().optional(),
	flagged_reason: z.string().optional(),
	contains_profanity: z.boolean().optional(),
	contains_personal_info: z.boolean().optional(),
	moderation_status: z.string().optional(),
	competitor_mentioned: z.array(z.string()).optional(),
	competitive_comparison: z.boolean().optional(),
	analyst_notes: z.string().optional(),
	internal_notes: z.string().optional(),
	analyzed_at: z.coerce.date().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type SentimentAnalysis = z.infer<typeof SentimentAnalysisSchema>;

/**
 * Schema for creating a new sentiment analysis
 */
export const CreateSentimentAnalysisSchema = SentimentAnalysisSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSentimentAnalysis = z.infer<
	typeof CreateSentimentAnalysisSchema
>;

/**
 * Schema for updating a sentiment analysis
 */
export const UpdateSentimentAnalysisSchema = SentimentAnalysisSchema.partial();

export type UpdateSentimentAnalysis = z.infer<
	typeof UpdateSentimentAnalysisSchema
>;

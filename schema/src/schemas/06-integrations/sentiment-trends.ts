/**
 * DEV DOC
 * Module: schemas/06-integrations/sentiment-trends.ts
 * Description: SentimentTrends Schema
 * Table: sentiment_trends
 * Category: 06-integrations
 * Primary exports: SentimentTrendsSchema, CreateSentimentTrendsSchema, UpdateSentimentTrendsSchema
 * @table sentiment_trends
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * SentimentTrends Schema
 * @table sentiment_trends
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete SentimentTrends schema
 */
export const SentimentTrendsSchema = z.object({
	trend_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	trend_period: z.string(),
	period_start_date: z.coerce.date(),
	period_end_date: z.coerce.date(),
	total_reviews: z.number().int().optional(),
	total_feedbacks: z.number().int().optional(),
	average_sentiment_score: money.optional(),
	median_sentiment_score: money.optional(),
	positive_count: z.number().int().optional(),
	neutral_count: z.number().int().optional(),
	negative_count: z.number().int().optional(),
	positive_percentage: money.optional(),
	avg_room_sentiment: money.optional(),
	avg_staff_sentiment: money.optional(),
	avg_cleanliness_sentiment: money.optional(),
	avg_food_sentiment: money.optional(),
	avg_location_sentiment: money.optional(),
	avg_amenities_sentiment: money.optional(),
	avg_value_sentiment: money.optional(),
	trending_topics: z.record(z.unknown()).optional(),
	top_positive_keywords: z.array(z.string()).optional(),
	top_negative_keywords: z.array(z.string()).optional(),
	top_issues: z.array(z.string()).optional(),
	issue_frequency: z.record(z.unknown()).optional(),
	promoter_count: z.number().int().optional(),
	passive_count: z.number().int().optional(),
	detractor_count: z.number().int().optional(),
	nps_score: z.number().int().optional(),
	previous_period_sentiment: money.optional(),
	sentiment_change: money.optional(),
	trend_direction: z.string().optional(),
	insights: z.string().optional(),
	action_items: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
});

export type SentimentTrends = z.infer<typeof SentimentTrendsSchema>;

/**
 * Schema for creating a new sentiment trends
 */
export const CreateSentimentTrendsSchema = SentimentTrendsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSentimentTrends = z.infer<typeof CreateSentimentTrendsSchema>;

/**
 * Schema for updating a sentiment trends
 */
export const UpdateSentimentTrendsSchema = SentimentTrendsSchema.partial();

export type UpdateSentimentTrends = z.infer<typeof UpdateSentimentTrendsSchema>;

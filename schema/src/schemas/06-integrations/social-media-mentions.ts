/**
 * DEV DOC
 * Module: schemas/06-integrations/social-media-mentions.ts
 * Description: SocialMediaMentions Schema
 * Table: social_media_mentions
 * Category: 06-integrations
 * Primary exports: SocialMediaMentionsSchema, CreateSocialMediaMentionsSchema, UpdateSocialMediaMentionsSchema
 * @table social_media_mentions
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * SocialMediaMentions Schema
 * @table social_media_mentions
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete SocialMediaMentions schema
 */
export const SocialMediaMentionsSchema = z.object({
	mention_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	platform: z.string(),
	post_id: z.string().optional(),
	post_url: z.string().optional(),
	post_type: z.string().optional(),
	author_username: z.string().optional(),
	author_display_name: z.string().optional(),
	author_profile_url: z.string().optional(),
	author_follower_count: z.number().int().optional(),
	author_verified: z.boolean().optional(),
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	content_text: z.string().optional(),
	content_language: z.string().optional(),
	has_media: z.boolean().optional(),
	media_urls: z.array(z.string()).optional(),
	media_type: z.string().optional(),
	hashtags: z.array(z.string()).optional(),
	mentioned_accounts: z.array(z.string()).optional(),
	posted_at: z.coerce.date(),
	detected_at: z.coerce.date().optional(),
	likes_count: z.number().int().optional(),
	comments_count: z.number().int().optional(),
	shares_count: z.number().int().optional(),
	views_count: z.number().int().optional(),
	engagement_rate: money.optional(),
	reach: z.number().int().optional(),
	impressions: z.number().int().optional(),
	sentiment: z.string().optional(),
	sentiment_score: money.optional(),
	sentiment_confidence: money.optional(),
	mention_category: z.string().optional(),
	topics: z.array(z.string()).optional(),
	keywords: z.array(z.string()).optional(),
	priority: z.string().optional(),
	requires_response: z.boolean().optional(),
	response_deadline: z.coerce.date().optional(),
	responded: z.boolean().optional(),
	response_text: z.string().optional(),
	responded_at: z.coerce.date().optional(),
	responded_by: uuid.optional(),
	response_time_minutes: z.number().int().optional(),
	mention_status: z.string().optional(),
	assigned_to: uuid.optional(),
	assigned_at: z.coerce.date().optional(),
	escalated: z.boolean().optional(),
	escalated_to: uuid.optional(),
	escalated_at: z.coerce.date().optional(),
	escalation_reason: z.string().optional(),
	flagged: z.boolean().optional(),
	flag_reason: z.string().optional(),
	is_crisis: z.boolean().optional(),
	crisis_level: z.string().optional(),
	verified_genuine: z.boolean().optional(),
	verified_by: uuid.optional(),
	verification_notes: z.string().optional(),
	is_spam: z.boolean().optional(),
	is_bot: z.boolean().optional(),
	spam_score: money.optional(),
	influencer_tier: z.string().optional(),
	influence_score: z.number().int().optional(),
	campaign_id: uuid.optional(),
	related_to_promotion: z.boolean().optional(),
	promo_code_mentioned: z.string().optional(),
	mentions_competitor: z.boolean().optional(),
	competitor_names: z.array(z.string()).optional(),
	contains_personal_info: z.boolean().optional(),
	contains_inappropriate_content: z.boolean().optional(),
	copyright_concern: z.boolean().optional(),
	requires_legal_review: z.boolean().optional(),
	legal_reviewed: z.boolean().optional(),
	led_to_booking: z.boolean().optional(),
	booking_id: uuid.optional(),
	conversion_value: money.optional(),
	geo_location: z.string().optional(),
	device_type: z.string().optional(),
	parent_mention_id: uuid.optional(),
	thread_id: z.string().optional(),
	is_reply: z.boolean().optional(),
	included_in_reports: z.boolean().optional(),
	report_ids: z.array(uuid).optional(),
	screenshot_url: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type SocialMediaMentions = z.infer<typeof SocialMediaMentionsSchema>;

/**
 * Schema for creating a new social media mentions
 */
export const CreateSocialMediaMentionsSchema = SocialMediaMentionsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSocialMediaMentions = z.infer<
	typeof CreateSocialMediaMentionsSchema
>;

/**
 * Schema for updating a social media mentions
 */
export const UpdateSocialMediaMentionsSchema =
	SocialMediaMentionsSchema.partial();

export type UpdateSocialMediaMentions = z.infer<
	typeof UpdateSocialMediaMentionsSchema
>;

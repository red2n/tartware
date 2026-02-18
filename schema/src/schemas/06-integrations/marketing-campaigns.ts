/**
 * DEV DOC
 * Module: schemas/06-integrations/marketing-campaigns.ts
 * Description: MarketingCampaigns Schema
 * Table: marketing_campaigns
 * Category: 06-integrations
 * Primary exports: MarketingCampaignsSchema, CreateMarketingCampaignsSchema, UpdateMarketingCampaignsSchema
 * @table marketing_campaigns
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * MarketingCampaigns Schema
 * @table marketing_campaigns
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete MarketingCampaigns schema
 */
export const MarketingCampaignsSchema = z.object({
	campaign_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	campaign_code: z.string(),
	campaign_name: z.string(),
	campaign_description: z.string().optional(),
	campaign_type: z.string().optional(),
	campaign_category: z.string().optional(),
	campaign_status: z.string().optional(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date().optional(),
	launch_date: z.coerce.date().optional(),
	is_recurring: z.boolean().optional(),
	recurrence_pattern: z.string().optional(),
	target_audience_type: z.string().optional(),
	target_segment_ids: z.array(uuid).optional(),
	target_audience_size: z.number().int().optional(),
	target_locations: z.array(z.string()).optional(),
	target_age_range: z.string().optional(),
	target_demographics: z.record(z.unknown()).optional(),
	channels: z.array(z.string()).optional(),
	primary_channel: z.string().optional(),
	budget_amount: money.optional(),
	budget_currency: z.string().optional(),
	actual_spend: money.optional(),
	budget_utilization_percent: money.optional(),
	cost_per_impression: money.optional(),
	cost_per_click: money.optional(),
	cost_per_acquisition: money.optional(),
	primary_goal: z.string().optional(),
	target_impressions: z.number().int().optional(),
	target_clicks: z.number().int().optional(),
	target_conversions: z.number().int().optional(),
	target_revenue: money.optional(),
	target_bookings: z.number().int().optional(),
	target_roi_percent: money.optional(),
	total_impressions: z.number().int().optional(),
	total_clicks: z.number().int().optional(),
	total_conversions: z.number().int().optional(),
	total_bookings: z.number().int().optional(),
	total_revenue: money.optional(),
	click_through_rate: money.optional(),
	conversion_rate: money.optional(),
	bounce_rate: money.optional(),
	engagement_rate: money.optional(),
	roi_percent: money.optional(),
	roas: money.optional(),
	emails_sent: z.number().int().optional(),
	emails_delivered: z.number().int().optional(),
	emails_opened: z.number().int().optional(),
	emails_clicked: z.number().int().optional(),
	emails_bounced: z.number().int().optional(),
	emails_unsubscribed: z.number().int().optional(),
	open_rate: money.optional(),
	click_rate: money.optional(),
	unsubscribe_rate: money.optional(),
	social_shares: z.number().int().optional(),
	social_likes: z.number().int().optional(),
	social_comments: z.number().int().optional(),
	social_reach: z.number().int().optional(),
	social_engagement_rate: money.optional(),
	landing_page_url: z.string().optional(),
	landing_page_visits: z.number().int().optional(),
	landing_page_conversion_rate: money.optional(),
	utm_source: z.string().optional(),
	utm_medium: z.string().optional(),
	utm_campaign: z.string().optional(),
	utm_content: z.string().optional(),
	tracking_code: z.string().optional(),
	has_offer: z.boolean().optional(),
	offer_type: z.string().optional(),
	discount_percent: money.optional(),
	discount_amount: money.optional(),
	promo_code: z.string().optional(),
	message_template: z.string().optional(),
	subject_line: z.string().optional(),
	call_to_action: z.string().optional(),
	creative_assets_urls: z.array(z.string()).optional(),
	is_ab_test: z.boolean().optional(),
	ab_test_variants: z.record(z.unknown()).optional(),
	winning_variant: z.string().optional(),
	attribution_model: z.string().optional(),
	leads_generated: z.number().int().optional(),
	qualified_leads: z.number().int().optional(),
	lead_quality_score: money.optional(),
	campaign_manager_id: uuid.optional(),
	created_by_user_id: uuid.optional(),
	assigned_to_ids: z.array(uuid).optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	post_campaign_review_completed: z.boolean().optional(),
	review_notes: z.string().optional(),
	lessons_learned: z.string().optional(),
	integrated_with: z.array(z.string()).optional(),
	external_campaign_id: z.string().optional(),
	alert_on_budget_threshold: z.boolean().optional(),
	budget_alert_threshold_percent: money.optional(),
	alert_recipients: z.array(z.string()).optional(),
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

export type MarketingCampaigns = z.infer<typeof MarketingCampaignsSchema>;

/**
 * Schema for creating a new marketing campaigns
 */
export const CreateMarketingCampaignsSchema = MarketingCampaignsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMarketingCampaigns = z.infer<
	typeof CreateMarketingCampaignsSchema
>;

/**
 * Schema for updating a marketing campaigns
 */
export const UpdateMarketingCampaignsSchema =
	MarketingCampaignsSchema.partial();

export type UpdateMarketingCampaigns = z.infer<
	typeof UpdateMarketingCampaignsSchema
>;

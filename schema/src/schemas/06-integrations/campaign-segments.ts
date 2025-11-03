/**
 * CampaignSegments Schema
 * @table campaign_segments
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete CampaignSegments schema
 */
export const CampaignSegmentsSchema = z.object({
  segment_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  segment_code: z.string(),
  segment_name: z.string(),
  segment_description: z.string().optional(),
  segment_type: z.string().optional(),
  is_active: z.boolean().optional(),
  is_dynamic: z.boolean().optional(),
  criteria_definition: z.record(z.unknown()),
  sql_filter: z.string().optional(),
  age_range_min: z.number().int().optional(),
  age_range_max: z.number().int().optional(),
  gender: z.array(z.string()).optional(),
  income_level: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  states_provinces: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  zip_codes: z.array(z.string()).optional(),
  distance_from_property_km: z.number().int().optional(),
  booking_frequency: z.string().optional(),
  last_booking_days_ago_min: z.number().int().optional(),
  last_booking_days_ago_max: z.number().int().optional(),
  average_booking_value_min: money.optional(),
  average_booking_value_max: money.optional(),
  total_lifetime_value_min: money.optional(),
  total_lifetime_value_max: money.optional(),
  engagement_level: z.string().optional(),
  email_engagement: z.string().optional(),
  website_visits_min: z.number().int().optional(),
  social_media_follower: z.boolean().optional(),
  loyalty_tier: z.array(z.string()).optional(),
  loyalty_points_min: z.number().int().optional(),
  loyalty_points_max: z.number().int().optional(),
  guest_status: z.array(z.string()).optional(),
  preferred_room_types: z.array(z.string()).optional(),
  preferred_amenities: z.array(z.string()).optional(),
  travel_purpose: z.array(z.string()).optional(),
  lifecycle_stage: z.string().optional(),
  churn_risk_level: z.string().optional(),
  propensity_to_book_score_min: z.number().int().optional(),
  propensity_to_book_score_max: z.number().int().optional(),
  exclude_segment_ids: z.array(uuid).optional(),
  exclude_unsubscribed: z.boolean().optional(),
  exclude_bounced_emails: z.boolean().optional(),
  member_count: z.number().int().optional(),
  last_calculated_count: z.number().int().optional(),
  last_calculation_date: z.coerce.date().optional(),
  auto_refresh: z.boolean().optional(),
  refresh_frequency_hours: z.number().int().optional(),
  last_refresh_at: z.coerce.date().optional(),
  next_refresh_at: z.coerce.date().optional(),
  campaigns_used_in: z.number().int().optional(),
  total_emails_sent: z.number().int().optional(),
  average_open_rate: money.optional(),
  average_click_rate: money.optional(),
  average_conversion_rate: money.optional(),
  total_revenue_generated: money.optional(),
  total_bookings: z.number().int().optional(),
  manual_inclusions: z.array(uuid).optional(),
  manual_exclusions: z.array(uuid).optional(),
  is_test_segment: z.boolean().optional(),
  test_sample_size: z.number().int().optional(),
  owner_id: uuid.optional(),
  shared_with_users: z.array(uuid).optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type CampaignSegments = z.infer<typeof CampaignSegmentsSchema>;

/**
 * Schema for creating a new campaign segments
 */
export const CreateCampaignSegmentsSchema = CampaignSegmentsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCampaignSegments = z.infer<typeof CreateCampaignSegmentsSchema>;

/**
 * Schema for updating a campaign segments
 */
export const UpdateCampaignSegmentsSchema = CampaignSegmentsSchema.partial();

export type UpdateCampaignSegments = z.infer<typeof UpdateCampaignSegmentsSchema>;

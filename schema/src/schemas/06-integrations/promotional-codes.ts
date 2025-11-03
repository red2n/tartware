/**
 * PromotionalCodes Schema
 * @table promotional_codes
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete PromotionalCodes schema
 */
export const PromotionalCodesSchema = z.object({
  promo_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  promo_code: z.string(),
  promo_name: z.string(),
  promo_description: z.string().optional(),
  promo_type: z.string().optional(),
  promo_status: z.string().optional(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
  valid_from: z.coerce.date(),
  valid_to: z.coerce.date(),
  discount_type: z.string().optional(),
  discount_percent: money.optional(),
  discount_amount: money.optional(),
  discount_currency: z.string().optional(),
  max_discount_amount: money.optional(),
  free_nights_count: z.number().int().optional(),
  free_nights_conditions: z.string().optional(),
  has_usage_limit: z.boolean().optional(),
  total_usage_limit: z.number().int().optional(),
  usage_count: z.number().int().optional(),
  remaining_uses: z.number().int().optional(),
  per_user_limit: z.number().int().optional(),
  per_user_usage: z.record(z.unknown()).optional(),
  minimum_stay_nights: z.number().int().optional(),
  maximum_stay_nights: z.number().int().optional(),
  minimum_booking_amount: money.optional(),
  maximum_booking_amount: money.optional(),
  advance_booking_days_min: z.number().int().optional(),
  advance_booking_days_max: z.number().int().optional(),
  applicable_check_in_from: z.coerce.date().optional(),
  applicable_check_in_to: z.coerce.date().optional(),
  blackout_dates: z.array(z.coerce.date()).optional(),
  applicable_days_of_week: z.array(z.number().int()).optional(),
  applicable_room_types: z.array(uuid).optional(),
  excluded_room_types: z.array(uuid).optional(),
  applicable_rate_codes: z.array(z.string()).optional(),
  excluded_rate_codes: z.array(z.string()).optional(),
  applicable_to: z.array(z.string()).optional(),
  excluded_services: z.array(uuid).optional(),
  eligible_guest_types: z.array(z.string()).optional(),
  eligible_loyalty_tiers: z.array(z.string()).optional(),
  new_guests_only: z.boolean().optional(),
  returning_guests_only: z.boolean().optional(),
  applicable_countries: z.array(z.string()).optional(),
  excluded_countries: z.array(z.string()).optional(),
  applicable_states: z.array(z.string()).optional(),
  applicable_cities: z.array(z.string()).optional(),
  applicable_channels: z.array(z.string()).optional(),
  excluded_channels: z.array(z.string()).optional(),
  combinable_with_other_promos: z.boolean().optional(),
  combinable_promo_codes: z.array(z.string()).optional(),
  mutually_exclusive_codes: z.array(z.string()).optional(),
  campaign_id: uuid.optional(),
  marketing_source: z.string().optional(),
  times_viewed: z.number().int().optional(),
  times_applied: z.number().int().optional(),
  times_redeemed: z.number().int().optional(),
  total_discount_given: money.optional(),
  total_revenue_generated: money.optional(),
  conversion_rate: money.optional(),
  average_booking_value: money.optional(),
  incremental_revenue: money.optional(),
  revenue_impact_percent: money.optional(),
  roi_percent: money.optional(),
  requires_minimum_guests: z.number().int().optional(),
  requires_specific_addons: z.array(z.string()).optional(),
  validation_rules: z.record(z.unknown()).optional(),
  custom_validation_function: z.string().optional(),
  auto_apply: z.boolean().optional(),
  auto_apply_conditions: z.record(z.unknown()).optional(),
  display_on_website: z.boolean().optional(),
  display_message: z.string().optional(),
  email_notification: z.boolean().optional(),
  sms_notification: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  approval_notes: z.string().optional(),
  redemption_notes: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  alert_before_expiry_days: z.number().int().optional(),
  expiry_alert_sent: z.boolean().optional(),
  alert_on_depletion_threshold: z.number().int().optional(),
  depletion_alert_sent: z.boolean().optional(),
  created_by_user_id: uuid.optional(),
  owner_id: uuid.optional(),
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

export type PromotionalCodes = z.infer<typeof PromotionalCodesSchema>;

/**
 * Schema for creating a new promotional codes
 */
export const CreatePromotionalCodesSchema = PromotionalCodesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePromotionalCodes = z.infer<typeof CreatePromotionalCodesSchema>;

/**
 * Schema for updating a promotional codes
 */
export const UpdatePromotionalCodesSchema = PromotionalCodesSchema.partial();

export type UpdatePromotionalCodes = z.infer<typeof UpdatePromotionalCodesSchema>;

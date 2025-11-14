/**
 * PricingRules Schema
 * @table pricing_rules
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete PricingRules schema
 */
export const PricingRulesSchema = z.object({
  rule_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  rule_name: z.string(),
  rule_code: z.string().optional(),
  description: z.string().optional(),
  rule_type: z.string(),
  rule_category: z.string().optional(),
  is_active: z.boolean().optional(),
  is_paused: z.boolean().optional(),
  priority: z.number().int().optional(),
  applies_to_room_types: z.array(uuid).optional(),
  applies_to_rate_plans: z.array(uuid).optional(),
  applies_to_channels: z.array(z.string()).optional(),
  applies_to_segments: z.array(z.string()).optional(),
  excluded_room_types: z.array(uuid).optional(),
  excluded_rate_plans: z.array(uuid).optional(),
  effective_from: z.coerce.date(),
  effective_until: z.coerce.date().optional(),
  applies_monday: z.boolean().optional(),
  applies_tuesday: z.boolean().optional(),
  applies_wednesday: z.boolean().optional(),
  applies_thursday: z.boolean().optional(),
  applies_friday: z.boolean().optional(),
  applies_saturday: z.boolean().optional(),
  applies_sunday: z.boolean().optional(),
  booking_window_start_days: z.number().int().optional(),
  booking_window_end_days: z.number().int().optional(),
  applies_to_weekends_only: z.boolean().optional(),
  applies_to_weekdays_only: z.boolean().optional(),
  conditions: z.record(z.unknown()),
  adjustment_type: z.string(),
  adjustment_value: money,
  adjustment_cap_min: money.optional(),
  adjustment_cap_max: money.optional(),
  round_to_nearest: money.optional(),
  rounding_method: z.string().optional(),
  min_length_of_stay: z.number().int().optional(),
  max_length_of_stay: z.number().int().optional(),
  los_discount_structure: z.record(z.unknown()).optional(),
  apply_min_stay_restriction: z.number().int().optional(),
  apply_max_stay_restriction: z.number().int().optional(),
  apply_closed_to_arrival: z.boolean().optional(),
  apply_closed_to_departure: z.boolean().optional(),
  apply_stop_sell: z.boolean().optional(),
  can_combine_with_other_rules: z.boolean().optional(),
  mutually_exclusive_with_rules: z.array(uuid).optional(),
  must_combine_with_rules: z.array(uuid).optional(),
  conflict_resolution: z.string().optional(),
  times_applied: z.number().int().optional(),
  total_revenue_impact: money.optional(),
  bookings_influenced: z.number().int().optional(),
  average_rate_adjustment: money.optional(),
  last_applied_at: z.coerce.date().optional(),
  conversion_rate: money.optional(),
  revenue_per_available_room: money.optional(),
  occupancy_lift_percent: money.optional(),
  effectiveness_score: money.optional(),
  is_ab_test: z.boolean().optional(),
  ab_test_variant: z.string().optional(),
  ab_test_control_group_percent: z.number().int().optional(),
  ab_test_start_date: z.coerce.date().optional(),
  ab_test_end_date: z.coerce.date().optional(),
  auto_activate: z.boolean().optional(),
  auto_deactivate: z.boolean().optional(),
  auto_adjust_based_on_performance: z.boolean().optional(),
  notify_on_activation: z.boolean().optional(),
  notify_on_significant_impact: z.boolean().optional(),
  notification_recipients: z.array(uuid).optional(),
  requires_approval: z.boolean().optional(),
  approval_status: z.string().optional(),
  approved_by: uuid.optional(),
  approved_at: z.coerce.date().optional(),
  approval_notes: z.string().optional(),
  can_be_overridden: z.boolean().optional(),
  override_requires_approval: z.boolean().optional(),
  override_count: z.number().int().optional(),
  last_modified_reason: z.string().optional(),
  change_history: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type PricingRules = z.infer<typeof PricingRulesSchema>;

/**
 * Schema for creating a new pricing rules
 */
export const CreatePricingRulesSchema = PricingRulesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePricingRules = z.infer<typeof CreatePricingRulesSchema>;

/**
 * Schema for updating a pricing rules
 */
export const UpdatePricingRulesSchema = PricingRulesSchema.partial();

export type UpdatePricingRules = z.infer<typeof UpdatePricingRulesSchema>;

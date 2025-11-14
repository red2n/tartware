/**
 * RateOverrides Schema
 * @table rate_overrides
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete RateOverrides schema
 */
export const RateOverridesSchema = z.object({
  override_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  reservation_id: uuid,
  room_type_id: uuid.optional(),
  rate_plan_id: uuid.optional(),
  override_code: z.string().optional(),
  override_type: z.string(),
  original_rate: money,
  original_rate_plan: z.string().optional(),
  original_total: money.optional(),
  override_rate: money,
  override_total: money.optional(),
  adjustment_amount: money.optional(),
  adjustment_percentage: money.optional(),
  is_increase: z.boolean().optional(),
  is_decrease: z.boolean().optional(),
  stay_date: z.coerce.date().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  number_of_nights: z.number().int().optional(),
  reason_category: z.string(),
  reason_code: z.string().optional(),
  reason_description: z.string(),
  approval_required: z.boolean().optional(),
  approval_threshold: money.optional(),
  approval_level: z.number().int().optional(),
  requested_at: z.coerce.date().optional(),
  requested_by: uuid,
  approved_at: z.coerce.date().optional(),
  approved_by: uuid.optional(),
  approval_notes: z.string().optional(),
  rejected_at: z.coerce.date().optional(),
  rejected_by: uuid.optional(),
  rejection_reason: z.string().optional(),
  override_status: z.string(),
  applied_at: z.coerce.date().optional(),
  applied_by: uuid.optional(),
  is_applied: z.boolean().optional(),
  max_override_amount: money.optional(),
  min_rate_allowed: money.optional(),
  competitor_name: z.string().optional(),
  competitor_rate: money.optional(),
  competitor_url: z.string().optional(),
  price_match_verified: z.boolean().optional(),
  verified_by: uuid.optional(),
  guest_id: uuid.optional(),
  guest_tier: z.string().optional(),
  is_repeat_guest: z.boolean().optional(),
  lifetime_value: money.optional(),
  market_segment_id: uuid.optional(),
  booking_source_id: uuid.optional(),
  is_commissionable: z.boolean().optional(),
  is_refundable: z.boolean().optional(),
  requires_prepayment: z.boolean().optional(),
  revenue_impact: money.optional(),
  cost_center: z.string().optional(),
  authorization_code: z.string().optional(),
  valid_from: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
  is_expired: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  applies_to_future_bookings: z.boolean().optional(),
  is_automatic: z.boolean().optional(),
  rule_id: uuid.optional(),
  requires_review: z.boolean().optional(),
  reviewed_at: z.coerce.date().optional(),
  reviewed_by: uuid.optional(),
  complies_with_policy: z.boolean().optional(),
  policy_exception_notes: z.string().optional(),
  guest_notified: z.boolean().optional(),
  notification_sent_at: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type RateOverrides = z.infer<typeof RateOverridesSchema>;

/**
 * Schema for creating a new rate overrides
 */
export const CreateRateOverridesSchema = RateOverridesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRateOverrides = z.infer<typeof CreateRateOverridesSchema>;

/**
 * Schema for updating a rate overrides
 */
export const UpdateRateOverridesSchema = RateOverridesSchema.partial();

export type UpdateRateOverrides = z.infer<typeof UpdateRateOverridesSchema>;

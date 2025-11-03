/**
 * GuestLoyaltyPrograms Schema
 * @table guest_loyalty_programs
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete GuestLoyaltyPrograms schema
 */
export const GuestLoyaltyProgramsSchema = z.object({
  program_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  guest_id: uuid,
  program_name: z.string(),
  program_tier: z.string().optional(),
  membership_number: z.string().optional(),
  membership_status: z.string().optional(),
  points_balance: z.number().int().optional(),
  points_earned_lifetime: z.number().int().optional(),
  points_redeemed_lifetime: z.number().int().optional(),
  points_expired_lifetime: z.number().int().optional(),
  points_expiring_soon: z.number().int().optional(),
  points_expiry_date: z.coerce.date().optional(),
  tier_status: z.string().optional(),
  tier_start_date: z.coerce.date().optional(),
  tier_expiry_date: z.coerce.date().optional(),
  tier_qualification_date: z.coerce.date().optional(),
  nights_to_next_tier: z.number().int().optional(),
  points_to_next_tier: z.number().int().optional(),
  stays_to_next_tier: z.number().int().optional(),
  total_stays: z.number().int().optional(),
  total_nights: z.number().int().optional(),
  total_spend: money.optional(),
  last_stay_date: z.coerce.date().optional(),
  last_points_earned_date: z.coerce.date().optional(),
  last_points_redeemed_date: z.coerce.date().optional(),
  enrollment_date: z.coerce.date(),
  enrollment_channel: z.string().optional(),
  enrollment_property_id: uuid.optional(),
  referred_by_guest_id: uuid.optional(),
  is_active: z.boolean().optional(),
  last_activity_date: z.coerce.date().optional(),
  inactivity_warning_sent: z.boolean().optional(),
  reactivation_date: z.coerce.date().optional(),
  benefits: z.record(z.unknown()).optional(),
  tier_benefits: z.record(z.unknown()).optional(),
  special_privileges: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
  anniversary_date: z.coerce.date().optional(),
  birthday_bonus_claimed: z.boolean().optional(),
  anniversary_bonus_claimed: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  marketing_emails: z.boolean().optional(),
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

export type GuestLoyaltyPrograms = z.infer<typeof GuestLoyaltyProgramsSchema>;

/**
 * Schema for creating a new guest loyalty programs
 */
export const CreateGuestLoyaltyProgramsSchema = GuestLoyaltyProgramsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGuestLoyaltyPrograms = z.infer<typeof CreateGuestLoyaltyProgramsSchema>;

/**
 * Schema for updating a guest loyalty programs
 */
export const UpdateGuestLoyaltyProgramsSchema = GuestLoyaltyProgramsSchema.partial();

export type UpdateGuestLoyaltyPrograms = z.infer<typeof UpdateGuestLoyaltyProgramsSchema>;

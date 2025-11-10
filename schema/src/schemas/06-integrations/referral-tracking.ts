/**
 * ReferralTracking Schema
 * @table referral_tracking
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ReferralTracking schema
 */
export const ReferralTrackingSchema = z.object({
	referral_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	referral_code: z.string(),
	referral_link: z.string().optional(),
	referrer_type: z.string().optional(),
	referrer_id: uuid,
	referrer_name: z.string().optional(),
	referrer_email: z.string().optional(),
	referrer_phone: z.string().optional(),
	referee_id: uuid.optional(),
	referee_name: z.string().optional(),
	referee_email: z.string().optional(),
	referee_phone: z.string().optional(),
	referral_status: z.string().optional(),
	referred_at: z.coerce.date().optional(),
	link_clicked_at: z.coerce.date().optional(),
	registered_at: z.coerce.date().optional(),
	qualified_at: z.coerce.date().optional(),
	converted_at: z.coerce.date().optional(),
	expires_at: z.coerce.date().optional(),
	converted: z.boolean().optional(),
	conversion_type: z.string().optional(),
	reservation_id: uuid.optional(),
	booking_amount: money.optional(),
	booking_date: z.coerce.date().optional(),
	check_in_date: z.coerce.date().optional(),
	referrer_reward_type: z.string().optional(),
	referrer_reward_amount: money.optional(),
	referrer_reward_percent: money.optional(),
	referrer_reward_points: z.number().int().optional(),
	referrer_reward_currency: z.string().optional(),
	referrer_reward_issued: z.boolean().optional(),
	referrer_reward_issued_at: z.coerce.date().optional(),
	referrer_reward_redeemed: z.boolean().optional(),
	referee_reward_type: z.string().optional(),
	referee_reward_amount: money.optional(),
	referee_reward_percent: money.optional(),
	referee_reward_points: z.number().int().optional(),
	referee_reward_currency: z.string().optional(),
	referee_reward_issued: z.boolean().optional(),
	referee_reward_issued_at: z.coerce.date().optional(),
	referee_reward_redeemed: z.boolean().optional(),
	tier_level: z.number().int().optional(),
	parent_referral_id: uuid.optional(),
	child_referral_ids: z.array(uuid).optional(),
	campaign_id: uuid.optional(),
	referral_program_id: uuid.optional(),
	source_channel: z.string().optional(),
	utm_source: z.string().optional(),
	utm_medium: z.string().optional(),
	utm_campaign: z.string().optional(),
	qualification_criteria: z.record(z.unknown()).optional(),
	qualified: z.boolean().optional(),
	qualification_notes: z.string().optional(),
	minimum_booking_amount: money.optional(),
	minimum_stay_nights: z.number().int().optional(),
	link_clicks: z.number().int().optional(),
	successful_conversions: z.number().int().optional(),
	total_referral_value: money.optional(),
	revenue_generated: money.optional(),
	lifetime_value_generated: money.optional(),
	invitation_sent: z.boolean().optional(),
	invitation_sent_at: z.coerce.date().optional(),
	invitation_method: z.string().optional(),
	reminder_count: z.number().int().optional(),
	last_reminder_sent_at: z.coerce.date().optional(),
	flagged_suspicious: z.boolean().optional(),
	fraud_check_passed: z.boolean().optional(),
	fraud_notes: z.string().optional(),
	same_ip_address: z.boolean().optional(),
	same_device: z.boolean().optional(),
	attribution_verified: z.boolean().optional(),
	attribution_notes: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	device_type: z.string().optional(),
	browser: z.string().optional(),
	ip_address: z.string().optional(),
	geo_location: z.string().optional(),
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

export type ReferralTracking = z.infer<typeof ReferralTrackingSchema>;

/**
 * Schema for creating a new referral tracking
 */
export const CreateReferralTrackingSchema = ReferralTrackingSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateReferralTracking = z.infer<
	typeof CreateReferralTrackingSchema
>;

/**
 * Schema for updating a referral tracking
 */
export const UpdateReferralTrackingSchema = ReferralTrackingSchema.partial();

export type UpdateReferralTracking = z.infer<
	typeof UpdateReferralTrackingSchema
>;

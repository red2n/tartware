/**
 * DEV DOC
 * Module: schemas/06-integrations/guest-behavior-patterns.ts
 * Description: GuestBehaviorPatterns Schema
 * Table: guest_behavior_patterns
 * Category: 06-integrations
 * Primary exports: GuestBehaviorPatternsSchema, CreateGuestBehaviorPatternsSchema, UpdateGuestBehaviorPatternsSchema
 * @table guest_behavior_patterns
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * GuestBehaviorPatterns Schema
 * @table guest_behavior_patterns
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete GuestBehaviorPatterns schema
 */
export const GuestBehaviorPatternsSchema = z.object({
	pattern_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	analysis_date: z.coerce.date().optional(),
	first_stay_date: z.coerce.date().optional(),
	last_stay_date: z.coerce.date().optional(),
	total_stays: z.number().int().optional(),
	average_booking_lead_time: z.number().int().optional(),
	preferred_booking_channel: z.string().optional(),
	booking_channel_distribution: z.record(z.unknown()).optional(),
	typical_booking_time: z.string().optional(),
	books_on_weekdays: z.boolean().optional(),
	books_on_weekends: z.boolean().optional(),
	price_sensitivity: z.string().optional(),
	average_rate_paid: money.optional(),
	discount_usage_rate: money.optional(),
	preferred_stay_duration: z.number().int().optional(),
	average_stay_duration: money.optional(),
	min_stay_duration: z.number().int().optional(),
	max_stay_duration: z.number().int().optional(),
	preferred_check_in_day: z.string().optional(),
	preferred_check_out_day: z.string().optional(),
	check_in_day_distribution: z.record(z.unknown()).optional(),
	seasonality_pattern: z.string().optional(),
	preferred_room_type_id: uuid.optional(),
	room_type_preferences: z.record(z.unknown()).optional(),
	preferred_floor: z.string().optional(),
	preferred_view: z.string().optional(),
	preferred_bed_type: z.string().optional(),
	upgrades_accepted: z.number().int().optional(),
	upgrade_acceptance_rate: money.optional(),
	travel_purpose: z.string().optional(),
	typical_party_size: z.number().int().optional(),
	travels_with_children: z.boolean().optional(),
	travels_with_pets: z.boolean().optional(),
	origin_country: z.string().optional(),
	origin_city: z.string().optional(),
	is_local_guest: z.boolean().optional(),
	is_international_guest: z.boolean().optional(),
	dining_preferences: z.record(z.unknown()).optional(),
	spa_service_usage_rate: money.optional(),
	amenity_usage_patterns: z.record(z.unknown()).optional(),
	concierge_service_usage: z.number().int().optional(),
	transportation_preferences: z.record(z.unknown()).optional(),
	preferred_contact_method: z.string().optional(),
	response_rate: money.optional(),
	average_response_time_hours: z.number().int().optional(),
	prefers_digital_checkin: z.boolean().optional(),
	uses_mobile_app: z.boolean().optional(),
	total_lifetime_value: money.optional(),
	average_total_spend_per_stay: money.optional(),
	room_revenue_percentage: money.optional(),
	food_beverage_revenue_percentage: money.optional(),
	spa_revenue_percentage: money.optional(),
	other_revenue_percentage: money.optional(),
	ancillary_spend_propensity: z.string().optional(),
	repeat_guest_score: money.optional(),
	loyalty_tier: z.string().optional(),
	months_since_last_stay: z.number().int().optional(),
	churn_risk_score: money.optional(),
	churn_risk_level: z.string().optional(),
	referral_count: z.number().int().optional(),
	is_brand_advocate: z.boolean().optional(),
	average_satisfaction_score: money.optional(),
	nps_score: z.number().int().optional(),
	total_reviews_submitted: z.number().int().optional(),
	average_review_rating: money.optional(),
	review_sentiment_score: money.optional(),
	complaint_count: z.number().int().optional(),
	compliment_count: z.number().int().optional(),
	is_early_adopter: z.boolean().optional(),
	is_high_maintenance: z.boolean().optional(),
	is_low_touch: z.boolean().optional(),
	special_occasion_traveler: z.boolean().optional(),
	celebration_count: z.number().int().optional(),
	cancellation_rate: money.optional(),
	average_cancellation_lead_time: z.number().int().optional(),
	no_show_count: z.number().int().optional(),
	upsell_propensity_score: money.optional(),
	cross_sell_propensity_score: money.optional(),
	premium_service_affinity: money.optional(),
	next_booking_probability: money.optional(),
	predicted_next_booking_date: z.coerce.date().optional(),
	predicted_ltv_next_12_months: money.optional(),
	customer_segment: z.string().optional(),
	value_segment: z.string().optional(),
	model_name: z.string().optional(),
	model_version: z.string().optional(),
	confidence_score: money.optional(),
	last_analyzed_at: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type GuestBehaviorPatterns = z.infer<typeof GuestBehaviorPatternsSchema>;

/**
 * Schema for creating a new guest behavior patterns
 */
export const CreateGuestBehaviorPatternsSchema =
	GuestBehaviorPatternsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateGuestBehaviorPatterns = z.infer<
	typeof CreateGuestBehaviorPatternsSchema
>;

/**
 * Schema for updating a guest behavior patterns
 */
export const UpdateGuestBehaviorPatternsSchema =
	GuestBehaviorPatternsSchema.partial();

export type UpdateGuestBehaviorPatterns = z.infer<
	typeof UpdateGuestBehaviorPatternsSchema
>;

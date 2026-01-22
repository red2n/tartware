/**
 * DEV DOC
 * Module: schemas/03-bookings/market-segments.ts
 * Description: MarketSegments Schema
 * Table: market_segments
 * Category: 03-bookings
 * Primary exports: MarketSegmentsSchema, CreateMarketSegmentsSchema, UpdateMarketSegmentsSchema
 * @table market_segments
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * MarketSegments Schema
 * @table market_segments
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MarketSegments schema
 */
export const MarketSegmentsSchema = z.object({
	segment_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	segment_code: z.string(),
	segment_name: z.string(),
	segment_type: z.string(),
	is_active: z.boolean().optional(),
	is_bookable: z.boolean().optional(),
	parent_segment_id: uuid.optional(),
	segment_level: z.number().int().optional(),
	segment_path: z.string().optional(),
	average_daily_rate: money.optional(),
	average_length_of_stay: money.optional(),
	average_booking_value: money.optional(),
	contribution_to_revenue: money.optional(),
	booking_lead_time_days: z.number().int().optional(),
	cancellation_rate: money.optional(),
	no_show_rate: money.optional(),
	repeat_guest_rate: money.optional(),
	total_bookings: z.number().int().optional(),
	total_room_nights: z.number().int().optional(),
	total_revenue: money.optional(),
	rate_multiplier: money.optional(),
	min_rate: money.optional(),
	max_rate: money.optional(),
	default_rate_plan_id: uuid.optional(),
	discount_percentage: money.optional(),
	premium_percentage: money.optional(),
	pays_commission: z.boolean().optional(),
	commission_percentage: money.optional(),
	target_age_min: z.number().int().optional(),
	target_age_max: z.number().int().optional(),
	target_income_level: z.string().optional(),
	target_party_size: z.number().int().optional(),
	high_season_months: z.array(z.number().int()).optional(),
	low_season_months: z.array(z.number().int()).optional(),
	peak_booking_days: z.array(z.number().int()).optional(),
	preferred_channels: z.array(z.string()).optional(),
	marketing_priority: z.number().int().optional(),
	is_target_segment: z.boolean().optional(),
	acquisition_cost: money.optional(),
	lifetime_value: money.optional(),
	loyalty_program_eligible: z.boolean().optional(),
	loyalty_points_multiplier: money.optional(),
	min_advance_booking_days: z.number().int().optional(),
	max_advance_booking_days: z.number().int().optional(),
	min_length_of_stay: z.number().int().optional(),
	max_length_of_stay: z.number().int().optional(),
	allowed_days_of_week: z.array(z.number().int()).optional(),
	blackout_dates: z.record(z.unknown()).optional(),
	included_amenities: z.array(z.string()).optional(),
	excluded_amenities: z.array(z.string()).optional(),
	special_services: z.array(z.string()).optional(),
	ranking: z.number().int().optional(),
	color_code: z.string().optional(),
	icon: z.string().optional(),
	description: z.string().optional(),
	sales_focus: z.boolean().optional(),
	requires_approval: z.boolean().optional(),
	approval_threshold: money.optional(),
	preferred_contact_method: z.string().optional(),
	email_template: z.string().optional(),
	tax_exempt: z.boolean().optional(),
	tax_rate_override: money.optional(),
	requires_id_verification: z.boolean().optional(),
	requires_company_info: z.boolean().optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	marketing_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type MarketSegments = z.infer<typeof MarketSegmentsSchema>;

/**
 * Schema for creating a new market segments
 */
export const CreateMarketSegmentsSchema = MarketSegmentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMarketSegments = z.infer<typeof CreateMarketSegmentsSchema>;

/**
 * Schema for updating a market segments
 */
export const UpdateMarketSegmentsSchema = MarketSegmentsSchema.partial();

export type UpdateMarketSegments = z.infer<typeof UpdateMarketSegmentsSchema>;

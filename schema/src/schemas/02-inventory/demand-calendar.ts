/**
 * DemandCalendar Schema
 * @table demand_calendar
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete DemandCalendar schema
 */
export const DemandCalendarSchema = z.object({
	demand_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	calendar_date: z.coerce.date(),
	day_of_week: z.string(),
	week_number: z.number().int().optional(),
	month_number: z.number().int().optional(),
	quarter_number: z.number().int().optional(),
	year_number: z.number().int().optional(),
	is_weekend: z.boolean().optional(),
	is_holiday: z.boolean().optional(),
	holiday_name: z.string().optional(),
	is_local_holiday: z.boolean().optional(),
	is_national_holiday: z.boolean().optional(),
	season: z.string().optional(),
	season_factor: money.optional(),
	is_peak_season: z.boolean().optional(),
	is_special_period: z.boolean().optional(),
	special_period_name: z.string().optional(),
	demand_level: z.string(),
	demand_score: z.number().int().optional(),
	demand_forecast: z.string().optional(),
	total_bookings: z.number().int().optional(),
	new_bookings_today: z.number().int().optional(),
	cancellations_today: z.number().int().optional(),
	modifications_today: z.number().int().optional(),
	booking_pace: z.string().optional(),
	pace_vs_last_year: z.number().int().optional(),
	pace_vs_budget: z.number().int().optional(),
	pickup_last_7_days: z.number().int().optional(),
	pickup_last_30_days: z.number().int().optional(),
	rooms_available: z.number().int(),
	rooms_occupied: z.number().int().optional(),
	rooms_reserved: z.number().int().optional(),
	rooms_blocked: z.number().int().optional(),
	rooms_out_of_order: z.number().int().optional(),
	rooms_remaining: z.number().int().optional(),
	occupancy_percent: money.optional(),
	forecasted_occupancy_percent: money.optional(),
	optimal_occupancy_target: money.optional(),
	adr: money.optional(),
	forecasted_adr: money.optional(),
	target_adr: money.optional(),
	revpar: money.optional(),
	forecasted_revpar: money.optional(),
	target_revpar: money.optional(),
	total_revenue: money.optional(),
	forecasted_revenue: money.optional(),
	revenue_potential: money.optional(),
	segment_distribution: z.record(z.unknown()).optional(),
	top_segment: z.string().optional(),
	segment_diversity_score: money.optional(),
	channel_distribution: z.record(z.unknown()).optional(),
	direct_booking_percent: money.optional(),
	ota_booking_percent: money.optional(),
	average_lead_time_days: z.number().int().optional(),
	median_lead_time_days: z.number().int().optional(),
	booking_window: z.string().optional(),
	average_los: money.optional(),
	most_common_los: z.number().int().optional(),
	los_distribution: z.record(z.unknown()).optional(),
	has_events: z.boolean().optional(),
	events_count: z.number().int().optional(),
	events: z.record(z.unknown()).optional(),
	event_impact_score: z.number().int().optional(),
	major_event_name: z.string().optional(),
	competitor_occupancy_avg: money.optional(),
	competitor_adr_avg: money.optional(),
	market_occupancy: money.optional(),
	our_market_share: money.optional(),
	recommended_pricing_strategy: z.string().optional(),
	min_stay_recommendation: z.number().int().optional(),
	max_stay_recommendation: z.number().int().optional(),
	close_to_arrival: z.boolean().optional(),
	min_stay_restriction: z.number().int().optional(),
	max_stay_restriction: z.number().int().optional(),
	closed_to_arrival: z.boolean().optional(),
	closed_to_departure: z.boolean().optional(),
	group_blocks_count: z.number().int().optional(),
	group_rooms_blocked: z.number().int().optional(),
	group_pickup_percent: money.optional(),
	weather_condition: z.string().optional(),
	temperature_celsius: money.optional(),
	weather_impact_score: z.number().int().optional(),
	requires_attention: z.boolean().optional(),
	alert_reasons: z.array(z.string()).optional(),
	recommended_actions: z.array(z.string()).optional(),
	action_taken: z.string().optional(),
	action_taken_by: uuid.optional(),
	action_taken_at: z.coerce.date().optional(),
	same_day_last_year_occupancy: money.optional(),
	same_day_last_year_adr: money.optional(),
	variance_vs_last_year_occupancy: money.optional(),
	variance_vs_last_year_adr: money.optional(),
	demand_notes: z.string().optional(),
	market_conditions: z.string().optional(),
	revenue_manager_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type DemandCalendar = z.infer<typeof DemandCalendarSchema>;

/**
 * Schema for creating a new demand calendar
 */
export const CreateDemandCalendarSchema = DemandCalendarSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateDemandCalendar = z.infer<typeof CreateDemandCalendarSchema>;

/**
 * Schema for updating a demand calendar
 */
export const UpdateDemandCalendarSchema = DemandCalendarSchema.partial();

export type UpdateDemandCalendar = z.infer<typeof UpdateDemandCalendarSchema>;

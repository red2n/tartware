/**
 * DEV DOC
 * Module: schemas/05-operations/shuttle-schedules.ts
 * Description: ShuttleSchedules Schema
 * Table: shuttle_schedules
 * Category: 05-operations
 * Primary exports: ShuttleSchedulesSchema, CreateShuttleSchedulesSchema, UpdateShuttleSchedulesSchema
 * @table shuttle_schedules
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * ShuttleSchedules Schema
 * @table shuttle_schedules
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete ShuttleSchedules schema
 */
export const ShuttleSchedulesSchema = z.object({
	schedule_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	schedule_name: z.string(),
	schedule_code: z.string(),
	description: z.string().optional(),
	route_type: z.string(),
	route_name: z.string(),
	is_roundtrip: z.boolean().optional(),
	is_loop: z.boolean().optional(),
	route_stops: z.record(z.unknown()),
	total_stops: z.number().int(),
	departure_location: z.string(),
	departure_address: z.string().optional(),
	departure_coordinates: z.record(z.unknown()).optional(),
	destination_location: z.string().optional(),
	destination_address: z.string().optional(),
	destination_coordinates: z.record(z.unknown()).optional(),
	estimated_duration_minutes: z.number().int(),
	estimated_distance_km: money.optional(),
	buffer_time_minutes: z.number().int().optional(),
	schedule_type: z.string(),
	departure_times: z.unknown().optional(),
	interval_minutes: z.number().int().optional(),
	first_departure_time: z.string().optional(),
	last_departure_time: z.string().optional(),
	operates_monday: z.boolean().optional(),
	operates_tuesday: z.boolean().optional(),
	operates_wednesday: z.boolean().optional(),
	operates_thursday: z.boolean().optional(),
	operates_friday: z.boolean().optional(),
	operates_saturday: z.boolean().optional(),
	operates_sunday: z.boolean().optional(),
	operates_holidays: z.boolean().optional(),
	operates_on_closure_days: z.boolean().optional(),
	special_operating_dates: z.array(z.coerce.date()).optional(),
	excluded_dates: z.array(z.coerce.date()).optional(),
	seasonal: z.boolean().optional(),
	season_start_date: z.coerce.date().optional(),
	season_end_date: z.coerce.date().optional(),
	season_name: z.string().optional(),
	default_vehicle_id: uuid.optional(),
	alternate_vehicle_ids: z.array(uuid).optional(),
	vehicle_type_required: z.string().optional(),
	min_vehicle_capacity: z.number().int().optional(),
	max_passengers_per_trip: z.number().int(),
	wheelchair_spots_available: z.number().int().optional(),
	standee_capacity: z.number().int().optional(),
	reservation_required: z.boolean().optional(),
	walk_on_allowed: z.boolean().optional(),
	advance_booking_hours: z.number().int().optional(),
	service_type: z.string(),
	price_per_person: money.optional(),
	child_price: money.optional(),
	roundtrip_price: money.optional(),
	currency_code: z.string().optional(),
	guest_only: z.boolean().optional(),
	public_access: z.boolean().optional(),
	minimum_age: z.number().int().optional(),
	requires_room_key: z.boolean().optional(),
	schedule_status: z.string(),
	active_from_date: z.coerce.date().optional(),
	active_to_date: z.coerce.date().optional(),
	default_driver_id: uuid.optional(),
	requires_specific_license: z.boolean().optional(),
	license_type_required: z.string().optional(),
	real_time_tracking_enabled: z.boolean().optional(),
	tracking_available_to_guests: z.boolean().optional(),
	tracking_url_template: z.string().optional(),
	automated_notifications: z.boolean().optional(),
	sms_reminders: z.boolean().optional(),
	email_confirmations: z.boolean().optional(),
	notification_minutes_before: z.number().int().optional(),
	boarding_location: z.string().optional(),
	boarding_instructions: z.string().optional(),
	check_in_required: z.boolean().optional(),
	check_in_minutes_before: z.number().int().optional(),
	cancelled_if_weather: z.string().optional(),
	weather_alternative_transport: z.string().optional(),
	average_occupancy_percent: money.optional(),
	total_trips_ytd: z.number().int().optional(),
	total_passengers_ytd: z.number().int().optional(),
	no_show_rate_percent: money.optional(),
	on_time_performance_percent: money.optional(),
	average_delay_minutes: money.optional(),
	guest_satisfaction_rating: money.optional(),
	displayed_on_website: z.boolean().optional(),
	displayed_on_app: z.boolean().optional(),
	available_for_booking: z.boolean().optional(),
	booking_url: z.string().optional(),
	external_booking_system: z.string().optional(),
	safety_briefing_required: z.boolean().optional(),
	safety_briefing_text: z.string().optional(),
	insurance_required: z.boolean().optional(),
	max_continuous_operation_hours: z.number().int().optional(),
	capacity_alert_threshold: z.number().int().optional(),
	maintenance_alert: z.boolean().optional(),
	vehicle_unavailable_alert: z.boolean().optional(),
	preferred_route_path: z.record(z.unknown()).optional(),
	avoid_tolls: z.boolean().optional(),
	avoid_highways: z.boolean().optional(),
	traffic_aware_routing: z.boolean().optional(),
	wifi_available: z.boolean().optional(),
	air_conditioning: z.boolean().optional(),
	restroom_available: z.boolean().optional(),
	refreshments_provided: z.boolean().optional(),
	luggage_storage: z.boolean().optional(),
	internal_notes: z.string().optional(),
	driver_notes: z.string().optional(),
	guest_facing_description: z.string().optional(),
	terms_and_conditions: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type ShuttleSchedules = z.infer<typeof ShuttleSchedulesSchema>;

/**
 * Schema for creating a new shuttle schedules
 */
export const CreateShuttleSchedulesSchema = ShuttleSchedulesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateShuttleSchedules = z.infer<
	typeof CreateShuttleSchedulesSchema
>;

/**
 * Schema for updating a shuttle schedules
 */
export const UpdateShuttleSchedulesSchema = ShuttleSchedulesSchema.partial();

export type UpdateShuttleSchedules = z.infer<
	typeof UpdateShuttleSchedulesSchema
>;

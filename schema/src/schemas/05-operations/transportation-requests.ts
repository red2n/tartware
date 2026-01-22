/**
 * DEV DOC
 * Module: schemas/05-operations/transportation-requests.ts
 * Description: TransportationRequests Schema
 * Table: transportation_requests
 * Category: 05-operations
 * Primary exports: TransportationRequestsSchema, CreateTransportationRequestsSchema, UpdateTransportationRequestsSchema
 * @table transportation_requests
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * TransportationRequests Schema
 * @table transportation_requests
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete TransportationRequests schema
 */
export const TransportationRequestsSchema = z.object({
	request_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	request_number: z.string(),
	request_date: z.coerce.date(),
	request_type: z.string(),
	reservation_id: uuid.optional(),
	guest_id: uuid,
	guest_name: z.string(),
	guest_phone: z.string().optional(),
	guest_email: z.string().optional(),
	room_number: z.string().optional(),
	passenger_count: z.number().int(),
	child_count: z.number().int().optional(),
	infant_count: z.number().int().optional(),
	wheelchair_required: z.boolean().optional(),
	child_seat_required: z.boolean().optional(),
	special_needs: z.string().optional(),
	luggage_count: z.number().int().optional(),
	oversized_luggage: z.boolean().optional(),
	special_items: z.string().optional(),
	pickup_location: z.string(),
	pickup_location_type: z.string().optional(),
	pickup_address: z.string().optional(),
	pickup_coordinates: z.record(z.unknown()).optional(),
	dropoff_location: z.string(),
	dropoff_location_type: z.string().optional(),
	dropoff_address: z.string().optional(),
	dropoff_coordinates: z.record(z.unknown()).optional(),
	requested_pickup_datetime: z.coerce.date(),
	requested_pickup_time: z.string(),
	actual_pickup_datetime: z.coerce.date().optional(),
	estimated_arrival_datetime: z.coerce.date().optional(),
	actual_arrival_datetime: z.coerce.date().optional(),
	is_flight_related: z.boolean().optional(),
	flight_number: z.string().optional(),
	airline: z.string().optional(),
	airline_code: z.string().optional(),
	terminal: z.string().optional(),
	arrival_departure: z.string().optional(),
	flight_datetime: z.coerce.date().optional(),
	flight_tracking_enabled: z.boolean().optional(),
	flight_status: z.string().optional(),
	vehicle_id: uuid.optional(),
	vehicle_number: z.string().optional(),
	vehicle_type: z.string().optional(),
	driver_id: uuid.optional(),
	driver_name: z.string().optional(),
	driver_phone: z.string().optional(),
	request_status: z.string(),
	confirmation_sent: z.boolean().optional(),
	confirmation_sent_at: z.coerce.date().optional(),
	dispatched: z.boolean().optional(),
	dispatch_time: z.coerce.date().optional(),
	dispatched_by: uuid.optional(),
	dispatch_notes: z.string().optional(),
	completed_datetime: z.coerce.date().optional(),
	completed_by: uuid.optional(),
	actual_distance_km: money.optional(),
	actual_duration_minutes: z.number().int().optional(),
	meet_and_greet: z.boolean().optional(),
	signage_name: z.string().optional(),
	vip_service: z.boolean().optional(),
	special_instructions: z.string().optional(),
	guest_preferences: z.string().optional(),
	service_type: z.string().optional(),
	base_rate: money.optional(),
	per_km_rate: money.optional(),
	per_hour_rate: money.optional(),
	surcharge_amount: money.optional(),
	surcharge_reason: z.string().optional(),
	gratuity_amount: money.optional(),
	total_charge: money.optional(),
	currency_code: z.string().optional(),
	complimentary: z.boolean().optional(),
	complimentary_reason: z.string().optional(),
	charge_to_room: z.boolean().optional(),
	folio_id: uuid.optional(),
	posted_to_folio: z.boolean().optional(),
	posted_at: z.coerce.date().optional(),
	payment_method: z.string().optional(),
	payment_status: z.string().optional(),
	package_included: z.boolean().optional(),
	package_id: uuid.optional(),
	promotional_code: z.string().optional(),
	discount_percent: money.optional(),
	discount_amount: money.optional(),
	third_party_service: z.boolean().optional(),
	third_party_provider: z.string().optional(),
	third_party_booking_id: z.string().optional(),
	third_party_cost: money.optional(),
	sms_sent: z.boolean().optional(),
	sms_sent_at: z.coerce.date().optional(),
	email_sent: z.boolean().optional(),
	email_sent_at: z.coerce.date().optional(),
	reminder_sent: z.boolean().optional(),
	reminder_sent_at: z.coerce.date().optional(),
	guest_notified_arrival: z.boolean().optional(),
	real_time_tracking_enabled: z.boolean().optional(),
	tracking_url: z.string().optional(),
	current_location: z.record(z.unknown()).optional(),
	last_location_update: z.coerce.date().optional(),
	guest_rating: z.number().int().optional(),
	guest_feedback: z.string().optional(),
	feedback_date: z.coerce.date().optional(),
	driver_rating: z.number().int().optional(),
	service_quality_score: z.number().int().optional(),
	issues_reported: z.boolean().optional(),
	issue_description: z.string().optional(),
	incident_report_id: uuid.optional(),
	compensation_provided: z.boolean().optional(),
	compensation_amount: money.optional(),
	cancelled_by: z.string().optional(),
	cancellation_datetime: z.coerce.date().optional(),
	cancellation_reason: z.string().optional(),
	cancellation_fee: money.optional(),
	cancellation_policy_applied: z.string().optional(),
	no_show_recorded: z.boolean().optional(),
	no_show_fee: money.optional(),
	no_show_follow_up: z.string().optional(),
	weather_conditions: z.string().optional(),
	traffic_conditions: z.string().optional(),
	route_notes: z.string().optional(),
	carbon_offset_offered: z.boolean().optional(),
	carbon_offset_accepted: z.boolean().optional(),
	carbon_offset_amount: money.optional(),
	recurring: z.boolean().optional(),
	recurring_schedule: z.record(z.unknown()).optional(),
	parent_request_id: uuid.optional(),
	pos_transaction_id: z.string().optional(),
	accounting_code: z.string().optional(),
	gl_account: z.string().optional(),
	external_system_id: z.string().optional(),
	internal_notes: z.string().optional(),
	driver_notes: z.string().optional(),
	guest_visible_notes: z.string().optional(),
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

export type TransportationRequests = z.infer<
	typeof TransportationRequestsSchema
>;

/**
 * Schema for creating a new transportation requests
 */
export const CreateTransportationRequestsSchema =
	TransportationRequestsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateTransportationRequests = z.infer<
	typeof CreateTransportationRequestsSchema
>;

/**
 * Schema for updating a transportation requests
 */
export const UpdateTransportationRequestsSchema =
	TransportationRequestsSchema.partial();

export type UpdateTransportationRequests = z.infer<
	typeof UpdateTransportationRequestsSchema
>;

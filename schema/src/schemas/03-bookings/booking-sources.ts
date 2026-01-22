/**
 * DEV DOC
 * Module: schemas/03-bookings/booking-sources.ts
 * Description: BookingSources Schema
 * Table: booking_sources
 * Category: 03-bookings
 * Primary exports: BookingSourcesSchema, CreateBookingSourcesSchema, UpdateBookingSourcesSchema
 * @table booking_sources
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * BookingSources Schema
 * @table booking_sources
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete BookingSources schema
 */
export const BookingSourcesSchema = z.object({
	source_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	source_code: z.string(),
	source_name: z.string(),
	source_type: z.string(),
	category: z.string().optional(),
	sub_category: z.string().optional(),
	is_active: z.boolean().optional(),
	is_bookable: z.boolean().optional(),
	channel_name: z.string().optional(),
	channel_website: z.string().optional(),
	channel_manager: z.string().optional(),
	commission_type: z.string().optional(),
	commission_percentage: money.optional(),
	commission_fixed_amount: money.optional(),
	commission_notes: z.string().optional(),
	total_bookings: z.number().int().optional(),
	total_revenue: money.optional(),
	total_commission_paid: money.optional(),
	total_room_nights: z.number().int().optional(),
	average_booking_value: money.optional(),
	conversion_rate: money.optional(),
	cancellation_rate: money.optional(),
	average_lead_time_days: z.number().int().optional(),
	average_length_of_stay: money.optional(),
	ranking: z.number().int().optional(),
	is_preferred: z.boolean().optional(),
	is_featured: z.boolean().optional(),
	has_integration: z.boolean().optional(),
	integration_type: z.string().optional(),
	api_key: z.string().optional(),
	api_credentials: z.record(z.unknown()).optional(),
	last_sync_at: z.coerce.date().optional(),
	sync_frequency_minutes: z.number().int().optional(),
	contact_name: z.string().optional(),
	contact_email: z.string().optional(),
	contact_phone: z.string().optional(),
	account_manager_name: z.string().optional(),
	account_manager_email: z.string().optional(),
	billing_cycle: z.string().optional(),
	payment_terms: z.string().optional(),
	invoice_email: z.string().optional(),
	tax_id: z.string().optional(),
	contract_start_date: z.coerce.date().optional(),
	contract_end_date: z.coerce.date().optional(),
	contract_notes: z.string().optional(),
	auto_renew: z.boolean().optional(),
	attribution_window_days: z.number().int().optional(),
	last_click_attribution: z.boolean().optional(),
	utm_source: z.string().optional(),
	utm_medium: z.string().optional(),
	utm_campaign: z.string().optional(),
	tracking_code: z.string().optional(),
	display_name: z.string().optional(),
	description: z.string().optional(),
	logo_url: z.string().optional(),
	icon: z.string().optional(),
	color_code: z.string().optional(),
	min_lead_time_hours: z.number().int().optional(),
	max_lead_time_days: z.number().int().optional(),
	min_length_of_stay: z.number().int().optional(),
	max_length_of_stay: z.number().int().optional(),
	allowed_room_types: z.array(uuid).optional(),
	blocked_dates: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	guest_facing_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type BookingSources = z.infer<typeof BookingSourcesSchema>;

/**
 * Schema for creating a new booking sources
 */
export const CreateBookingSourcesSchema = BookingSourcesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateBookingSources = z.infer<typeof CreateBookingSourcesSchema>;

/**
 * Schema for updating a booking sources
 */
export const UpdateBookingSourcesSchema = BookingSourcesSchema.partial();

export type UpdateBookingSources = z.infer<typeof UpdateBookingSourcesSchema>;

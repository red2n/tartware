/**
 * DEV DOC
 * Module: schemas/03-bookings/guest-preferences.ts
 * Description: GuestPreferences Schema
 * Table: guest_preferences
 * Category: 03-bookings
 * Primary exports: GuestPreferencesSchema, CreateGuestPreferencesSchema, UpdateGuestPreferencesSchema
 * @table guest_preferences
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * GuestPreferences Schema
 * @table guest_preferences
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete GuestPreferences schema
 */
export const GuestPreferencesSchema = z.object({
	preference_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	preference_category: z.string(),
	preference_type: z.string(),
	preference_value: z.string().optional(),
	preference_code: z.string().optional(),
	preference_options: z.record(z.unknown()).optional(),
	priority: z.number().int().optional(),
	is_mandatory: z.boolean().optional(),
	is_special_request: z.boolean().optional(),
	preferred_floor: z.number().int().optional(),
	floor_preference: z.string().optional(),
	preferred_room_type_id: uuid.optional(),
	preferred_room_numbers: z.array(z.string()).optional(),
	avoid_room_numbers: z.array(z.string()).optional(),
	bed_type_preference: z.string().optional(),
	smoking_preference: z.string().optional(),
	view_preference: z.string().optional(),
	room_location_preference: z.string().optional(),
	connecting_rooms: z.boolean().optional(),
	adjacent_rooms: z.boolean().optional(),
	newspaper_preference: z.string().optional(),
	turndown_service: z.boolean().optional(),
	do_not_disturb_default: z.boolean().optional(),
	wake_up_call_preference: z.string().optional(),
	pillow_type: z.string().optional(),
	extra_pillows: z.number().int().optional(),
	extra_blankets: z.number().int().optional(),
	mini_bar_stocked: z.boolean().optional(),
	mini_bar_preferences: z.array(z.string()).optional(),
	room_temperature_celsius: money.optional(),
	dietary_restrictions: z.array(z.string()).optional(),
	food_allergies: z.array(z.string()).optional(),
	preferred_cuisine: z.array(z.string()).optional(),
	dislikes: z.array(z.string()).optional(),
	mobility_accessible: z.boolean().optional(),
	hearing_accessible: z.boolean().optional(),
	visual_accessible: z.boolean().optional(),
	service_animal: z.boolean().optional(),
	accessibility_notes: z.string().optional(),
	preferred_language: z.string().optional(),
	preferred_contact_method: z.string().optional(),
	preferred_contact_time: z.string().optional(),
	marketing_opt_in: z.boolean().optional(),
	newsletter_opt_in: z.boolean().optional(),
	sms_opt_in: z.boolean().optional(),
	preferred_payment_method: z.string().optional(),
	split_billing: z.boolean().optional(),
	itemized_invoice: z.boolean().optional(),
	email_invoice: z.boolean().optional(),
	check_in_preference: z.string().optional(),
	check_out_preference: z.string().optional(),
	occasions: z.array(z.string()).optional(),
	celebration_dates: z.record(z.unknown()).optional(),
	traveling_with: z.string().optional(),
	number_of_children: z.number().int().optional(),
	children_ages: z.array(z.number().int()).optional(),
	has_pets: z.boolean().optional(),
	pet_type: z.string().optional(),
	frequency: z.string().optional(),
	is_active: z.boolean().optional(),
	valid_from: z.coerce.date().optional(),
	valid_until: z.coerce.date().optional(),
	source: z.string().optional(),
	collected_at: z.coerce.date().optional(),
	collected_by: uuid.optional(),
	last_honored_at: z.coerce.date().optional(),
	times_honored: z.number().int().optional(),
	is_verified: z.boolean().optional(),
	verified_at: z.coerce.date().optional(),
	verified_by: uuid.optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type GuestPreferences = z.infer<typeof GuestPreferencesSchema>;

/**
 * Schema for creating a new guest preferences
 */
export const CreateGuestPreferencesSchema = GuestPreferencesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGuestPreferences = z.infer<
	typeof CreateGuestPreferencesSchema
>;

/**
 * Schema for updating a guest preferences
 */
export const UpdateGuestPreferencesSchema = GuestPreferencesSchema.partial();

export type UpdateGuestPreferences = z.infer<
	typeof UpdateGuestPreferencesSchema
>;

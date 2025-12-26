/**
 * GuestRoomPreferences Schema
 * @table guest_room_preferences
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete GuestRoomPreferences schema
 */
export const GuestRoomPreferencesSchema = z.object({
	preference_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	preferred_temperature: money.optional(),
	temperature_unit: z.string().optional(),
	preferred_hvac_mode: z.string().optional(),
	preferred_humidity: money.optional(),
	preferred_lighting_level: z.number().int().optional(),
	preferred_color_temperature: z.number().int().optional(),
	prefers_natural_light: z.boolean().optional(),
	wake_up_lighting_time: z.string().optional(),
	sleep_lighting_time: z.string().optional(),
	auto_curtains_open_time: z.string().optional(),
	auto_curtains_close_time: z.string().optional(),
	motion_sensor_enabled: z.boolean().optional(),
	auto_lights_off_when_vacant: z.boolean().optional(),
	preferred_tv_channels: z.array(z.string()).optional(),
	preferred_streaming_services: z.array(z.string()).optional(),
	preferred_music_genre: z.array(z.string()).optional(),
	voice_assistant_enabled: z.boolean().optional(),
	voice_assistant_wake_word: z.string().optional(),
	voice_assistant_language: z.string().optional(),
	accessibility_mode: z.boolean().optional(),
	hearing_accessible: z.boolean().optional(),
	mobility_accessible: z.boolean().optional(),
	visual_accessible: z.boolean().optional(),
	do_not_disturb_default: z.boolean().optional(),
	privacy_mode_enabled: z.boolean().optional(),
	camera_disabled: z.boolean().optional(),
	microphone_disabled: z.boolean().optional(),
	learning_mode_enabled: z.boolean().optional(),
	last_learned_at: z.coerce.date().optional(),
	profile_name: z.string().optional(),
	is_default_profile: z.boolean().optional(),
	device_preferences: z.record(z.unknown()).optional(),
	special_requests: z.string().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type GuestRoomPreferences = z.infer<typeof GuestRoomPreferencesSchema>;

/**
 * Schema for creating a new guest room preferences
 */
export const CreateGuestRoomPreferencesSchema = GuestRoomPreferencesSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateGuestRoomPreferences = z.infer<
	typeof CreateGuestRoomPreferencesSchema
>;

/**
 * Schema for updating a guest room preferences
 */
export const UpdateGuestRoomPreferencesSchema =
	GuestRoomPreferencesSchema.partial();

export type UpdateGuestRoomPreferences = z.infer<
	typeof UpdateGuestRoomPreferencesSchema
>;

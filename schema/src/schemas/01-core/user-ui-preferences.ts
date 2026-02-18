/**
 * DEV DOC
 * Module: schemas/01-core/user-ui-preferences.ts
 * Description: UserUiPreferences Schema
 * Table: user_ui_preferences
 * Category: 01-core
 * Primary exports: UserUiPreferencesSchema, CreateUserUiPreferencesSchema, UpdateUserUiPreferencesSchema
 * @table user_ui_preferences
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * UserUiPreferences Schema — per-user interface customization
 * including home page, profile display, dashboard layout, theme,
 * and notification delivery settings.
 * @table user_ui_preferences
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

const profileHistoryDisplayEnum = z.enum(["COMPACT", "DETAILED", "TIMELINE"]);

const notificationDigestEnum = z.enum(["IMMEDIATE", "HOURLY", "DAILY", "NONE"]);

const themeEnum = z.enum(["LIGHT", "DARK", "SYSTEM"]);

const timeFormatEnum = z.enum(["12H", "24H"]);

const currencyDisplayEnum = z.enum(["SYMBOL", "CODE", "BOTH"]);

/**
 * Complete UserUiPreferences schema
 */
export const UserUiPreferencesSchema = z.object({
	preference_id: uuid,
	tenant_id: uuid,
	user_id: uuid,

	// Home page
	home_page: z.string().max(200).optional(),
	home_page_dashboard_layout: z.array(z.record(z.unknown())).optional(),

	// Profile display
	profile_display_fields: z.array(z.string()).optional(),
	profile_history_display: profileHistoryDisplayEnum.optional(),
	default_profile_tab: z.string().max(50).optional(),

	// List & grid
	default_page_size: z.number().int().min(5).max(200).optional(),
	default_sort_field: z.string().max(100).optional(),
	default_sort_direction: z.enum(["ASC", "DESC"]).optional(),

	// Notifications
	notification_sound_enabled: z.boolean().optional(),
	notification_desktop_enabled: z.boolean().optional(),
	notification_email_digest: notificationDigestEnum.optional(),

	// Visual
	theme: themeEnum.optional(),
	language: z.string().max(10).optional(),
	timezone: z.string().max(50).optional(),
	date_format: z.string().max(20).optional(),
	time_format: timeFormatEnum.optional(),
	currency_display: currencyDisplayEnum.optional(),

	// Quick access
	pinned_reports: z.array(z.record(z.unknown())).optional(),
	recent_searches: z.array(z.record(z.unknown())).optional(),
	favorite_properties: z.array(uuid).optional(),

	// Audit
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type UserUiPreferences = z.infer<typeof UserUiPreferencesSchema>;

/**
 * Schema for creating user UI preferences.
 * Omits auto-generated fields.
 */
export const CreateUserUiPreferencesSchema = UserUiPreferencesSchema.omit({
	preference_id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
});

export type CreateUserUiPreferences = z.infer<
	typeof CreateUserUiPreferencesSchema
>;

/**
 * Schema for updating user UI preferences.
 * All fields optional; identity keys excluded.
 */
export const UpdateUserUiPreferencesSchema = UserUiPreferencesSchema.omit({
	preference_id: true,
	tenant_id: true,
	user_id: true,
	created_at: true,
	created_by: true,
}).partial();

export type UpdateUserUiPreferences = z.infer<
	typeof UpdateUserUiPreferencesSchema
>;

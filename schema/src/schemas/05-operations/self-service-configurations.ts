/**
 * DEV DOC
 * Module: schemas/05-operations/self-service-configurations.ts
 * Description: SelfServiceConfigurations Schema
 * Table: self_service_configurations
 * Category: 05-operations
 * Primary exports: SelfServiceConfigurationsSchema, CreateSelfServiceConfigurationsSchema, UpdateSelfServiceConfigurationsSchema
 * @table self_service_configurations
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * SelfServiceConfigurations Schema — per-property feature toggles for
 * mobile check-in, digital keys, direct booking, and registration cards.
 * @table self_service_configurations
 * @category 05-operations
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete SelfServiceConfigurations schema
 */
export const SelfServiceConfigurationsSchema = z.object({
	config_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// Mobile Check-In
	mobile_checkin_enabled: z.boolean().optional(),
	mobile_checkin_window_hours: z.number().int().optional(),
	mobile_checkin_require_id: z.boolean().optional(),
	mobile_checkin_require_payment: z.boolean().optional(),
	mobile_checkin_auto_assign_room: z.boolean().optional(),

	// Digital Keys
	digital_keys_enabled: z.boolean().optional(),
	digital_keys_provider: z.string().max(50).optional(),
	digital_keys_max_per_reservation: z.number().int().optional(),
	digital_keys_auto_revoke_on_checkout: z.boolean().optional(),

	// Direct Booking Engine
	booking_engine_enabled: z.boolean().optional(),
	booking_engine_min_advance_hours: z.number().int().optional(),
	booking_engine_max_advance_days: z.number().int().optional(),
	booking_engine_max_rooms_per_booking: z.number().int().optional(),
	booking_engine_require_deposit: z.boolean().optional(),
	booking_engine_deposit_percent: z
		.number()
		.min(0)
		.max(100)
		.multipleOf(0.01)
		.optional(),

	// Registration Card
	registration_card_enabled: z.boolean().optional(),
	registration_card_require_signature: z.boolean().optional(),
	registration_card_include_terms: z.boolean().optional(),
	registration_card_custom_terms: z.string().optional(),

	// Contactless Requests
	contactless_requests_enabled: z.boolean().optional(),
	contactless_menu_enabled: z.boolean().optional(),

	// Guest Communication
	send_pre_arrival_email: z.boolean().optional(),
	pre_arrival_email_hours: z.number().int().optional(),

	// Branding
	brand_logo_url: z.string().max(500).optional(),
	brand_primary_color: z.string().max(7).optional(),
	brand_welcome_message: z.string().optional(),

	// Status
	is_active: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),

	// Audit
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),

	// Soft Delete
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type SelfServiceConfigurations = z.infer<
	typeof SelfServiceConfigurationsSchema
>;

/**
 * Schema for creating a self-service configuration for a property.
 * Omits auto-generated fields.
 */
export const CreateSelfServiceConfigurationsSchema =
	SelfServiceConfigurationsSchema.omit({
		config_id: true,
		created_at: true,
		updated_at: true,
		created_by: true,
		updated_by: true,
		is_deleted: true,
		deleted_at: true,
		deleted_by: true,
	});

export type CreateSelfServiceConfigurations = z.infer<
	typeof CreateSelfServiceConfigurationsSchema
>;

/**
 * Schema for updating a self-service configuration.
 * All fields optional; tenant_id and config_id are immutable.
 */
export const UpdateSelfServiceConfigurationsSchema =
	SelfServiceConfigurationsSchema.omit({
		config_id: true,
		tenant_id: true,
		created_at: true,
		created_by: true,
	}).partial();

export type UpdateSelfServiceConfigurations = z.infer<
	typeof UpdateSelfServiceConfigurationsSchema
>;

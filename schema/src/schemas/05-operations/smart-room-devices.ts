/**
 * DEV DOC
 * Module: schemas/05-operations/smart-room-devices.ts
 * Description: SmartRoomDevices Schema
 * Table: smart_room_devices
 * Category: 05-operations
 * Primary exports: SmartRoomDevicesSchema, CreateSmartRoomDevicesSchema, UpdateSmartRoomDevicesSchema
 * @table smart_room_devices
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * SmartRoomDevices Schema
 * @table smart_room_devices
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete SmartRoomDevices schema
 */
export const SmartRoomDevicesSchema = z.object({
	device_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_id: uuid.optional(),
	location: z.string().optional(),
	device_name: z.string(),
	device_type: z.string(),
	device_category: z.string().optional(),
	manufacturer: z.string().optional(),
	model_number: z.string().optional(),
	serial_number: z.string().optional(),
	firmware_version: z.string().optional(),
	hardware_version: z.string().optional(),
	mac_address: z.string().optional(),
	ip_address: z.string().optional(),
	network_type: z.string().optional(),
	is_online: z.boolean().optional(),
	last_online_at: z.coerce.date().optional(),
	signal_strength: z.number().int().optional(),
	battery_level: z.number().int().optional(),
	is_battery_powered: z.boolean().optional(),
	installation_date: z.coerce.date().optional(),
	installed_by: uuid.optional(),
	warranty_expiry_date: z.coerce.date().optional(),
	status: z.string().optional(),
	operational_status: z.string().optional(),
	supports_voice_control: z.boolean().optional(),
	supports_remote_control: z.boolean().optional(),
	supports_scheduling: z.boolean().optional(),
	supports_automation: z.boolean().optional(),
	current_state: z.record(z.unknown()).optional(),
	device_settings: z.record(z.unknown()).optional(),
	automation_rules: z.record(z.unknown()).optional(),
	power_consumption_watts: money.optional(),
	energy_usage_kwh: money.optional(),
	last_maintenance_date: z.coerce.date().optional(),
	next_maintenance_date: z.coerce.date().optional(),
	maintenance_interval_days: z.number().int().optional(),
	maintenance_notes: z.string().optional(),
	issue_count: z.number().int().optional(),
	integration_platform: z.string().optional(),
	api_endpoint: z.string().optional(),
	api_key_reference: z.string().optional(),
	guest_controllable: z.boolean().optional(),
	guest_visible: z.boolean().optional(),
	requires_training: z.boolean().optional(),
	total_activations: z.number().int().optional(),
	last_activated_at: z.coerce.date().optional(),
	average_daily_activations: money.optional(),
	alert_enabled: z.boolean().optional(),
	alert_threshold: z.record(z.unknown()).optional(),
	last_alert_at: z.coerce.date().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type SmartRoomDevices = z.infer<typeof SmartRoomDevicesSchema>;

/**
 * Schema for creating a new smart room devices
 */
export const CreateSmartRoomDevicesSchema = SmartRoomDevicesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSmartRoomDevices = z.infer<
	typeof CreateSmartRoomDevicesSchema
>;

/**
 * Schema for updating a smart room devices
 */
export const UpdateSmartRoomDevicesSchema = SmartRoomDevicesSchema.partial();

export type UpdateSmartRoomDevices = z.infer<
	typeof UpdateSmartRoomDevicesSchema
>;

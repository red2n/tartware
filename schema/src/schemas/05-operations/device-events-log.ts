/**
 * DEV DOC
 * Module: schemas/05-operations/device-events-log.ts
 * Description: DeviceEventsLog Schema
 * Table: device_events_log
 * Category: 05-operations
 * Primary exports: DeviceEventsLogSchema, CreateDeviceEventsLogSchema, UpdateDeviceEventsLogSchema
 * @table device_events_log
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * DeviceEventsLog Schema
 * @table device_events_log
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete DeviceEventsLog schema
 */
export const DeviceEventsLogSchema = z.object({
	event_id: uuid,
	device_id: uuid,
	event_type: z.string(),
	event_timestamp: z.coerce.date().optional(),
	previous_state: z.record(z.unknown()).optional(),
	new_state: z.record(z.unknown()).optional(),
	event_data: z.record(z.unknown()).optional(),
	triggered_by: z.string().optional(),
	triggered_by_user_id: uuid.optional(),
	triggered_by_guest_id: uuid.optional(),
	error_code: z.string().optional(),
	error_message: z.string().optional(),
	severity: z.string().optional(),
	action_taken: z.string().optional(),
	resolved: z.boolean().optional(),
	resolved_at: z.coerce.date().optional(),
	created_at: z.coerce.date().optional(),
});

export type DeviceEventsLog = z.infer<typeof DeviceEventsLogSchema>;

/**
 * Schema for creating a new device events log
 */
export const CreateDeviceEventsLogSchema = DeviceEventsLogSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateDeviceEventsLog = z.infer<typeof CreateDeviceEventsLogSchema>;

/**
 * Schema for updating a device events log
 */
export const UpdateDeviceEventsLogSchema = DeviceEventsLogSchema.partial();

export type UpdateDeviceEventsLog = z.infer<typeof UpdateDeviceEventsLogSchema>;

/**
 * DEV DOC
 * Module: events/commands/operations.ts
 * Description: Operations command schemas for maintenance requests, incidents, asset tracking, inventory adjustments, and staff scheduling
 * Primary exports: OperationsMaintenanceRequestCommandSchema, OperationsIncidentReportCommandSchema, OperationsScheduleCreateCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

export const OperationsMaintenanceRequestCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_id: z.string().uuid().optional(),
	issue_category: z.string().min(2).max(100),
	issue_description: z.string().min(2).max(2000),
	priority: z.string().max(20).optional(),
	reported_by: z.string().uuid().optional(),
	reported_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceRequestCommand = z.infer<
	typeof OperationsMaintenanceRequestCommandSchema
>;

export const OperationsIncidentReportCommandSchema = z.object({
	property_id: z.string().uuid(),
	incident_type: z.string().min(2).max(100),
	description: z.string().min(2).max(2000),
	reported_by: z.string().uuid().optional(),
	occurred_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsIncidentReportCommand = z.infer<
	typeof OperationsIncidentReportCommandSchema
>;

export const OperationsAssetUpdateCommandSchema = z
	.object({
		asset_id: z.string().uuid(),
		status: z.string().max(50).optional(),
		location: z.string().max(200).optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.status || value.location || value.notes),
		"status, location, or notes is required",
	);

export type OperationsAssetUpdateCommand = z.infer<
	typeof OperationsAssetUpdateCommandSchema
>;

export const OperationsInventoryAdjustCommandSchema = z.object({
	property_id: z.string().uuid(),
	item_id: z.string().uuid(),
	delta_quantity: z.coerce.number(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsInventoryAdjustCommand = z.infer<
	typeof OperationsInventoryAdjustCommandSchema
>;

export const OperationsScheduleCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	user_id: z.string().uuid(),
	department: z.string().min(1).max(100),
	schedule_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	shift_type: z.enum([
		"morning",
		"afternoon",
		"evening",
		"night",
		"split",
		"on_call",
		"full_day",
		"custom",
	]),
	scheduled_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
	scheduled_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
	scheduled_hours: z.coerce.number().positive(),
	role: z.string().max(100).optional(),
	shift_name: z.string().max(100).optional(),
	work_location: z.string().max(100).optional(),
	assigned_area: z.string().max(100).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsScheduleCreateCommand = z.infer<
	typeof OperationsScheduleCreateCommandSchema
>;

export const OperationsScheduleUpdateCommandSchema = z.object({
	schedule_id: z.string().uuid(),
	property_id: z.string().uuid(),
	shift_type: z
		.enum([
			"morning",
			"afternoon",
			"evening",
			"night",
			"split",
			"on_call",
			"full_day",
			"custom",
		])
		.optional(),
	scheduled_start_time: z
		.string()
		.regex(/^\d{2}:\d{2}(:\d{2})?$/)
		.optional(),
	scheduled_end_time: z
		.string()
		.regex(/^\d{2}:\d{2}(:\d{2})?$/)
		.optional(),
	scheduled_hours: z.coerce.number().positive().optional(),
	schedule_status: z
		.enum(["draft", "scheduled", "confirmed", "cancelled", "adjusted"])
		.optional(),
	role: z.string().max(100).optional(),
	shift_name: z.string().max(100).optional(),
	work_location: z.string().max(100).optional(),
	assigned_area: z.string().max(100).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsScheduleUpdateCommand = z.infer<
	typeof OperationsScheduleUpdateCommandSchema
>;

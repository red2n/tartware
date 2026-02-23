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
	room_number: z.string().max(20).optional(),
	request_type: z
		.enum([
			"CORRECTIVE",
			"PREVENTIVE",
			"EMERGENCY",
			"ROUTINE",
			"INSPECTION",
			"UPGRADE",
			"GUEST_REPORTED",
		])
		.default("CORRECTIVE"),
	issue_category: z.string().min(2).max(100),
	issue_description: z.string().min(2).max(2000),
	priority: z.string().max(20).optional(),
	reported_by: z.string().uuid().optional(),
	reported_at: z.coerce.date().optional(),
	reporter_role: z.string().max(30).optional(),
	guest_id: z.string().uuid().optional(),
	reservation_id: z.string().uuid().optional(),
	location_description: z.string().max(200).optional(),
	affects_occupancy: z.boolean().optional(),
	is_safety_issue: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceRequestCommand = z.infer<
	typeof OperationsMaintenanceRequestCommandSchema
>;

export const OperationsMaintenanceAssignCommandSchema = z.object({
	request_id: z.string().uuid(),
	assigned_to: z.string().uuid(),
	maintenance_team: z.string().max(50).optional(),
	scheduled_date: z.string().optional(),
	scheduled_time: z.string().optional(),
	estimated_duration_minutes: z.number().int().positive().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceAssignCommand = z.infer<
	typeof OperationsMaintenanceAssignCommandSchema
>;

export const OperationsMaintenanceCompleteCommandSchema = z.object({
	request_id: z.string().uuid(),
	work_performed: z.string().max(2000),
	parts_used: z.array(z.string()).optional(),
	actual_duration_minutes: z.number().int().positive().optional(),
	labor_cost: z.number().optional(),
	parts_cost: z.number().optional(),
	is_satisfactory: z.boolean().optional(),
	completion_notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceCompleteCommand = z.infer<
	typeof OperationsMaintenanceCompleteCommandSchema
>;

export const OperationsMaintenanceEscalateCommandSchema = z.object({
	request_id: z.string().uuid(),
	escalated_to: z.string().uuid(),
	escalation_reason: z.string().max(2000),
	new_priority: z
		.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY"])
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceEscalateCommand = z.infer<
	typeof OperationsMaintenanceEscalateCommandSchema
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

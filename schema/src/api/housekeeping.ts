/**
 * DEV DOC
 * Module: api/housekeeping.ts
 * Purpose: Housekeeping and Operations API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { isoDateString, uuid } from "../shared/base-schemas.js";

// =====================================================
// HOUSEKEEPING TASKS
// =====================================================

/**
 * Housekeeping task list item schema for API responses.
 * Includes display fields derived from enum values.
 */
export const HousekeepingTaskListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	room_number: z.string(),
	task_type: z.string(),
	priority: z.string().optional(),
	status: z.string(),
	status_display: z.string(),
	assigned_to: uuid.optional(),
	assigned_at: z.string().optional(),
	scheduled_date: z.string(),
	scheduled_time: z.string().optional(),
	started_at: z.string().optional(),
	completed_at: z.string().optional(),
	inspected_by: uuid.optional(),
	inspected_at: z.string().optional(),
	inspection_passed: z.boolean().optional(),
	is_guest_request: z.boolean(),
	special_instructions: z.string().optional(),
	notes: z.string().optional(),
	issues_found: z.string().optional(),
	credits: z.number().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string(),
});

export type HousekeepingTaskListItem = z.infer<typeof HousekeepingTaskListItemSchema>;

/**
 * Housekeeping task list response schema.
 */
export const HousekeepingTaskListResponseSchema = z.object({
	data: z.array(HousekeepingTaskListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type HousekeepingTaskListResponse = z.infer<typeof HousekeepingTaskListResponseSchema>;

// =====================================================
// HOUSEKEEPING SCHEDULES
// =====================================================

/**
 * Query schema for listing housekeeping schedules.
 * Filters tasks that have a scheduled date, with optional date range.
 */
export const HousekeepingScheduleListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	date_from: isoDateString.optional(),
	date_to: isoDateString.optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type HousekeepingScheduleListQuery = z.infer<typeof HousekeepingScheduleListQuerySchema>;

/**
 * Response schema for housekeeping schedule list.
 */
export const HousekeepingScheduleListResponseSchema = z.array(HousekeepingTaskListItemSchema);

export type HousekeepingScheduleListResponse = z.infer<typeof HousekeepingScheduleListResponseSchema>;

// =====================================================
// HOUSEKEEPING INSPECTIONS
// =====================================================

/**
 * Query schema for listing housekeeping inspections.
 * Filters tasks that have been inspected, with optional pass/fail and date range.
 */
export const HousekeepingInspectionListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	passed: z
		.enum(["true", "false"])
		.optional()
		.transform((v) => (v === undefined ? undefined : v === "true")),
	date_from: isoDateString.optional(),
	date_to: isoDateString.optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type HousekeepingInspectionListQuery = z.infer<typeof HousekeepingInspectionListQuerySchema>;

/**
 * Response schema for housekeeping inspection list.
 */
export const HousekeepingInspectionListResponseSchema = z.array(HousekeepingTaskListItemSchema);

export type HousekeepingInspectionListResponse = z.infer<typeof HousekeepingInspectionListResponseSchema>;

// =====================================================
// MAINTENANCE REQUESTS
// =====================================================

/**
 * Maintenance request type enum values matching database constraints.
 */
export const MaintenanceRequestTypeEnum = z.enum([
	"CORRECTIVE",
	"PREVENTIVE",
	"EMERGENCY",
	"ROUTINE",
	"INSPECTION",
	"UPGRADE",
	"GUEST_REPORTED",
]);
export type MaintenanceRequestType = z.infer<typeof MaintenanceRequestTypeEnum>;

/**
 * Maintenance request status enum values matching database constraints.
 */
export const MaintenanceRequestStatusEnum = z.enum([
	"OPEN",
	"ASSIGNED",
	"IN_PROGRESS",
	"ON_HOLD",
	"COMPLETED",
	"CANCELLED",
	"VERIFIED",
]);
export type MaintenanceRequestStatus = z.infer<typeof MaintenanceRequestStatusEnum>;

/**
 * Maintenance priority enum values matching database constraints.
 */
export const MaintenancePriorityEnum = z.enum([
	"LOW",
	"MEDIUM",
	"HIGH",
	"URGENT",
	"EMERGENCY",
]);
export type MaintenancePriority = z.infer<typeof MaintenancePriorityEnum>;

/**
 * Maintenance issue category enum values matching database constraints.
 */
export const MaintenanceIssueCategoryEnum = z.enum([
	"PLUMBING",
	"ELECTRICAL",
	"HVAC",
	"APPLIANCE",
	"FURNITURE",
	"FIXTURE",
	"SAFETY",
	"CLEANLINESS",
	"PEST",
	"STRUCTURAL",
	"EQUIPMENT",
	"TECHNOLOGY",
	"OTHER",
]);
export type MaintenanceIssueCategory = z.infer<typeof MaintenanceIssueCategoryEnum>;

/**
 * Maintenance request list item schema for API responses.
 */
export const MaintenanceRequestListItemSchema = z.object({
	request_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	request_number: z.string().nullable(),
	request_type: z.string(),
	request_type_display: z.string(),
	request_status: z.string(),
	request_status_display: z.string(),
	priority: z.string(),
	priority_display: z.string(),

	// Location
	room_id: uuid.optional(),
	room_number: z.string().nullable(),
	location_description: z.string().nullable(),
	location_type: z.string().nullable(),

	// Issue Details
	issue_category: z.string(),
	issue_category_display: z.string(),
	issue_subcategory: z.string().nullable(),
	issue_description: z.string(),

	// Severity indicators
	affects_occupancy: z.boolean(),
	affects_guest_comfort: z.boolean(),
	is_safety_issue: z.boolean(),
	is_health_issue: z.boolean(),

	// Reporter info
	reported_at: z.string(),
	reported_by: uuid,
	reporter_role: z.string().nullable(),

	// Assignment
	assigned_to: uuid.optional(),
	assigned_at: z.string().optional(),
	maintenance_team: z.string().nullable(),

	// Scheduling
	scheduled_date: z.string().nullable(),
	estimated_duration_minutes: z.number().int().nullable(),

	// Work details
	work_started_at: z.string().optional(),
	work_completed_at: z.string().optional(),
	actual_duration_minutes: z.number().int().nullable(),
	work_performed: z.string().nullable(),

	// Costs
	total_cost: z.number().nullable(),
	currency_code: z.string(),

	// Room impact
	room_out_of_service: z.boolean(),
	oos_from: z.string().optional(),
	oos_until: z.string().optional(),

	// SLA
	response_time_minutes: z.number().int().nullable(),
	resolution_time_hours: z.number().int().nullable(),
	is_within_sla: z.boolean().nullable(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type MaintenanceRequestListItem = z.infer<typeof MaintenanceRequestListItemSchema>;

/**
 * Maintenance request list response schema.
 */
export const MaintenanceRequestListResponseSchema = z.object({
	data: z.array(MaintenanceRequestListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type MaintenanceRequestListResponse = z.infer<typeof MaintenanceRequestListResponseSchema>;

// =====================================================
// INCIDENT REPORTS
// =====================================================

/**
 * Incident type enum values matching database constraints.
 */
export const IncidentTypeEnum = z.enum([
	"accident",
	"injury",
	"illness",
	"theft",
	"damage",
	"fire",
	"security_breach",
	"guest_complaint",
	"staff_misconduct",
	"food_poisoning",
	"slip_fall",
	"equipment_failure",
	"medical_emergency",
	"death",
	"violence",
	"harassment",
	"property_damage",
	"natural_disaster",
	"other",
]);
export type IncidentType = z.infer<typeof IncidentTypeEnum>;

/**
 * Incident severity enum values matching database constraints.
 */
export const IncidentSeverityEnum = z.enum([
	"minor",
	"moderate",
	"serious",
	"critical",
	"catastrophic",
]);
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;

/**
 * Incident status enum values matching database constraints.
 */
export const IncidentStatusEnum = z.enum([
	"reported",
	"under_investigation",
	"investigated",
	"resolved",
	"closed",
	"pending",
	"escalated",
	"legal_action",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;

/**
 * Incident report list item schema for API responses.
 */
export const IncidentReportListItemSchema = z.object({
	incident_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	incident_number: z.string(),
	incident_title: z.string(),

	// Classification
	incident_type: z.string(),
	incident_type_display: z.string(),
	incident_category: z.string().nullable(),
	severity: z.string(),
	severity_display: z.string(),
	severity_score: z.number().int().nullable(),

	// Date & Time
	incident_datetime: z.string(),
	incident_date: z.string(),
	incident_time: z.string(),

	// Location
	incident_location: z.string(),
	room_number: z.string().nullable(),
	floor_number: z.number().int().nullable(),
	area_name: z.string().nullable(),

	// People involved
	guest_involved: z.boolean(),
	staff_involved: z.boolean(),
	third_party_involved: z.boolean(),
	witness_count: z.number().int(),

	// Injuries
	injuries_sustained: z.boolean(),
	injury_severity: z.string().nullable(),
	medical_attention_required: z.boolean(),

	// Property damage
	property_damage: z.boolean(),
	estimated_damage_cost: z.number().nullable(),

	// Status
	incident_status: z.string(),
	incident_status_display: z.string(),

	// Investigation
	investigation_required: z.boolean(),
	investigation_completed: z.boolean(),

	// Legal & Insurance
	police_notified: z.boolean(),
	police_report_number: z.string().nullable(),
	insurance_claim_filed: z.boolean(),
	insurance_claim_number: z.string().nullable(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
	created_by: uuid,
});

export type IncidentReportListItem = z.infer<typeof IncidentReportListItemSchema>;

/**
 * Incident report list response schema.
 */
export const IncidentReportListResponseSchema = z.object({
	data: z.array(IncidentReportListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type IncidentReportListResponse = z.infer<typeof IncidentReportListResponseSchema>;

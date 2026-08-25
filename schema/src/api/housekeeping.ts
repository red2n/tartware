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

export type HousekeepingTaskListItem = z.infer<
	typeof HousekeepingTaskListItemSchema
>;

/**
 * Housekeeping task list response schema.
 */
export const HousekeepingTaskListResponseSchema = z.object({
	data: z.array(HousekeepingTaskListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type HousekeepingTaskListResponse = z.infer<
	typeof HousekeepingTaskListResponseSchema
>;

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

export type HousekeepingScheduleListQuery = z.infer<
	typeof HousekeepingScheduleListQuerySchema
>;

/**
 * Response schema for housekeeping schedule list.
 */
export const HousekeepingScheduleListResponseSchema = z.array(
	HousekeepingTaskListItemSchema,
);

export type HousekeepingScheduleListResponse = z.infer<
	typeof HousekeepingScheduleListResponseSchema
>;

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

export type HousekeepingInspectionListQuery = z.infer<
	typeof HousekeepingInspectionListQuerySchema
>;

/**
 * Response schema for housekeeping inspection list.
 */
export const HousekeepingInspectionListResponseSchema = z.array(
	HousekeepingTaskListItemSchema,
);

export type HousekeepingInspectionListResponse = z.infer<
	typeof HousekeepingInspectionListResponseSchema
>;

// =====================================================
// DEEP CLEAN DUE
// =====================================================

/**
 * Query schema for listing rooms due for deep cleaning.
 */
export const DeepCleanDueQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type DeepCleanDueQuery = z.infer<typeof DeepCleanDueQuerySchema>;

/**
 * Deep clean due room item schema for API responses.
 */
export const DeepCleanDueItemSchema = z.object({
	room_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	room_number: z.string(),
	room_type_name: z.string().optional(),
	floor: z.string().optional(),
	status: z.string(),
	housekeeping_status: z.string(),
	last_deep_clean_date: z.string().nullable(),
	deep_clean_interval_days: z.number().int(),
	days_since_deep_clean: z.number().int().nullable(),
	days_overdue: z.number().int().nullable(),
});

export type DeepCleanDueItem = z.infer<typeof DeepCleanDueItemSchema>;

/**
 * Response schema for deep clean due list.
 */
export const DeepCleanDueResponseSchema = z.array(DeepCleanDueItemSchema);

export type DeepCleanDueResponse = z.infer<typeof DeepCleanDueResponseSchema>;

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
export type MaintenanceRequestStatus = z.infer<
	typeof MaintenanceRequestStatusEnum
>;

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
export type MaintenanceIssueCategory = z.infer<
	typeof MaintenanceIssueCategoryEnum
>;

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

export type MaintenanceRequestListItem = z.infer<
	typeof MaintenanceRequestListItemSchema
>;

/**
 * Maintenance request list response schema.
 */
export const MaintenanceRequestListResponseSchema = z.object({
	data: z.array(MaintenanceRequestListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type MaintenanceRequestListResponse = z.infer<
	typeof MaintenanceRequestListResponseSchema
>;

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

export type IncidentReportListItem = z.infer<
	typeof IncidentReportListItemSchema
>;

/**
 * Detail shape for `GET /v1/incidents/:incidentId`.
 *
 * The list shape carries classification and flags only. `INCIDENT_REPORT_BY_ID_SQL`
 * has always selected the narrative columns too, but the by-id handler reused the
 * list mapper and dropped them — so what happened, what was done about it and how
 * it was closed could be written through the product and never read back.
 * See ui-gaps/06-incidents.md.
 */
export const IncidentReportDetailSchema = IncidentReportListItemSchema.extend({
	incident_description: z.string(),
	immediate_actions_taken: z.string().nullable(),
	discovered_by_name: z.string().nullable(),
	guest_name: z.string().nullable(),
	injury_details: z.string().nullable(),
	damage_description: z.string().nullable(),
	investigation_findings: z.string().nullable(),
	corrective_actions: z.string().nullable(),
	follow_up_required: z.boolean().nullable(),
	follow_up_actions: z.string().nullable(),
	closed_at: z.string().nullable(),
	closure_notes: z.string().nullable(),
});

export type IncidentReportDetail = z.infer<typeof IncidentReportDetailSchema>;

/**
 * Incident report list response schema.
 */
export const IncidentReportListResponseSchema = z.object({
	data: z.array(IncidentReportListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type IncidentReportListResponse = z.infer<
	typeof IncidentReportListResponseSchema
>;

// =====================================================
// LOST & FOUND ACTIONS
// =====================================================

/** Body schema for claiming a lost & found item. */
export const ClaimLostAndFoundBodySchema = z.object({
	tenant_id: uuid,
	claimed_by_guest_id: uuid.optional(),
	claimed_by_name: z.string().min(1).max(200),
	verification_notes: z.string().optional(),
});

export type ClaimLostAndFoundBody = z.infer<typeof ClaimLostAndFoundBodySchema>;

/** Accepted return methods for lost & found items. */
export const LostAndFoundReturnMethodEnum = z.enum([
	"in_person",
	"shipped",
	"courier",
	"picked_up",
	"mailed",
]);

/** Body schema for returning a lost & found item. */
export const ReturnLostAndFoundBodySchema = z.object({
	tenant_id: uuid,
	return_method: LostAndFoundReturnMethodEnum,
	returned_to_name: z.string().min(1).max(200),
	notes: z.string().optional(),
});

export type ReturnLostAndFoundBody = z.infer<
	typeof ReturnLostAndFoundBodySchema
>;

// =====================================================
// HOUSEKEEPING TASK STATUS
// =====================================================

/**
 * Status of a housekeeping task.
 *
 * @database housekeeping_tasks.status — the Postgres enum type
 * `housekeeping_status`, which is why the column carries no CHECK constraint.
 *
 * This is a **room-cleanliness** vocabulary, not a task lifecycle. There is no
 * PENDING, COMPLETED or CANCELLED; the database cannot store them. Both the
 * dashboard summary and `features/housekeeping` were coded against those
 * non-existent values until 2026-08-18 — the dashboard's four housekeeping tiles
 * read zero against real data, and `canComplete`/`canReopen` were inverted.
 * Housekeeping tasks was the only domain here with no status enum to import,
 * which is exactly how the UI drifted. See ui-gaps/17-command-reachability.md.
 *
 * **The values on the wire are lowercase.** `housekeeping-service`'s row mapper
 * lowercases `status` on the way out while the column stores upper, so the list
 * response types `status` as `z.string()` rather than this enum — parsing a
 * response against these values would fail. Compare case-insensitively until the
 * mappers stop case-folding.
 */
export const HousekeepingTaskStatusEnum = z.enum([
	"CLEAN",
	"DIRTY",
	"INSPECTED",
	"IN_PROGRESS",
	"DO_NOT_DISTURB",
]);

export type HousekeepingTaskStatus = z.infer<typeof HousekeepingTaskStatusEnum>;

// =====================================================
// LOST & FOUND ITEM CATEGORIES & STATUSES
// =====================================================

/** Status enum for lost & found items. */
export const LostAndFoundItemStatusEnum = z.enum([
	"registered",
	"stored",
	"claimed",
	"returned",
	"shipped",
	"donated",
	"disposed",
	"lost_again",
	"pending_claim",
]);

/** Category enum for lost & found items. */
export const LostAndFoundItemCategoryEnum = z.enum([
	"electronics",
	"jewelry",
	"clothing",
	"accessories",
	"documents",
	"keys",
	"bags",
	"wallets",
	"phones",
	"laptops",
	"tablets",
	"watches",
	"glasses",
	"books",
	"toys",
	"medical",
	"other",
]);

// =====================================================
// LOST & FOUND CREATE / UPDATE BODIES
// =====================================================

/** Body schema for creating (registering) a new lost & found item. */
export const CreateLostAndFoundBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	item_name: z.string().min(1).max(255),
	item_description: z.string().min(1),
	item_category: LostAndFoundItemCategoryEnum,
	item_subcategory: z.string().max(100).optional(),
	brand: z.string().max(100).optional(),
	color: z.string().max(50).optional(),
	estimated_value: z.number().positive().optional(),
	found_date: isoDateString,
	found_time: z.string().optional(),
	found_by_name: z.string().max(200).optional(),
	found_location: z.string().min(1).max(255),
	room_number: z.string().max(20).optional(),
	area_name: z.string().max(100).optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().max(200).optional(),
	guest_email: z.string().email().optional(),
	reservation_id: uuid.optional(),
	storage_location: z.string().max(255).optional(),
	hold_days: z.number().int().positive().max(365).optional(),
	is_valuable: z.boolean().optional(),
	requires_secure_storage: z.boolean().optional(),
	special_handling_instructions: z.string().optional(),
	internal_notes: z.string().optional(),
});

export type CreateLostAndFoundBody = z.infer<
	typeof CreateLostAndFoundBodySchema
>;

/** Body schema for updating an existing lost & found item. */
export const UpdateLostAndFoundBodySchema = z.object({
	tenant_id: uuid,
	item_name: z.string().min(1).max(255).optional(),
	item_description: z.string().min(1).optional(),
	item_category: LostAndFoundItemCategoryEnum.optional(),
	item_subcategory: z.string().max(100).optional(),
	brand: z.string().max(100).optional(),
	color: z.string().max(50).optional(),
	estimated_value: z.number().positive().optional(),
	storage_location: z.string().max(255).optional(),
	storage_shelf: z.string().max(50).optional(),
	storage_bin: z.string().max(50).optional(),
	item_status: LostAndFoundItemStatusEnum.optional(),
	internal_notes: z.string().optional(),
	staff_comments: z.string().optional(),
	guest_name: z.string().max(200).optional(),
	guest_email: z.string().email().optional(),
	guest_phone: z.string().max(50).optional(),
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	hold_until_date: isoDateString.optional(),
	requires_secure_storage: z.boolean().optional(),
	is_valuable: z.boolean().optional(),
	fragile: z.boolean().optional(),
});

export type UpdateLostAndFoundBody = z.infer<
	typeof UpdateLostAndFoundBodySchema
>;

// -----------------------------------------------------------------------------
// Incident report write contracts
//
// The type/severity/status/injury enums above already match the
// `incident_reports` CHECK constraints, so these bodies reuse them rather than
// restating the values. `created_by` is NOT NULL on that table, so the route
// requires an authenticated actor rather than attributing a record to a
// placeholder.
// -----------------------------------------------------------------------------

export const IncidentInjurySeverityEnum = z.enum([
	"none",
	"minor",
	"moderate",
	"serious",
	"critical",
	"fatal",
]);

/** Report an incident. `incident_number` is generated server-side. */
export const IncidentWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	incident_title: z.string().min(1).max(300),
	incident_type: IncidentTypeEnum,
	severity: IncidentSeverityEnum,
	incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	incident_time: z.string().min(4).max(8),
	incident_location: z.string().min(1).max(255),
	incident_description: z.string().min(1).max(5000),
	immediate_actions_taken: z.string().min(1).max(5000),
	incident_category: z.string().max(100).optional(),
	room_number: z.string().max(50).optional(),
	area_name: z.string().max(100).optional(),
	guest_involved: z.boolean().optional(),
	staff_involved: z.boolean().optional(),
	injury_severity: IncidentInjurySeverityEnum.optional(),
	police_notified: z.boolean().optional(),
	severity_score: z.coerce.number().int().min(1).max(10).optional(),
	discovered_by_name: z.string().max(255).optional(),
});

export type IncidentWriteBody = z.infer<typeof IncidentWriteBodySchema>;

export const IncidentUpdateBodySchema =
	IncidentWriteBodySchema.partial().extend({
		tenant_id: uuid,
	});

export type IncidentUpdateBody = z.infer<typeof IncidentUpdateBodySchema>;

/**
 * Move an incident through its status. A terminal status stamps
 * closed/closed_at/closed_by, which is how time-to-close stays answerable.
 */
export const IncidentStatusBodySchema = z.object({
	tenant_id: uuid,
	incident_status: IncidentStatusEnum,
	closure_notes: z.string().max(2000).optional(),
});

export type IncidentStatusBody = z.infer<typeof IncidentStatusBodySchema>;

/**
 * Service-layer input for reporting or correcting an incident. `incidentNumber`
 * is generated server-side and the actor is passed separately, because
 * `incident_reports.created_by` is NOT NULL and must come from the request.
 */
export type IncidentWriteInput = {
	propertyId: string;
	incidentTitle: string;
	incidentType: IncidentWriteBody["incident_type"];
	severity: IncidentWriteBody["severity"];
	incidentDate: string;
	incidentTime: string;
	incidentLocation: string;
	incidentDescription: string;
	immediateActionsTaken: string;
	incidentCategory?: string;
	roomNumber?: string;
	areaName?: string;
	guestInvolved?: boolean;
	staffInvolved?: boolean;
	injurySeverity?: IncidentWriteBody["injury_severity"];
	policeNotified?: boolean;
	severityScore?: number;
	discoveredByName?: string;
};

/** Service-layer input for an incident status transition. */
export type IncidentStatusInput = {
	incidentStatus: IncidentStatusBody["incident_status"];
	closureNotes?: string;
};

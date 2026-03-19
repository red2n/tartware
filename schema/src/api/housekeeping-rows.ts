/**
 * DEV DOC
 * Module: api/housekeeping-rows.ts
 * Purpose: Raw PostgreSQL row shapes for housekeeping-service query results.
 * Ownership: Schema package
 */

// =====================================================
// HOUSEKEEPING TASK ROW
// =====================================================

/** Raw row shape from housekeeping_tasks table query. */
export type HousekeepingTaskRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	room_number: string;
	task_type: string;
	priority: string | null;
	status: string | null;
	assigned_to: string | null;
	assigned_at: string | Date | null;
	scheduled_date: string | Date;
	scheduled_time: string | null;
	started_at: string | Date | null;
	completed_at: string | Date | null;
	inspected_by: string | null;
	inspected_at: string | Date | null;
	inspection_passed: boolean | null;
	is_guest_request: boolean | null;
	special_instructions: string | null;
	notes: string | null;
	issues_found: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string | Date;
	updated_at: string | Date | null;
	version: bigint | null;
	credits: number | string | null;
};

// =====================================================
// DEEP CLEAN DUE ROW
// =====================================================

/** Raw row shape from deep-clean-due rooms query. */
export type DeepCleanDueRow = {
	room_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	room_number: string;
	room_type_name: string | null;
	floor: string | null;
	status: string;
	housekeeping_status: string;
	last_deep_clean_date: string | Date | null;
	deep_clean_interval_days: number | string;
	days_since_deep_clean: number | string | null;
	days_overdue: number | string | null;
};

// =====================================================
// MAINTENANCE REQUEST ROW
// =====================================================

/** Raw row shape from maintenance_requests table query. */
export type MaintenanceRequestRow = {
	request_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	request_number: string | null;
	request_type: string;
	request_status: string;
	priority: string;
	room_id: string | null;
	room_number: string | null;
	location_description: string | null;
	location_type: string | null;
	issue_category: string;
	issue_subcategory: string | null;
	issue_description: string;
	affects_occupancy: boolean;
	affects_guest_comfort: boolean;
	is_safety_issue: boolean;
	is_health_issue: boolean;
	reported_at: string | Date;
	reported_by: string;
	reporter_role: string | null;
	assigned_to: string | null;
	assigned_at: string | Date | null;
	maintenance_team: string | null;
	scheduled_date: string | Date | null;
	estimated_duration_minutes: number | null;
	work_started_at: string | Date | null;
	work_completed_at: string | Date | null;
	actual_duration_minutes: number | null;
	work_performed: string | null;
	total_cost: number | string | null;
	currency_code: string;
	room_out_of_service: boolean;
	oos_from: string | Date | null;
	oos_until: string | Date | null;
	response_time_minutes: number | null;
	resolution_time_hours: number | null;
	is_within_sla: boolean | null;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// INCIDENT REPORT ROW
// =====================================================

/** Raw row shape from incident_reports table query. */
export type IncidentReportRow = {
	incident_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	incident_number: string;
	incident_title: string;
	incident_type: string;
	incident_category: string | null;
	severity: string;
	severity_score: number | null;
	incident_datetime: string | Date;
	incident_date: string | Date;
	incident_time: string;
	incident_location: string;
	room_number: string | null;
	floor_number: number | null;
	area_name: string | null;
	guest_involved: boolean;
	staff_involved: boolean;
	third_party_involved: boolean;
	witness_count: number;
	injuries_sustained: boolean;
	injury_severity: string | null;
	medical_attention_required: boolean;
	property_damage: boolean;
	estimated_damage_cost: number | string | null;
	incident_status: string;
	investigation_required: boolean;
	investigation_completed: boolean;
	police_notified: boolean;
	police_report_number: string | null;
	insurance_claim_filed: boolean;
	insurance_claim_number: string | null;
	created_at: string | Date;
	updated_at: string | Date | null;
	created_by: string;
};

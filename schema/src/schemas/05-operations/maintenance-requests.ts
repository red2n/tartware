/**
 * MaintenanceRequests Schema
 * @table maintenance_requests
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MaintenanceRequests schema
 */
export const MaintenanceRequestsSchema = z.object({
	request_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	request_number: z.string().optional(),
	request_type: z.string(),
	request_status: z.string(),
	priority: z.string(),
	room_id: uuid.optional(),
	room_number: z.string().optional(),
	location_description: z.string().optional(),
	location_type: z.string().optional(),
	issue_category: z.string(),
	issue_subcategory: z.string().optional(),
	issue_description: z.string(),
	affects_occupancy: z.boolean().optional(),
	affects_guest_comfort: z.boolean().optional(),
	is_safety_issue: z.boolean().optional(),
	is_health_issue: z.boolean().optional(),
	reported_at: z.coerce.date().optional(),
	reported_by: uuid,
	reporter_role: z.string().optional(),
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	assigned_to: uuid.optional(),
	assigned_at: z.coerce.date().optional(),
	assigned_by: uuid.optional(),
	maintenance_team: z.string().optional(),
	scheduled_date: z.coerce.date().optional(),
	scheduled_time: z.string().optional(),
	estimated_duration_minutes: z.number().int().optional(),
	requires_room_vacant: z.boolean().optional(),
	requires_specialist: z.boolean().optional(),
	specialist_type: z.string().optional(),
	work_started_at: z.coerce.date().optional(),
	work_completed_at: z.coerce.date().optional(),
	actual_duration_minutes: z.number().int().optional(),
	work_performed: z.string().optional(),
	parts_used: z.array(z.string()).optional(),
	materials_used: z.string().optional(),
	labor_cost: money.optional(),
	parts_cost: money.optional(),
	total_cost: money.optional(),
	currency_code: z.string().optional(),
	is_warranty_work: z.boolean().optional(),
	warranty_notes: z.string().optional(),
	requires_vendor: z.boolean().optional(),
	vendor_name: z.string().optional(),
	vendor_contact: z.string().optional(),
	vendor_cost: money.optional(),
	po_number: z.string().optional(),
	room_out_of_service: z.boolean().optional(),
	oos_from: z.coerce.date().optional(),
	oos_until: z.coerce.date().optional(),
	actual_oos_duration_hours: z.number().int().optional(),
	requires_follow_up: z.boolean().optional(),
	follow_up_date: z.coerce.date().optional(),
	follow_up_notes: z.string().optional(),
	verified_at: z.coerce.date().optional(),
	verified_by: uuid.optional(),
	verification_notes: z.string().optional(),
	is_satisfactory: z.boolean().optional(),
	is_recurring_issue: z.boolean().optional(),
	previous_request_id: uuid.optional(),
	recurrence_count: z.number().int().optional(),
	root_cause_analysis: z.string().optional(),
	is_scheduled_maintenance: z.boolean().optional(),
	maintenance_schedule_id: uuid.optional(),
	next_maintenance_date: z.coerce.date().optional(),
	guest_notified: z.boolean().optional(),
	notification_sent_at: z.coerce.date().optional(),
	apology_issued: z.boolean().optional(),
	compensation_offered: z.boolean().optional(),
	compensation_amount: money.optional(),
	response_time_minutes: z.number().int().optional(),
	resolution_time_hours: z.number().int().optional(),
	is_within_sla: z.boolean().optional(),
	sla_target_hours: z.number().int().optional(),
	sla_notes: z.string().optional(),
	photo_urls: z.array(z.string()).optional(),
	document_urls: z.array(z.string()).optional(),
	is_escalated: z.boolean().optional(),
	escalated_at: z.coerce.date().optional(),
	escalated_to: uuid.optional(),
	escalation_reason: z.string().optional(),
	completed_at: z.coerce.date().optional(),
	completed_by: uuid.optional(),
	completion_notes: z.string().optional(),
	cancelled_at: z.coerce.date().optional(),
	cancelled_by: uuid.optional(),
	cancellation_reason: z.string().optional(),
	asset_id: uuid.optional(),
	asset_tag: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type MaintenanceRequests = z.infer<typeof MaintenanceRequestsSchema>;

/**
 * Schema for creating a new maintenance requests
 */
export const CreateMaintenanceRequestsSchema = MaintenanceRequestsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMaintenanceRequests = z.infer<
	typeof CreateMaintenanceRequestsSchema
>;

/**
 * Schema for updating a maintenance requests
 */
export const UpdateMaintenanceRequestsSchema =
	MaintenanceRequestsSchema.partial();

export type UpdateMaintenanceRequests = z.infer<
	typeof UpdateMaintenanceRequestsSchema
>;

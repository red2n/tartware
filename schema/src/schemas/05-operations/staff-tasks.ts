/**
 * StaffTasks Schema
 * @table staff_tasks
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete StaffTasks schema
 */
export const StaffTasksSchema = z.object({
	task_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	task_number: z.string().optional(),
	task_title: z.string(),
	task_description: z.string().optional(),
	task_type: z.string(),
	task_category: z.string().optional(),
	task_subcategory: z.string().optional(),
	assigned_to: uuid.optional(),
	assigned_department: z.string().optional(),
	assigned_team: z.string().optional(),
	assigned_by: uuid.optional(),
	assigned_at: z.coerce.date().optional(),
	can_be_delegated: z.boolean().optional(),
	delegated_from: uuid.optional(),
	delegation_level: z.number().int().optional(),
	priority: z.string(),
	urgency_score: z.number().int().optional(),
	is_urgent: z.boolean().optional(),
	task_status: z.string().optional(),
	progress_percent: z.number().int().optional(),
	due_date: z.coerce.date().optional(),
	due_time: z.string().optional(),
	scheduled_start_time: z.coerce.date().optional(),
	scheduled_end_time: z.coerce.date().optional(),
	estimated_duration_minutes: z.number().int().optional(),
	actual_start_time: z.coerce.date().optional(),
	actual_end_time: z.coerce.date().optional(),
	actual_duration_minutes: z.number().int().optional(),
	location_type: z.string().optional(),
	room_id: uuid.optional(),
	room_number: z.string().optional(),
	floor_number: z.number().int().optional(),
	area_name: z.string().optional(),
	specific_location: z.string().optional(),
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	maintenance_request_id: uuid.optional(),
	housekeeping_task_id: uuid.optional(),
	required_skills: z.array(z.string()).optional(),
	required_equipment: z.array(z.string()).optional(),
	required_supplies: z.record(z.unknown()).optional(),
	safety_requirements: z.string().optional(),
	instructions: z.string().optional(),
	step_by_step_guide: z.record(z.unknown()).optional(),
	special_instructions: z.string().optional(),
	safety_notes: z.string().optional(),
	has_checklist: z.boolean().optional(),
	checklist_items: z.record(z.unknown()).optional(),
	checklist_completed_count: z.number().int().optional(),
	checklist_total_count: z.number().int().optional(),
	accepted: z.boolean().optional(),
	accepted_by: uuid.optional(),
	accepted_at: z.coerce.date().optional(),
	rejection_reason: z.string().optional(),
	completed: z.boolean().optional(),
	completed_by: uuid.optional(),
	completed_at: z.coerce.date().optional(),
	completion_notes: z.string().optional(),
	requires_verification: z.boolean().optional(),
	verified: z.boolean().optional(),
	verified_by: uuid.optional(),
	verified_at: z.coerce.date().optional(),
	verification_notes: z.string().optional(),
	verification_passed: z.boolean().optional(),
	quality_rating: z.number().int().optional(),
	quality_notes: z.string().optional(),
	efficiency_rating: z.number().int().optional(),
	is_overdue: z.boolean().optional(),
	overdue_by_minutes: z.number().int().optional(),
	depends_on_tasks: z.array(uuid).optional(),
	blocks_tasks: z.array(uuid).optional(),
	all_dependencies_met: z.boolean().optional(),
	is_recurring: z.boolean().optional(),
	recurrence_pattern: z.string().optional(),
	recurrence_days: z.array(z.string()).optional(),
	recurrence_time: z.string().optional(),
	recurrence_end_date: z.coerce.date().optional(),
	parent_task_id: uuid.optional(),
	has_issues: z.boolean().optional(),
	issues: z.record(z.unknown()).optional(),
	is_blocked: z.boolean().optional(),
	blocked_reason: z.string().optional(),
	blocked_at: z.coerce.date().optional(),
	blocked_by: uuid.optional(),
	photos_required: z.boolean().optional(),
	photos_count: z.number().int().optional(),
	photo_urls: z.array(z.string()).optional(),
	documents_attached: z.boolean().optional(),
	document_urls: z.array(z.string()).optional(),
	estimated_cost: money.optional(),
	actual_cost: money.optional(),
	materials_cost: money.optional(),
	labor_cost: money.optional(),
	guest_facing: z.boolean().optional(),
	guest_satisfaction_impact: z.string().optional(),
	guest_notification_required: z.boolean().optional(),
	guest_notified: z.boolean().optional(),
	notification_sent: z.boolean().optional(),
	notification_sent_at: z.coerce.date().optional(),
	reminder_sent: z.boolean().optional(),
	reminder_sent_at: z.coerce.date().optional(),
	escalation_sent: z.boolean().optional(),
	escalated_to: uuid.optional(),
	escalated_at: z.coerce.date().optional(),
	comments_count: z.number().int().optional(),
	last_comment_at: z.coerce.date().optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	sla_hours: z.number().int().optional(),
	sla_due_at: z.coerce.date().optional(),
	sla_breached: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type StaffTasks = z.infer<typeof StaffTasksSchema>;

/**
 * Schema for creating a new staff tasks
 */
export const CreateStaffTasksSchema = StaffTasksSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateStaffTasks = z.infer<typeof CreateStaffTasksSchema>;

/**
 * Schema for updating a staff tasks
 */
export const UpdateStaffTasksSchema = StaffTasksSchema.partial();

export type UpdateStaffTasks = z.infer<typeof UpdateStaffTasksSchema>;

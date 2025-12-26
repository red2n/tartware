/**
 * ShiftHandovers Schema
 * @table shift_handovers
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ShiftHandovers schema
 */
export const ShiftHandoversSchema = z.object({
	handover_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	handover_number: z.string().optional(),
	handover_title: z.string().optional(),
	shift_date: z.coerce.date(),
	outgoing_shift: z.string(),
	outgoing_shift_start: z.string().optional(),
	outgoing_shift_end: z.string().optional(),
	outgoing_user_id: uuid,
	outgoing_user_name: z.string().optional(),
	incoming_shift: z.string(),
	incoming_shift_start: z.string().optional(),
	incoming_shift_end: z.string().optional(),
	incoming_user_id: uuid,
	incoming_user_name: z.string().optional(),
	department: z.string(),
	handover_status: z.string().optional(),
	handover_started_at: z.coerce.date().optional(),
	handover_completed_at: z.coerce.date().optional(),
	handover_duration_minutes: z.number().int().optional(),
	current_occupancy_count: z.number().int().optional(),
	current_occupancy_percent: money.optional(),
	expected_arrivals_count: z.number().int().optional(),
	expected_departures_count: z.number().int().optional(),
	in_house_guests_count: z.number().int().optional(),
	rooms_occupied: z.number().int().optional(),
	rooms_vacant_clean: z.number().int().optional(),
	rooms_vacant_dirty: z.number().int().optional(),
	rooms_out_of_order: z.number().int().optional(),
	rooms_blocked: z.number().int().optional(),
	reservations_arriving_today: z.number().int().optional(),
	reservations_departing_today: z.number().int().optional(),
	reservations_in_house: z.number().int().optional(),
	vip_guests_in_house: z.number().int().optional(),
	group_reservations_active: z.number().int().optional(),
	tasks_pending: z.number().int().optional(),
	tasks_urgent: z.number().int().optional(),
	tasks_overdue: z.number().int().optional(),
	tasks_completed: z.number().int().optional(),
	tasks_details: z.record(z.unknown()).optional(),
	key_points: z.string(),
	important_notes: z.string().optional(),
	urgent_matters: z.string().optional(),
	guest_issues: z.record(z.unknown()).optional(),
	guest_complaints_count: z.number().int().optional(),
	guest_requests_pending: z.number().int().optional(),
	guest_special_attention: z.record(z.unknown()).optional(),
	vip_arrivals: z.record(z.unknown()).optional(),
	vip_in_house: z.record(z.unknown()).optional(),
	vip_departures: z.record(z.unknown()).optional(),
	maintenance_issues: z.record(z.unknown()).optional(),
	equipment_failures: z.record(z.unknown()).optional(),
	safety_concerns: z.record(z.unknown()).optional(),
	inventory_alerts: z.record(z.unknown()).optional(),
	supplies_low: z.boolean().optional(),
	supplies_needed: z.string().optional(),
	cash_on_hand: money.optional(),
	deposits_to_make: money.optional(),
	outstanding_payments: money.optional(),
	payment_issues: z.string().optional(),
	security_incidents: z.record(z.unknown()).optional(),
	safety_issues: z.record(z.unknown()).optional(),
	access_control_notes: z.string().optional(),
	staff_availability: z.record(z.unknown()).optional(),
	staff_issues: z.string().optional(),
	coverage_concerns: z.string().optional(),
	requires_follow_up: z.boolean().optional(),
	follow_up_items: z.record(z.unknown()).optional(),
	follow_up_count: z.number().int().optional(),
	escalated_issues: z.record(z.unknown()).optional(),
	escalation_count: z.number().int().optional(),
	upcoming_events: z.record(z.unknown()).optional(),
	special_situations: z.string().optional(),
	weather_concerns: z.string().optional(),
	handover_checklist: z.record(z.unknown()).optional(),
	checklist_completed: z.boolean().optional(),
	system_status: z.record(z.unknown()).optional(),
	equipment_status: z.record(z.unknown()).optional(),
	technology_issues: z.string().optional(),
	acknowledged: z.boolean().optional(),
	acknowledged_by: uuid.optional(),
	acknowledged_at: z.coerce.date().optional(),
	acknowledgment_notes: z.string().optional(),
	questions_asked: z.string().optional(),
	clarifications_provided: z.string().optional(),
	additional_information: z.string().optional(),
	handover_quality_rating: z.number().int().optional(),
	information_completeness_rating: z.number().int().optional(),
	has_attachments: z.boolean().optional(),
	attachment_urls: z.array(z.string()).optional(),
	photo_urls: z.array(z.string()).optional(),
	reviewed_by_manager: z.boolean().optional(),
	manager_id: uuid.optional(),
	manager_review_notes: z.string().optional(),
	manager_review_at: z.coerce.date().optional(),
	incident_reports: z.array(uuid).optional(),
	maintenance_requests: z.array(uuid).optional(),
	guest_complaints: z.array(uuid).optional(),
	previous_handover_id: uuid.optional(),
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

export type ShiftHandovers = z.infer<typeof ShiftHandoversSchema>;

/**
 * Schema for creating a new shift handovers
 */
export const CreateShiftHandoversSchema = ShiftHandoversSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateShiftHandovers = z.infer<typeof CreateShiftHandoversSchema>;

/**
 * Schema for updating a shift handovers
 */
export const UpdateShiftHandoversSchema = ShiftHandoversSchema.partial();

export type UpdateShiftHandovers = z.infer<typeof UpdateShiftHandoversSchema>;

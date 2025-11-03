/**
 * StaffSchedules Schema
 * @table staff_schedules
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete StaffSchedules schema
 */
export const StaffSchedulesSchema = z.object({
  schedule_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  user_id: uuid,
  staff_name: z.string().optional(),
  employee_number: z.string().optional(),
  department: z.string(),
  role: z.string().optional(),
  position_title: z.string().optional(),
  schedule_date: z.coerce.date(),
  day_of_week: z.string(),
  week_number: z.number().int().optional(),
  shift_type: z.string(),
  shift_name: z.string().optional(),
  scheduled_start_time: z.string(),
  scheduled_end_time: z.string(),
  scheduled_hours: money,
  actual_start_time: z.string().optional(),
  actual_end_time: z.string().optional(),
  actual_hours: money.optional(),
  break_duration_minutes: z.number().int().optional(),
  break_start_time: z.string().optional(),
  break_end_time: z.string().optional(),
  paid_break: z.boolean().optional(),
  work_location: z.string().optional(),
  assigned_area: z.string().optional(),
  work_station: z.string().optional(),
  schedule_status: z.string().optional(),
  checked_in: z.boolean().optional(),
  check_in_time: z.coerce.date().optional(),
  check_in_method: z.string().optional(),
  checked_out: z.boolean().optional(),
  check_out_time: z.coerce.date().optional(),
  check_out_method: z.string().optional(),
  is_late: z.boolean().optional(),
  late_by_minutes: z.number().int().optional(),
  is_early_departure: z.boolean().optional(),
  early_departure_minutes: z.number().int().optional(),
  is_overtime: z.boolean().optional(),
  overtime_hours: money.optional(),
  overtime_approved: z.boolean().optional(),
  overtime_approved_by: uuid.optional(),
  overtime_rate_multiplier: money.optional(),
  is_holiday: z.boolean().optional(),
  holiday_name: z.string().optional(),
  holiday_pay_multiplier: money.optional(),
  is_weekend: z.boolean().optional(),
  weekend_pay_multiplier: money.optional(),
  is_replacement_shift: z.boolean().optional(),
  replacing_user_id: uuid.optional(),
  replacement_reason: z.string().optional(),
  is_covered: z.boolean().optional(),
  coverage_confirmed: z.boolean().optional(),
  is_swap_request: z.boolean().optional(),
  swap_requested_by: uuid.optional(),
  swap_requested_with: uuid.optional(),
  swap_status: z.string().optional(),
  swap_approved_by: uuid.optional(),
  swap_approved_at: z.coerce.date().optional(),
  assigned_tasks: z.record(z.unknown()).optional(),
  tasks_count: z.number().int().optional(),
  tasks_completed: z.number().int().optional(),
  special_instructions: z.string().optional(),
  notes: z.string().optional(),
  manager_notes: z.string().optional(),
  performance_rating: z.number().int().optional(),
  performance_notes: z.string().optional(),
  incidents_reported: z.number().int().optional(),
  has_conflicts: z.boolean().optional(),
  conflict_reasons: z.array(z.string()).optional(),
  conflict_resolved: z.boolean().optional(),
  availability_status: z.string().optional(),
  unavailability_reason: z.string().optional(),
  is_leave: z.boolean().optional(),
  leave_type: z.string().optional(),
  leave_approved: z.boolean().optional(),
  leave_approved_by: uuid.optional(),
  payroll_code: z.string().optional(),
  cost_center: z.string().optional(),
  hourly_rate: money.optional(),
  estimated_cost: money.optional(),
  actual_cost: money.optional(),
  notification_sent: z.boolean().optional(),
  notification_sent_at: z.coerce.date().optional(),
  reminder_sent: z.boolean().optional(),
  reminder_sent_at: z.coerce.date().optional(),
  is_published: z.boolean().optional(),
  published_at: z.coerce.date().optional(),
  published_by: uuid.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.string().optional(),
  recurrence_end_date: z.coerce.date().optional(),
  parent_schedule_id: uuid.optional(),
  requires_approval: z.boolean().optional(),
  approved: z.boolean().optional(),
  approved_by: uuid.optional(),
  approved_at: z.coerce.date().optional(),
  approval_notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type StaffSchedules = z.infer<typeof StaffSchedulesSchema>;

/**
 * Schema for creating a new staff schedules
 */
export const CreateStaffSchedulesSchema = StaffSchedulesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateStaffSchedules = z.infer<typeof CreateStaffSchedulesSchema>;

/**
 * Schema for updating a staff schedules
 */
export const UpdateStaffSchedulesSchema = StaffSchedulesSchema.partial();

export type UpdateStaffSchedules = z.infer<typeof UpdateStaffSchedulesSchema>;

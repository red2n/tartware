/**
 * HousekeepingTasks Schema
 * @table housekeeping_tasks
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';
import { HousekeepingStatusEnum } from '../../shared/enums.js';

/**
 * Complete HousekeepingTasks schema
 */
export const HousekeepingTasksSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  room_number: z.string(),
  task_type: z.string(),
  priority: z.string().optional(),
  status: HousekeepingStatusEnum,
  assigned_to: uuid.optional(),
  assigned_at: z.coerce.date().optional(),
  scheduled_date: z.coerce.date(),
  scheduled_time: z.string().optional(),
  started_at: z.coerce.date().optional(),
  completed_at: z.coerce.date().optional(),
  inspected_by: uuid.optional(),
  inspected_at: z.coerce.date().optional(),
  inspection_passed: z.boolean().optional(),
  inspection_notes: z.string().optional(),
  is_guest_request: z.boolean().optional(),
  guest_id: uuid.optional(),
  special_instructions: z.string().optional(),
  notes: z.string().optional(),
  issues_found: z.string().optional(),
  credits: money.optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().optional(),
  version: z.bigint().optional(),
});

export type HousekeepingTasks = z.infer<typeof HousekeepingTasksSchema>;

/**
 * Schema for creating a new housekeeping tasks
 */
export const CreateHousekeepingTasksSchema = HousekeepingTasksSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateHousekeepingTasks = z.infer<typeof CreateHousekeepingTasksSchema>;

/**
 * Schema for updating a housekeeping tasks
 */
export const UpdateHousekeepingTasksSchema = HousekeepingTasksSchema.partial();

export type UpdateHousekeepingTasks = z.infer<typeof UpdateHousekeepingTasksSchema>;

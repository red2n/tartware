/**
 * DEV DOC
 * Module: housekeeping-task-repository.ts
 * Purpose: Housekeeping task writes and the room lookup they label tasks with.
 * Ownership: housekeeping-service
 *
 * Lifted verbatim out of `services/housekeeping-command-service.ts`.
 */

import { query } from "../lib/db.js";

const ASSIGN_TASK_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        assigned_to = $3::uuid,
        assigned_at = NOW(),
        status = CASE
          WHEN status IN ('CLEAN', 'INSPECTED') THEN status
          ELSE 'IN_PROGRESS'
        END,
        priority = COALESCE($4, priority),
        notes = CASE
          WHEN $5::text IS NULL THEN notes
          WHEN notes IS NULL THEN $5::text
          ELSE CONCAT_WS(E'\\n', notes, $5::text)
        END,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const COMPLETE_TASK_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        status = $4::housekeeping_status,
        completed_by = $3::uuid,
        completed_at = NOW(),
        notes = CASE
          WHEN $5::text IS NULL THEN notes
          WHEN notes IS NULL THEN $5::text
          ELSE CONCAT_WS(E'\\n', notes, $5::text)
        END,
        inspection_passed = $6,
        inspected_by = $7::uuid,
        inspected_at = CASE WHEN $7 IS NOT NULL THEN NOW() ELSE inspected_at END,
        inspection_notes = COALESCE($8, inspection_notes),
        updated_at = NOW(),
        updated_by = $9
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_ROOM_NUMBER_SQL = `
      SELECT room_number
      FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

const CREATE_TASK_SQL = `
      INSERT INTO public.housekeeping_tasks (
        tenant_id,
        property_id,
        room_number,
        task_type,
        priority,
        status,
        assigned_to,
        assigned_at,
        scheduled_date,
        notes,
        metadata,
        created_at,
        updated_at,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        COALESCE($5, 'normal'),
        'DIRTY',
        $6::uuid,
        CASE WHEN $6::uuid IS NULL THEN NULL ELSE NOW() END,
        COALESCE($7::date, CURRENT_DATE),
        $8,
        $9::jsonb,
        NOW(),
        NOW(),
        $10,
        $10
      )
      RETURNING id
    `;

const REASSIGN_TASK_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        assigned_to = $3::uuid,
        assigned_at = NOW(),
        status = CASE
          WHEN status IN ('CLEAN', 'INSPECTED') THEN status
          ELSE 'IN_PROGRESS'
        END,
        notes = CASE
          WHEN $4::text IS NULL THEN notes
          WHEN notes IS NULL THEN $4::text
          ELSE CONCAT_WS(E'\\n', notes, $4::text)
        END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const MARK_TASK_DIRTY_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        status = 'DIRTY',
        completed_at = NULL,
        inspection_passed = NULL,
        inspected_by = NULL,
        inspected_at = NULL,
        inspection_notes = NULL,
        notes = CASE
          WHEN $3::text IS NULL THEN notes
          WHEN notes IS NULL THEN $3::text
          ELSE CONCAT_WS(E'\\n', notes, $3::text)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const APPEND_TASK_NOTE_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        notes = CASE
          WHEN notes IS NULL THEN $3::text
          ELSE CONCAT_WS(E'\\n', notes, $3::text)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const BULK_UPDATE_TASK_STATUS_SQL = `
      UPDATE public.housekeeping_tasks
      SET
        status = $2::housekeeping_status,
        notes = CASE
          WHEN $3::text IS NULL THEN notes
          WHEN notes IS NULL THEN $3::text
          ELSE CONCAT_WS(E'\\n', notes, $3::text)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = ANY($5::uuid[])
        AND COALESCE(is_deleted, false) = false
    `;

/**
 * Assign a task to a staff member.
 */
export const assignTask = (
  tenantId: string,
  taskId: string,
  assignedTo: string,
  priority: string | null,
  notes: string | null,
  actorId: string,
) => query(ASSIGN_TASK_SQL, [tenantId, taskId, assignedTo, priority, notes, actorId]);

/**
 * Close a task, recording the inspection outcome.
 */
export const completeTask = (
  tenantId: string,
  taskId: string,
  completedBy: string,
  inspectedStatus: string,
  notes: string | null,
  inspectionPassed: boolean | null,
  inspectedBy: string | null,
  inspectionNotes: string | null,
  actorId: string,
) =>
  query(COMPLETE_TASK_SQL, [
    tenantId,
    taskId,
    completedBy,
    inspectedStatus,
    notes,
    inspectionPassed,
    inspectedBy,
    inspectionNotes,
    actorId,
  ]);

/**
 * A room's display number, used to label a task.
 */
export const findRoomNumber = (tenantId: string, roomId: string) =>
  query<{ room_number: string | null }>(FIND_ROOM_NUMBER_SQL, [tenantId, roomId]);

/**
 * Create a housekeeping task.
 */
export const createTask = (
  tenantId: string,
  propertyId: string,
  roomNumber: string | null,
  taskType: string,
  priority: string | null,
  assignedTo: string | null,
  scheduledDate: string | Date | null,
  notes: string | null,
  metadata: string,
  actorId: string,
) =>
  query<{ id: string }>(CREATE_TASK_SQL, [
    tenantId,
    propertyId,
    roomNumber,
    taskType,
    priority,
    assignedTo,
    scheduledDate,
    notes,
    metadata,
    actorId,
  ]);

/**
 * Move a task to a different staff member.
 */
export const reassignTask = (
  tenantId: string,
  taskId: string,
  assignedTo: string,
  reason: string | null,
  actorId: string,
) => query(REASSIGN_TASK_SQL, [tenantId, taskId, assignedTo, reason, actorId]);

/**
 * Reopen a task by returning the room to dirty.
 */
export const markTaskDirty = (
  tenantId: string,
  taskId: string,
  reason: string | null,
  actorId: string,
) => query(MARK_TASK_DIRTY_SQL, [tenantId, taskId, reason, actorId]);

/**
 * Append a note to a task without altering its status.
 */
export const appendTaskNote = (tenantId: string, taskId: string, note: string, actorId: string) =>
  query(APPEND_TASK_NOTE_SQL, [tenantId, taskId, note, actorId]);

/**
 * Apply one status to several tasks in a single statement.
 */
export const bulkUpdateTaskStatus = (
  tenantId: string,
  status: string,
  notes: string | null,
  actorId: string,
  taskIds: string[],
) => query(BULK_UPDATE_TASK_STATUS_SQL, [tenantId, status, notes, actorId, taskIds]);

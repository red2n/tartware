/**
 * DEV DOC
 * Module: staff-schedule-repository.ts
 * Purpose: Staff schedule writes.
 * Ownership: housekeeping-service
 *
 * Lifted verbatim out of `services/schedule-command-service.ts`. The partial
 * update stays in the service: it builds its SET clause from whichever fields
 * were supplied, so that statement is assembled, not stored.
 */

import type { CommandContext, OperationsScheduleCreateCommand } from "@tartware/schemas";

import { query } from "../lib/db.js";

const INSERT_STAFF_SCHEDULE_SQL = `
      INSERT INTO public.staff_schedules (
        tenant_id,
        property_id,
        user_id,
        department,
        role,
        schedule_date,
        day_of_week,
        shift_type,
        shift_name,
        scheduled_start_time,
        scheduled_end_time,
        scheduled_hours,
        work_location,
        assigned_area,
        schedule_status,
        notes,
        metadata,
        created_at,
        updated_at,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6::date,
        $7,
        $8,
        $9,
        $10::time,
        $11::time,
        $12,
        $13,
        $14,
        'scheduled',
        $15,
        COALESCE($16::jsonb, '{}'::jsonb),
        NOW(),
        NOW(),
        $17,
        $17
      )
      RETURNING schedule_id
    `;

/**
 * Create a staff schedule entry.
 */
export const insertStaffSchedule = (
  context: CommandContext,
  command: OperationsScheduleCreateCommand,
  actor: string,
  dayOfWeekLabel: string,
) =>
  query<{ schedule_id: string }>(INSERT_STAFF_SCHEDULE_SQL, [
    context.tenantId,
    command.property_id,
    command.user_id,
    command.department,
    command.role ?? null,
    command.schedule_date,
    dayOfWeekLabel,
    command.shift_type,
    command.shift_name ?? null,
    command.scheduled_start_time,
    command.scheduled_end_time,
    command.scheduled_hours,
    command.work_location ?? null,
    command.assigned_area ?? null,
    command.notes ?? null,
    command.metadata ? JSON.stringify(command.metadata) : null,
    actor,
  ]);

import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { insertStaffSchedule } from "../repositories/staff-schedule-repository.js";
import {
  type OperationsScheduleCreateCommand,
  OperationsScheduleCreateCommandSchema,
  type OperationsScheduleUpdateCommand,
  OperationsScheduleUpdateCommandSchema,
} from "../schemas/schedule-commands.js";

/**
 * ScheduleCommandError — see {@link CommandError} for the `retryable` contract the
 * command consumer reads when deciding retry vs DLQ.
 */
class ScheduleCommandError extends CommandError {}

const dayOfWeek = (dateStr: string): string => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = new Date(`${dateStr}T00:00:00Z`);
  return days[d.getUTCDay()] ?? "Monday";
};

/**
 * Create a new staff schedule entry.
 */
export const createStaffSchedule = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = OperationsScheduleCreateCommandSchema.parse(payload);
  return applyCreate(command, context);
};

/**
 * Update an existing staff schedule entry.
 */
export const updateStaffSchedule = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = OperationsScheduleUpdateCommandSchema.parse(payload);
  await applyUpdate(command, context);
};

const applyCreate = async (
  command: OperationsScheduleCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);

  const { rows } = await insertStaffSchedule(
    context,
    command,
    actor,
    dayOfWeek(command.schedule_date),
  );

  const scheduleId = rows[0]?.schedule_id;
  if (!scheduleId) {
    throw new ScheduleCommandError(
      "SCHEDULE_CREATE_FAILED",
      "Unable to create staff schedule entry.",
    );
  }
  return scheduleId;
};

const applyUpdate = async (
  command: OperationsScheduleUpdateCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = resolveActorId(context.initiatedBy);

  const setClauses: string[] = [];
  const params: unknown[] = [context.tenantId, command.schedule_id, command.property_id];
  let idx = 4;

  if (command.shift_type !== undefined) {
    setClauses.push(`shift_type = $${idx}`);
    params.push(command.shift_type);
    idx++;
  }
  if (command.scheduled_start_time !== undefined) {
    setClauses.push(`scheduled_start_time = $${idx}::time`);
    params.push(command.scheduled_start_time);
    idx++;
  }
  if (command.scheduled_end_time !== undefined) {
    setClauses.push(`scheduled_end_time = $${idx}::time`);
    params.push(command.scheduled_end_time);
    idx++;
  }
  if (command.scheduled_hours !== undefined) {
    setClauses.push(`scheduled_hours = $${idx}`);
    params.push(command.scheduled_hours);
    idx++;
  }
  if (command.schedule_status !== undefined) {
    setClauses.push(`schedule_status = $${idx}`);
    params.push(command.schedule_status);
    idx++;
  }
  if (command.role !== undefined) {
    setClauses.push(`role = $${idx}`);
    params.push(command.role);
    idx++;
  }
  if (command.shift_name !== undefined) {
    setClauses.push(`shift_name = $${idx}`);
    params.push(command.shift_name);
    idx++;
  }
  if (command.work_location !== undefined) {
    setClauses.push(`work_location = $${idx}`);
    params.push(command.work_location);
    idx++;
  }
  if (command.assigned_area !== undefined) {
    setClauses.push(`assigned_area = $${idx}`);
    params.push(command.assigned_area);
    idx++;
  }
  if (command.notes !== undefined) {
    setClauses.push(
      `notes = CASE WHEN notes IS NULL THEN $${idx}::text ELSE CONCAT_WS(E'\\n', notes, $${idx}::text) END`,
    );
    params.push(command.notes);
    idx++;
  }

  if (setClauses.length === 0) {
    return;
  }

  setClauses.push(`updated_at = NOW()`);
  setClauses.push(`updated_by = $${idx}`);
  params.push(actor);

  const { rowCount } = await query(
    `
      UPDATE public.staff_schedules
      SET ${setClauses.join(", ")}
      WHERE tenant_id = $1::uuid
        AND schedule_id = $2::uuid
        AND property_id = $3::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    params,
  );

  if (!rowCount || rowCount === 0) {
    throw new ScheduleCommandError(
      "SCHEDULE_NOT_FOUND",
      "Unable to update the requested staff schedule.",
    );
  }
};

import { query } from "../lib/db.js";
import {
  type HousekeepingAssignCommand,
  HousekeepingAssignCommandSchema,
  type HousekeepingCompleteCommand,
  HousekeepingCompleteCommandSchema,
  type HousekeepingTaskAddNoteCommand,
  HousekeepingTaskAddNoteCommandSchema,
  type HousekeepingTaskBulkStatusCommand,
  HousekeepingTaskBulkStatusCommandSchema,
  type HousekeepingTaskCreateCommand,
  HousekeepingTaskCreateCommandSchema,
  type HousekeepingTaskReassignCommand,
  HousekeepingTaskReassignCommandSchema,
  type HousekeepingTaskReopenCommand,
  HousekeepingTaskReopenCommandSchema,
} from "../schemas/housekeeping-commands.js";

type CommandContext = {
  tenantId: string;
  initiatedBy?: {
    userId?: string;
  } | null;
};

class HousekeepingCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const APP_ACTOR = "COMMAND_CENTER";

export const assignHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingAssignCommandSchema.parse(payload);
  await applyAssignment(command, context);
};

export const completeHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingCompleteCommandSchema.parse(payload);
  await applyCompletion(command, context);
};

export const createHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = HousekeepingTaskCreateCommandSchema.parse(payload);
  return applyCreate(command, context);
};

export const reassignHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskReassignCommandSchema.parse(payload);
  await applyReassign(command, context);
};

export const reopenHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskReopenCommandSchema.parse(payload);
  await applyReopen(command, context);
};

export const addHousekeepingTaskNote = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskAddNoteCommandSchema.parse(payload);
  await applyAddNote(command, context);
};

export const bulkUpdateHousekeepingStatus = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskBulkStatusCommandSchema.parse(payload);
  await applyBulkStatus(command, context);
};

const applyAssignment = async (
  command: HousekeepingAssignCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        assigned_to = $3::uuid,
        assigned_at = NOW(),
        status = 'IN_PROGRESS',
        priority = COALESCE($4, priority),
        notes = CASE
          WHEN $5 IS NULL THEN notes
          WHEN notes IS NULL THEN $5
          ELSE CONCAT_WS(E'\\n', notes, $5)
        END,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.task_id,
      command.assigned_to,
      command.priority ?? null,
      command.notes ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to assign the requested housekeeping task.",
    );
  }
};

const applyCompletion = async (
  command: HousekeepingCompleteCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const inspectionPassed = command.inspection?.passed ?? null;
  const inspectedStatus = inspectionPassed === true ? "INSPECTED" : "CLEAN";
  const inspectedBy = command.inspection?.inspected_by ?? null;
  const inspectionNotes = command.inspection?.notes ?? null;

  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        status = $4::housekeeping_status,
        completed_by = $3::uuid,
        completed_at = NOW(),
        notes = CASE
          WHEN $5 IS NULL THEN notes
          WHEN notes IS NULL THEN $5
          ELSE CONCAT_WS(E'\\n', notes, $5)
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
    `,
    [
      context.tenantId,
      command.task_id,
      command.completed_by ?? actor,
      inspectedStatus,
      command.notes ?? null,
      inspectionPassed,
      inspectedBy,
      inspectionNotes ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to complete the requested housekeeping task.",
    );
  }
};

const lookupRoomNumber = async (
  tenantId: string,
  roomId: string,
): Promise<{ exists: boolean; roomNumber: string | null }> => {
  const { rows } = await query<{ room_number: string | null }>(
    `
      SELECT room_number
      FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [tenantId, roomId],
  );
  if (!rows[0]) {
    return { exists: false, roomNumber: null };
  }
  return { exists: true, roomNumber: rows[0].room_number ?? null };
};

const applyCreate = async (
  command: HousekeepingTaskCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  let roomNumber: string | null = null;
  let roomExists = false;
  if (command.room_id) {
    const lookup = await lookupRoomNumber(context.tenantId, command.room_id);
    roomNumber = lookup.roomNumber;
    roomExists = lookup.exists;
  }
  if (!roomExists) {
    throw new HousekeepingCommandError(
      "ROOM_NOT_FOUND",
      "Unable to locate room for housekeeping task.",
    );
  }
  if (!roomNumber) {
    throw new HousekeepingCommandError(
      "ROOM_NUMBER_MISSING",
      "Room is missing a room number for housekeeping task creation.",
    );
  }

  const { rows } = await query<{ id: string }>(
    `
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
    `,
    [
      context.tenantId,
      command.property_id,
      roomNumber,
      command.task_type,
      command.priority ?? null,
      command.assigned_to ?? null,
      command.scheduled_date ?? null,
      command.notes ?? null,
      JSON.stringify(command.metadata ?? {}),
      actor,
    ],
  );

  const taskId = rows[0]?.id;
  if (!taskId) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_CREATE_FAILED",
      "Unable to create housekeeping task.",
    );
  }
  return taskId;
};

const applyReassign = async (
  command: HousekeepingTaskReassignCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        assigned_to = $3::uuid,
        assigned_at = NOW(),
        status = 'IN_PROGRESS',
        notes = CASE
          WHEN $4 IS NULL THEN notes
          WHEN notes IS NULL THEN $4
          ELSE CONCAT_WS(E'\\n', notes, $4)
        END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.task_id,
      command.assigned_to,
      command.reason ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to reassign the requested housekeeping task.",
    );
  }
};

const applyReopen = async (
  command: HousekeepingTaskReopenCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        status = 'DIRTY',
        completed_at = NULL,
        inspection_passed = NULL,
        inspected_by = NULL,
        inspected_at = NULL,
        inspection_notes = NULL,
        notes = CASE
          WHEN $3 IS NULL THEN notes
          WHEN notes IS NULL THEN $3
          ELSE CONCAT_WS(E'\\n', notes, $3)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [context.tenantId, command.task_id, command.reason ?? null, actor],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to reopen the requested housekeeping task.",
    );
  }
};

const applyAddNote = async (
  command: HousekeepingTaskAddNoteCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        notes = CASE
          WHEN notes IS NULL THEN $3
          ELSE CONCAT_WS(E'\\n', notes, $3)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [context.tenantId, command.task_id, command.note, actor],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to add note to housekeeping task.",
    );
  }
};

const applyBulkStatus = async (
  command: HousekeepingTaskBulkStatusCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.housekeeping_tasks
      SET
        status = $2::housekeeping_status,
        notes = CASE
          WHEN $3 IS NULL THEN notes
          WHEN notes IS NULL THEN $3
          ELSE CONCAT_WS(E'\\n', notes, $3)
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = ANY($5::uuid[])
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.status,
      command.notes ?? null,
      actor,
      command.task_ids,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to update housekeeping tasks.",
    );
  }
};

import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import {
  appendTaskNote,
  assignTask,
  bulkUpdateTaskStatus,
  completeTask,
  createTask,
  findRoomNumber,
  markTaskDirty,
  reassignTask,
} from "../repositories/housekeeping-task-repository.js";
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

/**
 * HousekeepingCommandError — see {@link CommandError} for the `retryable` contract the
 * command consumer reads when deciding retry vs DLQ.
 */
class HousekeepingCommandError extends CommandError {}

/**
 * Assign a housekeeping task to a staff member.
 */
export const assignHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingAssignCommandSchema.parse(payload);
  await applyAssignment(command, context);
};

/**
 * Mark a housekeeping task as completed/inspected.
 */
export const completeHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingCompleteCommandSchema.parse(payload);
  await applyCompletion(command, context);
};

/**
 * Create a new housekeeping task for a room.
 */
export const createHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = HousekeepingTaskCreateCommandSchema.parse(payload);
  return applyCreate(command, context);
};

/**
 * Reassign a housekeeping task to a different staff member.
 */
export const reassignHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskReassignCommandSchema.parse(payload);
  await applyReassign(command, context);
};

/**
 * Reopen a housekeeping task that was previously completed.
 */
export const reopenHousekeepingTask = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskReopenCommandSchema.parse(payload);
  await applyReopen(command, context);
};

/**
 * Add a note to a housekeeping task.
 */
export const addHousekeepingTaskNote = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = HousekeepingTaskAddNoteCommandSchema.parse(payload);
  await applyAddNote(command, context);
};

/**
 * Bulk update housekeeping task status.
 */
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
  const actor = resolveActorId(context.initiatedBy);
  // MED-004: Preserve completed statuses (CLEAN/INSPECTED) when assigning staff
  // Only transition to IN_PROGRESS if task is not already completed
  const { rowCount } = await assignTask(
    context.tenantId,
    command.task_id,
    command.assigned_to,
    command.priority ?? null,
    command.notes ?? null,
    actor,
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
  const actor = resolveActorId(context.initiatedBy);
  const inspectionPassed = command.inspection?.passed ?? null;
  const inspectedStatus = inspectionPassed === true ? "INSPECTED" : "CLEAN";
  const inspectedBy = command.inspection?.inspected_by ?? null;
  const inspectionNotes = command.inspection?.notes ?? null;

  const { rowCount } = await completeTask(
    context.tenantId,
    command.task_id,
    command.completed_by ?? actor,
    inspectedStatus,
    command.notes ?? null,
    inspectionPassed,
    inspectedBy,
    inspectionNotes ?? null,
    actor,
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
  const { rows } = await findRoomNumber(tenantId, roomId);
  if (!rows[0]) {
    return { exists: false, roomNumber: null };
  }
  return { exists: true, roomNumber: rows[0].room_number ?? null };
};

const applyCreate = async (
  command: HousekeepingTaskCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
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

  const { rows } = await createTask(
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
  const actor = resolveActorId(context.initiatedBy);
  // MED-004: Preserve completed statuses (CLEAN/INSPECTED) when reassigning staff
  // Only transition to IN_PROGRESS if task is not already completed
  const { rowCount } = await reassignTask(
    context.tenantId,
    command.task_id,
    command.assigned_to,
    command.reason ?? null,
    actor,
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
  const actor = resolveActorId(context.initiatedBy);
  const { rowCount } = await markTaskDirty(
    context.tenantId,
    command.task_id,
    command.reason ?? null,
    actor,
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
  const actor = resolveActorId(context.initiatedBy);
  const { rowCount } = await appendTaskNote(context.tenantId, command.task_id, command.note, actor);

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
  const actor = resolveActorId(context.initiatedBy);
  const { rowCount } = await bulkUpdateTaskStatus(
    context.tenantId,
    command.status,
    command.notes ?? null,
    actor,
    command.task_ids,
  );

  if (!rowCount || rowCount === 0) {
    throw new HousekeepingCommandError(
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "Unable to update housekeeping tasks.",
    );
  }
};

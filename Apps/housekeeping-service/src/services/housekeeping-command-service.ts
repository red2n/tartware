import { query } from "../lib/db.js";
import {
  type HousekeepingAssignCommand,
  HousekeepingAssignCommandSchema,
  type HousekeepingCompleteCommand,
  HousekeepingCompleteCommandSchema,
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

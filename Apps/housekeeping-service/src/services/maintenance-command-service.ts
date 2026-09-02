import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import {
  type OperationsMaintenanceAssignCommand,
  OperationsMaintenanceAssignCommandSchema,
  type OperationsMaintenanceCompleteCommand,
  OperationsMaintenanceCompleteCommandSchema,
  type OperationsMaintenanceEscalateCommand,
  OperationsMaintenanceEscalateCommandSchema,
  type OperationsMaintenanceRequestCommand,
  OperationsMaintenanceRequestCommandSchema,
} from "@tartware/schemas/events/commands/operations";
import {
  applyMaintenanceAssignment,
  applyMaintenanceCompletion,
  applyMaintenanceEscalation,
  insertMaintenanceRequest,
  markRequestRoomOutOfService,
} from "../repositories/maintenance-repository.js";

/**
 * MaintenanceCommandError — see {@link CommandError} for the `retryable` contract the
 * command consumer reads when deciding retry vs DLQ.
 */
class MaintenanceCommandError extends CommandError {}

/**
 * Create a new maintenance request / work order.
 */
export const createMaintenanceRequest = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command: OperationsMaintenanceRequestCommand =
    OperationsMaintenanceRequestCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rows } = await insertMaintenanceRequest(context, command, actor);

  const requestId = rows[0]?.request_id;
  if (!requestId) {
    throw new MaintenanceCommandError(
      "MAINTENANCE_CREATE_FAILED",
      "Unable to create maintenance request.",
    );
  }

  // If safety issue or emergency, auto-set room out of service
  if (command.is_safety_issue || command.request_type === "EMERGENCY") {
    await markRequestRoomOutOfService(requestId);
  }

  return requestId;
};

/**
 * Assign a maintenance request to a staff member / team.
 */
export const assignMaintenanceRequest = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command: OperationsMaintenanceAssignCommand =
    OperationsMaintenanceAssignCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rowCount } = await applyMaintenanceAssignment(context, command, actor);

  if (!rowCount || rowCount === 0) {
    throw new MaintenanceCommandError(
      "MAINTENANCE_REQUEST_NOT_FOUND",
      "Maintenance request not found.",
    );
  }
};

/**
 * Complete a maintenance request with work details.
 */
export const completeMaintenanceRequest = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command: OperationsMaintenanceCompleteCommand =
    OperationsMaintenanceCompleteCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const totalCost = (command.labor_cost ?? 0) + (command.parts_cost ?? 0) || null;

  const { rowCount } = await applyMaintenanceCompletion(context, command, actor, totalCost);

  if (!rowCount || rowCount === 0) {
    throw new MaintenanceCommandError(
      "MAINTENANCE_COMPLETE_FAILED",
      "Unable to complete maintenance request. It may already be completed or cancelled.",
    );
  }
};

/**
 * Escalate a maintenance request to another person / priority.
 */
export const escalateMaintenanceRequest = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command: OperationsMaintenanceEscalateCommand =
    OperationsMaintenanceEscalateCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rowCount } = await applyMaintenanceEscalation(context, command, actor);

  if (!rowCount || rowCount === 0) {
    throw new MaintenanceCommandError(
      "MAINTENANCE_ESCALATE_FAILED",
      "Unable to escalate maintenance request.",
    );
  }
};

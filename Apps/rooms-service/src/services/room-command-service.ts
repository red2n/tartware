import { query } from "../lib/db.js";
import {
  type RoomInventoryBlockCommand,
  RoomInventoryBlockCommandSchema,
} from "../schemas/room-commands.js";

type CommandContext = {
  tenantId: string;
  initiatedBy?: {
    userId?: string;
  } | null;
};

class RoomCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const APP_ACTOR = "COMMAND_CENTER";

export const handleRoomInventoryCommand = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomInventoryBlockCommandSchema.parse(payload);
  if (command.action === "release") {
    await releaseRoomBlock(command, context);
    return;
  }
  await blockRoom(command, context);
};

const blockRoom = async (
  command: RoomInventoryBlockCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const blockedFrom = command.blocked_from ?? new Date();

  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        is_blocked = TRUE,
        block_reason = COALESCE($3, block_reason),
        blocked_from = $4,
        blocked_until = $5,
        expected_ready_date = $6,
        updated_at = NOW(),
        updated_by = $7
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      `,
    [
      context.tenantId,
      command.room_id,
      command.reason ?? null,
      blockedFrom,
      command.blocked_until ?? null,
      command.expected_ready_date ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to block inventory for the requested room.",
    );
  }
};

const releaseRoomBlock = async (
  command: RoomInventoryBlockCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        is_blocked = FALSE,
        block_reason = NULL,
        blocked_from = NULL,
        blocked_until = NULL,
        expected_ready_date = NULL,
        updated_at = NOW(),
        updated_by = $3
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [context.tenantId, command.room_id, actor],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to release inventory block for the requested room.",
    );
  }
};

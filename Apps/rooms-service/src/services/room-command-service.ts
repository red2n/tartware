import { query } from "../lib/db.js";
import {
  RoomFeaturesUpdateCommandSchema,
  RoomHousekeepingStatusUpdateCommandSchema,
  type RoomInventoryBlockCommand,
  RoomInventoryBlockCommandSchema,
  RoomInventoryReleaseCommandSchema,
  RoomMoveCommandSchema,
  RoomOutOfOrderCommandSchema,
  RoomOutOfServiceCommandSchema,
  RoomStatusUpdateCommandSchema,
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

export const handleRoomInventoryRelease = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomInventoryReleaseCommandSchema.parse(payload);
  await releaseRoomBlock(
    { room_id: command.room_id, action: "release" },
    context,
  );
};

export const handleRoomStatusUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomStatusUpdateCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        status = COALESCE($3::room_status, status),
        maintenance_status = COALESCE($4::maintenance_status, maintenance_status),
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
      command.room_id,
      command.status ?? null,
      command.maintenance_status ?? null,
      command.reason ?? command.notes ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to update room status.",
    );
  }
};

export const handleRoomHousekeepingStatusUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomHousekeepingStatusUpdateCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        housekeeping_status = $3::housekeeping_status,
        housekeeping_notes = CASE
          WHEN $4 IS NULL THEN housekeeping_notes
          WHEN housekeeping_notes IS NULL THEN $4
          ELSE CONCAT_WS(E'\\n', housekeeping_notes, $4)
        END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.room_id,
      command.housekeeping_status,
      command.notes ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to update housekeeping status.",
    );
  }
};

export const handleRoomOutOfOrder = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomOutOfOrderCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        status = 'OUT_OF_ORDER',
        is_out_of_order = true,
        out_of_order_reason = $3,
        out_of_order_since = COALESCE($4, NOW()),
        expected_ready_date = $5,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.room_id,
      command.reason ?? null,
      command.out_of_order_since ?? null,
      command.expected_ready_date ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to mark room out of order.",
    );
  }
};

export const handleRoomOutOfService = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomOutOfServiceCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        status = 'OUT_OF_SERVICE',
        is_out_of_order = true,
        out_of_order_reason = $3,
        out_of_order_since = COALESCE($4, NOW()),
        expected_ready_date = $5,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      context.tenantId,
      command.room_id,
      command.reason ?? null,
      command.out_of_service_from ?? null,
      command.out_of_service_until ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to mark room out of service.",
    );
  }
};

/**
 * Room move operations require reservation context and workflow coordination.
 * This command is registered in the catalog for future implementation but
 * currently returns NOT_SUPPORTED. Use the reservations domain move workflow instead.
 */
export const handleRoomMove = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomMoveCommandSchema.parse(payload);
  void context;
  throw new RoomCommandError(
    "ROOM_MOVE_NOT_SUPPORTED",
    `Room move is not yet implemented. Move from ${command.from_room_id} to ${command.to_room_id} requires reservation workflow. Use reservations.room.move instead.`,
  );
};

export const handleRoomFeaturesUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomFeaturesUpdateCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        features = COALESCE($3::jsonb, features),
        amenities = COALESCE($4::jsonb, amenities),
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
      command.room_id,
      command.features ? JSON.stringify(command.features) : null,
      command.amenities ? JSON.stringify(command.amenities) : null,
      command.notes ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to update room features.",
    );
  }
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

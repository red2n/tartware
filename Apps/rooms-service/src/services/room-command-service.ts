import crypto from "node:crypto";
import { config } from "../config.js";
import { publishEvent } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import {
  RoomFeaturesUpdateCommandSchema,
  RoomHousekeepingStatusUpdateCommandSchema,
  type RoomInventoryBlockCommand,
  RoomInventoryBlockCommandSchema,
  RoomInventoryReleaseCommandSchema,
  RoomKeyIssueCommandSchema,
  RoomKeyRevokeCommandSchema,
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

const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? APP_ACTOR;

/**
 * Handle room inventory block or release commands.
 */
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

/**
 * Handle explicit room inventory release commands.
 */
export const handleRoomInventoryRelease = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomInventoryReleaseCommandSchema.parse(payload);
  await releaseRoomBlock({ room_id: command.room_id, action: "release" }, context);
};

/**
 * Handle room status updates.
 */
export const handleRoomStatusUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomStatusUpdateCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  // MED-006: Sync is_blocked and is_out_of_order flags when status changes
  // to maintain single source of truth for room availability
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        status = COALESCE($3::room_status, status),
        maintenance_status = COALESCE($4::maintenance_status, maintenance_status),
        is_blocked = CASE
          WHEN $3 = 'AVAILABLE' THEN false
          WHEN $3 = 'BLOCKED' THEN true
          ELSE is_blocked
        END,
        is_out_of_order = CASE
          WHEN $3 = 'AVAILABLE' THEN false
          WHEN $3 IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE') THEN true
          ELSE is_out_of_order
        END,
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
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update room status.");
  }
};

/**
 * Handle housekeeping status updates for a room.
 */
export const handleRoomHousekeepingStatusUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomHousekeepingStatusUpdateCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
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
    [context.tenantId, command.room_id, command.housekeeping_status, command.notes ?? null, actor],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update housekeeping status.");
  }
};

/**
 * Mark a room as out of order.
 */
export const handleRoomOutOfOrder = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomOutOfOrderCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
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
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to mark room out of order.");
  }
};

/**
 * Mark a room as out of service.
 */
export const handleRoomOutOfService = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomOutOfServiceCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
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
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to mark room out of service.");
  }
};

/**
 * Handle room move: reassign a guest from one room to another mid-stay.
 * S25 — supports charge transfer between folios and rate recalculation
 * when the room type changes (upgrade/downgrade).
 */
export const handleRoomMove = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = RoomMoveCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // 1. Validate source room exists and is OCCUPIED
  const fromResult = await query<{
    id: string;
    status: string;
    room_number: string;
    room_type_id: string;
  }>(
    `SELECT id, status, room_number, room_type_id FROM public.rooms
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [command.from_room_id, context.tenantId],
  );
  const fromRoom = fromResult.rows[0];
  if (!fromRoom) {
    throw new RoomCommandError("ROOM_NOT_FOUND", `Source room ${command.from_room_id} not found.`);
  }
  if (fromRoom.status !== "OCCUPIED") {
    throw new RoomCommandError(
      "INVALID_ROOM_STATUS",
      `Source room ${fromRoom.room_number} is ${fromRoom.status}, not OCCUPIED.`,
    );
  }

  // 2. Validate target room exists and is AVAILABLE
  const toResult = await query<{
    id: string;
    status: string;
    room_number: string;
    room_type_id: string;
  }>(
    `SELECT id, status, room_number, room_type_id FROM public.rooms
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [command.to_room_id, context.tenantId],
  );
  const toRoom = toResult.rows[0];
  if (!toRoom) {
    throw new RoomCommandError("ROOM_NOT_FOUND", `Target room ${command.to_room_id} not found.`);
  }
  if (toRoom.status !== "AVAILABLE") {
    throw new RoomCommandError(
      "ROOM_NOT_AVAILABLE",
      `Target room ${toRoom.room_number} is ${toRoom.status}, not AVAILABLE.`,
    );
  }

  // 3. Source room → DIRTY (vacated, needs housekeeping)
  await query(
    `UPDATE public.rooms SET status = 'DIRTY', version = version + 1, updated_at = NOW(), updated_by = $3
     WHERE id = $1 AND tenant_id = $2`,
    [command.from_room_id, context.tenantId, actor],
  );

  // 4. Target room → OCCUPIED
  await query(
    `UPDATE public.rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW(), updated_by = $3
     WHERE id = $1 AND tenant_id = $2`,
    [command.to_room_id, context.tenantId, actor],
  );

  // 5. Update reservation room_number if reservation_id provided
  if (command.reservation_id) {
    const roomTypeChanged = fromRoom.room_type_id !== toRoom.room_type_id;

    // Update room_number (and room_type_id if room type changed)
    if (roomTypeChanged) {
      await query(
        `UPDATE public.reservations
         SET room_number = $3, room_type_id = $4, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [command.reservation_id, context.tenantId, toRoom.room_number, toRoom.room_type_id],
      );
    } else {
      await query(
        `UPDATE public.reservations
         SET room_number = $3, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [command.reservation_id, context.tenantId, toRoom.room_number],
      );
    }

    // S25: Recalculate rate if room type changed and recalculate_rate is true
    if (roomTypeChanged && command.recalculate_rate) {
      const { rows: rateRows } = await query<{ base_price: string | number }>(
        `SELECT base_price FROM public.room_types
         WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
        [toRoom.room_type_id, context.tenantId],
      );
      const { rows: oldRateRows } = await query<{ base_price: string | number }>(
        `SELECT base_price FROM public.room_types
         WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
        [fromRoom.room_type_id, context.tenantId],
      );
      if (rateRows[0]) {
        const newRate = Number(rateRows[0].base_price);
        const oldRate = oldRateRows[0] ? Number(oldRateRows[0].base_price) : 0;
        // Recalculate total_amount based on new nightly rate × nights
        await query(
          `UPDATE public.reservations
           SET room_rate = $3,
               total_amount = $3 * GREATEST(1, check_out_date::date - check_in_date::date),
               version = version + 1, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [command.reservation_id, context.tenantId, newRate],
        );

        // S25: Post rate adjustment charge to billing for the remaining nights
        const rateDiff = newRate - oldRate;
        if (rateDiff !== 0) {
          try {
            const { rows: stayRows } = await query<{
              remaining_nights: number;
              property_id: string;
            }>(
              `SELECT GREATEST(0, check_out_date::date - CURRENT_DATE) AS remaining_nights,
                      property_id
               FROM public.reservations
               WHERE id = $1 AND tenant_id = $2`,
              [command.reservation_id, context.tenantId],
            );
            const stay = stayRows[0];
            if (stay && stay.remaining_nights > 0) {
              const adjustmentAmount = Math.abs(rateDiff) * stay.remaining_nights;
              const commandId = crypto.randomUUID();
              await publishEvent({
                topic: config.commandCenter.topic,
                key: commandId,
                value: JSON.stringify({
                  metadata: {
                    commandId,
                    commandName: "billing.charge.post",
                    tenantId: context.tenantId,
                    targetService: "billing-service",
                    targetTopic: config.commandCenter.topic,
                    issuedAt: new Date().toISOString(),
                    route: { id: "system", source: "internal", tenantId: null },
                    initiatedBy: context.initiatedBy ?? {
                      userId: "00000000-0000-0000-0000-000000000000",
                      role: "SYSTEM",
                    },
                    featureStatus: "enabled",
                  },
                  payload: {
                    property_id: stay.property_id,
                    reservation_id: command.reservation_id,
                    amount: adjustmentAmount,
                    charge_code: rateDiff > 0 ? "UPGRADE" : "DOWNGRADE_CREDIT",
                    posting_type: rateDiff > 0 ? "DEBIT" : "CREDIT",
                    description: `Room move rate adjustment: ${fromRoom.room_number} → ${toRoom.room_number} (${rateDiff > 0 ? "upgrade" : "downgrade"} $${Math.abs(rateDiff).toFixed(2)}/night × ${stay.remaining_nights} nights)`,
                    idempotency_key: `room-move-rate-${command.reservation_id}-${command.from_room_id}-${command.to_room_id}-${new Date().toISOString().slice(0, 10)}`,
                  },
                }),
                headers: {
                  "x-command-name": "billing.charge.post",
                  "x-command-tenant-id": context.tenantId,
                  "x-command-request-id": commandId,
                  "x-command-target": "billing-service",
                },
              });
            }
          } catch (err) {
            // Non-critical: rate adjustment charge is best-effort but log for reconciliation
            const { appLogger } = await import("../lib/logger.js");
            appLogger.warn(
              {
                err,
                reservationId: command.reservation_id,
                fromRoom: command.from_room_id,
                toRoom: command.to_room_id,
                rateDiff,
              },
              "Failed to post rate adjustment billing charge during room move",
            );
          }
        }
      }
    }

    // S25: Transfer pending charges from old folio to new room's folio
    if (command.transfer_charges) {
      await query(
        `UPDATE public.charge_postings
         SET transfer_source = folio_id,
             transfer_target = (
               SELECT folio_id FROM public.folios
               WHERE reservation_id = $3 AND tenant_id = $1
                 AND folio_status = 'OPEN'
               ORDER BY created_at ASC LIMIT 1
             ),
             updated_at = NOW()
         WHERE tenant_id = $1
           AND reservation_id = $3
           AND is_voided = false
           AND transfer_source IS NULL`,
        [context.tenantId, command.from_room_id, command.reservation_id],
      );
    }

    // S25: Log the room move in reservation_status_history for audit
    await query(
      `INSERT INTO public.reservation_status_history
         (reservation_id, tenant_id, previous_status, new_status, change_reason, changed_by, changed_at, metadata)
       VALUES ($1, $2, 'CHECKED_IN', 'CHECKED_IN', $3, $4, NOW(), $5)`,
      [
        command.reservation_id,
        context.tenantId,
        `Room move: ${fromRoom.room_number} → ${toRoom.room_number}${command.reason ? ` (${command.reason})` : ""}`,
        actor,
        JSON.stringify({
          action: "room_move",
          from_room_id: command.from_room_id,
          to_room_id: command.to_room_id,
          from_room_number: fromRoom.room_number,
          to_room_number: toRoom.room_number,
          room_type_changed: roomTypeChanged,
          charges_transferred: command.transfer_charges,
          rate_recalculated: roomTypeChanged && command.recalculate_rate,
        }),
      ],
    );
  }
};

/**
 * Handle updates to room features and amenities.
 */
export const handleRoomFeaturesUpdate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = RoomFeaturesUpdateCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
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
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update room features.");
  }
};

/**
 * S28 — Issue a digital key (mobile key) for a guest's room.
 * Generates a unique key_code, inserts into mobile_keys with status 'active'.
 */
export const handleKeyIssue = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = RoomKeyIssueCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Validate room exists and belongs to tenant
  const { rows: roomRows } = await query<{ id: string; room_number: string }>(
    `SELECT id, room_number FROM public.rooms
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [command.room_id, context.tenantId],
  );
  if (!roomRows[0]) {
    throw new RoomCommandError("ROOM_NOT_FOUND", `Room ${command.room_id} not found.`);
  }

  // Generate unique key code
  const keyCode = `MK-${crypto.randomUUID().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

  // Default validity: check-in now → check-out (or 24h if not specified)
  const validFrom = command.valid_from ?? new Date();
  const defaultValidTo = new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);
  const validTo = command.valid_to ?? defaultValidTo;

  await query(
    `INSERT INTO public.mobile_keys (
       tenant_id, property_id, guest_id, reservation_id, room_id,
       key_code, key_type, status,
       valid_from, valid_to, usage_count,
       device_id, device_type, metadata,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, 'active',
       $8, $9, 0,
       $10, $11, $12,
       $13, $13
     )
     ON CONFLICT (key_code) DO NOTHING`,
    [
      context.tenantId,
      command.property_id,
      command.guest_id,
      command.reservation_id,
      command.room_id,
      keyCode,
      command.key_type,
      validFrom,
      validTo,
      command.device_id ?? null,
      command.device_type ?? null,
      command.metadata ? JSON.stringify(command.metadata) : null,
      actor,
    ],
  );
};

/**
 * S28 — Revoke a digital key (or all keys for a reservation).
 * Sets status to 'revoked' so the key is no longer valid.
 */
export const handleKeyRevoke = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = RoomKeyRevokeCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  if (command.revoke_all_for_reservation && command.reservation_id) {
    // Revoke all active keys for this reservation
    await query(
      `UPDATE public.mobile_keys
       SET status = 'revoked', updated_at = NOW(), updated_by = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', $4)
       WHERE tenant_id = $1 AND reservation_id = $2
         AND status = 'active'
         AND COALESCE(is_deleted, false) = false`,
      [context.tenantId, command.reservation_id, actor, command.reason ?? "bulk_revoke"],
    );
    return;
  }

  // Revoke single key
  const { rowCount } = await query(
    `UPDATE public.mobile_keys
     SET status = 'revoked', updated_at = NOW(), updated_by = $3,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', $4)
     WHERE tenant_id = $1 AND key_id = $2
       AND status = 'active'
       AND COALESCE(is_deleted, false) = false`,
    [context.tenantId, command.key_id, actor, command.reason ?? "manual_revoke"],
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("KEY_NOT_FOUND", `Active key ${command.key_id} not found.`);
  }
};

const blockRoom = async (
  command: RoomInventoryBlockCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = resolveActorId(context.initiatedBy);
  const blockedFrom = command.blocked_from ?? new Date();

  // MED-006: Also update status to maintain single source of truth
  // A blocked room should have status reflecting unavailability
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        is_blocked = TRUE,
        status = 'BLOCKED',
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
  const actor = resolveActorId(context.initiatedBy);
  // MED-006: Restore status when releasing block
  // Only set to AVAILABLE if room is not out_of_order; otherwise preserve that status
  const { rowCount } = await query(
    `
      UPDATE public.rooms
      SET
        is_blocked = FALSE,
        status = CASE
          WHEN is_out_of_order = true THEN status
          ELSE 'AVAILABLE'
        END,
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

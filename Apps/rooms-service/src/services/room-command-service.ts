import crypto from "node:crypto";
import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import { config } from "../config.js";
import { publishEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  applyRoomBlock,
  assignReservationRoom,
  assignReservationRoomAndType,
  fetchRateChangeContext,
  findGuestContact,
  findReservationForNotification,
  findRoomForKeyIssue,
  findRoomForMove,
  findRoomNumber,
  findRoomTypeBasePrice,
  insertMobileKey,
  markRoomDirty,
  markRoomOccupied,
  markRoomOutOfOrder,
  markRoomOutOfService,
  recordRoomMoveHistory,
  revokeKey,
  revokeKeysForReservation,
  transferRoomCharges,
  unblockRoom,
  updateHousekeepingStatus,
  updateReservationRate,
  updateRoomFeatures,
  updateRoomStatus,
} from "../repositories/room-command-repository.js";
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
import { hashIdentifier, recordAuditLog } from "../utils/audit.js";
import { findArrivingReservation, publishNotificationCommand } from "./room-notification-helper.js";

const logger = appLogger.child({ module: "room-command-service" });

/**
 * RoomCommandError — see {@link CommandError} for the `retryable` contract the
 * command consumer reads when deciding retry vs DLQ.
 */
class RoomCommandError extends CommandError {}

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
  const { rowCount } = await updateRoomStatus(
    context.tenantId,
    command.room_id,
    command.status ?? null,
    command.maintenance_status ?? null,
    command.reason ?? command.notes ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update room status.");
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null, // Room level
    actorId: actor,
    action: "room.status_update",
    eventType: "UPDATE",
    entityType: "room",
    entityId: command.room_id,
    metadata: {
      status: command.status,
      maintenance_status: command.maintenance_status,
      reason: command.reason || command.notes,
    },
  });

  // Room back-in-service notification: when status transitions to AVAILABLE
  // the room is returned to inventory, check for awaiting guests.
  if (command.status === "AVAILABLE") {
    try {
      const { rows: roomRows } = await findRoomNumber(command.room_id, context.tenantId);
      const roomNumber = roomRows[0]?.room_number;
      if (roomNumber) {
        const reservation = await findArrivingReservation(context.tenantId, roomNumber);
        if (reservation) {
          await publishNotificationCommand({
            tenantId: context.tenantId,
            propertyId: reservation.property_id,
            guestId: reservation.guest_id,
            reservationId: reservation.id,
            templateCode: "ROOM_READY",
            recipientName: reservation.guest_name,
            recipientEmail: reservation.guest_email ?? undefined,
            context: {
              guest_name: reservation.guest_name,
              room_number: roomNumber,
              room_type: reservation.room_type_name,
              confirmation_number: reservation.confirmation_number,
            },
            idempotencyKey: `room-ready-${reservation.id}-${new Date().toISOString().slice(0, 10)}`,
            initiatedBy: context.initiatedBy,
          });
        }
      }
    } catch (err) {
      logger.warn(
        { err, roomId: command.room_id },
        "Failed to send room-ready notification (best-effort)",
      );
    }
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
  const { rowCount } = await updateHousekeepingStatus(
    context.tenantId,
    command.room_id,
    command.housekeeping_status,
    command.notes ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update housekeeping status.");
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null,
    actorId: actor,
    action: "room.housekeeping_status_update",
    eventType: "UPDATE",
    entityType: "room",
    entityId: command.room_id,
    metadata: {
      housekeeping_status: command.housekeeping_status,
      notes: command.notes,
    },
  });

  // Room-ready notification: when housekeeping marks a room as CLEAN or
  // INSPECTED, check if a guest is arriving today for this room.
  if (command.housekeeping_status === "CLEAN" || command.housekeeping_status === "INSPECTED") {
    try {
      const { rows: roomRows } = await findRoomNumber(command.room_id, context.tenantId);
      const roomNumber = roomRows[0]?.room_number;
      if (roomNumber) {
        const reservation = await findArrivingReservation(context.tenantId, roomNumber);
        if (reservation) {
          await publishNotificationCommand({
            tenantId: context.tenantId,
            propertyId: reservation.property_id,
            guestId: reservation.guest_id,
            reservationId: reservation.id,
            templateCode: "ROOM_READY",
            recipientName: reservation.guest_name,
            recipientEmail: reservation.guest_email ?? undefined,
            context: {
              guest_name: reservation.guest_name,
              room_number: roomNumber,
              room_type: reservation.room_type_name,
              confirmation_number: reservation.confirmation_number,
            },
            idempotencyKey: `room-ready-${reservation.id}-${new Date().toISOString().slice(0, 10)}`,
            initiatedBy: context.initiatedBy,
          });
        }
      }
    } catch (err) {
      logger.warn(
        { err, roomId: command.room_id },
        "Failed to send room-ready notification (best-effort)",
      );
    }
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
  const { rowCount } = await markRoomOutOfOrder(
    context.tenantId,
    command.room_id,
    command.reason ?? null,
    command.out_of_order_since ?? null,
    command.expected_ready_date ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to mark room out of order.");
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null,
    actorId: actor,
    action: "room.mark_out_of_order",
    eventType: "UPDATE",
    entityType: "room",
    entityId: command.room_id,
    metadata: {
      reason: command.reason,
      out_of_order_since: command.out_of_order_since,
      expected_ready_date: command.expected_ready_date,
    },
  });
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
  const { rowCount } = await markRoomOutOfService(
    context.tenantId,
    command.room_id,
    command.reason ?? null,
    command.out_of_service_from ?? null,
    command.out_of_service_until ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to mark room out of service.");
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null,
    actorId: actor,
    action: "room.mark_out_of_service",
    eventType: "UPDATE",
    entityType: "room",
    entityId: command.room_id,
    metadata: {
      reason: command.reason,
      out_of_service_from: command.out_of_service_from,
      out_of_service_until: command.out_of_service_until,
    },
  });
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
  const fromResult = await findRoomForMove(command.from_room_id, context.tenantId);
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
  const toResult = await findRoomForMove(command.to_room_id, context.tenantId);
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
  await markRoomDirty(command.from_room_id, context.tenantId, actor);

  // 4. Target room → OCCUPIED
  await markRoomOccupied(command.to_room_id, context.tenantId, actor);

  // 5. Update reservation room_number if reservation_id provided
  if (command.reservation_id) {
    const roomTypeChanged = fromRoom.room_type_id !== toRoom.room_type_id;

    // Update room_number (and room_type_id if room type changed)
    if (roomTypeChanged) {
      await assignReservationRoomAndType(
        command.reservation_id,
        context.tenantId,
        toRoom.room_number,
        toRoom.room_type_id,
      );
    } else {
      await assignReservationRoom(command.reservation_id, context.tenantId, toRoom.room_number);
    }

    // S25: Recalculate rate if room type changed and recalculate_rate is true
    if (roomTypeChanged && command.recalculate_rate) {
      const { rows: rateRows } = await findRoomTypeBasePrice(toRoom.room_type_id, context.tenantId);
      const { rows: oldRateRows } = await findRoomTypeBasePrice(
        fromRoom.room_type_id,
        context.tenantId,
      );
      if (rateRows[0]) {
        const newRate = Number(rateRows[0].base_price);
        const oldRate = oldRateRows[0] ? Number(oldRateRows[0].base_price) : 0;
        // Recalculate total_amount based on new nightly rate × nights
        await updateReservationRate(command.reservation_id, context.tenantId, newRate);

        // S25: Post rate adjustment charge to billing for the remaining nights
        const rateDiff = newRate - oldRate;
        if (rateDiff !== 0) {
          try {
            const { rows: stayRows } = await fetchRateChangeContext(
              command.reservation_id,
              context.tenantId,
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
      await transferRoomCharges(context.tenantId, command.from_room_id, command.reservation_id);
    }

    // S25: Log the room move in reservation_status_history for audit
    await recordRoomMoveHistory(
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
        room_type_changed: fromRoom.room_type_id !== toRoom.room_type_id,
        charges_transferred: command.transfer_charges,
        rate_recalculated:
          fromRoom.room_type_id !== toRoom.room_type_id && command.recalculate_rate,
      }),
    );

    await recordAuditLog({
      tenantId: context.tenantId,
      propertyId: null,
      actorId: actor,
      action: "room.move",
      eventType: "UPDATE",
      entityType: "reservation",
      entityId: command.reservation_id,
      metadata: {
        reservation_id: hashIdentifier(command.reservation_id),
        from_room_id: command.from_room_id,
        to_room_id: command.to_room_id,
        room_type_changed: fromRoom.room_type_id !== toRoom.room_type_id,
        charges_transferred: command.transfer_charges,
        reason: command.reason,
      },
    });

    // Room move notification to the guest
    try {
      const { rows: resRows } = await findReservationForNotification(
        command.reservation_id,
        context.tenantId,
      );
      const res = resRows[0];
      if (res) {
        const { rows: guestRows } = await findGuestContact(res.guest_id, context.tenantId);
        const guest = guestRows[0];
        await publishNotificationCommand({
          tenantId: context.tenantId,
          propertyId: res.property_id,
          guestId: res.guest_id,
          reservationId: command.reservation_id,
          templateCode: "ROOM_MOVE_NOTIFICATION",
          recipientName: guest?.guest_name ?? "Guest",
          recipientEmail: guest?.email ?? undefined,
          context: {
            guest_name: guest?.guest_name ?? "Guest",
            from_room_number: fromRoom.room_number,
            to_room_number: toRoom.room_number,
            confirmation_number: res.confirmation_number ?? "",
            move_reason: command.reason ?? "Operational adjustment",
          },
          idempotencyKey: `room-move-${command.reservation_id}-${command.from_room_id}-${command.to_room_id}`,
          initiatedBy: context.initiatedBy,
        });
      }
    } catch (err) {
      logger.warn(
        { err, reservationId: command.reservation_id },
        "Failed to send room-move notification (best-effort)",
      );
    }
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
  const { rowCount } = await updateRoomFeatures(
    context.tenantId,
    command.room_id,
    command.features ? JSON.stringify(command.features) : null,
    command.amenities ? JSON.stringify(command.amenities) : null,
    command.notes ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("ROOM_NOT_FOUND", "Unable to update room features.");
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null,
    actorId: actor,
    action: "room.features_update",
    eventType: "UPDATE",
    entityType: "room",
    entityId: command.room_id,
    metadata: {
      features: command.features,
      amenities: command.amenities,
      notes: command.notes,
    },
  });
};

/**
 * S28 — Issue a digital key (mobile key) for a guest's room.
 * Generates a unique key_code, inserts into mobile_keys with status 'active'.
 */
export const handleKeyIssue = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = RoomKeyIssueCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Validate room exists and belongs to tenant
  const { rows: roomRows } = await findRoomForKeyIssue(command.room_id, context.tenantId);
  if (!roomRows[0]) {
    throw new RoomCommandError("ROOM_NOT_FOUND", `Room ${command.room_id} not found.`);
  }

  // Generate unique key code
  const keyCode = `MK-${crypto.randomUUID().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

  // Default validity: check-in now → check-out (or 24h if not specified)
  const validFrom = command.valid_from ?? new Date();
  const defaultValidTo = new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);
  const validTo = command.valid_to ?? defaultValidTo;

  await insertMobileKey(
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
  );

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: command.property_id,
    actorId: actor,
    action: "room.mobile_key_issue",
    eventType: "CREATE",
    entityType: "mobile_key",
    entityId: hashIdentifier(keyCode),
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      reservation_id: hashIdentifier(command.reservation_id || ""),
      room_id: command.room_id,
      key_type: command.key_type,
      device_type: command.device_type,
    },
  });

  // Mobile key issued notification to the guest
  try {
    const { rows: guestRows } = await findGuestContact(command.guest_id, context.tenantId);
    const guest = guestRows[0];
    await publishNotificationCommand({
      tenantId: context.tenantId,
      propertyId: command.property_id,
      guestId: command.guest_id,
      reservationId: command.reservation_id,
      templateCode: "MOBILE_KEY_ISSUED",
      recipientName: guest?.guest_name ?? "Guest",
      recipientEmail: guest?.email ?? undefined,
      context: {
        guest_name: guest?.guest_name ?? "Guest",
        room_number: roomRows[0].room_number,
        key_type: command.key_type,
        valid_from: validFrom.toISOString(),
        valid_to: validTo.toISOString(),
      },
      idempotencyKey: `mobile-key-${keyCode}`,
      initiatedBy: context.initiatedBy,
    });
  } catch (err) {
    logger.warn(
      { err, guestId: command.guest_id, roomId: command.room_id },
      "Failed to send mobile-key notification (best-effort)",
    );
  }
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
    await revokeKeysForReservation(
      context.tenantId,
      command.reservation_id,
      actor,
      command.reason ?? "bulk_revoke",
    );
    return;
  }

  // Revoke single key
  const { rowCount } = await revokeKey(
    context.tenantId,
    command.key_id,
    actor,
    command.reason ?? "manual_revoke",
  );

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError("KEY_NOT_FOUND", `Active key ${command.key_id} not found.`);
  }

  await recordAuditLog({
    tenantId: context.tenantId,
    propertyId: null,
    actorId: actor,
    action: "room.mobile_key_revoke",
    eventType: "DELETE",
    entityType: "mobile_key",
    entityId: command.key_id ? hashIdentifier(command.key_id) : "bulk_revoke",
    metadata: {
      reservation_id: command.reservation_id ? hashIdentifier(command.reservation_id) : null,
      reason: command.reason,
      revoke_all: command.revoke_all_for_reservation,
    },
  });
};

const blockRoom = async (
  command: RoomInventoryBlockCommand,
  context: CommandContext,
): Promise<void> => {
  const actor = resolveActorId(context.initiatedBy);
  const blockedFrom = command.blocked_from ?? new Date();

  // MED-006: Also update status to maintain single source of truth
  // A blocked room should have status reflecting unavailability
  const { rowCount } = await applyRoomBlock(
    context.tenantId,
    command.room_id,
    command.reason ?? null,
    blockedFrom,
    command.blocked_until ?? null,
    command.expected_ready_date ?? null,
    actor,
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
  const { rowCount } = await unblockRoom(context.tenantId, command.room_id, actor);

  if (!rowCount || rowCount === 0) {
    throw new RoomCommandError(
      "ROOM_NOT_FOUND",
      "Unable to release inventory block for the requested room.",
    );
  }
};

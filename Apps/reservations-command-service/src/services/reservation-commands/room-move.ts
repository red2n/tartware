import { resolveActorId, SYSTEM_ACTOR_ROLE } from "@tartware/command-consumer-utils/command-utils";
import type { ReservationRoomMoveCommand } from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import {
  lockReservationHold,
  releaseReservationHold,
} from "../../clients/availability-guard-client.js";
import { withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { getReservationGuardMetadata } from "../../repositories/reservation-guard-metadata-repository.js";
import { fetchReservationStaySnapshot } from "../../repositories/reservation-repository.js";
import {
  applyRoomMove,
  applyRoomStatuses,
  fetchReservationRooms,
  fetchTargetRoom,
  type ReservationRoomRow,
  repriceRemainingNights,
} from "../../repositories/room-move-repository.js";
import { recordAuditLog, recordFlowApproval } from "../../utils/audit.js";

import {
  type CreateReservationResult,
  enqueueReservationUpdate,
  ReservationCommandError,
  resolveReasonCode,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Move an in-house guest to a different room (PMS-02-02).
 *
 * Not `assign_room` with extra steps. Assignment fills an empty slot before
 * arrival; a move has a guest in the bed. That difference is the whole command:
 * there is a room to vacate that has been slept in, charges already running
 * against the stay, and a key that no longer opens the right door.
 *
 * The order of operations is the part worth defending. The hold on the new room
 * is taken *before* the old one is released, and the move fails closed if the
 * guard cannot answer — the same rule reinstatement follows. Releasing first
 * would open a window where the guest has no room at all, and taking the new
 * room on a guard shrug risks walking whoever was sold it.
 */

const logger = reservationsLogger.child({ module: "room-move" });

/**
 * Pick the room being moved.
 *
 * A booking has held several rooms since WS-01, so "move this reservation" is
 * only meaningful when there is exactly one. With more than one and no
 * `reservation_room_id`, the command refuses: moving the wrong guest out of the
 * wrong room is not a mistake anyone should be able to make by omission.
 */
const selectRoomToMove = (
  rooms: ReservationRoomRow[],
  requestedId: string | undefined,
): ReservationRoomRow => {
  if (requestedId) {
    const match = rooms.find((r) => r.reservation_room_id === requestedId);
    if (!match) {
      throw new ReservationCommandError(
        "RESERVATION_ROOM_NOT_FOUND",
        `Reservation room ${requestedId} does not belong to this reservation`,
      );
    }
    return match;
  }

  if (rooms.length === 0) {
    throw new ReservationCommandError(
      "NO_ROOMS_ON_RESERVATION",
      "This reservation holds no rooms to move",
    );
  }
  if (rooms.length > 1) {
    throw new ReservationCommandError(
      "AMBIGUOUS_ROOM",
      `This reservation holds ${rooms.length} rooms. Name reservation_room_id — ` +
        `one of: ${rooms.map((r) => `${r.reservation_room_id} (room ${r.room_number ?? "unassigned"})`).join(", ")}`,
    );
  }
  return rooms[0];
};

export const moveRoom = async (
  tenantId: string,
  command: ReservationRoomMoveCommand,
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const actorId = resolveActorId({ userId: options.actorId }) ?? SYSTEM_ACTOR_ID;

  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const propertyId = command.property_id ?? snapshot.propertyId;
  const rooms = await fetchReservationRooms(tenantId, command.reservation_id);
  const source = selectRoomToMove(rooms, command.reservation_room_id);

  // A guest who has not arrived has nothing to move out of, and one who has
  // left has nothing to move. Both are assignment problems, not move problems.
  if (source.status !== "CHECKED_IN") {
    throw new ReservationCommandError(
      "GUEST_NOT_IN_HOUSE",
      `Room move applies to an in-house guest; this room is ${source.status}. ` +
        `Use reservation.assign_room to change an assignment before arrival.`,
    );
  }

  if (source.room_id === command.to_room_id) {
    throw new ReservationCommandError(
      "ALREADY_IN_ROOM",
      `The guest is already in room ${source.room_number ?? command.to_room_id}`,
    );
  }

  // `do_not_move` exists because someone deliberately set it — an ADA
  // allocation, a VIP, a room booked for its specific view.
  if (source.do_not_move && !command.force) {
    throw new ReservationCommandError(
      "ROOM_IS_DO_NOT_MOVE",
      `Room ${source.room_number ?? source.reservation_room_id} is flagged do-not-move. ` +
        `Pass force to override, which is recorded.`,
    );
  }

  const reason = await resolveReasonCode(tenantId, propertyId, command.reason_code, "ROOM_MOVE");

  // `requires_approval` has sat in reason_codes with nothing reading it. A code
  // configured to need a manager's sign-off should not be usable by a command
  // that cannot produce one, so it refuses unless overridden on the record.
  if (reason.requires_approval && !command.force) {
    throw new ReservationCommandError(
      "REASON_CODE_REQUIRES_APPROVAL",
      `Reason code "${reason.reason_code}" requires approval and this command carries none. ` +
        `Pass force to proceed on the authority of the caller, which is recorded.`,
    );
  }

  const target = await fetchTargetRoom(tenantId, command.to_room_id);
  if (!target) {
    throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${command.to_room_id} not found`);
  }
  if (target.property_id !== propertyId) {
    throw new ReservationCommandError(
      "ROOM_WRONG_PROPERTY",
      `Room ${target.room_number} belongs to a different property`,
    );
  }
  if (target.is_out_of_order || target.is_blocked) {
    throw new ReservationCommandError(
      "ROOM_NOT_SELLABLE",
      `Room ${target.room_number} is ${target.is_out_of_order ? "out of order" : "blocked"}`,
    );
  }
  // A move into an unclean room is a complaint waiting to happen, and unlike
  // most of these rules it is one a night manager may legitimately override.
  if (!["CLEAN", "INSPECTED"].includes(target.housekeeping_status) && !command.force) {
    throw new ReservationCommandError(
      "ROOM_NOT_CLEAN",
      `Room ${target.room_number} is ${target.housekeeping_status}. Pass force to move anyway.`,
    );
  }

  // Read the outgoing hold before taking the new one. Both locks belong to the
  // same reservation, so after the second is taken there is no way to tell which
  // row is the one to release.
  const previousGuard = await getReservationGuardMetadata(tenantId, command.reservation_id);
  const previousLockId = previousGuard?.lockId ?? null;

  // Hold the new room before letting go of the old one, and fail closed: a
  // guard that cannot answer is not a yes.
  const guard = await lockReservationHold({
    tenantId,
    propertyId,
    reservationId: command.reservation_id,
    roomTypeId: target.room_type_id,
    roomId: command.to_room_id,
    stayStart: new Date(snapshot.checkInDate),
    stayEnd: new Date(snapshot.checkOutDate),
    reason: "RESERVATION_ROOM_MOVE",
    correlationId: options.correlationId ?? eventId,
  });

  if (guard.status !== "LOCKED") {
    throw new ReservationCommandError(
      guard.status === "CONFLICT" ? "ROOM_UNAVAILABLE" : "AVAILABILITY_GUARD_UNAVAILABLE",
      guard.status === "CONFLICT"
        ? `Room ${target.room_number} is not available for the remainder of this stay`
        : `The availability guard could not confirm room ${target.room_number} is free. ` +
            `Refusing rather than risk moving the guest into a sold room.`,
    );
  }

  if (command.rate_action === "REPRICE" && command.new_rate_amount === undefined) {
    throw new ReservationCommandError(
      "REPRICE_NEEDS_AMOUNT",
      "rate_action REPRICE requires new_rate_amount. The nightly price comes from the " +
        "rate engine, not from this command — supply the agreed rate.",
    );
  }

  const typeChanged = target.room_type_id !== source.room_type_id;
  const movedAt = new Date();

  try {
    let repriced = { repriced: 0, amount_before: "0", amount_after: "0" };

    await withTransaction(async (client) => {
      await applyRoomMove(client, {
        tenantId,
        reservationRoomId: source.reservation_room_id,
        toRoomId: command.to_room_id,
        toRoomNumber: target.room_number,
        toRoomTypeId: target.room_type_id,
        actorId,
      });

      if (command.rate_action === "REPRICE" && command.new_rate_amount !== undefined) {
        // Only nights not yet slept — see repriceRemainingNights for why.
        repriced = await repriceRemainingNights(client, {
          tenantId,
          reservationRoomId: source.reservation_room_id,
          fromDate: movedAt,
          newRateAmount: command.new_rate_amount,
          newRateCode: command.new_rate_code ?? null,
          actorId,
        });
      }

      await applyRoomStatuses(client, {
        tenantId,
        fromRoomId: source.room_id,
        toRoomId: command.to_room_id,
        fromHousekeepingStatus: command.from_room_status_after,
        actorId,
      });
    });

    // Release the old room's hold only once the move is durable. A failure
    // before this point leaves the old hold standing, which is the safe way to
    // be wrong: the guest keeps a room.
    if (previousLockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: previousLockId,
          reservationId: command.reservation_id,
          reason: "ROOM_MOVE_VACATED",
          correlationId: options.correlationId ?? eventId,
        });
      } catch (releaseError) {
        logger.error(
          { reservationId: command.reservation_id, lockId: previousLockId, err: releaseError },
          "Room move applied but the vacated room's hold was not released — it will expire via TTL",
        );
      }
    }

    await recordFlowApproval({
      tenantId,
      propertyId,
      flowName: "reservation_room_move",
      gateName: "room_move",
      entityType: "reservation",
      entityId: command.reservation_id,
      approvedBy: actorId,
      roleAtApproval: options.actorRole ?? SYSTEM_ACTOR_ROLE,
      forced: Boolean(command.force),
      reasonCode: reason.reason_code,
      reasonNotes:
        command.reason_notes ??
        `${reason.reason_name}: room ${source.room_number ?? "unassigned"} → ${target.room_number}`,
      correlationId: options.correlationId ?? null,
    });

    await recordAuditLog({
      tenantId,
      propertyId,
      actorId,
      action: "ROOM_MOVE",
      eventType: "RESERVATION_ROOM_MOVE",
      entityType: "reservation",
      entityId: command.reservation_id,
      metadata: {
        description:
          `Room move: ${source.room_number ?? "unassigned"} → ${target.room_number}, ` +
          `reason ${reason.reason_code}`,
        reservation_room_id: source.reservation_room_id,
        from_room_id: source.room_id,
        from_room_number: source.room_number,
        to_room_id: command.to_room_id,
        to_room_number: target.room_number,
        room_type_changed: typeChanged,
        rate_action: command.rate_action,
        nights_repriced: repriced.repriced,
        // Written out so the financial effect is auditable without re-deriving
        // it from the nights table months later.
        amount_before: repriced.amount_before,
        amount_after: repriced.amount_after,
        reason_code: reason.reason_code,
        reason_notes: command.reason_notes,
        forced: command.force === true,
        do_not_move_overridden: source.do_not_move && command.force === true,
        approval_overridden: reason.requires_approval && command.force === true,
        correlation_id: options.correlationId,
      },
    });

    logger.info(
      {
        reservationId: command.reservation_id,
        from: source.room_number,
        to: target.room_number,
        typeChanged,
        nightsRepriced: repriced.repriced,
        forced: command.force === true,
      },
      "room move applied",
    );

    return await enqueueReservationUpdate(
      tenantId,
      "reservation.room_move",
      {
        id: command.reservation_id,
        tenant_id: tenantId,
        property_id: propertyId,
        room_number: target.room_number,
        metadata: {
          ...command.metadata,
          room_move: {
            reservation_room_id: source.reservation_room_id,
            from_room_id: source.room_id,
            from_room_number: source.room_number,
            to_room_id: command.to_room_id,
            to_room_number: target.room_number,
            from_room_status_after: command.from_room_status_after,
            room_type_changed: typeChanged,
            nights_repriced: repriced.repriced,
            reason_code: reason.reason_code,
            moved_at: movedAt.toISOString(),
            // The physical key must be re-cut for the new door. No lock vendor
            // is integrated yet (WS-10), so this states the requirement for
            // whichever adapter picks it up rather than pretending it is done.
            key_reissue_required: true,
          },
          availabilityGuard: guard,
        },
      },
      options,
    );
  } catch (error) {
    if (guard.status === "LOCKED" && guard.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guard.lockId,
          reservationId: command.reservation_id,
          reason: "ROOM_MOVE_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
      } catch (releaseError) {
        logger.error(
          { reservationId: command.reservation_id, lockId: guard.lockId, err: releaseError },
          "Failed to release the new room's hold after a failed move — it will expire via TTL",
        );
      }
    }
    throw error;
  }
};

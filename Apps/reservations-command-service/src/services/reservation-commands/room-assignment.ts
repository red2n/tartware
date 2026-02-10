import { v4 as uuid } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../../clients/availability-guard-client.js";

import { reservationsLogger } from "../../logger.js";
import { fetchReservationStaySnapshot } from "../../repositories/reservation-repository.js";
import type {
  ReservationAssignRoomCommand,
  ReservationExtendStayCommand,
  ReservationUnassignRoomCommand,
} from "../../schemas/reservation-command.js";

import {
  type CreateReservationResult,
  enqueueReservationUpdate,
  fetchRoomInfo,
  ReservationCommandError,
  type ReservationUpdatePayload,
} from "./common.js";

/**
 * Assign a room to a reservation with availability guard.
 */
export const assignRoom = async (
  tenantId: string,
  command: ReservationAssignRoomCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const roomInfo = await fetchRoomInfo(tenantId, command.room_id);
  if (!roomInfo) {
    throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${command.room_id} not found`);
  }

  // Fetch reservation to get stay dates for availability check
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  // P2-16: Validate the room's type matches the reservation's expected room type
  if (roomInfo.roomTypeId !== snapshot.roomTypeId) {
    throw new ReservationCommandError(
      "ROOM_TYPE_MISMATCH",
      `Room type ${roomInfo.roomTypeId} does not match reservation room type ${snapshot.roomTypeId}`,
    );
  }

  // Verify room is available for the reservation's date range
  const guardMetadata = await lockReservationHold({
    tenantId,
    reservationId: command.reservation_id,
    roomTypeId: snapshot.roomTypeId,
    roomId: command.room_id, // Check specific room availability
    stayStart: new Date(snapshot.checkInDate),
    stayEnd: new Date(snapshot.checkOutDate),
    reason: "RESERVATION_ASSIGN_ROOM",
    correlationId: options.correlationId ?? eventId,
  });

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    room_number: roomInfo.roomNumber,
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      availabilityGuard: guardMetadata,
    },
  };

  try {
    return await enqueueReservationUpdate(
      tenantId,
      "reservation.assign_room",
      updatePayload,
      options,
    );
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guardMetadata.lockId,
          reservationId: command.reservation_id,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId: command.reservation_id, lockId: guardMetadata.lockId },
          "Released availability lock after assign-room transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          {
            reservationId: command.reservation_id,
            lockId: guardMetadata.lockId,
            err: releaseError,
          },
          "Failed to release availability lock after assign-room failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }
};

/**
 * Remove room assignment from a reservation.
 */
export const unassignRoom = async (
  tenantId: string,
  command: ReservationUnassignRoomCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    room_number: null,
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.unassign_room", updatePayload, options);
};

/**
 * Extend reservation stay dates with availability guard.
 */
export const extendStay = async (
  tenantId: string,
  command: ReservationExtendStayCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  // Fetch current reservation to check if extension requires availability lock
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new ReservationCommandError("RESERVATION_NOT_FOUND", `Reservation ${command.reservation_id} not found`);
  }

  const newCheckOut = new Date(command.new_check_out_date);
  const currentCheckOut = new Date(snapshot.checkOutDate);
  const checkIn = new Date(snapshot.checkInDate);

  // Validate new checkout is after check-in
  if (newCheckOut <= checkIn) {
    throw new ReservationCommandError("INVALID_DATES", "new_check_out_date must be after check_in_date");
  }

  // If extending (new checkout is later), verify availability for extended period
  let guardMetadata: AvailabilityGuardMetadata = {
    status: "SKIPPED",
    message: "NO_EXTENSION_REQUIRED",
  };

  if (newCheckOut > currentCheckOut) {
    guardMetadata = await lockReservationHold({
      tenantId,
      reservationId: command.reservation_id,
      roomTypeId: snapshot.roomTypeId,
      roomId: null, // Room assignment handled separately
      stayStart: currentCheckOut, // Lock from current checkout to new checkout
      stayEnd: newCheckOut,
      reason: "RESERVATION_EXTEND_STAY",
      correlationId: options.correlationId ?? eventId,
    });
  }

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    check_out_date: command.new_check_out_date,
    internal_notes: command.reason,
    metadata: {
      ...command.metadata,
      availabilityGuard: guardMetadata,
    },
  };

  try {
    return await enqueueReservationUpdate(
      tenantId,
      "reservation.extend_stay",
      updatePayload,
      options,
    );
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guardMetadata.lockId,
          reservationId: command.reservation_id,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId: command.reservation_id, lockId: guardMetadata.lockId },
          "Released availability lock after extend-stay transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          {
            reservationId: command.reservation_id,
            lockId: guardMetadata.lockId,
            err: releaseError,
          },
          "Failed to release availability lock after extend-stay failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }
};

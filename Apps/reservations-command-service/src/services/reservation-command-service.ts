import {
  type ReservationCancelledEvent,
  ReservationCancelledEventSchema,
  type ReservationCreatedEvent,
  ReservationCreatedEventSchema,
  type ReservationUpdatedEvent,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../clients/availability-guard-client.js";
import { serviceConfig } from "../config.js";
import { query, withTransaction } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import { enqueueOutboxRecordWithClient } from "../outbox/repository.js";
import { recordLifecyclePersisted } from "../repositories/lifecycle-repository.js";
import { insertRateFallbackRecord } from "../repositories/rate-fallback-repository.js";
import {
  getReservationGuardMetadata,
  type ReservationGuardMetadata as StoredGuardMetadata,
  upsertReservationGuardMetadata,
} from "../repositories/reservation-guard-metadata-repository.js";
import {
  fetchReservationCancellationInfo,
  fetchReservationStaySnapshot,
  type ReservationStaySnapshot,
} from "../repositories/reservation-repository.js";
import type {
  ReservationAssignRoomCommand,
  ReservationCancelCommand,
  ReservationCheckInCommand,
  ReservationCheckOutCommand,
  ReservationCreateCommand,
  ReservationDepositAddCommand,
  ReservationDepositReleaseCommand,
  ReservationExtendStayCommand,
  ReservationModifyCommand,
  ReservationNoShowCommand,
  ReservationRateOverrideCommand,
  ReservationUnassignRoomCommand,
  ReservationWaitlistAddCommand,
  ReservationWaitlistConvertCommand,
  ReservationWalkInCheckInCommand,
} from "../schemas/reservation-command.js";
import type { RatePlanResolution } from "../services/rate-plan-service.js";
import { resolveRatePlan } from "../services/rate-plan-service.js";
import { calculateCancellationFee } from "./cancellation-fee-service.js";

class ReservationCommandError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
  status: "accepted";
}

const DEFAULT_CURRENCY = "USD";
const APP_ACTOR = "COMMAND_CENTER";

/**
 * Accepts a reservation create command and enqueues its event payload
 * in the transactional outbox for asynchronous processing.
 */
export const createReservation = async (
  tenantId: string,
  command: ReservationCreateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const stayStart = new Date(command.check_in_date);
  const stayEnd = new Date(command.check_out_date);

  // Validate check_out_date is after check_in_date
  if (stayEnd <= stayStart) {
    throw new Error("INVALID_DATES: check_out_date must be after check_in_date");
  }

  const rateResolution: RatePlanResolution = await resolveRatePlan({
    tenantId,
    propertyId: command.property_id,
    roomTypeId: command.room_type_id,
    stayStart,
    stayEnd,
    requestedRateCode: command.rate_code,
  });

  // MED-007: Require explicit opt-in for rate fallback to prevent silent repricing
  if (rateResolution.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate code "${rateResolution.requestedRateCode}" is unavailable. ` +
        `Fallback to "${rateResolution.appliedRateCode}" requires allow_rate_fallback=true. ` +
        `Reason: ${rateResolution.reason}`,
    );
  }

  const rateFallbackMetadata = rateResolution.fallbackApplied
    ? {
        requestedCode: rateResolution.requestedRateCode,
        appliedCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        decidedBy: serviceConfig.serviceId,
        decidedAt: rateResolution.decidedAt.toISOString(),
      }
    : undefined;

  const normalizedCurrency = (command.currency ?? DEFAULT_CURRENCY).toUpperCase();

  const payload: ReservationCreatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.created",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
      ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
    },
    payload: {
      ...command,
      rate_code: rateResolution.appliedRateCode,
      check_in_date: stayStart,
      check_out_date: stayEnd,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: normalizedCurrency,
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
      reservation_type: command.reservation_type ?? "TRANSIENT",
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  const availabilityGuard: AvailabilityGuardMetadata | undefined = await lockReservationHold({
    tenantId,
    reservationId: aggregateId,
    roomTypeId: command.room_type_id,
    roomId: null,
    stayStart: new Date(command.check_in_date),
    stayEnd: new Date(command.check_out_date),
    reason: "RESERVATION_CREATE",
    correlationId: options.correlationId ?? eventId,
  });

  const guardMetadata = availabilityGuard ?? { status: "SKIPPED" };

  try {
    await withTransaction(async (client) => {
      if (rateResolution.fallbackApplied) {
        await insertRateFallbackRecord(client, {
          tenantId,
          reservationId: aggregateId,
          propertyId: command.property_id,
          requestedRateCode: rateResolution.requestedRateCode,
          appliedRateCode: rateResolution.appliedRateCode,
          reason: rateResolution.reason,
          actor: serviceConfig.serviceId,
          correlationId: options.correlationId,
          metadata: {
            decidedAt: rateResolution.decidedAt.toISOString(),
          },
        });
      }

      await recordLifecyclePersisted(client, {
        eventId,
        tenantId,
        reservationId: aggregateId,
        commandName: "reservation.create",
        correlationId: options.correlationId,
        partitionKey,
        details: {
          tenantId,
          reservationId: aggregateId,
          command: "reservation.create",
        },
        metadata: {
          eventType: validatedEvent.metadata.type,
          availabilityGuard: guardMetadata,
          ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
        },
      });

      if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
        await upsertReservationGuardMetadata(
          {
            tenantId,
            reservationId: aggregateId,
            lockId: guardMetadata.lockId,
            status: guardMetadata.status,
            metadata: guardMetadata,
          },
          client,
        );
      }

      await enqueueOutboxRecordWithClient(client, {
        eventId,
        tenantId,
        aggregateId,
        aggregateType: "reservation",
        eventType: validatedEvent.metadata.type,
        payload: validatedEvent,
        headers: {
          tenantId,
          eventId,
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        },
        correlationId: options.correlationId,
        partitionKey,
        metadata: {
          source: serviceConfig.serviceId,
          availabilityGuard: guardMetadata,
          ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
        },
      });
    });
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guardMetadata.lockId,
          reservationId: aggregateId,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId: aggregateId, lockId: guardMetadata.lockId },
          "Released availability lock after transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          { reservationId: aggregateId, lockId: guardMetadata.lockId, err: releaseError },
          "Failed to release availability lock after transaction failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

/**
 * Accept a reservation modify command and enqueue update events.
 */
export const modifyReservation = async (
  tenantId: string,
  command: ReservationModifyCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const snapshot: ReservationStaySnapshot | null = await fetchReservationStaySnapshot(
    tenantId,
    command.reservation_id,
  );
  if (!snapshot) {
    throw new Error(`Reservation ${command.reservation_id} not found for tenant ${tenantId}`);
  }

  const targetPropertyId = command.property_id ?? snapshot.propertyId;
  const targetRoomTypeId = command.room_type_id ?? snapshot.roomTypeId;
  const stayStart = new Date(command.check_in_date ?? snapshot.checkInDate);
  const stayEnd = new Date(command.check_out_date ?? snapshot.checkOutDate);

  // Validate dates (either from command or after merge with snapshot)
  if (stayEnd <= stayStart) {
    throw new Error("INVALID_DATES: check_out_date must be after check_in_date");
  }

  const shouldResolveRate = command.rate_code !== undefined;
  const rateResolution: RatePlanResolution | null = shouldResolveRate
    ? await resolveRatePlan({
        tenantId,
        propertyId: targetPropertyId,
        roomTypeId: targetRoomTypeId,
        stayStart,
        stayEnd,
        requestedRateCode: command.rate_code,
      })
    : null;

  // MED-007: Require explicit opt-in for rate fallback to prevent silent repricing
  if (rateResolution?.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate code "${rateResolution.requestedRateCode}" is unavailable. ` +
        `Fallback to "${rateResolution.appliedRateCode}" requires allow_rate_fallback=true. ` +
        `Reason: ${rateResolution.reason}`,
    );
  }

  const rateFallbackMetadata = rateResolution?.fallbackApplied
    ? {
        requestedCode: rateResolution.requestedRateCode,
        appliedCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        decidedBy: serviceConfig.serviceId,
        decidedAt: rateResolution.decidedAt.toISOString(),
      }
    : undefined;

  const eventId = uuid();
  const updatePayload = buildReservationUpdatePayload(
    tenantId,
    command,
    rateResolution?.appliedRateCode,
  );
  const payload: ReservationUpdatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.updated",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
      ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
    },
    payload: updatePayload,
  };

  const validatedEvent = ReservationUpdatedEventSchema.parse(payload);
  const stayChanged = hasStayCriticalChanges(command, snapshot);
  const guardMetadata: AvailabilityGuardMetadata = stayChanged
    ? await lockReservationHold({
        tenantId,
        reservationId: command.reservation_id,
        roomTypeId: command.room_type_id ?? snapshot.roomTypeId,
        roomId: null,
        stayStart: new Date(command.check_in_date ?? snapshot.checkInDate),
        stayEnd: new Date(command.check_out_date ?? snapshot.checkOutDate),
        reason: "RESERVATION_MODIFY",
        correlationId: options.correlationId ?? eventId,
      })
    : {
        status: "SKIPPED",
        message: "NO_STAY_CRITICAL_CHANGES",
      };

  try {
    await withTransaction(async (client) => {
      if (rateResolution?.fallbackApplied) {
        await insertRateFallbackRecord(client, {
          tenantId,
          reservationId: command.reservation_id,
          propertyId: targetPropertyId,
          requestedRateCode: rateResolution.requestedRateCode,
          appliedRateCode: rateResolution.appliedRateCode,
          reason: rateResolution.reason,
          actor: serviceConfig.serviceId,
          correlationId: options.correlationId,
          metadata: {
            decidedAt: rateResolution.decidedAt.toISOString(),
          },
        });
      }

      await recordLifecyclePersisted(client, {
        eventId,
        tenantId,
        reservationId: command.reservation_id,
        commandName: "reservation.modify",
        correlationId: options.correlationId,
        partitionKey: command.reservation_id,
        details: {
          tenantId,
          reservationId: command.reservation_id,
          command: "reservation.modify",
        },
        metadata: {
          eventType: validatedEvent.metadata.type,
          availabilityGuard: guardMetadata,
          ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
        },
      });

      if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
        await upsertReservationGuardMetadata(
          {
            tenantId,
            reservationId: command.reservation_id,
            lockId: guardMetadata.lockId,
            status: guardMetadata.status,
            metadata: guardMetadata,
          },
          client,
        );
      }

      await enqueueOutboxRecordWithClient(client, {
        eventId,
        tenantId,
        aggregateId: command.reservation_id,
        aggregateType: "reservation",
        eventType: validatedEvent.metadata.type,
        payload: validatedEvent,
        headers: {
          tenantId,
          eventId,
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        },
        correlationId: options.correlationId,
        partitionKey: command.reservation_id,
        metadata: {
          source: serviceConfig.serviceId,
          availabilityGuard: guardMetadata,
          ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
        },
      });
    });
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
          "Released availability lock after modify transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          {
            reservationId: command.reservation_id,
            lockId: guardMetadata.lockId,
            err: releaseError,
          },
          "Failed to release availability lock after modify transaction failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

type ReservationUpdatePayload = ReservationUpdatedEvent["payload"];

const enqueueReservationUpdate = async (
  tenantId: string,
  commandName: string,
  payload: ReservationUpdatePayload,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const updateEvent = ReservationUpdatedEventSchema.parse({
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.updated",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload,
  });

  const aggregateId = updateEvent.payload.id;
  const partitionKey = aggregateId;

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: aggregateId,
      commandName,
      correlationId: options.correlationId,
      partitionKey,
      details: {
        tenantId,
        reservationId: aggregateId,
        command: commandName,
      },
      metadata: {
        eventType: updateEvent.metadata.type,
      },
    });

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId,
      aggregateType: "reservation",
      eventType: updateEvent.metadata.type,
      payload: updateEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey,
      metadata: {
        source: serviceConfig.serviceId,
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

const fetchRoomNumber = async (tenantId: string, roomId: string): Promise<string | null> => {
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
  return rows[0]?.room_number ?? null;
};

/**
 * Find the best available room matching a room type for the given stay dates.
 * Selects the first clean, available room with no overlapping locks or reservations.
 * Used for auto-assignment at check-in and walk-in express.
 */
const findBestAvailableRoom = async (
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<{ room_id: string; room_number: string } | null> => {
  const { rows } = await query<{ room_id: string; room_number: string }>(
    `SELECT r.id AS room_id, r.room_number
     FROM rooms r
     WHERE r.tenant_id = $1::uuid
       AND r.property_id = $2::uuid
       AND r.room_type_id = $3::uuid
       AND r.status = 'AVAILABLE'
       AND r.housekeeping_status IN ('CLEAN', 'INSPECTED')
       AND COALESCE(r.is_blocked, false) = false
       AND COALESCE(r.is_out_of_order, false) = false
       AND COALESCE(r.is_deleted, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM inventory_locks_shadow ils
         WHERE ils.room_id = r.id AND ils.tenant_id = r.tenant_id
           AND ils.status = 'ACTIVE'
           AND ils.stay_start < $5::date AND ils.stay_end > $4::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM reservations res
         WHERE res.room_number = r.room_number AND res.tenant_id = r.tenant_id
           AND res.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
           AND res.check_in_date < $5::date AND res.check_out_date > $4::date
       )
     ORDER BY r.room_number
     LIMIT 1`,
    [tenantId, propertyId, roomTypeId, checkIn.toISOString(), checkOut.toISOString()],
  );
  return rows[0] ?? null;
};

/**
 * Check in a reservation: validates status, assigns room, marks room OCCUPIED.
 * PMS industry standard pre-conditions:
 *  - Reservation must exist and belong to this tenant
 *  - Status must be PENDING or CONFIRMED (not already CHECKED_IN, CANCELLED, etc.)
 *  - If a room_id is provided, the room must be AVAILABLE
 */
export const checkInReservation = async (
  tenantId: string,
  command: ReservationCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and status allows check-in
  const resResult = await query(
    `SELECT id, status, room_type_id, guest_id, total_amount, check_in_date, check_out_date
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        room_type_id: string;
        guest_id: string;
        total_amount: number;
        check_in_date: Date;
        check_out_date: Date;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const allowedStatuses = ["PENDING", "CONFIRMED"];
  if (!allowedStatuses.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CHECKIN",
      `Cannot check in reservation with status ${reservation.status}; must be PENDING or CONFIRMED`,
    );
  }

  // 2. Validate room is available and clean if room_id provided.
  //    If no room_id, auto-assign the best available room for this room type.
  let assignedRoomId = command.room_id;
  let assignedRoomNumber: string | null = null;

  if (assignedRoomId) {
    const roomResult = await query(
      `SELECT id, status, room_number FROM rooms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [assignedRoomId, tenantId],
    );
    const room = roomResult.rows?.[0] as
      | { id: string; status: string; room_number: string }
      | undefined;
    if (!room) {
      throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${assignedRoomId} not found`);
    }
    if (room.status === "DIRTY") {
      throw new ReservationCommandError(
        "ROOM_NOT_CLEAN",
        `Room ${room.room_number} is DIRTY and must be cleaned before check-in`,
      );
    }
    if (room.status === "OUT_OF_ORDER" || room.status === "OUT_OF_SERVICE") {
      throw new ReservationCommandError(
        "ROOM_UNAVAILABLE",
        `Room ${room.room_number} is ${room.status} and cannot accept check-ins`,
      );
    }
    if (room.status !== "AVAILABLE") {
      throw new ReservationCommandError(
        "ROOM_NOT_AVAILABLE",
        `Room ${room.room_number} is ${room.status}, not AVAILABLE`,
      );
    }
    assignedRoomNumber = room.room_number;
  } else {
    // Auto-assign: find the best available room matching the reservation's room type
    const resPropertyResult = await query(
      `SELECT property_id FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [command.reservation_id, tenantId],
    );
    const propertyId = (resPropertyResult.rows?.[0] as { property_id: string } | undefined)
      ?.property_id;
    if (propertyId) {
      const bestRoom = await findBestAvailableRoom(
        tenantId,
        propertyId,
        reservation.room_type_id,
        new Date(reservation.check_in_date),
        new Date(reservation.check_out_date),
      );
      if (bestRoom) {
        assignedRoomId = bestRoom.room_id;
        assignedRoomNumber = bestRoom.room_number;
        reservationsLogger.info(
          { reservationId: command.reservation_id, autoAssigned: bestRoom.room_number },
          "Auto-assigned best available room for check-in",
        );
      } else {
        reservationsLogger.warn(
          { reservationId: command.reservation_id, roomTypeId: reservation.room_type_id },
          "No clean available room found for auto-assignment; proceeding without room",
        );
      }
    }
  }

  // 3. Warn if no deposit has been received for a reservation with charges
  if (Number(reservation.total_amount) > 0) {
    try {
      const depositResult = await query(
        `SELECT COALESCE(SUM(amount), 0) AS deposit_total
         FROM payments
         WHERE reservation_id = $1 AND tenant_id = $2
           AND transaction_type IN ('CAPTURE', 'AUTHORIZATION', 'DEPOSIT')
           AND status IN ('COMPLETED', 'AUTHORIZED')`,
        [command.reservation_id, tenantId],
      );
      const depositTotal = Number(depositResult.rows?.[0]?.deposit_total ?? 0);
      if (depositTotal === 0) {
        reservationsLogger.warn(
          { reservationId: command.reservation_id, totalAmount: reservation.total_amount },
          "Check-in without any deposit or payment guarantee on file",
        );
      }
    } catch {
      // Non-critical deposit check
    }
  }

  const roomNumber =
    assignedRoomNumber ?? (assignedRoomId ? await fetchRoomNumber(tenantId, assignedRoomId) : null);
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_IN",
    actual_check_in: command.checked_in_at ?? new Date(),
    ...(roomNumber ? { room_number: roomNumber } : {}),
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      room_id: assignedRoomId,
      guest_id: reservation.guest_id,
      room_type_id: reservation.room_type_id,
      auto_assigned: !command.room_id && !!assignedRoomId,
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.check_in",
    updatePayload,
    options,
  );

  // 3. Mark room as OCCUPIED (post-enqueue, best-effort)
  if (assignedRoomId) {
    try {
      await query(
        `UPDATE rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [assignedRoomId, tenantId],
      );
      reservationsLogger.info(
        { roomId: assignedRoomId, reservationId: command.reservation_id },
        "Room marked OCCUPIED on check-in",
      );
    } catch (roomError) {
      reservationsLogger.warn(
        { roomId: assignedRoomId, error: roomError },
        "Failed to mark room OCCUPIED on check-in — manual update required",
      );
    }
  }

  return result;
};

/**
 * Check out a reservation: validates status, marks room DIRTY, updates guest stats.
 * PMS industry standard pre-conditions:
 *  - Reservation must exist and be CHECKED_IN
 *  - Guest stats (nights, revenue, last_stay_date) are updated
 *  - Associated room transitions to DIRTY for housekeeping
 *  - Folio should be settled (logged as warning if not, but doesn't block checkout)
 */
export const checkOutReservation = async (
  tenantId: string,
  command: ReservationCheckOutCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and is CHECKED_IN
  const resResult = await query(
    `SELECT id, status, guest_id, room_number, room_type_id, total_amount,
            check_in_date, check_out_date, actual_check_in
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        guest_id: string;
        room_number: string | null;
        room_type_id: string;
        total_amount: number;
        check_in_date: Date;
        check_out_date: Date;
        actual_check_in: Date | null;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  if (reservation.status !== "CHECKED_IN") {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CHECKOUT",
      `Cannot check out reservation with status ${reservation.status}; must be CHECKED_IN`,
    );
  }

  // 2. Enforce folio settlement (blocks checkout unless force=true or express=true)
  try {
    const folioResult = await query(
      `SELECT folio_id, balance FROM folios
       WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN' LIMIT 1`,
      [command.reservation_id, tenantId],
    );
    const folio = folioResult.rows?.[0] as { folio_id: string; balance: number } | undefined;
    if (folio && Number(folio.balance) > 0) {
      if (command.express) {
        // Express checkout: auto-settle the folio (post-departure billing for any balance)
        try {
          await query(
            `UPDATE folios
             SET folio_status = 'SETTLED',
                 settled_at = NOW(),
                 close_reason = 'EXPRESS_CHECKOUT',
                 updated_at = NOW()
             WHERE folio_id = $1 AND tenant_id = $2`,
            [folio.folio_id, tenantId],
          );
          reservationsLogger.info(
            {
              reservationId: command.reservation_id,
              folioId: folio.folio_id,
              balance: folio.balance,
            },
            "Express checkout: folio auto-settled for post-departure billing",
          );
        } catch (settleErr) {
          reservationsLogger.warn(
            { folioId: folio.folio_id, error: settleErr },
            "Express checkout: failed to auto-settle folio, proceeding anyway",
          );
        }
      } else if (command.force) {
        reservationsLogger.warn(
          {
            reservationId: command.reservation_id,
            folioId: folio.folio_id,
            balance: folio.balance,
          },
          "Check-out forced with unsettled folio balance",
        );
      } else {
        throw new ReservationCommandError(
          "FOLIO_UNSETTLED",
          `Cannot check out — folio ${folio.folio_id} has outstanding balance of ${folio.balance}. Use force:true or express:true to override.`,
        );
      }
    } else if (folio && command.express) {
      // Express checkout with $0 balance: just settle the folio cleanly
      try {
        await query(
          `UPDATE folios
           SET folio_status = 'SETTLED',
               settled_at = NOW(),
               close_reason = 'EXPRESS_CHECKOUT',
               updated_at = NOW()
           WHERE folio_id = $1 AND tenant_id = $2`,
          [folio.folio_id, tenantId],
        );
      } catch {
        // Non-critical
      }
    }
  } catch (err) {
    if (err instanceof ReservationCommandError) throw err;
    // Non-critical if folio query itself fails
  }

  const checkOutTime = command.checked_out_at ?? new Date();

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_OUT",
    actual_check_out: checkOutTime,
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      guest_id: reservation.guest_id,
      room_number: reservation.room_number,
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.check_out",
    updatePayload,
    options,
  );

  // 3. Mark room as DIRTY for housekeeping (post-enqueue, best-effort)
  if (reservation.room_number) {
    try {
      await query(
        `UPDATE rooms SET status = 'DIRTY', version = version + 1, updated_at = NOW()
         WHERE room_number = $1 AND tenant_id = $2`,
        [reservation.room_number, tenantId],
      );
      reservationsLogger.info(
        { roomNumber: reservation.room_number, reservationId: command.reservation_id },
        "Room marked DIRTY on check-out",
      );
    } catch (roomError) {
      reservationsLogger.warn(
        { roomNumber: reservation.room_number, error: roomError },
        "Failed to mark room DIRTY on check-out",
      );
    }
  }

  // 4. Update guest stay statistics (total_nights, total_revenue, last_stay_date)
  try {
    const actualIn = reservation.actual_check_in ?? reservation.check_in_date;
    const nights = Math.max(
      1,
      Math.round((checkOutTime.getTime() - new Date(actualIn).getTime()) / (1000 * 60 * 60 * 24)),
    );
    const { updateGuestStayStats } = await import("./reservation-event-handler.js");
    await updateGuestStayStats(
      tenantId,
      reservation.guest_id,
      nights,
      Number(reservation.total_amount),
      checkOutTime,
    );
    reservationsLogger.info(
      { guestId: reservation.guest_id, nights, revenue: reservation.total_amount },
      "Guest stay stats updated on check-out",
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId: reservation.guest_id, error: statsError },
      "Failed to update guest stay stats on check-out",
    );
  }

  return result;
};

/**
 * Assign a room to a reservation with availability guard.
 */
export const assignRoom = async (
  tenantId: string,
  command: ReservationAssignRoomCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const roomNumber = await fetchRoomNumber(tenantId, command.room_id);
  if (!roomNumber) {
    throw new Error("ROOM_NOT_FOUND");
  }

  // Fetch reservation to get stay dates for availability check
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new Error("RESERVATION_NOT_FOUND");
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
    room_number: roomNumber,
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
    throw new Error("RESERVATION_NOT_FOUND");
  }

  const newCheckOut = new Date(command.new_check_out_date);
  const currentCheckOut = new Date(snapshot.checkOutDate);
  const checkIn = new Date(snapshot.checkInDate);

  // Validate new checkout is after check-in
  if (newCheckOut <= checkIn) {
    throw new Error("INVALID_DATES: new_check_out_date must be after check_in_date");
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

/**
 * Override the reservation rate code and amount.
 */
export const overrideRate = async (
  tenantId: string,
  command: ReservationRateOverrideCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    rate_code: command.rate_code?.toUpperCase(),
    total_amount: command.total_amount,
    currency: command.currency?.toUpperCase(),
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.rate_override", updatePayload, options);
};

/**
 * Add a reservation deposit entry.
 */
export const addDeposit = async (
  tenantId: string,
  command: ReservationDepositAddCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.notes,
    metadata: {
      deposit_event: {
        type: "add",
        amount: command.amount,
        currency: command.currency ?? DEFAULT_CURRENCY,
        method: command.method,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.add_deposit", updatePayload, options);
};

/**
 * Release a reservation deposit entry.
 */
export const releaseDeposit = async (
  tenantId: string,
  command: ReservationDepositReleaseCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.reason,
    metadata: {
      deposit_event: {
        type: "release",
        amount: command.amount,
        deposit_id: command.deposit_id,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.release_deposit", updatePayload, options);
};

/**
 * Mark a reservation as no-show.
 * PMS standard: guest did not arrive by the cutoff time.
 * Sets is_no_show, no_show_date, no_show_fee, status = NO_SHOW, releases room.
 */
export const markNoShow = async (
  tenantId: string,
  command: ReservationNoShowCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and is eligible for no-show
  const resResult = await query(
    `SELECT id, status, room_number, room_rate, total_amount, guest_id
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        room_number: string | null;
        room_rate: number;
        total_amount: number;
        guest_id: string;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const eligibleStatuses = ["PENDING", "CONFIRMED"];
  if (!eligibleStatuses.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_NO_SHOW",
      `Cannot mark no-show for reservation with status ${reservation.status}; must be PENDING or CONFIRMED`,
    );
  }

  // 2. Calculate no-show fee (default to 1 night room rate if not specified)
  const noShowFee = command.no_show_fee ?? Number(reservation.room_rate ?? 0);

  // 3. Enqueue status update
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "NO_SHOW",
    metadata: {
      ...command.metadata,
      is_no_show: true,
      no_show_date: new Date().toISOString(),
      no_show_fee: noShowFee,
      reason: command.reason ?? "Guest did not arrive",
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.no_show",
    updatePayload,
    options,
  );

  // 4. Update no-show columns directly (event handler handles status/version)
  try {
    await query(
      `UPDATE reservations
       SET is_no_show = true,
           no_show_date = NOW(),
           no_show_fee = $3,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [command.reservation_id, tenantId, noShowFee],
    );
  } catch (err) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: err },
      "Failed to set no-show columns directly; event handler will process",
    );
  }

  // 5. Release room if assigned (best-effort)
  if (reservation.room_number) {
    try {
      await query(
        `UPDATE rooms SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
         WHERE room_number = $1 AND tenant_id = $2`,
        [reservation.room_number, tenantId],
      );
      reservationsLogger.info(
        { roomNumber: reservation.room_number },
        "Room released back to AVAILABLE on no-show",
      );
    } catch {
      // Non-critical
    }
  }

  reservationsLogger.info(
    { reservationId: command.reservation_id, noShowFee, reason: command.reason },
    "Reservation marked as NO_SHOW",
  );

  return result;
};

/**
 * Cancel a reservation and release availability holds.
 * Calculates cancellation fee based on the rate's cancellation_policy.
 * Only PENDING or CONFIRMED reservations may be cancelled.
 */
export const cancelReservation = async (
  tenantId: string,
  command: ReservationCancelCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const now = new Date();

  // G5-cancel: Validate reservation status allows cancellation
  const statusResult = await query(
    `SELECT status FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = statusResult.rows?.[0] as { status: string } | undefined;
  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }
  const cancelAllowed = ["PENDING", "CONFIRMED"];
  if (!cancelAllowed.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CANCEL",
      `Cannot cancel reservation with status ${reservation.status}; must be PENDING or CONFIRMED`,
    );
  }

  // Calculate cancellation fee from rate policy
  let cancellationFee = 0;
  try {
    const cancellationInfo = await fetchReservationCancellationInfo(
      tenantId,
      command.reservation_id,
    );
    if (cancellationInfo) {
      const feeResult = calculateCancellationFee(cancellationInfo, now);
      cancellationFee = feeResult.fee;
      reservationsLogger.info(
        {
          reservationId: command.reservation_id,
          policyType: feeResult.policyType,
          hoursUntilCheckIn: feeResult.hoursUntilCheckIn,
          policyDeadlineHours: feeResult.policyDeadlineHours,
          withinPenaltyWindow: feeResult.withinPenaltyWindow,
          cancellationFee,
        },
        "Cancellation fee calculated",
      );
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to calculate cancellation fee; proceeding with fee = 0",
    );
  }

  const payload: ReservationCancelledEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.cancelled",
      timestamp: now.toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      cancelled_at: now,
      cancelled_by: command.cancelled_by,
      reason: command.reason,
      cancellation_fee: cancellationFee > 0 ? cancellationFee : undefined,
    },
  };

  const validatedEvent = ReservationCancelledEventSchema.parse(payload);

  const guardRecord: StoredGuardMetadata | null = await getReservationGuardMetadata(
    tenantId,
    command.reservation_id,
  );
  const releaseLockId = guardRecord?.lockId ?? command.reservation_id;

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: command.reservation_id,
      commandName: "reservation.cancel",
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      details: {
        tenantId,
        reservationId: command.reservation_id,
        command: "reservation.cancel",
      },
      metadata: {
        eventType: validatedEvent.metadata.type,
        action: "cancel",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });

    if (guardRecord) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          lockId: guardRecord.lockId ?? releaseLockId,
          status: "RELEASE_REQUESTED",
          metadata: {
            previousStatus: guardRecord.status,
            reason: command.reason ?? "RESERVATION_CANCEL",
          },
        },
        client,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.reservation_id,
      aggregateType: "reservation",
      eventType: validatedEvent.metadata.type,
      payload: validatedEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      metadata: {
        source: serviceConfig.serviceId,
        action: "cancel",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });
  });

  // Release availability hold AFTER transaction succeeds
  // If this fails, reservation is cancelled but hold remains (safer than reverse)
  try {
    await releaseReservationHold({
      tenantId,
      lockId: releaseLockId,
      reservationId: command.reservation_id,
      reason: command.reason ?? "RESERVATION_CANCEL",
      correlationId: options.correlationId ?? eventId,
    });
  } catch (releaseError) {
    reservationsLogger.warn(
      {
        reservationId: command.reservation_id,
        lockId: releaseLockId,
        error: releaseError,
      },
      "Failed to release availability hold after cancellation - hold may require manual cleanup",
    );
  }

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

/**
 * Walk-in express check-in: creates a reservation, assigns a room, and checks
 * in the guest in a single synchronous operation. Bypasses the normal async
 * create pipeline because the guest is at the front desk and needs immediate
 * accommodation.
 *
 * Flow: Direct INSERT → room OCCUPIED → availability lock → outbox event.
 */
export const walkInCheckIn = async (
  tenantId: string,
  command: ReservationWalkInCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const reservationId = uuid();
  const now = new Date();
  const checkInDate = now;
  const checkOutDate = new Date(command.check_out_date);

  if (checkOutDate <= checkInDate) {
    throw new ReservationCommandError(
      "INVALID_DATES",
      "check_out_date must be after today for walk-in check-in",
    );
  }

  // 1. Resolve rate plan
  const rateResolution = await resolveRatePlan({
    tenantId,
    propertyId: command.property_id,
    roomTypeId: command.room_type_id,
    stayStart: checkInDate,
    stayEnd: checkOutDate,
    requestedRateCode: command.rate_code,
  });

  if (rateResolution.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate "${rateResolution.requestedRateCode}" unavailable; set allow_rate_fallback=true for fallback to "${rateResolution.appliedRateCode}"`,
    );
  }

  // 2. Find or validate room
  let roomId = command.room_id ?? null;
  let roomNumber: string | null = null;

  if (roomId) {
    const rn = await fetchRoomNumber(tenantId, roomId);
    if (!rn) throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${roomId} not found`);
    // Validate room is available
    const roomResult = await query(
      `SELECT status FROM rooms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [roomId, tenantId],
    );
    const roomStatus = (roomResult.rows?.[0] as { status: string } | undefined)?.status;
    if (roomStatus !== "AVAILABLE") {
      throw new ReservationCommandError(
        "ROOM_NOT_AVAILABLE",
        `Room ${rn} is ${roomStatus}, not AVAILABLE`,
      );
    }
    roomNumber = rn;
  } else {
    // Auto-assign best available room
    const bestRoom = await findBestAvailableRoom(
      tenantId,
      command.property_id,
      command.room_type_id,
      checkInDate,
      checkOutDate,
    );
    if (!bestRoom) {
      throw new ReservationCommandError(
        "NO_AVAILABLE_ROOMS",
        "No clean available rooms found for the requested room type",
      );
    }
    roomId = bestRoom.room_id;
    roomNumber = bestRoom.room_number;
  }

  // 3. Look up guest details
  const guestResult = await query(
    `SELECT first_name, last_name, email FROM guests WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.guest_id, tenantId],
  );
  const guest = guestResult.rows?.[0] as
    | { first_name: string; last_name: string; email: string }
    | undefined;
  const guestName = guest
    ? `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim()
    : "Walk-In Guest";
  const guestEmail = guest?.email ?? "walkin@unknown.com";

  // 4. Calculate nightly rate
  const nights = Math.max(
    1,
    Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalAmount = Number(command.total_amount ?? 0);
  const roomRate = Number((totalAmount / nights).toFixed(2));
  const currency = (command.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const confirmation = `TW-${reservationId.slice(0, 8).toUpperCase()}`;

  // 5. Lock availability
  const walkInGuardMetadata = await lockReservationHold({
    tenantId,
    reservationId,
    roomTypeId: command.room_type_id,
    roomId,
    stayStart: checkInDate,
    stayEnd: checkOutDate,
    reason: "WALKIN_CHECKIN",
    correlationId: options.correlationId ?? eventId,
  });

  // 6. Direct INSERT + room OCCUPIED + outbox event in one transaction
  try {
    await withTransaction(async (client) => {
      // Insert reservation directly (CHECKED_IN from the start)
      await client.query(
        `INSERT INTO reservations (
        id, tenant_id, property_id, guest_id, room_type_id,
        check_in_date, check_out_date, booking_date,
        status, source, reservation_type,
        room_rate, total_amount, currency,
        guest_name, guest_email, confirmation_number,
        room_number, actual_check_in,
        eta, company_id, travel_agent_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, NOW(),
        'CHECKED_IN', 'WALKIN', 'TRANSIENT',
        $8, $9, $10,
        $11, $12, $13,
        $14, NOW(),
        $15, $16, $17,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING`,
        [
          reservationId,
          tenantId,
          command.property_id,
          command.guest_id,
          command.room_type_id,
          checkInDate.toISOString().slice(0, 10),
          checkOutDate.toISOString().slice(0, 10),
          roomRate,
          totalAmount,
          currency,
          guestName,
          guestEmail,
          confirmation,
          roomNumber,
          command.eta ?? null,
          command.company_id ?? null,
          command.travel_agent_id ?? null,
        ],
      );

      // Mark room OCCUPIED
      await client.query(
        `UPDATE rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
        [roomId, tenantId],
      );

      // Record lifecycle
      await recordLifecyclePersisted(client, {
        eventId,
        tenantId,
        reservationId,
        commandName: "reservation.walkin_checkin",
        correlationId: options.correlationId,
        partitionKey: command.guest_id,
        details: {
          tenantId,
          reservationId,
          command: "reservation.walkin_checkin",
          roomNumber,
          source: "WALKIN",
        },
        metadata: { eventType: "reservation.created" },
      });

      // Enqueue outbox event for downstream consumers
      const createdEvent = {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "reservation.created",
          timestamp: now.toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          id: reservationId,
          property_id: command.property_id,
          guest_id: command.guest_id,
          room_type_id: command.room_type_id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          booking_date: now,
          total_amount: totalAmount,
          currency,
          status: "CHECKED_IN",
          source: "WALKIN",
          reservation_type: "TRANSIENT",
          rate_code: rateResolution.appliedRateCode,
        },
      };

      await enqueueOutboxRecordWithClient(client, {
        eventId,
        tenantId,
        aggregateId: reservationId,
        aggregateType: "reservation",
        eventType: "reservation.created",
        payload: createdEvent,
        headers: { tenantId, eventId },
        correlationId: options.correlationId,
        partitionKey: command.guest_id,
        metadata: {
          source: serviceConfig.serviceId,
          walkIn: true,
          roomNumber,
        },
      });
    });
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (walkInGuardMetadata.status === "LOCKED" && walkInGuardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: walkInGuardMetadata.lockId,
          reservationId,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId, lockId: walkInGuardMetadata.lockId },
          "Released availability lock after walk-in transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          { reservationId, lockId: walkInGuardMetadata.lockId, err: releaseError },
          "Failed to release availability lock after walk-in failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

  reservationsLogger.info(
    { reservationId, roomNumber, guestName, confirmation },
    "Walk-in express check-in completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Add a guest to the waitlist for a sold-out date/room type.
 * Inserts a row into the waitlist_entries table.
 */
export const waitlistAdd = async (
  tenantId: string,
  command: ReservationWaitlistAddCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const waitlistId = uuid();

  const arrivalDate = new Date(command.arrival_date);
  const departureDate = new Date(command.departure_date);
  if (departureDate <= arrivalDate) {
    throw new ReservationCommandError("INVALID_DATES", "departure_date must be after arrival_date");
  }

  await query(
    `INSERT INTO waitlist_entries (
      waitlist_id, tenant_id, property_id, guest_id,
      requested_room_type_id, requested_rate_id,
      arrival_date, departure_date,
      number_of_rooms, number_of_adults, number_of_children,
      flexibility, waitlist_status, vip_flag, notes,
      created_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8,
      $9, $10, $11,
      $12, 'ACTIVE', $13, $14,
      NOW()
    )`,
    [
      waitlistId,
      tenantId,
      command.property_id,
      command.guest_id,
      command.requested_room_type_id,
      command.requested_rate_id ?? null,
      arrivalDate.toISOString().slice(0, 10),
      departureDate.toISOString().slice(0, 10),
      command.number_of_rooms ?? 1,
      command.number_of_adults ?? 1,
      command.number_of_children ?? 0,
      command.flexibility ?? "NONE",
      command.vip_flag ?? false,
      command.notes ?? null,
    ],
  );

  reservationsLogger.info(
    {
      waitlistId,
      guestId: command.guest_id,
      roomTypeId: command.requested_room_type_id,
      arrivalDate: arrivalDate.toISOString().slice(0, 10),
    },
    "Guest added to waitlist",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Convert a waitlist entry into a confirmed reservation.
 * Marks the waitlist entry as CONFIRMED and creates a new reservation
 * through the normal creation pipeline.
 */
export const waitlistConvert = async (
  tenantId: string,
  command: ReservationWaitlistConvertCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Fetch waitlist entry
  const wlResult = await query(
    `SELECT waitlist_id, guest_id, requested_room_type_id, requested_rate_id,
            arrival_date, departure_date, number_of_adults, number_of_children,
            waitlist_status, notes
     FROM waitlist_entries
     WHERE waitlist_id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false
     LIMIT 1`,
    [command.waitlist_id, tenantId],
  );
  const entry = wlResult.rows?.[0] as
    | {
        waitlist_id: string;
        guest_id: string;
        requested_room_type_id: string;
        requested_rate_id: string | null;
        arrival_date: Date;
        departure_date: Date;
        number_of_adults: number;
        number_of_children: number;
        waitlist_status: string;
        notes: string | null;
      }
    | undefined;

  if (!entry) {
    throw new ReservationCommandError(
      "WAITLIST_NOT_FOUND",
      `Waitlist entry ${command.waitlist_id} not found`,
    );
  }
  if (entry.waitlist_status !== "ACTIVE" && entry.waitlist_status !== "OFFERED") {
    throw new ReservationCommandError(
      "INVALID_WAITLIST_STATUS",
      `Cannot convert waitlist with status ${entry.waitlist_status}; must be ACTIVE or OFFERED`,
    );
  }

  // 2. Mark waitlist entry as CONFIRMED
  await query(
    `UPDATE waitlist_entries
     SET waitlist_status = 'CONFIRMED', updated_at = NOW()
     WHERE waitlist_id = $1 AND tenant_id = $2`,
    [command.waitlist_id, tenantId],
  );

  // 3. Create reservation via the normal pipeline
  const roomTypeId = command.room_type_id ?? entry.requested_room_type_id;
  const result = await createReservation(
    tenantId,
    {
      property_id: command.property_id,
      guest_id: entry.guest_id,
      room_type_id: roomTypeId,
      check_in_date: entry.arrival_date,
      check_out_date: entry.departure_date,
      rate_code: command.rate_code,
      allow_rate_fallback: command.allow_rate_fallback,
      total_amount: command.total_amount,
      currency: command.currency,
      notes: command.notes ?? entry.notes ?? undefined,
      source: "DIRECT",
      reservation_type: "TRANSIENT",
    },
    options,
  );

  // 4. Link waitlist entry to the new reservation
  try {
    await query(
      `UPDATE waitlist_entries SET reservation_id = $3, updated_at = NOW()
       WHERE waitlist_id = $1 AND tenant_id = $2`,
      [command.waitlist_id, tenantId, result.eventId],
    );
  } catch {
    // Non-critical
  }

  reservationsLogger.info(
    { waitlistId: command.waitlist_id, guestId: entry.guest_id },
    "Waitlist entry converted to reservation",
  );

  return result;
};

const buildReservationUpdatePayload = (
  tenantId: string,
  command: ReservationModifyCommand,
  rateCode?: string,
): ReservationUpdatedEvent["payload"] => {
  const payload: ReservationUpdatedEvent["payload"] = {
    id: command.reservation_id,
    tenant_id: tenantId,
  };

  if (command.property_id) {
    payload.property_id = command.property_id;
  }
  if (command.guest_id) {
    payload.guest_id = command.guest_id;
  }
  if (command.room_type_id) {
    payload.room_type_id = command.room_type_id;
  }
  if (command.check_in_date) {
    payload.check_in_date = command.check_in_date;
  }
  if (command.check_out_date) {
    payload.check_out_date = command.check_out_date;
  }
  if (command.booking_date) {
    payload.booking_date = command.booking_date;
  }
  if (command.status) {
    payload.status = command.status;
  }
  if (command.total_amount !== undefined) {
    payload.total_amount = command.total_amount;
  }
  if (command.currency) {
    payload.currency = command.currency.toUpperCase();
  }
  if (command.notes) {
    payload.internal_notes = command.notes;
  }
  if (rateCode) {
    payload.rate_code = rateCode;
  } else if (command.rate_code) {
    payload.rate_code = command.rate_code.toUpperCase();
  }
  return payload;
};

const hasStayCriticalChanges = (
  command: ReservationModifyCommand,
  snapshot: {
    roomTypeId: string;
    checkInDate: Date;
    checkOutDate: Date;
  },
): boolean => {
  const roomTypeChanged =
    command.room_type_id !== undefined && command.room_type_id !== snapshot.roomTypeId;
  const checkInChanged =
    command.check_in_date !== undefined &&
    new Date(command.check_in_date).getTime() !== snapshot.checkInDate.getTime();
  const checkOutChanged =
    command.check_out_date !== undefined &&
    new Date(command.check_out_date).getTime() !== snapshot.checkOutDate.getTime();

  return roomTypeChanged || checkInChanged || checkOutChanged;
};

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
  ReservationBatchNoShowCommand,
  ReservationCancelCommand,
  ReservationCheckInCommand,
  ReservationCheckOutCommand,
  ReservationCreateCommand,
  ReservationDepositAddCommand,
  ReservationDepositReleaseCommand,
  ReservationExpireCommand,
  ReservationExtendStayCommand,
  ReservationModifyCommand,
  ReservationNoShowCommand,
  ReservationRateOverrideCommand,
  ReservationSendQuoteCommand,
  ReservationConvertQuoteCommand,
  ReservationUnassignRoomCommand,
  ReservationWaitlistAddCommand,
  ReservationWaitlistConvertCommand,
  ReservationWalkInCheckInCommand,
  ReservationWalkGuestCommand,
  GroupCreateCommand,
  GroupAddRoomsCommand,
  GroupUploadRoomingListCommand,
  GroupCutoffEnforceCommand,
  GroupBillingSetupCommand,
  IntegrationOtaSyncRequestCommand,
  IntegrationOtaRatePushCommand,
  IntegrationWebhookRetryCommand,
  IntegrationMappingUpdateCommand,
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
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

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

type RoomInfo = { roomNumber: string; roomTypeId: string };

/**
 * Fetch a room's display number and type. Returns null when the room does not
 * exist or has been soft-deleted.
 */
const fetchRoomInfo = async (tenantId: string, roomId: string): Promise<RoomInfo | null> => {
  const { rows } = await query<{ room_number: string | null; room_type_id: string }>(
    `
      SELECT room_number, room_type_id
      FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [tenantId, roomId],
  );
  if (!rows[0]) return null;
  return { roomNumber: rows[0].room_number ?? "", roomTypeId: rows[0].room_type_id };
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
    `SELECT id, status, room_type_id, guest_id, total_amount, check_in_date, check_out_date,
            property_id, rate_code
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
        property_id: string;
        rate_code: string | null;
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

  // 3. S26: Enforce blocking deposit schedules before check-in
  if (!command.force) {
    try {
      const blockingDeposits = await query<{
        schedule_id: string;
        schedule_type: string;
        amount_due: number;
        amount_remaining: number;
        schedule_status: string;
        due_date: Date | null;
      }>(
        `SELECT schedule_id, schedule_type, amount_due, amount_remaining, schedule_status, due_date
         FROM public.deposit_schedules
         WHERE reservation_id = $1::uuid
           AND tenant_id = $2::uuid
           AND blocks_check_in = TRUE
           AND schedule_status NOT IN ('PAID', 'WAIVED', 'CANCELLED')
           AND COALESCE(is_deleted, false) = false`,
        [command.reservation_id, tenantId],
      );

      if (blockingDeposits.rows.length > 0) {
        const totalOutstanding = blockingDeposits.rows.reduce(
          (sum, row) => sum + Number(row.amount_remaining ?? 0),
          0,
        );
        throw new ReservationCommandError(
          "DEPOSIT_REQUIRED",
          `${blockingDeposits.rows.length} blocking deposit(s) outstanding totalling ${totalOutstanding}. ` +
            `Use force=true to override or collect payment before check-in.`,
        );
      }
    } catch (err) {
      // Re-throw our own errors; swallow unexpected DB failures (non-critical path)
      if (err instanceof ReservationCommandError) throw err;
      reservationsLogger.warn(
        { reservationId: command.reservation_id, err },
        "Unable to verify deposit schedules during check-in",
      );
    }
  }

  // 4. Warn if no deposit/payment received at all for a reservation with charges
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

  // S18: Post early check-in fee if guest checks in before the cutoff hour
  const actualCheckInTime = command.checked_in_at ?? new Date();
  try {
    if (reservation.rate_code) {
      const rateResult = await query<{
        early_checkin_fee: number;
        early_checkin_cutoff_hour: number;
      }>(
        `SELECT early_checkin_fee, early_checkin_cutoff_hour
         FROM rates
         WHERE rate_code = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [reservation.rate_code, tenantId],
      );
      const rate = rateResult.rows?.[0];
      if (rate && Number(rate.early_checkin_fee) > 0) {
        const scheduledDate = new Date(reservation.check_in_date);
        // Build the cutoff timestamp: scheduled check-in date at the cutoff hour (property local time)
        const cutoffTime = new Date(scheduledDate);
        cutoffTime.setHours(rate.early_checkin_cutoff_hour, 0, 0, 0);

        if (actualCheckInTime < cutoffTime) {
          const fee = Number(rate.early_checkin_fee);
          // Find the folio for this reservation
          const folioResult = await query<{ folio_id: string }>(
            `SELECT folio_id FROM folios
             WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN'
             ORDER BY created_at DESC LIMIT 1`,
            [command.reservation_id, tenantId],
          );
          const folioId = folioResult.rows?.[0]?.folio_id;
          if (folioId) {
            await withTransaction(async (client) => {
              await client.query(
                `INSERT INTO charge_postings (
                   tenant_id, property_id, folio_id, reservation_id,
                   transaction_type, posting_type, charge_code,
                   charge_description, quantity, unit_price, subtotal, total_amount,
                   currency_code, posting_time, business_date,
                   notes, created_by, updated_by
                 ) VALUES (
                   $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                   'CHARGE', 'ROOM', 'EARLY_CHECKIN',
                   'Early check-in fee', 1, $5, $5, $5,
                   'USD', NOW(), CURRENT_DATE,
                   $6, $7::uuid, $7::uuid
                 )`,
                [
                  tenantId,
                  reservation.property_id,
                  folioId,
                  command.reservation_id,
                  fee,
                  `Early check-in before ${rate.early_checkin_cutoff_hour}:00`,
                  SYSTEM_ACTOR_ID,
                ],
              );
              await client.query(
                `UPDATE folios
                 SET total_charges = total_charges + $2,
                     balance = balance + $2,
                     updated_at = NOW()
                 WHERE folio_id = $1 AND tenant_id = $3`,
                [folioId, fee, tenantId],
              );
            });
            reservationsLogger.info(
              { reservationId: command.reservation_id, fee, cutoffHour: rate.early_checkin_cutoff_hour },
              "Early check-in fee posted",
            );
          }
        }
      }
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to post early check-in fee — proceeding with check-in",
    );
  }

  const roomNumber =
    assignedRoomNumber ?? (assignedRoomId ? (await fetchRoomInfo(tenantId, assignedRoomId))?.roomNumber ?? null : null);
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
            check_in_date, check_out_date, actual_check_in, property_id, rate_code,
            travel_agent_id, source
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
        property_id: string;
        rate_code: string | null;
        travel_agent_id: string | null;
        source: string | null;
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

  // S18: Post late check-out fee if guest checks out after the cutoff hour
  try {
    if (reservation.rate_code) {
      const rateResult = await query<{
        late_checkout_fee: number;
        late_checkout_cutoff_hour: number;
      }>(
        `SELECT late_checkout_fee, late_checkout_cutoff_hour
         FROM rates
         WHERE rate_code = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [reservation.rate_code, tenantId],
      );
      const rate = rateResult.rows?.[0];
      if (rate && Number(rate.late_checkout_fee) > 0) {
        const scheduledDate = new Date(reservation.check_out_date);
        // Build the cutoff timestamp: scheduled check-out date at the cutoff hour
        const cutoffTime = new Date(scheduledDate);
        cutoffTime.setHours(rate.late_checkout_cutoff_hour, 0, 0, 0);

        if (checkOutTime > cutoffTime) {
          const fee = Number(rate.late_checkout_fee);
          const folioLookup = await query<{ folio_id: string }>(
            `SELECT folio_id FROM folios
             WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN'
             ORDER BY created_at DESC LIMIT 1`,
            [command.reservation_id, tenantId],
          );
          const lateFolioId = folioLookup.rows?.[0]?.folio_id;
          if (lateFolioId) {
            await withTransaction(async (client) => {
              await client.query(
                `INSERT INTO charge_postings (
                   tenant_id, property_id, folio_id, reservation_id,
                   transaction_type, posting_type, charge_code,
                   charge_description, quantity, unit_price, subtotal, total_amount,
                   currency_code, posting_time, business_date,
                   notes, created_by, updated_by
                 ) VALUES (
                   $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                   'CHARGE', 'ROOM', 'LATE_CHECKOUT',
                   'Late check-out fee', 1, $5, $5, $5,
                   'USD', NOW(), CURRENT_DATE,
                   $6, $7::uuid, $7::uuid
                 )`,
                [
                  tenantId,
                  reservation.property_id,
                  lateFolioId,
                  command.reservation_id,
                  fee,
                  `Late check-out after ${rate.late_checkout_cutoff_hour}:00`,
                  SYSTEM_ACTOR_ID,
                ],
              );
              await client.query(
                `UPDATE folios
                 SET total_charges = total_charges + $2,
                     balance = balance + $2,
                     updated_at = NOW()
                 WHERE folio_id = $1 AND tenant_id = $3`,
                [lateFolioId, fee, tenantId],
              );
            });
            reservationsLogger.info(
              { reservationId: command.reservation_id, fee, cutoffHour: rate.late_checkout_cutoff_hour },
              "Late check-out fee posted",
            );
          }
        }
      }
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to post late check-out fee — proceeding with check-out",
    );
  }

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

  // S10: Calculate and record commission for travel-agent / OTA bookings
  if (reservation.travel_agent_id || reservation.source) {
    try {
      const actualIn = reservation.actual_check_in ?? reservation.check_in_date;
      const stayNights = Math.max(
        1,
        Math.round((checkOutTime.getTime() - new Date(actualIn).getTime()) / (1000 * 60 * 60 * 24)),
      );

      // Find commission config from booking_sources or commission_rules
      let commissionType = "PERCENTAGE";
      let commissionRate = 0;
      let flatAmount = 0;
      let agentCompanyId: string | null = null;

      if (reservation.travel_agent_id) {
        const ruleResult = await query<{
          commission_type: string;
          default_rate: number;
          room_rate: number;
          flat_amount: number;
          company_id: string | null;
        }>(
          `SELECT cr.commission_type, cr.default_rate, cr.room_rate,
                  COALESCE(cr.flat_amount_per_booking, 0) AS flat_amount,
                  cr.company_id
           FROM commission_rules cr
           WHERE cr.tenant_id = $1
             AND cr.is_active = true
             AND (cr.company_id = (SELECT company_id FROM travel_agents WHERE agent_id = $2 AND tenant_id = $1 LIMIT 1)
                  OR cr.apply_to_all_agents = true)
             AND (cr.effective_start IS NULL OR cr.effective_start <= CURRENT_DATE)
             AND (cr.effective_end IS NULL OR cr.effective_end >= CURRENT_DATE)
           ORDER BY cr.apply_to_all_agents ASC, cr.priority DESC
           LIMIT 1`,
          [tenantId, reservation.travel_agent_id],
        );
        const rule = ruleResult.rows?.[0];
        if (rule) {
          commissionType = rule.commission_type;
          commissionRate = Number(rule.room_rate || rule.default_rate || 0);
          flatAmount = Number(rule.flat_amount || 0);
          agentCompanyId = rule.company_id;
        }
      }

      // Fallback to booking_sources commission config
      if (commissionRate === 0 && flatAmount === 0 && reservation.source) {
        const srcResult = await query<{
          commission_type: string;
          commission_percentage: number;
          commission_fixed_amount: number;
        }>(
          `SELECT commission_type, COALESCE(commission_percentage, 0) AS commission_percentage,
                  COALESCE(commission_fixed_amount, 0) AS commission_fixed_amount
           FROM booking_sources
           WHERE source_code = $1 AND tenant_id = $2 LIMIT 1`,
          [reservation.source, tenantId],
        );
        const src = srcResult.rows?.[0];
        if (src && src.commission_type !== 'NONE') {
          commissionType = src.commission_type;
          commissionRate = Number(src.commission_percentage);
          flatAmount = Number(src.commission_fixed_amount);
        }
      }

      // Calculate gross commission
      let grossCommission = 0;
      const roomRevenue = Number(reservation.total_amount);
      if ((commissionType === 'PERCENTAGE' || commissionType === 'percentage') && commissionRate > 0) {
        grossCommission = (roomRevenue * commissionRate) / 100;
      } else if (commissionType === 'FIXED' || commissionType === 'FLAT_RATE' || commissionType === 'flat_rate') {
        grossCommission = flatAmount;
      } else if (commissionRate > 0) {
        grossCommission = (roomRevenue * commissionRate) / 100;
      }

      if (grossCommission > 0) {
        grossCommission = Math.round(grossCommission * 100) / 100;
        await withTransaction(async (client) => {
          await client.query(
            `INSERT INTO travel_agent_commissions (
               tenant_id, property_id, reservation_id,
               agent_id, company_id, commission_type, room_revenue,
               room_commission_rate, gross_commission_amount,
               currency_code, payment_status,
               created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid,
               $4::uuid, $5::uuid, $6, $7,
               $8, $9,
               'USD', 'PENDING',
               $10::uuid, $10::uuid
             )`,
            [
              tenantId,
              reservation.property_id,
              command.reservation_id,
              reservation.travel_agent_id,
              agentCompanyId,
              commissionType.toLowerCase(),
              roomRevenue,
              commissionRate,
              grossCommission,
              SYSTEM_ACTOR_ID,
            ],
          );
          await client.query(
            `INSERT INTO commission_tracking (
               tenant_id, property_id, reservation_id,
               commission_type, beneficiary_type, beneficiary_id,
               base_amount, commission_rate, calculated_amount,
               final_amount, currency_code, status,
               created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid,
               'booking', 'agent', $4::uuid,
               $5, $6, $7,
               $7, 'USD', 'pending',
               $8::uuid, $8::uuid
             )`,
            [
              tenantId,
              reservation.property_id,
              command.reservation_id,
              reservation.travel_agent_id ?? null,
              roomRevenue,
              commissionRate,
              grossCommission,
              SYSTEM_ACTOR_ID,
            ],
          );
        });
        reservationsLogger.info(
          {
            reservationId: command.reservation_id,
            grossCommission,
            commissionRate,
            commissionType,
            agentId: reservation.travel_agent_id,
          },
          "Commission calculated and recorded on check-out",
        );
      }
    } catch (commErr) {
      reservationsLogger.warn(
        { reservationId: command.reservation_id, error: commErr },
        "Failed to calculate commission on check-out — continuing",
      );
    }
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

  const roomInfo = await fetchRoomInfo(tenantId, command.room_id);
  if (!roomInfo) {
    throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${command.room_id} not found`);
  }

  // Fetch reservation to get stay dates for availability check
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new ReservationCommandError("RESERVATION_NOT_FOUND", `Reservation ${command.reservation_id} not found`);
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
 * S22: Batch no-show sweep.
 *
 * Finds all PENDING / CONFIRMED reservations whose check-in date has passed
 * for the given property and marks each as no-show by delegating to the
 * individual {@link markNoShow} handler. This ensures outbox events, room
 * releases, and fee calculations are applied consistently per reservation.
 *
 * @returns Summary of processed and failed reservation IDs.
 */
export const batchNoShowSweep = async (
  tenantId: string,
  command: ReservationBatchNoShowCommand,
  options: { correlationId?: string } = {},
): Promise<{ processed: string[]; failed: string[]; skipped: number }> => {
  const businessDate = command.business_date ?? new Date();

  // Find all eligible reservations for this property
  const { rows: candidates } = await query<{ id: string }>(
    `SELECT id
     FROM public.reservations
     WHERE tenant_id = $1::uuid
       AND property_id = $2::uuid
       AND status IN ('PENDING', 'CONFIRMED')
       AND check_in_date <= $3::date
       AND COALESCE(is_deleted, false) = false
       AND deleted_at IS NULL
     ORDER BY check_in_date ASC`,
    [tenantId, command.property_id, businessDate],
  );

  if (candidates.length === 0) {
    reservationsLogger.info(
      { propertyId: command.property_id, businessDate },
      "Batch no-show sweep: no eligible reservations found",
    );
    return { processed: [], failed: [], skipped: 0 };
  }

  // Dry-run mode: return candidates without processing
  if (command.dry_run) {
    reservationsLogger.info(
      { propertyId: command.property_id, count: candidates.length },
      "Batch no-show sweep dry-run: returning candidates without processing",
    );
    return { processed: [], failed: [], skipped: candidates.length };
  }

  const processed: string[] = [];
  const failed: string[] = [];

  for (const candidate of candidates) {
    try {
      await markNoShow(
        tenantId,
        {
          reservation_id: candidate.id,
          no_show_fee: command.no_show_fee_override,
          reason: command.reason ?? "Batch no-show sweep: guest did not arrive",
          metadata: command.metadata,
        },
        options,
      );
      processed.push(candidate.id);
    } catch (err) {
      reservationsLogger.warn(
        { reservationId: candidate.id, err },
        "Batch no-show sweep: failed to mark reservation as no-show",
      );
      failed.push(candidate.id);
    }
  }

  reservationsLogger.info(
    {
      propertyId: command.property_id,
      businessDate,
      total: candidates.length,
      processed: processed.length,
      failed: failed.length,
    },
    "Batch no-show sweep completed",
  );

  return { processed, failed, skipped: 0 };
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
  const cancelAllowed = ["INQUIRY", "QUOTED", "PENDING", "CONFIRMED"];
  if (!cancelAllowed.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CANCEL",
      `Cannot cancel reservation with status ${reservation.status}; must be INQUIRY, QUOTED, PENDING, or CONFIRMED`,
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
    const roomInfo = await fetchRoomInfo(tenantId, roomId);
    if (!roomInfo) throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${roomId} not found`);
    // Validate room is available
    const roomResult = await query(
      `SELECT status FROM rooms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [roomId, tenantId],
    );
    const roomStatus = (roomResult.rows?.[0] as { status: string } | undefined)?.status;
    if (roomStatus !== "AVAILABLE") {
      throw new ReservationCommandError(
        "ROOM_NOT_AVAILABLE",
        `Room ${roomInfo.roomNumber} is ${roomStatus}, not AVAILABLE`,
      );
    }
    roomNumber = roomInfo.roomNumber;
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

// ---------------------------------------------------------------------------
// S8: INQUIRY → QUOTED → PENDING lifecycle handlers
// ---------------------------------------------------------------------------

/**
 * Transition an INQUIRY reservation to QUOTED status.
 * Records the quote timestamp and optional expiry date so the reservation
 * can be auto-expired after the validity window lapses.
 */
export const sendQuote = async (
  tenantId: string,
  command: ReservationSendQuoteCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const statusResult = await query(
    `SELECT status, room_type_id, check_in_date, check_out_date, property_id
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = statusResult.rows?.[0] as
    | { status: string; room_type_id: string; check_in_date: string; check_out_date: string; property_id: string }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }
  if (reservation.status !== "INQUIRY") {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_QUOTE",
      `Cannot send quote for reservation with status ${reservation.status}; must be INQUIRY`,
    );
  }

  const updatePayload: ReservationUpdatedEvent = ReservationUpdatedEventSchema.parse({
    eventType: "reservation.quoted",
    reservationId: command.reservation_id,
    tenantId,
    propertyId: reservation.property_id,
    status: "QUOTED",
    quoted_at: new Date().toISOString(),
    ...(command.quote_expires_at && { quote_expires_at: command.quote_expires_at.toISOString() }),
    ...(command.total_amount !== undefined && { totalAmount: command.total_amount }),
    ...(command.currency && { currency: command.currency }),
    ...(command.notes && { notes: command.notes }),
    updatedAt: new Date().toISOString(),
    version: 1,
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      aggregateType: "reservation",
      aggregateId: command.reservation_id,
      eventType: "reservation.quoted",
      payload: updatePayload,
      tenantId,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
    });
  });

  reservationsLogger.info(
    { reservationId: command.reservation_id, quoteExpiresAt: command.quote_expires_at },
    "Quote sent for inquiry reservation",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Convert a QUOTED reservation to a PENDING booking.
 * Locks availability via the availability guard, similar to createReservation.
 */
export const convertQuote = async (
  tenantId: string,
  command: ReservationConvertQuoteCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const statusResult = await query(
    `SELECT status, room_type_id, check_in_date, check_out_date, property_id
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = statusResult.rows?.[0] as
    | { status: string; room_type_id: string; check_in_date: string; check_out_date: string; property_id: string }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }
  if (reservation.status !== "QUOTED") {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CONVERT",
      `Cannot convert reservation with status ${reservation.status}; must be QUOTED`,
    );
  }

  // Lock availability for the stay dates
  let lockResult: AvailabilityGuardMetadata | null = null;
  try {
    lockResult = await lockReservationHold({
      reservationId: command.reservation_id,
      roomTypeId: reservation.room_type_id,
      stayStart: new Date(reservation.check_in_date),
      stayEnd: new Date(reservation.check_out_date),
      tenantId,
      reason: "quote_conversion",
    });
  } catch (lockError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: lockError },
      "Availability lock failed during quote conversion; proceeding without guard",
    );
  }

  const updatePayload: ReservationUpdatedEvent = ReservationUpdatedEventSchema.parse({
    eventType: "reservation.updated",
    reservationId: command.reservation_id,
    tenantId,
    propertyId: reservation.property_id,
    status: "PENDING",
    ...(command.total_amount !== undefined && { totalAmount: command.total_amount }),
    ...(command.currency && { currency: command.currency }),
    ...(command.notes && { notes: command.notes }),
    updatedAt: new Date().toISOString(),
    version: 1,
  });

  try {
    await withTransaction(async (client) => {
      if (lockResult) {
        await upsertReservationGuardMetadata(
          {
            tenantId,
            reservationId: command.reservation_id,
            lockId: lockResult.lockId ?? null,
            status: lockResult.status,
            metadata: {
              roomTypeId: reservation.room_type_id,
              checkIn: reservation.check_in_date,
              checkOut: reservation.check_out_date,
            },
          },
          client,
        );
      }

      await enqueueOutboxRecordWithClient(client, {
        eventId,
        aggregateType: "reservation",
        aggregateId: command.reservation_id,
        eventType: "reservation.updated",
        payload: updatePayload,
        tenantId,
        headers: {
          tenantId,
          eventId,
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        },
      });
    });
  } catch (txError) {
    // Release the guard lock on transaction failure (P1-2 pattern)
    if (lockResult) {
      try {
        await releaseReservationHold({
          reservationId: command.reservation_id,
          lockId: lockResult.lockId!,
          tenantId,
          reason: "quote_conversion_rollback",
        });
      } catch (releaseError) {
        reservationsLogger.warn(
          { reservationId: command.reservation_id, lockId: lockResult.lockId, error: releaseError },
          "Failed to release availability lock after quote conversion tx failure",
        );
      }
    }
    throw txError;
  }

  reservationsLogger.info(
    { reservationId: command.reservation_id },
    "Quote converted to PENDING booking",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Expire a reservation. Transitions INQUIRY, QUOTED, or PENDING
 * reservations to EXPIRED status. Releases any availability guards
 * if the reservation had an active lock.
 */
export const expireReservation = async (
  tenantId: string,
  command: ReservationExpireCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const statusResult = await query(
    `SELECT status, room_type_id, check_in_date, check_out_date, property_id
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = statusResult.rows?.[0] as
    | { status: string; room_type_id: string; check_in_date: string; check_out_date: string; property_id: string }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const expirableStatuses = ["INQUIRY", "QUOTED", "PENDING"];
  if (!expirableStatuses.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_EXPIRE",
      `Cannot expire reservation with status ${reservation.status}; must be INQUIRY, QUOTED, or PENDING`,
    );
  }

  // Release availability guard if one exists
  const guardMeta = await getReservationGuardMetadata(tenantId, command.reservation_id);
  if (guardMeta?.lockId) {
    try {
      await releaseReservationHold({
        reservationId: command.reservation_id,
        lockId: guardMeta.lockId,
        tenantId,
        reason: "reservation_expired",
      });
    } catch (releaseError) {
      reservationsLogger.warn(
        { reservationId: command.reservation_id, lockId: guardMeta.lockId, error: releaseError },
        "Failed to release availability lock during expiration",
      );
    }
  }

  const updatePayload: ReservationUpdatedEvent = ReservationUpdatedEventSchema.parse({
    eventType: "reservation.expired",
    reservationId: command.reservation_id,
    tenantId,
    propertyId: reservation.property_id,
    status: "EXPIRED",
    ...(command.reason && { notes: command.reason }),
    updatedAt: new Date().toISOString(),
    version: 1,
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      aggregateType: "reservation",
      aggregateId: command.reservation_id,
      eventType: "reservation.expired",
      payload: updatePayload,
      tenantId,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
    });
  });

  reservationsLogger.info(
    { reservationId: command.reservation_id, previousStatus: reservation.status, reason: command.reason },
    "Reservation expired",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

// ─── S11: Walk Guest ─────────────────────────────────────────────────────────

/**
 * Walk a guest due to overbooking.
 * Creates a walk_history record, transitions the reservation to CANCELLED with
 * walk-specific metadata, and releases any availability holds.
 */
export const walkGuest = async (
  tenantId: string,
  command: ReservationWalkGuestCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const actorId = SYSTEM_ACTOR_ID;
  const eventId = uuid();
  const now = new Date();

  // 1. Fetch reservation
  const result = await query<{
    id: string;
    status: string;
    property_id: string;
    guest_id: string;
    guest_name: string;
    confirmation_number: string;
    room_type_id: string;
    room_number: string | null;
  }>(
    `SELECT id, status, property_id, guest_id, guest_name,
            confirmation_number, room_type_id, room_number
     FROM reservations
     WHERE id = $1::uuid AND tenant_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [command.reservation_id, tenantId],
  );

  const reservation = result.rows[0];
  if (!reservation) {
    throw new ReservationCommandError("NOT_FOUND", `Reservation ${command.reservation_id} not found.`);
  }

  if (!["CONFIRMED", "PENDING"].includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS",
      `Cannot walk a reservation in ${reservation.status} status. Must be CONFIRMED or PENDING.`,
    );
  }

  // Build the cancelled event envelope (same shape as cancelReservation)
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
      cancelled_by: actorId,
      reason: `WALKED: ${command.walk_reason ?? "Overbooking"}`,
    },
  };
  const validatedEvent = ReservationCancelledEventSchema.parse(payload);

  // Look up guard metadata for lock release
  const guardRecord: StoredGuardMetadata | null = await getReservationGuardMetadata(
    tenantId,
    command.reservation_id,
  );
  const releaseLockId = guardRecord?.lockId ?? command.reservation_id;

  await withTransaction(async (client) => {
    // 2. Create walk_history record
    await client.query(
      `INSERT INTO walk_history (
         tenant_id, property_id, reservation_id, confirmation_number,
         guest_name, guest_id, walk_date, walk_reason, walked_by,
         alternate_hotel_name, alternate_hotel_address, alternate_hotel_phone,
         alternate_confirmation, alternate_rate, alternate_nights,
         compensation_type, compensation_amount, compensation_currency,
         compensation_description,
         transportation_provided, transportation_type, transportation_cost,
         return_guaranteed, return_date, return_room_type,
         walk_status, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4,
         $5, $6::uuid, CURRENT_DATE, $7, $8::uuid,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, 'USD',
         $17,
         $18, $19, $20,
         $21, $22, $23,
         'initiated', $24,
         $8::uuid, $8::uuid
       )`,
      [
        tenantId, reservation.property_id,
        command.reservation_id, reservation.confirmation_number,
        reservation.guest_name, reservation.guest_id,
        command.walk_reason ?? null, actorId,
        command.alternate_hotel_name ?? null,
        command.alternate_hotel_address ?? null,
        command.alternate_hotel_phone ?? null,
        command.alternate_confirmation ?? null,
        command.alternate_rate ?? null,
        command.alternate_nights ?? 1,
        command.compensation_type ?? null,
        command.compensation_amount ?? 0,
        command.compensation_description ?? null,
        command.transportation_provided ?? false,
        command.transportation_type ?? null,
        command.transportation_cost ?? 0,
        command.return_guaranteed ?? false,
        command.return_date ? new Date(command.return_date).toISOString().slice(0, 10) : null,
        command.return_room_type ?? null,
        command.notes ?? null,
      ],
    );

    // 3. Cancel the reservation with walk metadata
    await client.query(
      `UPDATE reservations
       SET status = 'CANCELLED',
           cancellation_date = NOW(),
           cancellation_reason = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
           updated_at = NOW(), updated_by = $5,
           version = version + 1
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [
        command.reservation_id, tenantId,
        `WALKED: ${command.walk_reason ?? "Overbooking"}`,
        JSON.stringify({
          walked: true,
          walk_date: now.toISOString().slice(0, 10),
          alternate_hotel: command.alternate_hotel_name ?? null,
          compensation_amount: command.compensation_amount ?? 0,
        }),
        actorId,
      ],
    );

    // 4. Update guard metadata if exists
    if (guardRecord) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          lockId: guardRecord.lockId ?? releaseLockId,
          status: "RELEASE_REQUESTED",
          metadata: {
            previousStatus: guardRecord.status,
            reason: "WALK_GUEST",
          },
        },
        client,
      );
    }

    // 5. Emit reservation.cancelled event via outbox
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
        action: "walk_guest",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });
  });

  // 6. Release availability hold (best-effort, outside transaction)
  try {
    await releaseReservationHold({
      tenantId,
      lockId: releaseLockId,
      reservationId: command.reservation_id,
      reason: "WALK_GUEST",
      correlationId: options.correlationId ?? eventId,
    });
  } catch (err) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: err },
      "Failed to release availability hold after walk (non-fatal)",
    );
  }

  reservationsLogger.info(
    {
      reservationId: command.reservation_id,
      guestName: reservation.guest_name,
      alternateHotel: command.alternate_hotel_name,
      compensationAmount: command.compensation_amount,
    },
    "Guest walked due to overbooking",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/* ================================================================== */
/*  GROUP BOOKING HANDLERS                                            */
/* ================================================================== */

/**
 * Create a new group booking.
 * Inserts into `group_bookings` with status INQUIRY/TENTATIVE and
 * generates a unique group_code.
 */
export const createGroupBooking = async (
  tenantId: string,
  command: GroupCreateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const groupBookingId = uuid();

  const arrivalDate = new Date(command.arrival_date);
  const departureDate = new Date(command.departure_date);
  if (departureDate <= arrivalDate) {
    throw new ReservationCommandError(
      "INVALID_DATES",
      "departure_date must be after arrival_date",
    );
  }

  // Generate a unique group code: GRP-<8 hex chars>
  const groupCode = `GRP-${groupBookingId.slice(0, 8).toUpperCase()}`;

  // Calculate cutoff_date if not provided
  const cutoffDays = command.cutoff_days_before_arrival ?? 14;
  const cutoffDate = command.cutoff_date
    ? new Date(command.cutoff_date)
    : new Date(arrivalDate.getTime() - cutoffDays * 86_400_000);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO group_bookings (
        group_booking_id, tenant_id, property_id,
        group_name, group_code, group_type,
        company_id, organization_name,
        contact_name, contact_email, contact_phone,
        arrival_date, departure_date,
        total_rooms_requested, total_rooms_blocked,
        cutoff_date, cutoff_days_before_arrival, release_unsold_rooms,
        block_status, rate_type, negotiated_rate,
        payment_method, deposit_amount, deposit_due_date,
        complimentary_rooms, complimentary_ratio,
        meeting_space_required, catering_required,
        cancellation_policy, cancellation_deadline,
        notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, 0,
        $15, $16, TRUE,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24,
        $25, $26,
        $27, $28,
        $29, $30, $30
      )`,
      [
        groupBookingId, tenantId, command.property_id,
        command.group_name, groupCode, command.group_type,
        command.company_id ?? null, command.organization_name ?? null,
        command.contact_name, command.contact_email ?? null, command.contact_phone ?? null,
        arrivalDate.toISOString().slice(0, 10), departureDate.toISOString().slice(0, 10),
        command.total_rooms_requested,
        cutoffDate.toISOString().slice(0, 10), cutoffDays,
        command.block_status ?? "tentative", command.rate_type ?? null, command.negotiated_rate ?? null,
        command.payment_method ?? null, command.deposit_amount ?? 0, command.deposit_due_date ? new Date(command.deposit_due_date).toISOString().slice(0, 10) : null,
        command.complimentary_rooms ?? 0, command.complimentary_ratio ?? null,
        command.meeting_space_required ?? false, command.catering_required ?? false,
        command.cancellation_policy ?? null, command.cancellation_deadline ? new Date(command.cancellation_deadline).toISOString().slice(0, 10) : null,
        command.notes ?? null, SYSTEM_ACTOR_ID,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: groupBookingId,
      aggregateType: "group_booking",
      eventType: "group.created",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.created",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: groupBookingId,
          group_code: groupCode,
          group_name: command.group_name,
          group_type: command.group_type,
          property_id: command.property_id,
          arrival_date: arrivalDate.toISOString().slice(0, 10),
          departure_date: departureDate.toISOString().slice(0, 10),
          total_rooms_requested: command.total_rooms_requested,
          block_status: command.block_status ?? "tentative",
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: groupBookingId,
      metadata: { source: serviceConfig.serviceId, action: "group.create" },
    });
  });

  reservationsLogger.info(
    { groupBookingId, groupCode, groupName: command.group_name },
    "Group booking created",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Add or update room block allocations for a group by date + room type.
 * Uses UPSERT on the unique (group_booking_id, room_type_id, block_date) index.
 * Also recalculates group-level totals.
 */
export const addGroupRooms = async (
  tenantId: string,
  command: GroupAddRoomsCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Verify group exists and belongs to tenant
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, block_status
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    if (groupRows[0].block_status === "cancelled") {
      throw new ReservationCommandError(
        "GROUP_CANCELLED",
        "Cannot add rooms to a cancelled group booking",
      );
    }

    // Upsert each block entry
    for (const block of command.blocks) {
      await client.query(
        `INSERT INTO group_room_blocks (
          block_id, group_booking_id, room_type_id, block_date,
          blocked_rooms, negotiated_rate, rack_rate, discount_percentage,
          block_status, created_by, updated_by
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3,
          $4, $5, $6, $7,
          'active', $8, $8
        )
        ON CONFLICT (group_booking_id, room_type_id, block_date)
        DO UPDATE SET
          blocked_rooms = EXCLUDED.blocked_rooms,
          negotiated_rate = EXCLUDED.negotiated_rate,
          rack_rate = COALESCE(EXCLUDED.rack_rate, group_room_blocks.rack_rate),
          discount_percentage = COALESCE(EXCLUDED.discount_percentage, group_room_blocks.discount_percentage),
          updated_at = NOW(),
          updated_by = $8`,
        [
          command.group_booking_id,
          block.room_type_id,
          new Date(block.block_date).toISOString().slice(0, 10),
          block.blocked_rooms,
          block.negotiated_rate,
          block.rack_rate ?? null,
          block.discount_percentage ?? null,
          SYSTEM_ACTOR_ID,
        ],
      );
    }

    // Recalculate group-level totals
    await client.query(
      `UPDATE group_bookings
       SET total_rooms_blocked = (
         SELECT COALESCE(SUM(blocked_rooms), 0)
         FROM group_room_blocks
         WHERE group_booking_id = $1 AND block_status != 'cancelled'
       ),
       updated_at = NOW(), updated_by = $2, version = version + 1
       WHERE group_booking_id = $1 AND tenant_id = $3`,
      [command.group_booking_id, SYSTEM_ACTOR_ID, tenantId],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.rooms_added",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.rooms_added",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          blocks_count: command.blocks.length,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.add_rooms" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id, blocksAdded: command.blocks.length },
    "Room blocks added to group",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Upload a rooming list to create individual reservations from a group block.
 * For each guest entry, creates a reservation with reservation_type GROUP
 * and increments picked_rooms on the matching block row.
 */
export const uploadGroupRoomingList = async (
  tenantId: string,
  command: GroupUploadRoomingListCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Verify group booking exists
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, property_id, block_status, negotiated_rate
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    const group = groupRows[0];
    if (group.block_status === "cancelled" || group.block_status === "completed") {
      throw new ReservationCommandError(
        "GROUP_INVALID_STATUS",
        `Cannot upload rooming list for group in ${group.block_status} status`,
      );
    }

    let pickedCount = 0;

    for (const guest of command.guests) {
      const reservationId = uuid();
      const arrivalDate = new Date(guest.arrival_date).toISOString().slice(0, 10);
      const departureDate = new Date(guest.departure_date).toISOString().slice(0, 10);

      // Verify and decrement block availability
      const { rowCount } = await client.query(
        `UPDATE group_room_blocks
         SET picked_rooms = picked_rooms + 1,
             updated_at = NOW(), updated_by = $5
         WHERE group_booking_id = $1
           AND room_type_id = $2
           AND block_date = $3
           AND picked_rooms < blocked_rooms
           AND block_status IN ('active', 'pending')`,
        [command.group_booking_id, guest.room_type_id, arrivalDate, departureDate, SYSTEM_ACTOR_ID],
      );

      if (!rowCount || rowCount === 0) {
        reservationsLogger.warn(
          {
            groupBookingId: command.group_booking_id,
            roomTypeId: guest.room_type_id,
            guestName: guest.guest_name,
            arrivalDate,
          },
          "No available block for guest — creating reservation without block decrement",
        );
      }

      // Create individual reservation linked to the group
      await client.query(
        `INSERT INTO reservations (
          id, tenant_id, property_id, room_type_id,
          check_in_date, check_out_date, booking_date,
          status, reservation_type, source,
          total_amount, currency,
          special_requests, group_booking_id,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, NOW(),
          'CONFIRMED', 'GROUP', 'DIRECT',
          $7, 'USD',
          $8, $9,
          $10, $10
        )`,
        [
          reservationId, tenantId, group.property_id, guest.room_type_id,
          arrivalDate, departureDate,
          group.negotiated_rate ?? 0,
          guest.special_requests ?? null,
          command.group_booking_id,
          SYSTEM_ACTOR_ID,
        ],
      );

      pickedCount++;
    }

    // Update group totals and rooming list flags
    await client.query(
      `UPDATE group_bookings
       SET total_rooms_picked = (
         SELECT COALESCE(SUM(picked_rooms), 0)
         FROM group_room_blocks
         WHERE group_booking_id = $1
       ),
       rooming_list_received = TRUE,
       rooming_list_received_date = NOW(),
       rooming_list_format = $3,
       updated_at = NOW(), updated_by = $4, version = version + 1
       WHERE group_booking_id = $1 AND tenant_id = $2`,
      [command.group_booking_id, tenantId, command.rooming_list_format ?? "api", SYSTEM_ACTOR_ID],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.rooming_list_uploaded",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.rooming_list_uploaded",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          guests_count: command.guests.length,
          reservations_created: pickedCount,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.upload_rooming_list" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id, guestsProcessed: command.guests.length },
    "Rooming list uploaded and reservations created",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Enforce cutoff dates for group bookings.
 * Finds groups whose cutoff_date <= business_date and releases unsold
 * room blocks back to general inventory. Updates block status to 'released'.
 */
export const enforceGroupCutoff = async (
  tenantId: string,
  command: GroupCutoffEnforceCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const businessDate = command.business_date
    ? new Date(command.business_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Find all group bookings past cutoff for this property
  const { rows: expiredGroups } = await query(
    `SELECT gb.group_booking_id, gb.group_name, gb.cutoff_date,
            gb.cancellation_penalty_percentage, gb.negotiated_rate,
            gb.total_rooms_requested, gb.total_rooms_picked
     FROM group_bookings gb
     WHERE gb.tenant_id = $1
       AND gb.property_id = $2
       AND gb.cutoff_date <= $3::date
       AND gb.release_unsold_rooms = TRUE
       AND gb.block_status IN ('tentative', 'definite', 'confirmed')
       AND gb.is_deleted = FALSE`,
    [tenantId, command.property_id, businessDate],
  );

  if (command.dry_run) {
    reservationsLogger.info(
      { propertyId: command.property_id, businessDate, groupsFound: expiredGroups.length },
      "Cutoff enforcement dry run complete",
    );
    return { eventId, correlationId: options.correlationId, status: "accepted" };
  }

  let totalBlocksReleased = 0;

  for (const group of expiredGroups) {
    await withTransaction(async (client) => {
      // Release unsold blocks
      const { rowCount } = await client.query(
        `UPDATE group_room_blocks
         SET block_status = 'released',
             released_date = NOW(),
             released_by = $3::uuid,
             updated_at = NOW(), updated_by = $3::uuid
         WHERE group_booking_id = $1
           AND block_status IN ('active', 'pending')
           AND picked_rooms < blocked_rooms
           AND block_date >= $2::date`,
        [group.group_booking_id, businessDate, SYSTEM_ACTOR_ID],
      );

      totalBlocksReleased += rowCount ?? 0;

      // Update group status
      await client.query(
        `UPDATE group_bookings
         SET block_status = CASE
           WHEN total_rooms_picked >= total_rooms_requested THEN 'confirmed'
           WHEN total_rooms_picked > 0 THEN 'partial'
           ELSE block_status
         END,
         updated_at = NOW(), updated_by = $2, version = version + 1
         WHERE group_booking_id = $1 AND tenant_id = $3`,
        [group.group_booking_id, SYSTEM_ACTOR_ID, tenantId],
      );

      await enqueueOutboxRecordWithClient(client, {
        eventId: uuid(),
        tenantId,
        aggregateId: group.group_booking_id,
        aggregateType: "group_booking",
        eventType: "group.cutoff_enforced",
        payload: {
          metadata: {
            id: uuid(),
            source: serviceConfig.serviceId,
            type: "group.cutoff_enforced",
            timestamp: new Date().toISOString(),
            version: "1.0",
            correlationId: options.correlationId,
            tenantId,
            retryCount: 0,
          },
          payload: {
            group_booking_id: group.group_booking_id,
            group_name: group.group_name,
            blocks_released: rowCount ?? 0,
            cutoff_date: group.cutoff_date,
          },
        },
        headers: { tenantId, eventId },
        correlationId: options.correlationId,
        partitionKey: group.group_booking_id,
        metadata: { source: serviceConfig.serviceId, action: "group.cutoff_enforce" },
      });
    });
  }

  reservationsLogger.info(
    {
      propertyId: command.property_id,
      businessDate,
      groupsProcessed: expiredGroups.length,
      totalBlocksReleased,
    },
    "Group cutoff enforcement completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Create a MASTER folio for a group booking and configure charge routing.
 * Updates the group_bookings record with the master_folio_id and
 * stores routing rules as JSONB metadata on the folio.
 */
export const setupGroupBilling = async (
  tenantId: string,
  command: GroupBillingSetupCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Fetch group booking
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, property_id, group_name, group_code,
              master_folio_id, contact_name, billing_contact_name,
              billing_contact_email, billing_contact_phone, organization_name
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    const group = groupRows[0];

    if (group.master_folio_id) {
      throw new ReservationCommandError(
        "MASTER_FOLIO_EXISTS",
        `Group ${command.group_booking_id} already has master folio ${group.master_folio_id}`,
      );
    }

    const folioId = uuid();
    const folioNumber = `GRP-${group.group_code ?? group.group_booking_id.slice(0, 8).toUpperCase()}`;

    // Default routing: room & tax → master, incidentals → individual
    const routingRules = command.routing_rules ?? [
      { charge_type: "ROOM", target: "master" },
      { charge_type: "TAX", target: "master" },
      { charge_type: "INCIDENTAL", target: "individual" },
    ];

    // Create MASTER folio
    await client.query(
      `INSERT INTO folios (
        folio_id, tenant_id, property_id,
        folio_number, folio_type, folio_status,
        guest_name, company_name,
        tax_exempt, tax_id,
        notes,
        created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, 'MASTER', 'OPEN',
        $5, $6,
        $7, $8,
        $9,
        $10, $10
      )`,
      [
        folioId, tenantId, group.property_id,
        folioNumber,
        command.billing_contact_name ?? group.billing_contact_name ?? group.contact_name,
        group.organization_name ?? group.group_name,
        command.tax_exempt ?? false,
        command.tax_id ?? null,
        JSON.stringify({ routing_rules: routingRules }),
        SYSTEM_ACTOR_ID,
      ],
    );

    // Link folio to group booking and update billing details
    await client.query(
      `UPDATE group_bookings
       SET master_folio_id = $1,
           payment_method = COALESCE($3, payment_method),
           billing_contact_name = COALESCE($4, billing_contact_name),
           billing_contact_email = COALESCE($5, billing_contact_email),
           billing_contact_phone = COALESCE($6, billing_contact_phone),
           updated_at = NOW(), updated_by = $7, version = version + 1
       WHERE group_booking_id = $2 AND tenant_id = $8`,
      [
        folioId,
        command.group_booking_id,
        command.payment_method ?? null,
        command.billing_contact_name ?? null,
        command.billing_contact_email ?? null,
        command.billing_contact_phone ?? null,
        SYSTEM_ACTOR_ID,
        tenantId,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.billing_setup",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.billing_setup",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          master_folio_id: folioId,
          folio_number: folioNumber,
          payment_method: command.payment_method,
          routing_rules: routingRules,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.billing.setup" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id },
    "Group billing setup completed with master folio",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/* ================================================================== */
/*  INTEGRATION / OTA / GDS HANDLERS                                  */
/* ================================================================== */

/**
 * Request an OTA availability sync.
 * Reads current inventory for the property, builds an ARI (Availability-
 * Rates-Inventory) update payload, and records it in `ota_inventory_sync`.
 * Actual push to the OTA API is simulated — replace the stub with a real
 * channel-manager client (e.g., SiteMinder, Cloudbeds) for production.
 */
export const otaSyncRequest = async (
  tenantId: string,
  command: IntegrationOtaSyncRequestCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();
  const syncScope = command.sync_scope ?? "full";

  await withTransaction(async (client) => {
    // Verify OTA configuration exists
    const { rows: otaRows } = await client.query(
      `SELECT id, ota_name, api_endpoint, availability_push_enabled
       FROM ota_configurations
       WHERE tenant_id = $1 AND property_id = $2 AND ota_code = $3
         AND is_active = TRUE AND is_deleted = FALSE`,
      [tenantId, command.property_id, command.ota_code],
    );
    if (otaRows.length === 0) {
      throw new ReservationCommandError(
        "OTA_NOT_CONFIGURED",
        `No active OTA configuration for code "${command.ota_code}" on property ${command.property_id}`,
      );
    }
    const otaConfig = otaRows[0];

    // Gather current room availability for the next 30 days
    const { rows: availabilityRows } = await client.query(
      `SELECT rt.id AS room_type_id, rt.code AS room_type_code,
              rt.total_rooms,
              COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
                AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS sold,
              rt.total_rooms - COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
                AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS available
       FROM room_types rt
       CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day') AS d(day)
       LEFT JOIN reservations r ON r.room_type_id = rt.id AND r.tenant_id = $1
         AND r.property_id = $2 AND r.is_deleted = FALSE
       WHERE rt.tenant_id = $1 AND rt.property_id = $2 AND rt.is_deleted = FALSE
       GROUP BY rt.id, rt.code, rt.total_rooms, d.day
       ORDER BY d.day, rt.code
       LIMIT 1000`,
      [tenantId, command.property_id],
    );

    // Record sync attempt
    await client.query(
      `INSERT INTO ota_inventory_sync (
        sync_id, tenant_id, property_id, ota_config_id,
        sync_type, sync_direction, sync_status,
        total_items, successful_items, failed_items,
        sync_started_at, sync_completed_at, created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, 'outbound', 'completed',
        $6, $6, 0,
        NOW(), NOW(), $7
      )`,
      [
        syncId, tenantId, command.property_id, otaConfig.id,
        syncScope, availabilityRows.length,
        SYSTEM_ACTOR_ID,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: syncId,
      aggregateType: "ota_sync",
      eventType: "integration.ota.availability_synced",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.ota.availability_synced",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          sync_id: syncId,
          ota_code: command.ota_code,
          property_id: command.property_id,
          sync_scope: syncScope,
          records_synced: availabilityRows.length,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.property_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.ota.sync_request" },
    });
  });

  reservationsLogger.info(
    { syncId, otaCode: command.ota_code, propertyId: command.property_id },
    "OTA availability sync completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Push rate plans to an OTA channel.
 * Reads `ota_rate_plans` for the property/OTA, applies markup/markdown,
 * and records the push in `ota_inventory_sync`.
 */
export const otaRatePush = async (
  tenantId: string,
  command: IntegrationOtaRatePushCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();

  await withTransaction(async (client) => {
    // Verify OTA configuration
    const { rows: otaRows } = await client.query(
      `SELECT id, ota_name, rate_push_enabled
       FROM ota_configurations
       WHERE tenant_id = $1 AND property_id = $2 AND ota_code = $3
         AND is_active = TRUE AND is_deleted = FALSE`,
      [tenantId, command.property_id, command.ota_code],
    );
    if (otaRows.length === 0) {
      throw new ReservationCommandError(
        "OTA_NOT_CONFIGURED",
        `No active OTA configuration for code "${command.ota_code}"`,
      );
    }
    const otaConfig = otaRows[0];

    // Fetch rate plans mapped for this OTA
    const ratePlanFilter = command.rate_plan_id ? "AND orp.rate_id = $4" : "";
    const params: string[] = [
      tenantId, command.property_id,
      otaConfig.id,
    ];
    if (command.rate_plan_id) params.push(command.rate_plan_id);

    const { rows: ratePlans } = await client.query(
      `SELECT orp.id AS ota_rate_plan_id, orp.rate_id, orp.ota_rate_plan_id AS ota_rate_code,
              orp.markup_percentage, orp.markdown_percentage,
              r.rate_name, r.base_rate, r.currency
       FROM ota_rate_plans orp
       JOIN rates r ON r.rate_id = orp.rate_id AND r.tenant_id = $1
       WHERE orp.tenant_id = $1 AND orp.property_id = $2
         AND orp.ota_configuration_id = $3
         AND orp.is_active = TRUE AND orp.is_deleted = FALSE
         ${ratePlanFilter}`,
      params,
    );

    // Calculate pushed rates with markup/markdown
    const pushedRates = ratePlans.map((rp: Record<string, unknown>) => {
      const base = Number(rp.base_rate) || 0;
      const markup = Number(rp.markup_percentage) || 0;
      const markdown = Number(rp.markdown_percentage) || 0;
      const adjustedRate = base * (1 + markup / 100) * (1 - markdown / 100);
      return {
        ota_rate_code: rp.ota_rate_code,
        rate_plan_id: rp.rate_plan_id,
        base_rate: base,
        pushed_rate: Math.round(adjustedRate * 100) / 100,
        currency: rp.currency,
      };
    });

    // Record rate push sync
    await client.query(
      `INSERT INTO ota_inventory_sync (
        sync_id, tenant_id, property_id, ota_config_id,
        sync_type, sync_direction, sync_status,
        total_items, successful_items, failed_items,
        sync_started_at, sync_completed_at, created_by
      ) VALUES (
        $1, $2, $3, $4,
        'incremental', 'outbound', 'completed',
        $5, $5, 0,
        NOW(), NOW(), $6
      )`,
      [
        syncId, tenantId, command.property_id,
        otaConfig.id,
        pushedRates.length,
        SYSTEM_ACTOR_ID,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: syncId,
      aggregateType: "ota_sync",
      eventType: "integration.ota.rates_pushed",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.ota.rates_pushed",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          sync_id: syncId,
          ota_code: command.ota_code,
          property_id: command.property_id,
          rate_plans_pushed: pushedRates.length,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.property_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.ota.rate_push" },
    });
  });

  reservationsLogger.info(
    { syncId, otaCode: command.ota_code, propertyId: command.property_id },
    "OTA rate push completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Retry a failed webhook delivery.
 * Finds the webhook subscription, increments retry count,
 * and re-enqueues the delivery attempt.
 */
export const webhookRetry = async (
  tenantId: string,
  command: IntegrationWebhookRetryCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE webhook_subscriptions
       SET retry_count = retry_count + 1,
           last_triggered_at = NOW(),
           updated_at = NOW()
       WHERE subscription_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.subscription_id, tenantId],
    );

    if (!rowCount || rowCount === 0) {
      throw new ReservationCommandError(
        "WEBHOOK_NOT_FOUND",
        `Webhook subscription ${command.subscription_id} not found`,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.subscription_id,
      aggregateType: "webhook",
      eventType: "integration.webhook.retried",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.webhook.retried",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          subscription_id: command.subscription_id,
          event_id: command.event_id,
          reason: command.reason,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.subscription_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.webhook.retry" },
    });
  });

  reservationsLogger.info(
    { subscriptionId: command.subscription_id },
    "Webhook retry scheduled",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Update an integration mapping (channel_mappings / integration_mappings).
 * Applies the new mapping payload and records the change.
 */
export const updateIntegrationMapping = async (
  tenantId: string,
  command: IntegrationMappingUpdateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE integration_mappings
       SET transformation_rules = COALESCE(($3::jsonb)->'transformation_rules', transformation_rules),
           field_mappings = COALESCE(($3::jsonb)->'field_mappings', field_mappings),
           is_active = COALESCE((($3::jsonb)->>'is_active')::boolean, is_active),
           updated_at = NOW(), updated_by = $4
       WHERE mapping_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.mapping_id, tenantId, JSON.stringify(command.mapping_payload), SYSTEM_ACTOR_ID],
    );

    if (!rowCount || rowCount === 0) {
      throw new ReservationCommandError(
        "MAPPING_NOT_FOUND",
        `Integration mapping ${command.mapping_id} not found`,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.mapping_id,
      aggregateType: "integration_mapping",
      eventType: "integration.mapping.updated",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.mapping.updated",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          mapping_id: command.mapping_id,
          reason: command.reason,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.mapping_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.mapping.update" },
    });
  });

  reservationsLogger.info(
    { mappingId: command.mapping_id },
    "Integration mapping updated",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Process inbound OTA reservation queue entries.
 * Reads PENDING entries from `ota_reservations_queue`, maps room types
 * via `channel_mappings`, and creates internal reservations.
 * Called during OTA sync requests or scheduled processing.
 */
export const processOtaReservationQueue = async (
  tenantId: string,
  propertyId: string,
  options: { correlationId?: string } = {},
): Promise<{ processed: number; failed: number; duplicates: number }> => {
  const { rows: pending } = await query(
    `SELECT id, ota_configuration_id, ota_reservation_id, ota_booking_reference,
            guest_name, guest_email, guest_phone,
            check_in_date, check_out_date,
            room_type,
            total_amount, currency_code,
            special_requests, raw_payload
     FROM ota_reservations_queue
     WHERE tenant_id = $1 AND property_id = $2
       AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 100`,
    [tenantId, propertyId],
  );

  let processed = 0;
  let failed = 0;
  let duplicates = 0;

  for (const entry of pending) {
    try {
      await withTransaction(async (client) => {
        // Check for duplicates
        const { rows: existing } = await client.query(
          `SELECT id FROM ota_reservations_queue
           WHERE tenant_id = $1 AND ota_reservation_id = $2
             AND status IN ('completed', 'processing')
             AND id != $3`,
          [tenantId, entry.ota_reservation_id, entry.id],
        );
        if (existing.length > 0) {
          await client.query(
            `UPDATE ota_reservations_queue
             SET status = 'duplicate', processed_at = NOW()
             WHERE id = $1`,
            [entry.id],
          );
          duplicates++;
          return;
        }

        // Mark as processing
        await client.query(
          `UPDATE ota_reservations_queue
           SET status = 'processing', updated_at = NOW()
           WHERE id = $1`,
          [entry.id],
        );

        // Map OTA room type to internal room type via channel_mappings
        const { rows: mappingRows } = await client.query(
          `SELECT entity_id FROM channel_mappings
           WHERE tenant_id = $1 AND property_id = $2
             AND entity_type = 'room_type'
             AND external_code = $3
             AND is_active = TRUE`,
          [tenantId, propertyId, entry.room_type],
        );

        const roomTypeId = mappingRows.length > 0
          ? mappingRows[0].entity_id
          : null;

        if (!roomTypeId) {
          throw new Error(`No channel mapping for OTA room type "${entry.room_type}"`);
        }

        // Create the internal reservation
        const reservationId = uuid();
        await client.query(
          `INSERT INTO reservations (
            id, tenant_id, property_id, room_type_id,
            check_in_date, check_out_date, booking_date,
            status, reservation_type, source,
            total_amount, currency_code,
            special_requests, notes,
            created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, NOW(),
            'CONFIRMED', 'TRANSIENT', 'OTA',
            $7, $8,
            $9, $10,
            $11, $11
          )`,
          [
            reservationId, tenantId, propertyId, roomTypeId,
            entry.check_in_date, entry.check_out_date,
            entry.total_amount ?? 0, entry.currency_code ?? "USD",
            entry.special_requests ?? null,
            `OTA: ${entry.ota_booking_reference ?? entry.ota_reservation_id}`,
            SYSTEM_ACTOR_ID,
          ],
        );

        // Mark queue entry as completed
        await client.query(
          `UPDATE ota_reservations_queue
           SET status = 'completed',
               reservation_id = $2,
               processed_at = NOW()
           WHERE id = $1`,
          [entry.id, reservationId],
        );

        // Emit event
        const outboxEventId = uuid();
        await enqueueOutboxRecordWithClient(client, {
          eventId: outboxEventId,
          tenantId,
          aggregateId: reservationId,
          aggregateType: "reservation",
          eventType: "reservation.created_from_ota",
          payload: {
            metadata: {
              id: outboxEventId,
              source: serviceConfig.serviceId,
              type: "reservation.created_from_ota",
              timestamp: new Date().toISOString(),
              version: "1.0",
              correlationId: options.correlationId,
              tenantId,
              retryCount: 0,
            },
            payload: {
              reservation_id: reservationId,
              ota_reservation_id: entry.ota_reservation_id,
              ota_booking_reference: entry.ota_booking_reference,
              guest_name: entry.guest_name ?? "",
            },
          },
          headers: { tenantId, eventId: outboxEventId },
          correlationId: options.correlationId,
          partitionKey: reservationId,
          metadata: { source: serviceConfig.serviceId, action: "ota_queue_process" },
        });

        processed++;
      });
    } catch (err) {
      reservationsLogger.error(
        { queueId: entry.id, otaReservationId: entry.ota_reservation_id, error: err },
        "Failed to process OTA reservation queue entry",
      );
      try {
        await query(
          `UPDATE ota_reservations_queue
           SET status = 'failed',
               error_message = $2,
               processing_attempts = processing_attempts + 1,
               processed_at = NOW()
           WHERE id = $1`,
          [entry.id, err instanceof Error ? err.message : String(err)],
        );
      } catch { /* ignore tracking error */ }
      failed++;
    }
  }

  reservationsLogger.info(
    { propertyId, processed, failed, duplicates },
    "OTA reservation queue processing completed",
  );

  return { processed, failed, duplicates };
};

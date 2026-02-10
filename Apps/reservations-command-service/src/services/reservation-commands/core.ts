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
} from "../../clients/availability-guard-client.js";
import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import { recordLifecyclePersisted } from "../../repositories/lifecycle-repository.js";
import { insertRateFallbackRecord } from "../../repositories/rate-fallback-repository.js";
import {
  getReservationGuardMetadata,
  type ReservationGuardMetadata as StoredGuardMetadata,
  upsertReservationGuardMetadata,
} from "../../repositories/reservation-guard-metadata-repository.js";
import {
  fetchReservationCancellationInfo,
  fetchReservationStaySnapshot,
  type ReservationStaySnapshot,
} from "../../repositories/reservation-repository.js";
import type {
  ReservationBatchNoShowCommand,
  ReservationCancelCommand,
  ReservationCreateCommand,
  ReservationModifyCommand,
  ReservationNoShowCommand,
  ReservationWalkGuestCommand,
} from "../../schemas/reservation-command.js";
import { type RatePlanResolution, resolveRatePlan } from "../../services/rate-plan-service.js";
import { calculateCancellationFee } from "../cancellation-fee-service.js";
import {
  ReservationCommandError,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  SYSTEM_ACTOR_ID,
  type ReservationUpdatePayload,
  enqueueReservationUpdate,
  buildReservationUpdatePayload,
  hasStayCriticalChanges,
  findBestAvailableRoom,
} from "./common.js";

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
    throw new ReservationCommandError(
      "NOT_FOUND",
      `Reservation ${command.reservation_id} not found.`,
    );
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
        tenantId,
        reservation.property_id,
        command.reservation_id,
        reservation.confirmation_number,
        reservation.guest_name,
        reservation.guest_id,
        command.walk_reason ?? null,
        actorId,
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
        command.reservation_id,
        tenantId,
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

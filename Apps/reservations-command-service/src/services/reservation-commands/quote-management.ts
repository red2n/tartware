import { type ReservationUpdatedEvent, ReservationUpdatedEventSchema } from "@tartware/schemas";
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

import {
  getReservationGuardMetadata,
  upsertReservationGuardMetadata,
} from "../../repositories/reservation-guard-metadata-repository.js";
import type {
  ReservationConvertQuoteCommand,
  ReservationExpireCommand,
  ReservationSendQuoteCommand,
} from "../../schemas/reservation-command.js";

import { type CreateReservationResult, ReservationCommandError } from "./common.js";

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
    | {
        status: string;
        room_type_id: string;
        check_in_date: string;
        check_out_date: string;
        property_id: string;
      }
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

  const updatePayload = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.quoted",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      property_id: reservation.property_id,
      status: "QUOTED" as const,
      quoted_at: new Date().toISOString(),
      ...(command.quote_expires_at && { quote_expires_at: command.quote_expires_at.toISOString() }),
      ...(command.total_amount !== undefined && { total_amount: command.total_amount }),
      ...(command.currency && { currency: command.currency }),
      ...(command.notes && { internal_notes: command.notes }),
    },
  };

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
    | {
        status: string;
        room_type_id: string;
        check_in_date: string;
        check_out_date: string;
        property_id: string;
      }
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
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      property_id: reservation.property_id,
      status: "PENDING",
      ...(command.total_amount !== undefined && { total_amount: command.total_amount }),
      ...(command.currency && { currency: command.currency }),
      ...(command.notes && { internal_notes: command.notes }),
    },
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
    if (lockResult?.status === "LOCKED" && lockResult.lockId) {
      try {
        await releaseReservationHold({
          reservationId: command.reservation_id,
          lockId: lockResult.lockId,
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
    | {
        status: string;
        room_type_id: string;
        check_in_date: string;
        check_out_date: string;
        property_id: string;
      }
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

  const updatePayload = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.expired",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      property_id: reservation.property_id,
      status: "EXPIRED" as const,
      ...(command.reason && { internal_notes: command.reason }),
    },
  };

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
    {
      reservationId: command.reservation_id,
      previousStatus: reservation.status,
      reason: command.reason,
    },
    "Reservation expired",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

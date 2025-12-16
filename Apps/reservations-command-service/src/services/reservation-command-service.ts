import type { ReservationCreatedEvent } from "@tartware/schemas";
import { ReservationCreatedEventSchema } from "@tartware/schemas";
import { validate as isUuid, v4 as uuid } from "uuid";

import { serviceConfig } from "../config.js";
import { withTransaction } from "../lib/db.js";
import { stampLifecycleCheckpoint } from "../lib/lifecycle-guard.js";
import { enqueueOutboxRecord } from "../outbox/repository.js";
import type { ReservationCreateCommand } from "../schemas/reservation-command.js";

import { ensureRatePlanAssignment } from "./rate-plan-fallback-service.js";

interface CreateReservationResult {
  eventId: string;
  correlationId: string;
  status: "accepted";
}

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
  const correlationId = ensureCorrelationId(options.correlationId, eventId);
  const ratePlanAssignment = await ensureRatePlanAssignment({
    tenantId,
    propertyId: command.property_id,
    roomTypeId: command.room_type_id,
    requestedRateCode: command.rate_plan_code,
    correlationId,
    checkInDate: command.check_in_date,
    checkOutDate: command.check_out_date,
  });
  const fallbackMetadata = ratePlanAssignment.fallbackApplied
    ? {
        requested_rate_code: ratePlanAssignment.requestedRateCode,
        applied_rate_code: ratePlanAssignment.rateCode,
        reason: ratePlanAssignment.fallbackReason,
        actor: serviceConfig.serviceId,
      }
    : undefined;
  const payload: ReservationCreatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.created",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId,
      tenantId,
    },
    payload: {
      ...command,
      rate_id: ratePlanAssignment.rateId,
      rate_plan_code: ratePlanAssignment.rateCode,
      check_in_date: command.check_in_date,
      check_out_date: command.check_out_date,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: command.currency ?? "USD",
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
      ...(fallbackMetadata ? { fallback: fallbackMetadata } : {}),
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  await stampLifecycleCheckpoint({
    correlationId,
    tenantId,
    reservationId: validatedEvent.payload.id,
    state: "RECEIVED",
    source: `${serviceConfig.serviceId}:api`,
    actor: serviceConfig.serviceId,
    reason: "Reservation command received",
    payload: {
      command: {
        property_id: command.property_id,
        room_type_id: command.room_type_id,
        guest_id: command.guest_id,
        rate_plan_code: (command as { rate_plan_code?: string }).rate_plan_code,
        check_in_date: command.check_in_date,
        check_out_date: command.check_out_date,
      },
      ratePlan: {
        requested: ratePlanAssignment.requestedRateCode,
        applied: ratePlanAssignment.rateCode,
        fallbackApplied: ratePlanAssignment.fallbackApplied,
      },
    },
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecord(
      {
        eventId,
        tenantId,
        aggregateId,
        aggregateType: "reservation",
        eventType: validatedEvent.metadata.type,
        payload: validatedEvent,
        headers: {
          tenantId,
          eventId,
          correlationId,
        },
        correlationId,
        partitionKey,
        metadata: {
          source: serviceConfig.serviceId,
        },
      },
      client,
    );

    await stampLifecycleCheckpoint(
      {
        correlationId,
        tenantId,
        reservationId: validatedEvent.payload.id,
        state: "PERSISTED",
        source: `${serviceConfig.serviceId}:api`,
        actor: serviceConfig.serviceId,
        reason: "Command persisted to transactional outbox",
        payload: {
          outbox: {
            eventId,
            aggregateId,
            partitionKey,
            eventType: validatedEvent.metadata.type,
          },
          ratePlan: {
            requested: ratePlanAssignment.requestedRateCode,
            applied: ratePlanAssignment.rateCode,
            fallbackApplied: ratePlanAssignment.fallbackApplied,
          },
        },
      },
      { client },
    );
  });

  return {
    eventId,
    correlationId,
    status: "accepted",
  };
};

const ensureCorrelationId = (
  suppliedId: string | undefined,
  fallback: string,
): string => {
  if (suppliedId && isUuid(suppliedId)) {
    return suppliedId;
  }
  return fallback;
};

import type { ReservationCreatedEvent } from "@tartware/schemas";
import { ReservationCreatedEventSchema } from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { serviceConfig } from "../config.js";
import { enqueueOutboxRecord } from "../outbox/repository.js";
import type { ReservationCreateCommand } from "../schemas/reservation-command.js";

interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
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
  const payload: ReservationCreatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.created",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
    },
    payload: {
      ...command,
      check_in_date: command.check_in_date,
      check_out_date: command.check_out_date,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: command.currency ?? "USD",
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  await enqueueOutboxRecord({
    eventId,
    tenantId,
    aggregateId,
    aggregateType: "reservation",
    eventType: validatedEvent.metadata.type,
    payload: validatedEvent,
    headers: {
      tenantId,
      eventId,
      ...(options.correlationId
        ? { correlationId: options.correlationId }
        : {}),
    },
    correlationId: options.correlationId,
    partitionKey,
    metadata: {
      source: serviceConfig.serviceId,
    },
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

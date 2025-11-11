import type { ReservationCreatedEvent } from "@tartware/schemas";
import { ReservationCreatedEventSchema } from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { serviceConfig } from "../config.js";
import { publishEvent } from "../kafka/producer.js";
import type { ReservationCreateCommand } from "../schemas/reservation-command.js";

interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
  status: "accepted";
}

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

  await publishEvent({
    key: validatedEvent.payload.guest_id ?? tenantId,
    value: JSON.stringify(validatedEvent),
    headers: {
      tenantId,
      eventId,
    },
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

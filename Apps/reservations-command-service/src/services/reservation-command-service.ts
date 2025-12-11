import {
  buildDomainEvent,
  createKafkaEventRecord,
  resolveDomainTopic,
} from "@tartware/domain-events";
import type {
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import {
  ReservationCancelledEventSchema,
  ReservationCreatedEventSchema,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";

import { kafkaConfig, serviceConfig } from "../config.js";
import { publishEvent } from "../kafka/producer.js";
import type {
  ReservationCancelCommand,
  ReservationCreateCommand,
  ReservationUpdateCommand,
} from "../schemas/reservation-command.js";

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
  const envelope = buildDomainEvent<ReservationCreatedEvent["payload"]>({
    type: "reservation.created",
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
    source: serviceConfig.serviceId,
    tenantId,
    correlationId: options.correlationId,
    version: "1.0",
  });

  const validatedEvent = ReservationCreatedEventSchema.parse(envelope);

  const topicName =
    kafkaConfig.topic ?? resolveDomainTopic("reservations").topic;

  const record = createKafkaEventRecord({
    event: validatedEvent,
    topic: topicName,
    partitionKey: validatedEvent.payload.guest_id ?? tenantId,
    headers: {
      tenantId,
      eventId: validatedEvent.metadata.id,
    },
  });

  await publishEvent(record);

  return {
    eventId: validatedEvent.metadata.id,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

export const updateReservation = async (
  tenantId: string,
  reservationId: string,
  command: ReservationUpdateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const envelope = buildDomainEvent<ReservationUpdatedEvent["payload"]>({
    type: "reservation.updated",
    payload: {
      id: reservationId,
      ...command,
    },
    source: serviceConfig.serviceId,
    tenantId,
    correlationId: options.correlationId,
    version: "1.0",
  });

  const validatedEvent = ReservationUpdatedEventSchema.parse(envelope);

  const topicName =
    kafkaConfig.topic ?? resolveDomainTopic("reservations").topic;

  const record = createKafkaEventRecord({
    event: validatedEvent,
    topic: topicName,
    partitionKey: validatedEvent.payload.id,
    headers: {
      tenantId,
      eventId: validatedEvent.metadata.id,
    },
  });

  await publishEvent(record);

  return {
    eventId: validatedEvent.metadata.id,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

export const cancelReservation = async (
  tenantId: string,
  reservationId: string,
  command: ReservationCancelCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const envelope = buildDomainEvent<ReservationCancelledEvent["payload"]>({
    type: "reservation.cancelled",
    payload: {
      id: reservationId,
      tenant_id: tenantId,
      cancelled_at: command.cancelled_at ?? new Date(),
      cancelled_by: command.cancelled_by,
      reason: command.reason,
    },
    source: serviceConfig.serviceId,
    tenantId,
    correlationId: options.correlationId,
    version: "1.0",
  });

  const validatedEvent = ReservationCancelledEventSchema.parse(envelope);

  const topicName =
    kafkaConfig.topic ?? resolveDomainTopic("reservations").topic;

  const record = createKafkaEventRecord({
    event: validatedEvent,
    topic: topicName,
    partitionKey: validatedEvent.payload.id,
    headers: {
      tenantId,
      eventId: validatedEvent.metadata.id,
    },
  });

  await publishEvent(record);

  return {
    eventId: validatedEvent.metadata.id,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

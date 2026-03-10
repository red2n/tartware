/**
 * Kafka consumer for reservation lifecycle events.
 *
 * Subscribes to `reservations.events` and updates demand calendar
 * metrics in near-real-time:
 *
 * - `reservation.created`   → increment OTB (on-the-books) rooms
 * - `reservation.cancelled`  → decrement OTB rooms
 * - `reservation.updated` (checkout) → move from reserved to occupied
 */

import type { ReservationEventEnvelope } from "@tartware/schemas";
import { createServiceLogger } from "@tartware/telemetry";
import type { Consumer, EachMessagePayload } from "kafkajs";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { query } from "../lib/db.js";
import {
  DEMAND_CALENDAR_CHECKOUT_SQL,
  DEMAND_CALENDAR_DECREMENT_OTB_SQL,
  DEMAND_CALENDAR_INCREMENT_OTB_SQL,
} from "../sql/event-queries.js";

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
}).child({ module: "reservation-event-consumer" });

let consumer: Consumer | null = null;

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

/**
 * Classify a `reservation.updated` event into a specific sub-type based
 * on payload fields (mirrors notification-service classification).
 */
const classifyUpdateEvent = (payload: ReservationEventEnvelope["payload"]): string => {
  const meta = payload.metadata;
  if (meta?.is_no_show === true) return "reservation.no_show";
  if (payload.status === "CHECKED_IN") return "reservation.checked_in";
  if (payload.status === "CHECKED_OUT" && payload.actual_check_out)
    return "reservation.checked_out";
  return "reservation.modified";
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Generate an array of date strings (YYYY-MM-DD) from check-in (inclusive)
 * to check-out (exclusive), representing room nights.
 */
const stayDates = (checkIn: string, checkOut: string): string[] => {
  const dates: string[] = [];
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

const handleReservationCreated = async (
  tenantId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> => {
  const dates = stayDates(checkIn, checkOut);
  for (const date of dates) {
    await query(DEMAND_CALENDAR_INCREMENT_OTB_SQL, [tenantId, propertyId, date, tenantId]);
  }
  logger.debug(
    { tenantId, propertyId, checkIn, checkOut, nights: dates.length },
    "OTB incremented for new reservation",
  );
};

const handleReservationCancelled = async (
  tenantId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> => {
  const dates = stayDates(checkIn, checkOut);
  for (const date of dates) {
    await query(DEMAND_CALENDAR_DECREMENT_OTB_SQL, [tenantId, propertyId, date, tenantId]);
  }
  logger.debug(
    { tenantId, propertyId, checkIn, checkOut, nights: dates.length },
    "OTB decremented for cancelled reservation",
  );
};

const handleReservationCheckedOut = async (
  tenantId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> => {
  const dates = stayDates(checkIn, checkOut);
  for (const date of dates) {
    await query(DEMAND_CALENDAR_CHECKOUT_SQL, [tenantId, propertyId, date, tenantId]);
  }
  logger.debug(
    { tenantId, propertyId, checkIn, checkOut, nights: dates.length },
    "demand calendar updated for checkout",
  );
};

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

const processReservationEvent = async (envelope: ReservationEventEnvelope): Promise<void> => {
  const rawType = envelope.metadata.type;
  const eventType =
    rawType === "reservation.updated" ? classifyUpdateEvent(envelope.payload) : rawType;

  const tenantId = envelope.metadata.tenantId;
  const propertyId = String(envelope.payload.property_id ?? "");
  const checkIn = envelope.payload.check_in_date ? String(envelope.payload.check_in_date) : null;
  const checkOut = envelope.payload.check_out_date ? String(envelope.payload.check_out_date) : null;

  if (!propertyId || !checkIn || !checkOut) {
    logger.debug({ eventType, tenantId }, "skipping event — missing property/dates");
    return;
  }

  switch (eventType) {
    case "reservation.created":
      await handleReservationCreated(tenantId, propertyId, checkIn, checkOut);
      break;
    case "reservation.cancelled":
      await handleReservationCancelled(tenantId, propertyId, checkIn, checkOut);
      break;
    case "reservation.checked_out":
      await handleReservationCheckedOut(tenantId, propertyId, checkIn, checkOut);
      break;
    default:
      logger.debug({ eventType }, "no demand calendar action for event type");
  }
};

// ---------------------------------------------------------------------------
// Consumer lifecycle
// ---------------------------------------------------------------------------

export const startReservationEventConsumer = async (): Promise<void> => {
  if (consumer) return;

  consumer = kafka.consumer({
    groupId: config.reservationEvents.consumerGroupId,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.reservationEvents.topic,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;

      try {
        const envelope = JSON.parse(message.value.toString()) as ReservationEventEnvelope;
        if (!envelope.metadata?.type || !envelope.payload) {
          logger.warn({ offset: message.offset }, "skipping malformed reservation event");
          return;
        }
        await processReservationEvent(envelope);
      } catch (err) {
        logger.error({ err, offset: message.offset }, "failed to process reservation event");
      }
    },
  });

  logger.info(
    {
      topic: config.reservationEvents.topic,
      groupId: config.reservationEvents.consumerGroupId,
    },
    "reservation event consumer started",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await consumer.disconnect();
    logger.info("reservation event consumer disconnected");
  } finally {
    consumer = null;
  }
};

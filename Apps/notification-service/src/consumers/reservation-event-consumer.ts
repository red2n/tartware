import type { Consumer, EachMessagePayload } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import { sendNotification } from "../services/notification-dispatch-service.js";

const logger = appLogger.child({ module: "reservation-event-consumer" });

let consumer: Consumer | null = null;

/**
 * Map reservation event types to template codes.
 *
 * Templates must be pre-seeded in `communication_templates` with matching `template_code` values.
 */
const EVENT_TO_TEMPLATE: Record<string, string> = {
  "reservation.confirmed": "BOOKING_CONFIRMED",
  "reservation.modified": "BOOKING_MODIFIED",
  "reservation.cancelled": "BOOKING_CANCELLED",
  "reservation.checked_in": "CHECK_IN_CONFIRMATION",
  "reservation.checked_out": "CHECK_OUT_CONFIRMATION",
};

type ReservationEvent = {
  eventType: string;
  tenantId: string;
  propertyId: string;
  reservationId: string;
  guestId: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  confirmationNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomNumber?: string;
  roomType?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
};

/**
 * Process a single reservation event and trigger a notification if a matching template exists.
 */
const processReservationEvent = async (event: ReservationEvent): Promise<void> => {
  const templateCode = EVENT_TO_TEMPLATE[event.eventType];
  if (!templateCode) {
    logger.debug({ eventType: event.eventType }, "No notification template mapped for event type");
    return;
  }

  const context: Record<string, string | number | boolean | null> = {
    guest_name: event.guestName ?? "Guest",
    confirmation_number: event.confirmationNumber ?? "",
    check_in_date: event.checkInDate ?? "",
    check_out_date: event.checkOutDate ?? "",
    room_number: event.roomNumber ?? "",
    room_type: event.roomType ?? "",
    total_amount: event.totalAmount ?? 0,
    currency: event.currency ?? "USD",
    reservation_id: event.reservationId,
    property_id: event.propertyId,
  };

  try {
    const result = await sendNotification({
      tenantId: event.tenantId,
      propertyId: event.propertyId,
      guestId: event.guestId,
      reservationId: event.reservationId,
      templateCode,
      recipientName: event.guestName ?? "Guest",
      recipientEmail: event.guestEmail ?? null,
      recipientPhone: event.guestPhone ?? null,
      context,
      initiatedBy: null,
      idempotencyKey: `${event.eventType}:${event.reservationId}`,
    });

    if (result) {
      logger.info(
        {
          eventType: event.eventType,
          templateCode,
          communicationId: result.communicationId,
          dispatched: result.dispatched,
          reservationId: event.reservationId,
        },
        "Reservation event notification processed",
      );
    }
  } catch (err) {
    logger.error(
      {
        err,
        eventType: event.eventType,
        reservationId: event.reservationId,
      },
      "Failed to process reservation event notification",
    );
  }
};

/**
 * Start consuming reservation events for automated notification dispatch.
 */
export const startReservationEventConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

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
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value.toString()) as ReservationEvent;
        await processReservationEvent(event);
      } catch (err) {
        logger.error({ err, offset: message.offset }, "Failed to parse reservation event message");
      }
    },
  });

  logger.info(
    {
      topic: config.reservationEvents.topic,
      groupId: config.reservationEvents.consumerGroupId,
    },
    "Reservation event consumer started for notification dispatch",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("Reservation event consumer disconnected");
  } finally {
    consumer = null;
  }
};

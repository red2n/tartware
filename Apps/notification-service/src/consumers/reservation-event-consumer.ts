import type { Consumer, EachMessagePayload } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import { getMessagesByTrigger } from "../services/automated-message-service.js";
import { createInAppNotification } from "../services/in-app-notification-service.js";
import { sendNotification } from "../services/notification-dispatch-service.js";
import { getTemplate } from "../services/template-service.js";

const logger = appLogger.child({ module: "reservation-event-consumer" });

/** Format an ISO date string to a short human-readable form (e.g. "Mar 3, 2026"). */
const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

let consumer: Consumer | null = null;

/**
 * Map reservation event types to template codes.
 *
 * Templates must be pre-seeded in `communication_templates` with matching `template_code` values.
 */
const EVENT_TO_TEMPLATE: Record<string, string> = {
  "reservation.created": "BOOKING_CONFIRMED",
  "reservation.updated": "BOOKING_MODIFIED",
  "reservation.cancelled": "BOOKING_CANCELLED",
};

/**
 * Map reservation event types to automated_messages trigger_type values.
 */
const EVENT_TO_TRIGGER_TYPE: Record<string, string> = {
  "reservation.created": "booking_confirmed",
  "reservation.updated": "booking_modified",
  "reservation.cancelled": "booking_cancelled",
};

/**
 * Map reservation event types to in-app notification properties.
 */
const EVENT_TO_IN_APP: Record<
  string,
  { title: (e: ReservationEvent) => string; category: string; priority: string }
> = {
  "reservation.created": {
    title: (e) => `New reservation ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.updated": {
    title: (e) => `Reservation ${e.confirmationNumber ?? e.reservationId} modified`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.cancelled": {
    title: (e) => `Reservation ${e.confirmationNumber ?? e.reservationId} cancelled`,
    category: "reservation",
    priority: "high",
  },
};

/** Internal flat format used by the consumer handlers. */
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
};

/** Kafka envelope: { metadata: {...}, payload: {...} } */
type ReservationEventEnvelope = {
  metadata: {
    type: string;
    tenantId: string;
    id: string;
    correlationId?: string;
    [key: string]: unknown;
  };
  payload: {
    id: string;
    property_id: string;
    guest_id: string;
    confirmation_number?: string;
    check_in_date?: string;
    check_out_date?: string;
    room_number?: string;
    room_type_id?: string;
    total_amount?: number;
    currency?: string;
    tenant_id?: string;
    [key: string]: unknown;
  };
};

/** Transform Kafka envelope into internal flat format. */
const toReservationEvent = (envelope: ReservationEventEnvelope): ReservationEvent => ({
  eventType: envelope.metadata.type,
  tenantId: envelope.metadata.tenantId,
  propertyId: String(envelope.payload.property_id ?? ""),
  reservationId: String(envelope.payload.id ?? envelope.metadata.id ?? ""),
  guestId: String(envelope.payload.guest_id ?? ""),
  confirmationNumber: envelope.payload.confirmation_number
    ? String(envelope.payload.confirmation_number)
    : undefined,
  checkInDate: envelope.payload.check_in_date ? String(envelope.payload.check_in_date) : undefined,
  checkOutDate: envelope.payload.check_out_date
    ? String(envelope.payload.check_out_date)
    : undefined,
  roomNumber: envelope.payload.room_number ? String(envelope.payload.room_number) : undefined,
  totalAmount:
    typeof envelope.payload.total_amount === "number" ? envelope.payload.total_amount : undefined,
  currency: envelope.payload.currency ? String(envelope.payload.currency) : undefined,
});

/**
 * Process a single reservation event and trigger notifications.
 *
 * 1. Send the hardcoded template mapping (EVENT_TO_TEMPLATE) if one exists.
 * 2. Look up active automated_messages for the trigger type and dispatch
 *    any that have a linked template_id (skipping duplicates of step 1).
 */
const processReservationEvent = async (event: ReservationEvent): Promise<void> => {
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

  // Step 1: Hardcoded template mapping (backward compatible)
  const templateCode = EVENT_TO_TEMPLATE[event.eventType];
  const sentTemplateCodes = new Set<string>();

  if (templateCode) {
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
        sentTemplateCodes.add(templateCode);
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
        { err, eventType: event.eventType, reservationId: event.reservationId },
        "Failed to process reservation event notification",
      );
    }
  }

  // Step 2: Automated messages lookup
  const triggerType = EVENT_TO_TRIGGER_TYPE[event.eventType];
  if (!triggerType) return;

  try {
    const automatedMessages = await getMessagesByTrigger(event.tenantId, triggerType);
    for (const msg of automatedMessages) {
      if (!msg.template_id) continue;

      // Resolve the template by ID to get its code and avoid duplicating step 1
      const template = await getTemplate(event.tenantId, msg.template_id);
      if (!template || sentTemplateCodes.has(template.template_code)) continue;

      try {
        const result = await sendNotification({
          tenantId: event.tenantId,
          propertyId: event.propertyId,
          guestId: event.guestId,
          reservationId: event.reservationId,
          templateCode: template.template_code,
          recipientName: event.guestName ?? "Guest",
          recipientEmail: event.guestEmail ?? null,
          recipientPhone: event.guestPhone ?? null,
          context,
          initiatedBy: null,
          idempotencyKey: `auto:${msg.message_id}:${event.reservationId}`,
        });

        if (result) {
          sentTemplateCodes.add(template.template_code);
          logger.info(
            {
              messageId: msg.message_id,
              templateCode: template.template_code,
              communicationId: result.communicationId,
              reservationId: event.reservationId,
            },
            "Automated message notification dispatched",
          );
        }
      } catch (err) {
        logger.error(
          { err, messageId: msg.message_id, reservationId: event.reservationId },
          "Failed to dispatch automated message notification",
        );
      }
    }
  } catch (err) {
    logger.error(
      { err, triggerType, reservationId: event.reservationId },
      "Failed to look up automated messages",
    );
  }

  // Step 3: Create in-app notification for staff
  const inAppConfig = EVENT_TO_IN_APP[event.eventType];
  if (inAppConfig) {
    try {
      const guestName = event.guestName ?? "Guest";
      const confNum = event.confirmationNumber ?? event.reservationId.slice(0, 8);
      const room = event.roomNumber ? ` — Room ${event.roomNumber}` : "";
      const dates =
        event.checkInDate && event.checkOutDate
          ? `${formatDate(event.checkInDate)} to ${formatDate(event.checkOutDate)}`
          : "";

      await createInAppNotification({
        tenant_id: event.tenantId,
        property_id: event.propertyId,
        title: inAppConfig.title(event),
        message: `${guestName} (${confNum})${room}${dates ? `. ${dates}` : ""}`,
        category: inAppConfig.category as "reservation" | "checkin" | "checkout",
        priority: inAppConfig.priority as "normal" | "high",
        source_type: "reservation",
        source_id: event.reservationId,
        action_url: `/reservations/${event.reservationId}`,
        metadata: {
          event_type: event.eventType,
          guest_name: guestName,
          confirmation_number: confNum,
          room_number: event.roomNumber,
        },
      });
    } catch (err) {
      logger.error(
        { err, eventType: event.eventType, reservationId: event.reservationId },
        "Failed to create in-app notification",
      );
    }
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
        const envelope = JSON.parse(message.value.toString()) as ReservationEventEnvelope;
        if (!envelope.metadata?.type || !envelope.payload) {
          logger.warn({ offset: message.offset }, "Skipping malformed reservation event");
          return;
        }
        const event = toReservationEvent(envelope);
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

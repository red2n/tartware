/* eslint-disable @typescript-eslint/no-explicit-any */

import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";
import { enterTenantScope } from "@tartware/config/db";
import { processWithRetry } from "@tartware/config/retry";
import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer } from "kafkajs";
import type { z } from "zod";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  recordDlqEvent,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import { getMessagesByTrigger } from "../services/automated-message-service.js";
import { createInAppNotification } from "../services/in-app-notification-service.js";
import { sendNotification } from "../services/notification-dispatch-service.js";
import { getTemplate } from "../services/template-service.js";
import { hashIdentifier, recordAuditLog, redactPayload } from "../utils/audit.js";

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
let dlqProducer: ReturnType<typeof createKafkaProducer> | null = null;

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

/**
 * Map reservation event types to template codes.
 *
 * `reservation.updated` is intentionally **excluded** — it is classified at
 * runtime into check-in, check-out, no-show, or regular modification based
 * on payload fields (see {@link classifyUpdateEvent}).
 *
 * Templates must be pre-seeded in `communication_templates` with matching
 * `template_code` values.
 */
const EVENT_TO_TEMPLATE: Record<string, string> = {
  // Reservation lifecycle
  "reservation.created": "BOOKING_CONFIRMED",
  "reservation.cancelled": "BOOKING_CANCELLED",
  "reservation.quoted": "QUOTE_SENT",
  "reservation.expired": "RESERVATION_EXPIRED",
  "reservation.created_from_ota": "OTA_BOOKING_CONFIRMED",

  // Sub-types derived from reservation.updated (set by classifyUpdateEvent)
  "reservation.checked_in": "CHECK_IN_CONFIRMATION",
  "reservation.checked_out": "CHECK_OUT_CONFIRMATION",
  "reservation.no_show": "NO_SHOW_NOTIFICATION",
  "reservation.modified": "BOOKING_MODIFIED",

  // Group events
  "group.created": "GROUP_BOOKING_CONFIRMED",
  "group.rooming_list_uploaded": "GROUP_ROOMING_LIST",
  "group.cutoff_enforced": "GROUP_CUTOFF_NOTICE",
};

/**
 * Map event types to automated_messages trigger_type values.
 */
const EVENT_TO_TRIGGER_TYPE: Record<string, string> = {
  "reservation.created": "booking_confirmed",
  "reservation.cancelled": "booking_cancelled",
  "reservation.checked_in": "checkin_completed",
  "reservation.checked_out": "checkout_completed",
  "reservation.no_show": "custom",
  "reservation.modified": "booking_modified",
  "reservation.quoted": "custom",
  "reservation.expired": "reservation_expiring",
  "reservation.created_from_ota": "booking_confirmed",
  "group.created": "custom",
  "group.rooming_list_uploaded": "custom",
  "group.cutoff_enforced": "custom",
};

type InAppConfig = {
  title: (e: ReservationEvent) => string;
  category: string;
  priority: string;
};

/**
 * Map event types to in-app notification properties for staff alerts.
 */
const EVENT_TO_IN_APP: Record<string, InAppConfig> = {
  "reservation.created": {
    title: (e) => `New reservation ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.modified": {
    title: (e) => `Reservation ${e.confirmationNumber ?? e.reservationId} modified`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.cancelled": {
    title: (e) => `Reservation ${e.confirmationNumber ?? e.reservationId} cancelled`,
    category: "reservation",
    priority: "high",
  },
  "reservation.checked_in": {
    title: (e) => `Guest checked in — ${e.confirmationNumber ?? e.reservationId}`,
    category: "checkin",
    priority: "normal",
  },
  "reservation.checked_out": {
    title: (e) => `Guest checked out — ${e.confirmationNumber ?? e.reservationId}`,
    category: "checkout",
    priority: "normal",
  },
  "reservation.no_show": {
    title: (e) => `No-show — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "high",
  },
  "reservation.quoted": {
    title: (e) => `Quote sent — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.expired": {
    title: (e) => `Reservation expired — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "reservation.created_from_ota": {
    title: (e) => `OTA booking — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "group.created": {
    title: (e) => `Group booking created — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "group.rooming_list_uploaded": {
    title: (e) => `Rooming list uploaded — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "normal",
  },
  "group.cutoff_enforced": {
    title: (e) => `Group cutoff enforced — ${e.confirmationNumber ?? e.reservationId}`,
    category: "reservation",
    priority: "high",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Extra context extracted from the raw payload for template rendering. */
  extraContext?: Record<string, string | number | boolean | null>;
  originalEventId: string;
};

/** Kafka envelope: { metadata: {...}, payload: {...} } */

// ---------------------------------------------------------------------------
// Event classification helpers
// ---------------------------------------------------------------------------

/**
 * Classify a generic `reservation.updated` event into a specific sub-type
 * based on payload fields set by the reservations-command-service.
 *
 * Priority order:
 * 1. No-show  — `metadata.is_no_show === true`
 * 2. Check-in — `status === "CHECKED_IN"` **and** `actual_check_in` present
 * 3. Check-out — `status === "CHECKED_OUT"` **and** `actual_check_out` present
 * 4. Regular modification — fallback
 */
const classifyUpdateEvent = (payload: any): string => {
  const meta = payload.metadata;

  if ((meta as any)?.is_no_show === true) {
    return "reservation.no_show";
  }

  if (payload.status === "CHECKED_IN" && (payload as any).actual_check_in) {
    return "reservation.checked_in";
  }

  if (payload.status === "CHECKED_OUT" && (payload as any).actual_check_out) {
    return "reservation.checked_out";
  }

  return "reservation.modified";
};

/**
 * Extract extra template-rendering context from the raw payload depending on
 * the classified event type (e.g. no-show fee, group name, OTA channel).
 */
const extractExtraContext = (
  classifiedType: string,
  payload: any,
): Record<string, string | number | boolean | null> => {
  const extra: Record<string, string | number | boolean | null> = {};
  const meta = payload.metadata;

  switch (classifiedType) {
    case "reservation.no_show":
      if (meta?.no_show_fee != null) extra.no_show_fee = Number(meta.no_show_fee);
      if (meta?.reason) extra.no_show_reason = String(meta.reason);
      break;

    case "reservation.checked_in":
      if (payload.actual_check_in) extra.actual_check_in = String(payload.actual_check_in);
      if (meta?.auto_assigned != null) extra.auto_assigned = Boolean(meta.auto_assigned);
      break;

    case "reservation.checked_out":
      if (payload.actual_check_out) extra.actual_check_out = String(payload.actual_check_out);
      break;

    case "reservation.quoted":
      if (payload.metadata?.expiry_date) extra.expiry_date = String(payload.metadata.expiry_date);
      if (payload.metadata?.quote_notes) extra.quote_notes = String(payload.metadata.quote_notes);
      break;

    case "group.created":
      if (payload.metadata?.group_name) extra.group_name = String(payload.metadata.group_name);
      if (payload.metadata?.booking_code)
        extra.booking_code = String(payload.metadata.booking_code);
      if (payload.metadata?.total_rooms) extra.total_rooms = Number(payload.metadata.total_rooms);
      if (payload.metadata?.cutoff_date) extra.cutoff_date = String(payload.metadata.cutoff_date);
      if (payload.metadata?.contact_name)
        extra.contact_name = String(payload.metadata.contact_name);
      break;

    case "group.rooming_list_uploaded":
      if (payload.metadata?.group_name) extra.group_name = String(payload.metadata.group_name);
      if (payload.metadata?.total_rooms) extra.total_rooms = Number(payload.metadata.total_rooms);
      if (payload.metadata?.rooms_assigned)
        extra.rooms_assigned = Number(payload.metadata.rooms_assigned);
      if (payload.metadata?.rooms_remaining)
        extra.rooms_remaining = Number(payload.metadata.rooms_remaining);
      if (payload.metadata?.contact_name)
        extra.contact_name = String(payload.metadata.contact_name);
      break;

    case "group.cutoff_enforced":
      if (payload.metadata?.group_name) extra.group_name = String(payload.metadata.group_name);
      if (payload.metadata?.cutoff_date) extra.cutoff_date = String(payload.metadata.cutoff_date);
      if (payload.metadata?.rooms_released)
        extra.rooms_released = Number(payload.metadata.rooms_released);
      if (payload.metadata?.rooms_remaining)
        extra.rooms_remaining = Number(payload.metadata.rooms_remaining);
      if (payload.metadata?.contact_name)
        extra.contact_name = String(payload.metadata.contact_name);
      break;

    case "reservation.created_from_ota":
      if (payload.metadata?.ota_channel) extra.ota_channel = String(payload.metadata.ota_channel);
      break;
  }

  return extra;
};

const readNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readFromPayloadOrMetadata = (
  payload: z.infer<typeof ReservationEventSchema>["payload"],
  key: string,
): string | undefined => {
  const payloadRecord = payload as Record<string, unknown>;
  const fromPayload = readNonEmptyString(payloadRecord[key]);
  if (fromPayload) {
    return fromPayload;
  }

  const metadataRecord = (payload as Record<string, unknown>).metadata as
    | Record<string, unknown>
    | undefined;
  return readNonEmptyString(metadataRecord?.[key]);
};

/** Transform Kafka envelope into internal flat format. */
const toReservationEvent = (envelope: z.infer<typeof ReservationEventSchema>): ReservationEvent => {
  // Classify reservation.updated into a specific sub-type
  const rawType = envelope.metadata.type;
  const payload = envelope.payload as any;

  const classifiedType =
    rawType === "reservation.updated" ? classifyUpdateEvent(envelope.payload) : rawType;

  const extraContext = extractExtraContext(classifiedType, envelope.payload);

  return {
    eventType: classifiedType,
    tenantId: envelope.metadata.tenantId,
    propertyId: String(payload.property_id ?? ""),
    reservationId: String(payload.id ?? envelope.metadata.id ?? ""),
    guestId: String(payload.guest_id ?? ""),
    guestName: readFromPayloadOrMetadata(envelope.payload, "guest_name"),
    guestEmail: readFromPayloadOrMetadata(envelope.payload, "guest_email"),
    guestPhone: readFromPayloadOrMetadata(envelope.payload, "guest_phone"),
    confirmationNumber: payload.confirmation_number
      ? String(payload.confirmation_number)
      : undefined,
    checkInDate: payload.check_in_date ? String(payload.check_in_date) : undefined,
    checkOutDate: payload.check_out_date ? String(payload.check_out_date) : undefined,
    roomNumber: payload.room_number ? String(payload.room_number) : undefined,
    roomType:
      readFromPayloadOrMetadata(envelope.payload, "room_type") ??
      readFromPayloadOrMetadata(envelope.payload, "room_type_name"),
    totalAmount: typeof payload.total_amount === "number" ? payload.total_amount : undefined,
    currency: payload.currency ? String(payload.currency) : undefined,
    extraContext: Object.keys(extraContext).length > 0 ? extraContext : undefined,
    originalEventId: envelope.metadata.id,
  };
};

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Process a single reservation event and trigger notifications.
 *
 * 1. Send the hardcoded template mapping (EVENT_TO_TEMPLATE) if one exists.
 * 2. Look up active automated_messages for the trigger type and dispatch
 *    any that have a linked template_id (skipping duplicates of step 1).
 * 3. Create an in-app notification for staff if configured.
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
    // Merge any extra context extracted from the payload (no-show fee, group name, etc.)
    ...event.extraContext,
  };

  // Step 1: Hardcoded template mapping
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
      throw err; // Rethrow to trigger processWithRetry
    }
  }

  // Step 2: Automated messages lookup
  const triggerType = EVENT_TO_TRIGGER_TYPE[event.eventType];
  if (triggerType) {
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
          throw err; // Rethrow to trigger processWithRetry
        }
      }
    } catch (err) {
      logger.error(
        { err, triggerType, reservationId: event.reservationId },
        "Failed to look up automated messages",
      );
      throw err;
    }
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
        category: inAppConfig.category as
          | "reservation"
          | "checkin"
          | "checkout"
          | "payment"
          | "housekeeping"
          | "system",
        priority: inAppConfig.priority as "low" | "normal" | "high" | "urgent",
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
      throw err;
    }
  }

  // Final Step: Secure Audit Logging (SOC 2 / GDPR Compliance)
  try {
    await recordAuditLog({
      tenantId: event.tenantId,
      propertyId: event.propertyId,
      actorId: "00000000-0000-0000-0000-000000000000", // System-generated event
      action: "RESERVATION_EVENT_PROCESSED",
      eventType: "NOTIFICATION_PROCESSED",
      entityType: "reservation",
      entityId: event.reservationId,
      metadata: {
        eventType: event.eventType,
        originalEventId: event.originalEventId,
        hashedTenantId: hashIdentifier(event.tenantId),
        hashedGuestId: event.guestId ? hashIdentifier(event.guestId) : null,
        // Redacted payload for security
        context: redactPayload(context),
        sentTemplates: Array.from(sentTemplateCodes),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (auditErr) {
    logger.error(
      { err: auditErr, reservationId: event.reservationId },
      "Failed to record secure audit log for reservation event",
    );
    // Audit failure shouldn't necessarily block the whole process if it succeeded,
    // but here we are at the end. We'll just log it.
  }
};

/**
 * Start consuming reservation events for automated notification dispatch.
 */
export const startReservationEventConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  // Initialize DLQ producer
  dlqProducer = createKafkaProducer(kafka, {
    commandTopic: config.commandCenter.topic,
    dlqTopic: config.reservationEvents.dlqTopic || "reservations.events.dlq",
  });

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
    eachBatchAutoResolve: false,
    eachBatch: async ({
      batch,
      resolveOffset,
      heartbeat,
      commitOffsetsIfNecessary,
      isRunning,
      isStale,
    }) => {
      for (const message of batch.messages) {
        if (!isRunning() || isStale()) break;

        if (!message.value) {
          resolveOffset(message.offset);
          continue;
        }

        const startTime = Date.now();
        const rawValue = message.value.toString();
        let eventEnvelope: z.infer<typeof ReservationEventSchema> | null = null;

        try {
          eventEnvelope = ReservationEventSchema.parse(JSON.parse(rawValue));
        } catch (err) {
          logger.warn({ err, offset: message.offset }, "Skipping malformed reservation event");
          resolveOffset(message.offset);
          continue;
        }

        const event = toReservationEvent(eventEnvelope);
        const eventType = eventEnvelope.metadata.type;

        try {
          await processWithRetry(
            async () => {
              enterTenantScope(event.tenantId);
              await processReservationEvent(event);
            },
            {
              maxRetries: 10,
              baseDelayMs: 500,
              delayScheduleMs: [500, 1000, 2000, 4000, 8000, 15000, 30000],
              onRetry: ({ attempt, delayMs, error }) => {
                logger.warn(
                  { attempt, delayMs, error, reservationId: event.reservationId },
                  "Retrying notification dispatch after failure (potential FK race)",
                );
              },
              isRetryable: (err: any) => {
                const msg = String(err.message || "");
                if (msg.includes("not found") || msg.includes("validation failed")) {
                  return false;
                }
                const code = String(err.code || "");
                return (
                  code.startsWith("08") ||
                  code === "23503" ||
                  code === "40001" ||
                  code === "57P01" ||
                  msg.includes("deadlock") ||
                  msg.includes("ECONNREFUSED")
                );
              },
            },
          );

          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "success");
        } catch (err) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "handler_error");

          logger.error(
            { err, offset: message.offset, reservationId: event.reservationId },
            "Failed to process reservation event message after retries. Routing to DLQ.",
          );

          try {
            const dlqPayload = buildDlqPayload({
              rawValue,
              topic: batch.topic,
              partition: batch.partition,
              offset: message.offset,
              attempts: 11,
              failureReason: "HANDLER_FAILURE",
              error: err,
              envelope: eventEnvelope as any,
            });

            await dlqProducer?.publishDlqEvent({
              key: event.tenantId,
              value: JSON.stringify(dlqPayload),
            });
            recordDlqEvent(err instanceof Error ? err.message : String(err));
          } catch (dlqErr) {
            logger.error({ err: dlqErr }, "Failed to publish to Notification DLQ");
          }
        } finally {
          resolveOffset(message.offset);
          await heartbeat();
        }
      }

      // Update lag for the entire batch
      if (batch.messages.length > 0) {
        const lastOffset = batch.messages[batch.messages.length - 1]!.offset;
        try {
          const high = BigInt(batch.highWatermark);
          const current = BigInt(lastOffset);
          const rawLag = high - current - 1n;
          const lag = rawLag > 0n ? Number(rawLag) : 0;
          setCommandConsumerLag(batch.topic, batch.partition, lag);
        } catch (err) {
          // Ignore lag calculation errors
        }
      }

      await commitOffsetsIfNecessary();
    },
  });

  // Track consumer lag
  consumer.on(consumer.events.GROUP_JOIN, () => {
    logger.info("Notification consumer joined group");
  });

  // Periodically report lag (best effort)
  setInterval(async () => {
    if (consumer) {
      try {
        const description = await consumer.describeGroup();
        for (const member of description.members) {
          logger.trace({ memberId: member.memberId }, "Reporting lag for consumer member");
        }
      } catch (err) {
        // Ignore lag reporting errors
      }
    }
  }, 30_000);

  logger.info(
    {
      topic: config.reservationEvents.topic,
      groupId: config.reservationEvents.consumerGroupId,
      dlqTopic: config.reservationEvents.dlqTopic,
    },
    "Reservation event consumer started for notification dispatch",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await dlqProducer?.shutdown();
    await consumer.disconnect();
    logger.info("Reservation event consumer disconnected");
  } finally {
    consumer = null;
    dlqProducer = null;
  }
};

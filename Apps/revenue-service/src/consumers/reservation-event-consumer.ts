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

import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";
import { enterTenantScope } from "@tartware/config/db";
import { processWithRetry } from "@tartware/config/retry";
import { ReservationEventSchema } from "@tartware/schemas";
import { createServiceLogger } from "@tartware/telemetry";
import type { Consumer } from "kafkajs";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { z } from "zod";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { query } from "../lib/db.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  recordDlqEvent,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import {
  DEMAND_CALENDAR_CHECKOUT_SQL,
  DEMAND_CALENDAR_DECREMENT_OTB_SQL,
  DEMAND_CALENDAR_INCREMENT_OTB_SQL,
} from "../sql/event-queries.js";
import { hashIdentifier, recordAuditLog } from "../utils/audit.js";

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
}).child({ module: "reservation-event-consumer" });

let consumer: Consumer | null = null;
let dlqProducer: ReturnType<typeof createKafkaProducer> | null = null;

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

/**
 * Classify a `reservation.updated` event into a specific sub-type based
 * on payload fields (mirrors notification-service classification).
 */
const classifyUpdateEvent = (payload: any): string => {
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
    await query(DEMAND_CALENDAR_INCREMENT_OTB_SQL, [tenantId, propertyId, date]);
  }
  logger.debug("OTB incremented for new reservation");

  await recordAuditLog({
    tenantId,
    propertyId,
    actorId: null,
    action: "revenue.otb_increment",
    entityType: "demand_calendar",
    entityId: hashIdentifier(`${propertyId}:${dates[0]}`),
    metadata: {
      check_in: checkIn,
      check_out: checkOut,
      nights: dates.length,
      action: "INCREMENT_OTB",
    },
  });
};

const handleReservationCancelled = async (
  tenantId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> => {
  const dates = stayDates(checkIn, checkOut);
  for (const date of dates) {
    await query(DEMAND_CALENDAR_DECREMENT_OTB_SQL, [tenantId, propertyId, date]);
  }
  logger.debug(
    { tenantId, propertyId, checkIn, checkOut, nights: dates.length },
    "OTB decremented for cancelled reservation",
  );

  await recordAuditLog({
    tenantId,
    propertyId,
    actorId: null,
    action: "revenue.otb_decrement",
    entityType: "demand_calendar",
    entityId: hashIdentifier(`${propertyId}:${dates[0]}`),
    metadata: {
      check_in: checkIn,
      check_out: checkOut,
      nights: dates.length,
      action: "DECREMENT_OTB",
    },
  });
};

const handleReservationCheckedOut = async (
  tenantId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> => {
  const dates = stayDates(checkIn, checkOut);
  for (const date of dates) {
    await query(DEMAND_CALENDAR_CHECKOUT_SQL, [tenantId, propertyId, date]);
  }
  logger.debug(
    { tenantId, propertyId, checkIn, checkOut, nights: dates.length },
    "demand calendar updated for checkout",
  );

  await recordAuditLog({
    tenantId,
    propertyId,
    actorId: null,
    action: "revenue.checkout_update",
    entityType: "demand_calendar",
    entityId: hashIdentifier(`${propertyId}:${dates[0]}`),
    metadata: {
      check_in: checkIn,
      check_out: checkOut,
      nights: dates.length,
      action: "CHECKOUT_UPDATE",
    },
  });
};

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

const processReservationEvent = async (
  envelope: z.infer<typeof ReservationEventSchema>,
): Promise<void> => {
  const rawType = envelope.metadata.type;
  const eventType =
    rawType === "reservation.updated" ? classifyUpdateEvent(envelope.payload) : rawType;

  const tenantId = envelope.metadata.tenantId;
  const payload = envelope.payload as any;
  const propertyId = String(payload.property_id ?? "");
  const checkIn = payload.check_in_date ? String(payload.check_in_date) : null;
  const checkOut = payload.check_out_date ? String(payload.check_out_date) : null;

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

  // Initialize DLQ producer
  dlqProducer = createKafkaProducer(kafka, {
    commandTopic: config.commandCenter.topic,
    dlqTopic: config.reservationEvents.dlqTopic,
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
    eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
      for (const message of batch.messages) {
        if (!isRunning() || isStale()) break;

        if (!message.value) {
          resolveOffset(message.offset);
          continue;
        }

        const startTime = Date.now();
        const rawValue = message.value.toString();
        let envelope: z.infer<typeof ReservationEventSchema> | null = null;

        try {
          envelope = ReservationEventSchema.parse(JSON.parse(rawValue));
        } catch (err) {
          logger.warn({ err, offset: message.offset }, "skipping malformed reservation event");
          resolveOffset(message.offset);
          continue;
        }

        const eventType = envelope.metadata.type;

        try {
          await processWithRetry(
            async () => {
              enterTenantScope(envelope!.metadata.tenantId);
              await processReservationEvent(envelope!);
            },
            {
              maxRetries: 5,
              baseDelayMs: 1000,
              delayScheduleMs: [1000, 2000, 5000, 10000, 20000],
              onRetry: (ctx) => {
                logger.warn(
                  {
                    attempt: ctx.attempt,
                    delayMs: ctx.delayMs,
                    err: ctx.error,
                    reservationId: (envelope?.payload as any).reservation_id,
                  },
                  "Revenue consumer retry triggered",
                );
              },
              isRetryable: (err: any) => {
                const code = String(err.code || "");
                return (
                  code.startsWith("08") || // Connection errors
                  code === "40001" || // Serialization failure
                  code === "57P01" || // Admin shutdown
                  err.message?.includes("deadlock") ||
                  err.message?.includes("ECONNREFUSED")
                );
              },
            },
          );

          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "success");
        } catch (err: any) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "handler_error");

          logger.error(
            {
              err,
              offset: message.offset,
              reservationId: (envelope?.payload as any).reservation_id,
            },
            "failed to process reservation event after retries. Routing to DLQ.",
          );

          // Routing to DLQ
          try {
            const dlqPayload = buildDlqPayload({
              rawValue,
              topic: batch.topic,
              partition: batch.partition,
              offset: message.offset,
              attempts: 6,
              failureReason: "HANDLER_FAILURE",
              error: err,
              envelope: envelope as any,
            });

            await dlqProducer?.publishDlqEvent({
              key: envelope?.metadata.tenantId || "unknown",
              value: JSON.stringify(dlqPayload),
            });
            recordDlqEvent(err instanceof Error ? err.message : String(err));
          } catch (dlqErr) {
            logger.error({ err: dlqErr }, "failed to publish to Revenue DLQ");
          } finally {
            resolveOffset(message.offset);
            await heartbeat();
          }
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
          setCommandConsumerLag(config.reservationEvents.topic, batch.partition, lag);
        } catch (err) {
          // Ignore lag calculation errors
        }
      }
    },
  });

  // Track consumer lag
  consumer.on(consumer.events.GROUP_JOIN, () => {
    logger.info("Revenue consumer joined group");
  });

  // Periodically report lag (best effort)
  setInterval(async () => {
    if (consumer) {
      try {
        const description = await consumer.describeGroup();
        for (const member of description.members) {
          logger.trace({ memberId: member.memberId }, "Reporting lag for consumer member");
          setCommandConsumerLag(config.reservationEvents.topic, 0, 0); // Placeholder
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
    "reservation event consumer started",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await dlqProducer?.shutdown();
    await consumer.disconnect();
    logger.info("reservation event consumer disconnected");
  } finally {
    consumer = null;
    dlqProducer = null;
  }
};

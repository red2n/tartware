/**
 * Reservation Event Consumer — listens to reservation lifecycle events
 * and auto-creates housekeeping tasks on checkout.
 *
 * Cross-flow integration (Flow 7 → Flow 8):
 *   - reservation.checked_out → housekeeping.task.create (CHECKOUT_CLEAN, priority HIGH)
 *
 * Uses a SEPARATE consumer group from other services consuming the same topic
 * to enable independent fan-out processing.
 *
 * @module consumers/reservation-event-consumer
 */
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
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  recordDlqEvent,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import { hashIdentifier, recordAuditLog } from "../utils/audit.js";

const logger = appLogger.child({ module: "reservation-event-consumer" });

const EVENTS_TOPIC = config.reservationEvents.topic;
const CONSUMER_GROUP = config.reservationEvents.consumerGroupId;
const DLQ_TOPIC = config.reservationEvents.dlqTopic;

let consumer: Consumer | null = null;
let dlqProducer: ReturnType<typeof createKafkaProducer> | null = null;

/**
 * Resolve room_id from reservation to get the room for housekeeping task creation.
 */
const resolveRoomFromReservation = async (
  tenantId: string,
  reservationId: string,
): Promise<{ roomId: string; propertyId: string } | null> => {
  const result = await query<{ room_id: string; property_id: string }>(
    `SELECT room_id, property_id FROM reservations
     WHERE id = $1::uuid AND tenant_id = $2::uuid AND room_id IS NOT NULL
     LIMIT 1`,
    [reservationId, tenantId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (!row) return null;
  return { roomId: row.room_id, propertyId: row.property_id };
};

/**
 * Check if a housekeeping task already exists for this room + date (idempotency).
 */
const taskAlreadyExists = async (
  tenantId: string,
  roomId: string,
  taskDate: string,
): Promise<boolean> => {
  const { rows } = await query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM housekeeping_tasks
     WHERE tenant_id = $1::uuid
       AND room_number = (SELECT room_number FROM rooms WHERE id = $2::uuid AND tenant_id = $1::uuid LIMIT 1)
       AND task_type = 'CHECKOUT_CLEAN'
       AND scheduled_date = $3::date
       AND status NOT IN ('CANCELLED')`,
    [tenantId, roomId, taskDate],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
};

/**
 * Create a housekeeping task for a room after checkout.
 */
const createCheckoutCleanTask = async (
  tenantId: string,
  roomId: string,
  propertyId: string,
): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  // Idempotency: skip if task already exists for this room today
  if (await taskAlreadyExists(tenantId, roomId, today)) {
    logger.debug({ roomId, tenantId }, "Checkout clean task already exists — skipping");
    return;
  }

  // Resolve room_number from room_id
  const { rows: roomRows } = await query<{ room_number: string }>(
    `SELECT room_number FROM rooms WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [roomId, tenantId],
  );
  if (roomRows.length === 0) {
    logger.warn({ roomId, tenantId }, "Room not found for checkout clean task");
    return;
  }
  const roomNumber = roomRows[0]?.room_number;

  await query(
    `INSERT INTO public.housekeeping_tasks (
       tenant_id, property_id, room_number, task_type, priority,
       status, scheduled_date, notes, created_at, updated_at, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'CHECKOUT_CLEAN', 'high',
       'DIRTY', $4::date, 'Auto-created on guest checkout', NOW(), NOW(),
       'system:checkout-event', 'system:checkout-event'
     )`,
    [tenantId, propertyId, roomNumber, today],
  );

  await recordAuditLog({
    tenantId,
    propertyId,
    actorId: null, // System event
    action: "housekeeping.task.create_on_checkout",
    entityType: "housekeeping_task",
    entityId: hashIdentifier(`${roomNumber}:${today}`),
    metadata: {
      room_number: roomNumber,
      scheduled_date: today,
      task_type: "CHECKOUT_CLEAN",
      triggered_by: "reservation.checked_out",
    },
  });

  logger.info(
    { roomId, roomNumber, propertyId, tenantId },
    "Created CHECKOUT_CLEAN housekeeping task from checkout event",
  );
};

/**
 * Classify a reservation.updated event — detect checkout.
 */
const isCheckoutEvent = (payload: Record<string, unknown>): boolean => {
  return payload.status === "CHECKED_OUT" && !!payload.actual_check_out;
};

/**
 * Process a single reservation event for housekeeping integration.
 */
const processEvent = async (event: z.infer<typeof ReservationEventSchema>): Promise<void> => {
  const tenantId = event.metadata.tenantId;
  if (!tenantId) return;

  enterTenantScope(tenantId);

  // Handle reservation.updated events — detect checkout
  if (event.metadata.type === "reservation.updated") {
    const payload = event.payload as Record<string, unknown>;

    if (isCheckoutEvent(payload)) {
      const reservationId = payload.reservation_id as string;
      if (!reservationId) return;

      const roomInfo = await resolveRoomFromReservation(tenantId, reservationId);
      if (!roomInfo) {
        logger.debug({ reservationId }, "No room assigned — skipping checkout clean task");
        return;
      }

      await createCheckoutCleanTask(tenantId, roomInfo.roomId, roomInfo.propertyId);
    }
  }
};

export const startReservationEventConsumer = async (): Promise<void> => {
  if (consumer) return;

  // Initialize DLQ producer
  dlqProducer = createKafkaProducer(kafka, {
    commandTopic: config.commandCenter.topic,
    dlqTopic: DLQ_TOPIC,
  });

  consumer = kafka.consumer({
    groupId: CONSUMER_GROUP,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: EVENTS_TOPIC, fromBeginning: false });

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
        let event: z.infer<typeof ReservationEventSchema> | null = null;

        try {
          event = ReservationEventSchema.parse(JSON.parse(rawValue));
        } catch (err) {
          logger.warn({ err, offset: message.offset }, "Skipping malformed reservation event");
          resolveOffset(message.offset);
          continue;
        }

        const eventType = event.metadata.type;

        try {
          await processWithRetry(async () => processEvent(event!), {
            maxRetries: 5,
            baseDelayMs: 1000,
            delayScheduleMs: [1000, 2000, 5000, 10000, 20000],
            onRetry: (ctx) => {
              logger.warn(
                {
                  attempt: ctx.attempt,
                  delayMs: ctx.delayMs,
                  err: ctx.error,
                  reservationId: (event?.payload as any)?.reservation_id,
                },
                "Housekeeping consumer retry triggered",
              );
            },
            isRetryable: (err: any) => {
              const code = String(err.code || "");
              return (
                code.startsWith("08") ||
                code === "40001" ||
                code === "57P01" ||
                err.message?.includes("deadlock") ||
                err.message?.includes("ECONNREFUSED")
              );
            },
          });

          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "success");
        } catch (err: any) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "handler_error");

          logger.error(
            { err, offset: message.offset, reservationId: (event?.payload as any)?.reservation_id },
            "Reservation event consumer: failed to process event after retries. Routing to DLQ.",
          );

          try {
            const dlqPayload = buildDlqPayload({
              rawValue,
              topic: batch.topic,
              partition: batch.partition,
              offset: message.offset,
              attempts: 6,
              failureReason: "HANDLER_FAILURE",
              error: err,
              envelope: event as any,
            });

            await dlqProducer?.publishDlqEvent({
              key: event?.metadata.tenantId || "unknown",
              value: JSON.stringify(dlqPayload),
            });
            recordDlqEvent(err.message || "handler_error");
          } catch (dlqErr) {
            logger.error({ err: dlqErr }, "failed to publish to Housekeeping DLQ");
          }
        } finally {
          resolveOffset(message.offset);
          await heartbeat();
        }
      }

      // Update lag for the entire batch
      if (batch.messages.length > 0) {
        const lastOffset = batch.messages[batch.messages.length - 1]?.offset;
        try {
          const high = BigInt(batch.highWatermark);
          const current = BigInt(lastOffset);
          const rawLag = high - current - 1n;
          const lag = rawLag > 0n ? Number(rawLag) : 0;
          setCommandConsumerLag(EVENTS_TOPIC, batch.partition, lag);
        } catch (_err) {
          // Ignore lag calculation errors
        }
      }
    },
  });

  // Track consumer lag
  consumer.on(consumer.events.GROUP_JOIN, () => {
    logger.info("Housekeeping consumer joined group");
  });

  // Periodically report lag (best effort)
  setInterval(async () => {
    if (consumer) {
      try {
        const description = await consumer.describeGroup();
        for (const member of description.members) {
          logger.trace({ memberId: member.memberId }, "Reporting lag for consumer member");
          setCommandConsumerLag(EVENTS_TOPIC, 0, 0); // Placeholder
        }
      } catch (_err) {
        // Ignore lag reporting errors
      }
    }
  }, 30_000);
  logger.info(
    { topic: EVENTS_TOPIC, groupId: CONSUMER_GROUP, dlqTopic: DLQ_TOPIC },
    "Housekeeping reservation event consumer started",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await dlqProducer?.shutdown();
    await consumer.disconnect();
  } catch (err) {
    logger.error({ err }, "Error disconnecting reservation event consumer");
  }
  consumer = null;
  dlqProducer = null;
};

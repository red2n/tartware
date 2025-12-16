import { performance } from "node:perf_hooks";

import type { ReservationEvent } from "@tartware/schemas";
import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer, EachBatchPayload } from "kafkajs";

import { kafkaConfig, serviceConfig } from "../config.js";
import { stampLifecycleCheckpoint } from "../lib/lifecycle-guard.js";
import {
  observeProcessingDuration,
  recordDlqEvent,
  recordRetryAttempt,
  setConsumerLag,
} from "../lib/metrics.js";
import { upsertReservationEventOffset } from "../lib/reservation-event-offsets.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import { reservationsLogger } from "../logger.js";
import { attachReservationToFallbackAudit } from "../services/rate-plan-fallback-service.js";
import { processReservationEvent } from "../services/reservation-event-handler.js";

import { kafka } from "./client.js";
import { publishDlqEvent } from "./producer.js";

let consumer: Consumer | null = null;

/**
 * Starts the KafkaJS consumer with manual offset commits, bounded retries,
 * and DLQ routing for poison events.
 */
export const startReservationConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: kafkaConfig.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: kafkaConfig.maxBatchBytes,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaConfig.topic, fromBeginning: false });

  await consumer.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });
};

/**
 * Disconnects the Kafka consumer.
 */
export const shutdownReservationConsumer = async (): Promise<void> => {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
};

const handleBatch = async ({
  batch,
  resolveOffset,
  heartbeat,
  commitOffsetsIfNecessary,
  isRunning,
  isStale,
}: EachBatchPayload): Promise<void> => {
  if (!isRunning() || isStale()) {
    return;
  }

  const batchLogger = reservationsLogger.child({
    topic: batch.topic,
    partition: batch.partition,
  });

  for (const message of batch.messages) {
    if (!isRunning() || isStale()) {
      break;
    }

    const offset = message.offset;
    const messageKey = message.key?.toString() ?? `offset-${offset}`;

    if (!message.value) {
      batchLogger.warn({ offset }, "Skipping Kafka message with empty value");
      resolveOffset(offset);
      await heartbeat();
      continue;
    }

    const rawValue = message.value.toString();
    const startedAt = performance.now();
    let parsedEvent: ReservationEvent;

    try {
      parsedEvent = parseReservationEvent(rawValue);
    } catch (error) {
      batchLogger.error(
        { err: error, offset },
        "Failed to parse reservation event; routing to DLQ",
      );
      await publishDlqEvent({
        key: messageKey,
        value: buildDlqPayload({
          rawValue,
          topic: batch.topic,
          partition: batch.partition,
          offset,
          failureReason: "PARSING_ERROR",
          attempts: 1,
          error,
        }),
        headers: {
          "x-tartware-dlq": "reservations-command-service",
        },
      });
      recordDlqEvent("parsing");
      observeProcessingDuration(
        batch.topic,
        batch.partition,
        secondsSince(startedAt),
      );
      updateConsumerLag(
        batch.highWatermark,
        batch.topic,
        batch.partition,
        offset,
      );
      resolveOffset(offset);
      await heartbeat();
      continue;
    }

    try {
      await stampLifecycleCheckpoint({
        correlationId:
          parsedEvent.metadata.correlationId ?? parsedEvent.metadata.id,
        tenantId: parsedEvent.metadata.tenantId,
        reservationId: getReservationIdFromEvent(parsedEvent),
        state: "CONSUMED",
        source: `${serviceConfig.serviceId}:consumer`,
        actor: kafkaConfig.consumerGroupId,
        reason: "Kafka consumer claimed event batch",
        payload: {
          topic: batch.topic,
          partition: batch.partition,
          offset,
        },
      });

      const { value: handlerResult, attempts } = await processWithRetry(
        () => processReservationEvent(parsedEvent),
        {
          maxRetries: kafkaConfig.maxRetries,
          baseDelayMs: kafkaConfig.retryBackoffMs,
          onRetry: ({ attempt, delayMs, error }) => {
            recordRetryAttempt("handler");
            batchLogger.warn(
              { attempt, delayMs, offset, err: error },
              "Retrying reservation event handler",
            );
          },
        },
      );

      await upsertReservationEventOffset({
        consumerGroup: kafkaConfig.consumerGroupId,
        topic: batch.topic,
        partition: batch.partition,
        offset,
        eventId: parsedEvent.metadata.id,
        reservationId: handlerResult.reservationId,
        correlationId: parsedEvent.metadata.correlationId,
        metadata: {
          attempts,
          messageKey,
          messageTimestamp: message.timestamp,
        },
      });
      await stampLifecycleCheckpoint({
        correlationId:
          parsedEvent.metadata.correlationId ?? parsedEvent.metadata.id,
        tenantId: parsedEvent.metadata.tenantId,
        reservationId: handlerResult.reservationId
          ? handlerResult.reservationId
          : getReservationIdFromEvent(parsedEvent),
        state: "APPLIED",
        source: `${serviceConfig.serviceId}:consumer`,
        actor: kafkaConfig.consumerGroupId,
        reason: "Reservation event handler applied successfully",
        payload: {
          topic: batch.topic,
          partition: batch.partition,
          offset,
          attempts,
        },
      });
      await maybeAttachFallbackAudit(parsedEvent, handlerResult.reservationId);
      observeProcessingDuration(
        batch.topic,
        batch.partition,
        secondsSince(startedAt),
      );
    } catch (error) {
      const attempts =
        error instanceof RetryExhaustedError ? error.attempts : 1;

      batchLogger.error(
        { err: error, offset, attempts },
        "Reservation event failed after retries; routing to DLQ",
      );

      await publishDlqEvent({
        key: messageKey,
        value: buildDlqPayload({
          event: parsedEvent,
          rawValue,
          topic: batch.topic,
          partition: batch.partition,
          offset,
          attempts,
          error,
          failureReason: "HANDLER_FAILURE",
        }),
        headers: {
          "x-tartware-dlq": "reservations-command-service",
        },
      });
      if (parsedEvent.metadata?.correlationId || parsedEvent.metadata?.id) {
        await stampLifecycleCheckpoint({
          correlationId:
            parsedEvent.metadata.correlationId ?? parsedEvent.metadata.id,
          tenantId: parsedEvent.metadata.tenantId,
          reservationId: getReservationIdFromEvent(parsedEvent),
          state: "DLQ",
          source: `${serviceConfig.serviceId}:consumer`,
          actor: kafkaConfig.consumerGroupId,
          reason: "Reservation event routed to DLQ after handler exhaustion",
          payload: {
            topic: batch.topic,
            partition: batch.partition,
            offset,
            attempts,
          },
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
      recordDlqEvent("handler");
      observeProcessingDuration(
        batch.topic,
        batch.partition,
        secondsSince(startedAt),
      );
    } finally {
      updateConsumerLag(
        batch.highWatermark,
        batch.topic,
        batch.partition,
        offset,
      );
      resolveOffset(offset);
      await heartbeat();
    }
  }

  await commitOffsetsIfNecessary();
};

const getReservationIdFromEvent = (
  event: ReservationEvent,
): string | undefined => {
  const payload = event.payload as { id?: string } | undefined;
  return payload?.id;
};

const maybeAttachFallbackAudit = async (
  event: ReservationEvent,
  reservationId?: string,
): Promise<void> => {
  const fallback = getFallbackDetails(event);
  if (!fallback) {
    return;
  }
  const resolvedReservationId =
    reservationId ?? getReservationIdFromEvent(event);
  if (!resolvedReservationId) {
    return;
  }
  await attachReservationToFallbackAudit(
    event.metadata.correlationId ?? event.metadata.id,
    resolvedReservationId,
  );
};

const getFallbackDetails = (
  event: ReservationEvent,
): Record<string, unknown> | null => {
  const payload = event.payload as { fallback?: Record<string, unknown> };
  return payload?.fallback ?? null;
};

const parseReservationEvent = (payload: string): ReservationEvent => {
  return ReservationEventSchema.parse(JSON.parse(payload));
};

type DlqPayloadInput = {
  topic: string;
  partition: number;
  offset: string;
  rawValue: string;
  attempts: number;
  failureReason: string;
  error: unknown;
  event?: ReservationEvent | null;
};

const buildDlqPayload = (input: DlqPayloadInput): string => {
  return JSON.stringify({
    failureReason: input.failureReason,
    failedAt: new Date().toISOString(),
    topic: input.topic,
    partition: input.partition,
    offset: input.offset,
    attempts: input.attempts,
    error:
      input.error instanceof Error
        ? {
            name: input.error.name,
            message: input.error.message,
            stack: input.error.stack,
          }
        : { message: String(input.error) },
    event: input.event,
    rawValue: input.rawValue,
  });
};

const secondsSince = (startedAt: number): number => {
  return (performance.now() - startedAt) / 1000;
};

const updateConsumerLag = (
  highWatermark: string | null | undefined,
  topic: string,
  partition: number,
  currentOffset: string,
): void => {
  if (!highWatermark) {
    return;
  }

  try {
    const high = BigInt(highWatermark);
    const current = BigInt(currentOffset);
    const rawLag = high - current - 1n;
    const lag = rawLag > 0n ? Number(rawLag) : 0;
    setConsumerLag(topic, partition, lag);
  } catch (error) {
    reservationsLogger.warn(
      { err: error, topic, partition, currentOffset, highWatermark },
      "Failed to compute consumer lag",
    );
  }
};

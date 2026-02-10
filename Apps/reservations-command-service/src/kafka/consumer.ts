import { performance } from "node:perf_hooks";

import {
  type FailureCause,
  type ReservationEvent,
  ReservationEventSchema,
} from "@tartware/schemas";
import type { Consumer, EachBatchPayload } from "kafkajs";

import { kafkaConfig } from "../config.js";
import {
  observeProcessingDuration,
  recordDlqEvent,
  recordRetryAttempt,
  setConsumerLag,
} from "../lib/metrics.js";
import { upsertReservationEventOffset } from "../lib/reservation-event-offsets.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import { reservationsLogger } from "../logger.js";
import {
  type ReservationCommandLifecycleState,
  updateLifecycleState,
} from "../repositories/lifecycle-repository.js";
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
      const failureCause = buildFailureCause(error, "parser");
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
          failureCause,
        }),
        headers: {
          "x-tartware-dlq": "reservations-command-service",
        },
      });
      recordDlqEvent("parsing");
      observeProcessingDuration(batch.topic, batch.partition, secondsSince(startedAt));
      updateConsumerLag(batch.highWatermark, batch.topic, batch.partition, offset);
      resolveOffset(offset);
      await heartbeat();
      continue;
    }

    try {
      await updateLifecycleStateSafe(parsedEvent.metadata.id, "CONSUMED", {
        topic: batch.topic,
        partition: batch.partition,
        offset,
      });

      const { value: handlerResult, attempts } = await processWithRetry(
        () => processReservationEvent(parsedEvent),
        {
          maxRetries: kafkaConfig.maxRetries,
          baseDelayMs: kafkaConfig.retryBackoffMs,
          delayScheduleMs: kafkaConfig.retryScheduleMs,
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
        tenantId: parsedEvent.metadata.tenantId,
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
      await updateLifecycleStateSafe(parsedEvent.metadata.id, "APPLIED", {
        reservationId: handlerResult.reservationId,
        attempts,
        offset,
        partition: batch.partition,
      });
      observeProcessingDuration(batch.topic, batch.partition, secondsSince(startedAt));
    } catch (error) {
      const attempts = error instanceof RetryExhaustedError ? error.attempts : 1;
      const failureCause = buildFailureCause(error, "handler");
      const dlqEvent = enrichEventForFailure(parsedEvent, attempts, failureCause);

      batchLogger.error(
        { err: error, offset, attempts },
        "Reservation event failed after retries; routing to DLQ",
      );

      await publishDlqEvent({
        key: messageKey,
        value: buildDlqPayload({
          event: dlqEvent,
          rawValue,
          topic: batch.topic,
          partition: batch.partition,
          offset,
          attempts,
          error,
          failureReason: "HANDLER_FAILURE",
          failureCause,
        }),
        headers: {
          "x-tartware-dlq": "reservations-command-service",
        },
      });
      recordDlqEvent("handler");
      await updateLifecycleStateSafe(parsedEvent.metadata.id, "DLQ", {
        offset,
        partition: batch.partition,
        attempts,
        failureCause,
        error:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
      });
      observeProcessingDuration(batch.topic, batch.partition, secondsSince(startedAt));
    } finally {
      updateConsumerLag(batch.highWatermark, batch.topic, batch.partition, offset);
      resolveOffset(offset);
      await heartbeat();
    }
  }

  await commitOffsetsIfNecessary();
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
  failureCause?: FailureCause;
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
    failureCause: input.failureCause,
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

const enrichEventForFailure = <TEvent extends ReservationEvent>(
  event: TEvent,
  attempts: number,
  failureCause: FailureCause,
): TEvent => {
  return {
    ...event,
    metadata: {
      ...event.metadata,
      retryCount: attempts,
      attemptedAt: new Date().toISOString(),
      failureCause,
    },
  };
};

const buildFailureCause = (error: unknown, origin: "parser" | "handler"): FailureCause => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      origin,
    };
  }
  return {
    message: String(error),
    origin,
  };
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

const updateLifecycleStateSafe = async (
  eventId: string | undefined,
  state: ReservationCommandLifecycleState,
  details: Record<string, unknown>,
): Promise<void> => {
  if (!eventId) {
    return;
  }
  try {
    await updateLifecycleState({
      eventId,
      state,
      details,
    });
  } catch (error) {
    reservationsLogger.warn(
      { err: error, eventId, state },
      "Failed to update lifecycle state from consumer",
    );
  }
};

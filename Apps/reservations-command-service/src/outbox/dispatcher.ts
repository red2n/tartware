import { performance } from "node:perf_hooks";

import type { OutboxRecord } from "@tartware/outbox";

import { kafkaConfig, outboxConfig } from "../config.js";
import { publishDlqEvent, publishEvent } from "../kafka/producer.js";
import {
  observeOutboxPublishDuration,
  setOutboxQueueSize,
} from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";
import {
  type ReservationCommandLifecycleState,
  updateLifecycleState,
} from "../repositories/lifecycle-repository.js";

import {
  claimOutboxBatch,
  countPendingOutboxRows,
  markOutboxDelivered,
  markOutboxFailed,
  releaseExpiredLocks,
} from "./repository.js";

let dispatcherTimer: NodeJS.Timeout | null = null;
let isDispatcherRunning = false;
let currentCycle: Promise<void> | null = null;

/**
 * Boots the outbox dispatcher loop which continuously flushes
 * transactional outbox rows into Kafka.
 */
export const startOutboxDispatcher = (): void => {
  if (isDispatcherRunning) {
    return;
  }
  isDispatcherRunning = true;
  scheduleNextCycle();
  reservationsLogger.info(
    { workerId: outboxConfig.workerId },
    "Outbox dispatcher started",
  );
};

/**
 * Stops the dispatcher loop and waits for any in-flight batch to finish.
 */
export const shutdownOutboxDispatcher = async (): Promise<void> => {
  isDispatcherRunning = false;
  if (dispatcherTimer) {
    clearTimeout(dispatcherTimer);
    dispatcherTimer = null;
  }
  try {
    await currentCycle;
  } catch {
    // ignore shutdown errors
  }
  reservationsLogger.info("Outbox dispatcher stopped");
};

const scheduleNextCycle = () => {
  dispatcherTimer = setTimeout(runCycle, outboxConfig.pollIntervalMs);
};

const runCycle = async () => {
  currentCycle = processOutboxBatch().catch((error) => {
    reservationsLogger.error(error, "Outbox dispatcher cycle failed");
  });

  await currentCycle;

  if (isDispatcherRunning) {
    scheduleNextCycle();
  }
};

const processOutboxBatch = async (): Promise<void> => {
  await releaseExpiredLocks(outboxConfig.lockTimeoutMs);

  const pending = await countPendingOutboxRows();
  setOutboxQueueSize(pending);

  if (pending === 0) {
    return;
  }

  const records = await claimOutboxBatch(
    outboxConfig.batchSize,
    outboxConfig.workerId,
  );

  for (const record of records) {
    await handleOutboxRecord(record);
  }
};

const handleOutboxRecord = async (record: OutboxRecord): Promise<void> => {
  const startedAt = performance.now();

  await updateLifecycleStateSafe(record.eventId, "IN_PROGRESS", {
    workerId: outboxConfig.workerId,
    aggregateId: record.aggregateId,
  });

  try {
    await publishEvent({
      key: record.partitionKey ?? record.aggregateId,
      value: JSON.stringify(record.payload),
      headers: normalizeHeaders(record.headers),
    });
    await markOutboxDelivered(record.id);
    await updateLifecycleStateSafe(record.eventId, "PUBLISHED", {
      topic: kafkaConfig.topic,
      partitionKey: record.partitionKey ?? record.aggregateId,
    });
    observeOutboxPublishDuration(secondsSince(startedAt));
  } catch (error) {
    const attemptCount = record.retryCount + 1;
    const failureCause = "OUTBOX_DISPATCH_FAILURE";
    const attemptedAt = new Date().toISOString();
    const payloadWithFailureMetadata = attachFailureMetadata(
      record.payload,
      attemptCount,
      attemptedAt,
      failureCause,
    );

    const status = await markOutboxFailed(
      record.id,
      error,
      outboxConfig.retryBackoffMs,
      outboxConfig.maxRetries,
    );
    await updateLifecycleStateSafe(
      record.eventId,
      status === "DLQ" ? "DLQ" : "FAILED",
      {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error),
        workerId: outboxConfig.workerId,
      },
    );
    observeOutboxPublishDuration(secondsSince(startedAt));
    reservationsLogger.error(
      { err: error, recordId: record.id, status },
      "Failed to publish outbox record",
    );

    if (status === "DLQ") {
      await publishDlqEvent({
        key: record.partitionKey ?? record.aggregateId,
        value: JSON.stringify({
          failureReason: failureCause,
          failureCause,
          failedAt: attemptedAt,
          attemptedAt,
          retryCount: attemptCount,
          topic: kafkaConfig.topic,
          record: {
            ...record,
            retryCount: attemptCount,
            payload: payloadWithFailureMetadata,
          },
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : String(error),
        }),
        headers: {
          "x-tartware-dlq": "reservations-command-service:outbox",
        },
      });
    }
  }
};

const normalizeHeaders = (
  headers: Record<string, string>,
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value);
    }
  }
  return normalized;
};

const attachFailureMetadata = (
  payload: Record<string, unknown>,
  retryCount: number,
  attemptedAt: string,
  failureCause: string,
): Record<string, unknown> => {
  const existingMetadata =
    typeof (payload as { metadata?: unknown }).metadata === "object" &&
    (payload as { metadata?: unknown }).metadata !== null
      ? ((payload as { metadata?: unknown }).metadata as Record<
          string,
          unknown
        >)
      : {};

  return {
    ...payload,
    metadata: {
      ...existingMetadata,
      retryCount,
      attemptedAt,
      failureCause,
    },
  };
};

const secondsSince = (startedAt: number): number => {
  return (performance.now() - startedAt) / 1000;
};

const updateLifecycleStateSafe = async (
  eventId: string,
  state: ReservationCommandLifecycleState,
  details: Record<string, unknown>,
): Promise<void> => {
  try {
    await updateLifecycleState({
      eventId,
      state,
      details,
    });
  } catch (error) {
    reservationsLogger.warn(
      { err: error, eventId, state },
      "Failed to update lifecycle state",
    );
  }
};

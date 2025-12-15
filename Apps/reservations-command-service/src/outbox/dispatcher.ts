import { performance } from "node:perf_hooks";

import { kafkaConfig, outboxConfig } from "../config.js";
import { publishDlqEvent, publishEvent } from "../kafka/producer.js";
import {
  observeOutboxPublishDuration,
  setOutboxQueueSize,
} from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";

import {
  claimOutboxBatch,
  countPendingOutboxRows,
  markOutboxDelivered,
  markOutboxFailed,
  releaseExpiredLocks,
} from "./repository.js";
import type { OutboxRecord } from "./types.js";

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

  try {
    await publishEvent({
      key: record.partitionKey ?? record.aggregateId,
      value: JSON.stringify(record.payload),
      headers: normalizeHeaders(record.headers),
    });
    await markOutboxDelivered(record.id);
    observeOutboxPublishDuration(secondsSince(startedAt));
  } catch (error) {
    const status = await markOutboxFailed(
      record.id,
      error,
      outboxConfig.retryBackoffMs,
      outboxConfig.maxRetries,
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
          failureReason: "OUTBOX_DISPATCH_FAILURE",
          failedAt: new Date().toISOString(),
          topic: kafkaConfig.topic,
          record,
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

const secondsSince = (startedAt: number): number => {
  return (performance.now() - startedAt) / 1000;
};

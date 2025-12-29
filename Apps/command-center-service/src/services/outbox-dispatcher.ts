import { performance } from "node:perf_hooks";

import { createTenantThrottler, type OutboxRecord } from "@tartware/outbox";

import { config } from "../config.js";
import {
  publishCommandDlqEvent,
  publishCommandEvent,
} from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  observeOutboxPublishDuration,
  observeOutboxThrottleWait,
  setOutboxQueueSize,
} from "../lib/metrics.js";
import {
  claimOutboxBatch,
  countPendingOutboxRows,
  markOutboxDelivered,
  markOutboxFailed,
  releaseExpiredLocks,
} from "../outbox/repository.js";
import { updateCommandDispatchStatus } from "../sql/command-dispatches.js";

const dispatcherLogger = appLogger.child({
  module: "command-center-outbox-dispatcher",
});

let dispatcherTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let currentCycle: Promise<void> | null = null;

const throttleTenant = createTenantThrottler({
  minSpacingMs: config.outbox.tenantThrottleMs,
  maxJitterMs: config.outbox.tenantJitterMs,
  cleanupIntervalMs: config.outbox.tenantThrottleCleanupMs,
});

export const startCommandOutboxDispatcher = (): void => {
  if (isRunning) {
    return;
  }
  isRunning = true;
  scheduleNextCycle();
  dispatcherLogger.info(
    { workerId: config.outbox.workerId },
    "command center outbox dispatcher started",
  );
};

export const shutdownCommandOutboxDispatcher = async (): Promise<void> => {
  isRunning = false;
  if (dispatcherTimer) {
    clearTimeout(dispatcherTimer);
    dispatcherTimer = null;
  }
  try {
    await currentCycle;
  } catch (error) {
    dispatcherLogger.warn(
      { err: error },
      "error while waiting for dispatcher cycle to finish",
    );
  }
  dispatcherLogger.info("command center outbox dispatcher stopped");
};

const scheduleNextCycle = () => {
  dispatcherTimer = setTimeout(runCycle, config.outbox.pollIntervalMs);
};

const runCycle = async () => {
  currentCycle = processOutboxBatch().catch((error) => {
    dispatcherLogger.error(error, "command center outbox cycle failed");
  });

  await currentCycle;

  if (isRunning) {
    scheduleNextCycle();
  }
};

const processOutboxBatch = async (): Promise<void> => {
  await releaseExpiredLocks(config.outbox.lockTimeoutMs);

  const pending = await countPendingOutboxRows();
  setOutboxQueueSize(pending);

  if (pending === 0) {
    return;
  }

  const records = await claimOutboxBatch(
    config.outbox.batchSize,
    config.outbox.workerId,
  );

  for (const record of records) {
    const throttledAt = performance.now();
    await throttleTenant(record.tenantId);
    observeOutboxThrottleWait(secondsSince(throttledAt));
    await handleOutboxRecord(record);
  }
};

const handleOutboxRecord = async (record: OutboxRecord): Promise<void> => {
  const startedAt = performance.now();

  try {
    await publishCommandEvent({
      key: record.partitionKey ?? record.aggregateId,
      value: JSON.stringify(record.payload),
      headers: normalizeHeaders(record.headers),
    });
    await markOutboxDelivered(record.id);
    await updateCommandDispatchStatus(record.eventId, "PUBLISHED");
    observeOutboxPublishDuration(secondsSince(startedAt));
  } catch (error) {
    const status = await markOutboxFailed(
      record.id,
      error,
      config.outbox.retryBackoffMs,
      config.outbox.maxRetries,
    );
    observeOutboxPublishDuration(secondsSince(startedAt));
    dispatcherLogger.error(
      { err: error, recordId: record.id, status },
      "failed to publish command outbox record",
    );

    if (status === "FAILED" || status === "DLQ") {
      await updateCommandDispatchStatus(
        record.eventId,
        status === "DLQ" ? "DLQ" : "FAILED",
      );
    }

    if (status === "DLQ") {
      await publishCommandDlqEvent({
        key: record.partitionKey ?? record.aggregateId,
        value: JSON.stringify({
          failureReason: "COMMAND_CENTER_OUTBOX_DISPATCH_FAILED",
          record,
          failedAt: new Date().toISOString(),
        }),
        headers: {
          "x-command-center-dlq": "outbox-dispatcher",
        },
      }).catch((dlqError) => {
        dispatcherLogger.error(
          { err: dlqError, recordId: record.id },
          "failed to publish command DLQ payload",
        );
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

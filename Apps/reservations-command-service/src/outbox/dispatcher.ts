import { performance } from "node:perf_hooks";

import { enterTenantScope } from "@tartware/config/db";
import { createTenantThrottler, type OutboxRecord } from "@tartware/outbox";

import { kafkaConfig, outboxConfig } from "../config.js";
import { publishDlqEvent, publishEvent } from "../kafka/producer.js";
import {
  observeOutboxPublishDuration,
  observeOutboxThrottleWait,
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

const throttleTenant = createTenantThrottler({
  minSpacingMs: outboxConfig.tenantThrottleMs,
  maxJitterMs: outboxConfig.tenantJitterMs,
  cleanupIntervalMs: outboxConfig.tenantThrottleCleanupMs,
});

/**
 * Every aggregate type this service enqueues, all of which belong on
 * `reservations.events`.
 *
 * This list used to be the single literal `"reservation"`, so the other four were
 * written inside the command transaction and then claimed by nobody — `group.created`
 * and `group.rooms_added` (which notification-service maps to GROUP_BOOKING_CONFIRMED)
 * and the four `integration.*` events sat PENDING indefinitely. Anything added to an
 * `enqueueOutboxRecord*` call in this service has to be added here too.
 */
const DISPATCHED_AGGREGATE_TYPES = [
  "reservation",
  "group_booking",
  "ota_sync",
  "webhook",
  "integration_mapping",
] as const;

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
  reservationsLogger.info({ workerId: outboxConfig.workerId }, "Outbox dispatcher started");
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
  // Guard: pollIntervalMs must be a positive finite value. A zero or negative
  // delay coerces to 1ms and spin-loops (TimeoutNegativeWarning / CPU burn).
  const delayMs = Math.max(1, outboxConfig.pollIntervalMs);
  dispatcherTimer = setTimeout(runCycle, delayMs);
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
    DISPATCHED_AGGREGATE_TYPES,
  );

  for (const record of records) {
    const throttledAt = performance.now();
    await throttleTenant(record.tenantId);
    observeOutboxThrottleWait(secondsSince(throttledAt));
    enterTenantScope(record.tenantId);
    await handleOutboxRecord(record);
  }
};

const handleOutboxRecord = async (record: OutboxRecord): Promise<void> => {
  const startedAt = performance.now();

  await updateLifecycleStateSafe(record, "IN_PROGRESS", {
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
    await updateLifecycleStateSafe(record, "PUBLISHED", {
      topic: kafkaConfig.topic,
      partitionKey: record.partitionKey ?? record.aggregateId,
    });
    observeOutboxPublishDuration(secondsSince(startedAt));
  } catch (error) {
    const status = await markOutboxFailed(
      record.id,
      error,
      outboxConfig.retryBackoffMs,
      outboxConfig.maxRetries,
    );
    await updateLifecycleStateSafe(record, status === "DLQ" ? "DLQ" : "FAILED", {
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      workerId: outboxConfig.workerId,
    });
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

const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
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

/**
 * `reservation_command_lifecycle` only ever holds rows for reservation events, so
 * every other aggregate type this dispatcher now drains would warn twice per record
 * about a row that is not supposed to exist. Skipping them keeps the warning
 * meaningful: if it fires, a reservation event really has lost its lifecycle row.
 */
const tracksLifecycle = (record: OutboxRecord): boolean => record.aggregateType === "reservation";

const updateLifecycleStateSafe = async (
  record: OutboxRecord,
  state: ReservationCommandLifecycleState,
  details: Record<string, unknown>,
): Promise<void> => {
  if (!tracksLifecycle(record)) {
    return;
  }
  const { eventId } = record;
  try {
    await updateLifecycleState({
      eventId,
      state,
      details,
    });
  } catch (error) {
    reservationsLogger.warn({ err: error, eventId, state }, "Failed to update lifecycle state");
  }
};

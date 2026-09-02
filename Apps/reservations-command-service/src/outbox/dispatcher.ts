/**
 * Composition root for this service's outbox dispatcher.
 *
 * The loop is `createOutboxDispatcher` in `@tartware/outbox`, shared with the
 * gateway. This module supplies the concrete producer, config, and the parts
 * specific to reservation events: lifecycle bookkeeping and DLQ routing.
 *
 * It used to be a bespoke serial loop — one `send()` per record, awaiting a
 * broker acknowledgement each time, on a fixed 2 s poll with a 25-row batch.
 * Measured under load that moved 7 rows/sec and fell hours behind while the
 * gateway's batched dispatcher drained 470K rows to zero on the same box. The
 * reservation events stuck in that backlog were why reservations never
 * appeared under load, so the fix is to share the design rather than keep two.
 */

import { createOutboxDispatcher, type OutboxRecord } from "@tartware/outbox";

import { kafkaConfig, outboxConfig } from "../config.js";
import { publishDlqEvent, publishRecordBatch } from "../kafka/producer.js";
import { observeOutboxPublishDuration, setOutboxQueueSize } from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";
import {
  type ReservationCommandLifecycleState,
  updateLifecycleStateBatch,
} from "../repositories/lifecycle-repository.js";

import {
  claimOutboxBatch,
  countPendingOutboxRows,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
} from "./repository.js";

/**
 * Every aggregate type this service enqueues, all of which belong on
 * `reservations.events`.
 *
 * This list used to be the single literal `"reservation"`, so the other four
 * were written inside the command transaction and then claimed by nobody —
 * `group.created` and `group.rooms_added` (which notification-service maps to
 * GROUP_BOOKING_CONFIRMED) and the `integration.*` events sat PENDING
 * indefinitely. Anything added to an `enqueueOutboxRecord*` call in this
 * service has to be added here too.
 */
const DISPATCHED_AGGREGATE_TYPES = [
  "reservation",
  "group_booking",
  "ota_sync",
  "webhook",
  "integration_mapping",
] as const;

/**
 * `reservation_command_lifecycle` only ever holds rows for reservation events,
 * so filtering here keeps the batch update from touching aggregate types that
 * never had a lifecycle row.
 */
const lifecycleEventIds = (records: OutboxRecord[]): string[] =>
  records
    .filter((record) => record.aggregateType === "reservation")
    .map((record) => record.eventId);

const dispatcher = createOutboxDispatcher({
  settings: outboxConfig,
  logger: reservationsLogger.child({ module: "outbox-dispatcher" }),
  aggregateTypes: DISPATCHED_AGGREGATE_TYPES,
  resolveTopic: () => kafkaConfig.topic,
  // Preserves the previous keying: the stored partition key when present,
  // falling back to the aggregate id.
  resolveKey: (record) => record.partitionKey ?? record.aggregateId,
  claimOutboxBatch,
  publishRecordBatch,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
  observeBatch: ({ durationSeconds }) => observeOutboxPublishDuration(durationSeconds),
  // Queue depth is a COUNT over the pending rows, so it rides the slow cadence
  // rather than running on every poll.
  onSlowSample: async () => {
    setOutboxQueueSize(await countPendingOutboxRows());
  },
  afterDelivered: async (records) => {
    try {
      await updateLifecycleStateBatch(lifecycleEventIds(records), "PUBLISHED", {
        topic: kafkaConfig.topic,
        workerId: outboxConfig.workerId,
      });
    } catch (error) {
      // Lifecycle is observability, not delivery. The batch is already
      // published and marked, so a failure here must not unwind that.
      reservationsLogger.warn(
        { err: error, batchSize: records.length },
        "failed to update lifecycle state for published batch",
      );
    }
  },
  onRecordFailed: async (record, error, status) => {
    const state: ReservationCommandLifecycleState = status === "DLQ" ? "DLQ" : "FAILED";
    if (record.aggregateType === "reservation") {
      await updateLifecycleStateBatch([record.eventId], state, {
        error:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
        workerId: outboxConfig.workerId,
      }).catch((lifecycleError) => {
        reservationsLogger.warn(
          { err: lifecycleError, eventId: record.eventId, state },
          "failed to update lifecycle state",
        );
      });
    }

    if (status !== "DLQ") {
      return;
    }

    await publishDlqEvent({
      key: record.partitionKey ?? record.aggregateId,
      value: JSON.stringify({
        failureReason: "OUTBOX_DISPATCH_FAILURE",
        failedAt: new Date().toISOString(),
        topic: kafkaConfig.topic,
        record,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
      }),
      headers: { "x-tartware-dlq": "reservations-command-service:outbox" },
    }).catch((dlqError) => {
      reservationsLogger.error(
        { err: dlqError, eventId: record.eventId },
        "failed to publish outbox DLQ event",
      );
    });
  },
});

/** Boots the dispatcher loop which flushes outbox rows into Kafka. */
export const startOutboxDispatcher = (): void => dispatcher.start();

/** Stops the loop and waits for any in-flight batch to finish. */
export const shutdownOutboxDispatcher = (): Promise<void> => dispatcher.shutdown();

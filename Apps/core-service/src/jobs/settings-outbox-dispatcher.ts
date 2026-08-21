/**
 * Settings Outbox Dispatcher
 *
 * Settings value writes (`POST /v1/settings/values`, `PATCH /v1/settings/values/:valueId`)
 * enqueue a `settings.value.set` envelope in `transactional_outbox` inside the same
 * transaction as the row itself. Those rows carry `aggregate_type = 'setting'`, and the
 * only other dispatcher in the system claims `aggregate_type = 'reservation'` — so until
 * this job existed they were written and never drained.
 *
 * The consumer on the far side is billing-service's business-calendar plugin, which
 * subscribes to `settings.events` and hot-reloads AUTO_ROLL_ENABLED / AUTO_ROLL_TIME /
 * DAY_START_TIME. Without a dispatcher it kept whatever it read at boot, so changing the
 * business-day roll time in the settings screen had no effect until billing restarted.
 *
 * Pattern: setInterval with overlap guard (same as retention-sweep).
 */

import { enterTenantScope } from "@tartware/config/db";
import type { OutboxRecord } from "@tartware/outbox";

import { config } from "../config.js";
import { publishDlqEvent, publishSettingsEvent } from "../kafka/settings-kafka-producer.js";
import { appLogger } from "../lib/logger.js";
import {
  claimOutboxBatch,
  markOutboxDelivered,
  markOutboxFailed,
  releaseExpiredLocks,
} from "../outbox/repository.js";

const logger = appLogger.child({ module: "settings-outbox-dispatcher" });

const eventsConfig = config.settings.events;

/**
 * Every aggregate type this service enqueues. Kept as a plain literal array under
 * this exact name because `outbox-dispatch-conformance.test.ts` reads it: the check
 * that no enqueued type goes undispatched is only trustworthy if both sides are
 * literals it can see without evaluating the code.
 */
const DISPATCHED_AGGREGATE_TYPES = ["setting"] as const;

let timer: NodeJS.Timeout | null = null;
let inFlight = false;

/**
 * Publishes one claimed row and settles its outbox status.
 *
 * A publish failure is retried by `markOutboxFailed` until `maxRetries`, after which the
 * row moves to DLQ and the envelope is mirrored onto the DLQ topic so the loss is visible.
 */
const dispatchRecord = async (record: OutboxRecord): Promise<void> => {
  const key = record.partitionKey ?? record.aggregateId;
  try {
    await publishSettingsEvent({
      key,
      value: JSON.stringify(record.payload),
      headers: record.headers,
    });
    await markOutboxDelivered(record.id);
  } catch (error) {
    const status = await markOutboxFailed(
      record.id,
      error,
      eventsConfig.retryBackoffMs,
      eventsConfig.maxRetries,
    );
    logger.error(
      { err: error, recordId: record.id, eventType: record.eventType, status },
      "Failed to publish settings outbox record",
    );

    if (status === "DLQ") {
      await publishDlqEvent({
        key,
        value: JSON.stringify({
          failureReason: "SETTINGS_OUTBOX_DISPATCH_FAILURE",
          failedAt: new Date().toISOString(),
          topic: eventsConfig.topic,
          record,
          error: error instanceof Error ? { name: error.name, message: error.message } : `${error}`,
        }),
        headers: { "x-tartware-dlq": "core-service:settings-outbox" },
      }).catch((dlqError: unknown) => {
        logger.error(
          { err: dlqError, recordId: record.id },
          "Failed to publish settings DLQ event",
        );
      });
    }
  }
};

const processBatch = async (): Promise<void> => {
  await releaseExpiredLocks(eventsConfig.lockTimeoutMs);

  // No pending-count short circuit here: the count spans every aggregate type in the
  // shared table, so it would report work this dispatcher must not claim.
  const records = await claimOutboxBatch(
    eventsConfig.batchSize,
    eventsConfig.workerId,
    DISPATCHED_AGGREGATE_TYPES,
  );

  for (const record of records) {
    enterTenantScope(record.tenantId);
    await dispatchRecord(record);
  }
};

/** Starts the polling loop. Safe to call once; repeat calls are ignored. */
export const startSettingsOutboxDispatcher = (): void => {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    processBatch()
      .catch((error: unknown) => {
        logger.error(error, "Settings outbox dispatch cycle failed");
      })
      .finally(() => {
        inFlight = false;
      });
  }, eventsConfig.pollIntervalMs);
  timer.unref();

  logger.info(
    {
      topic: eventsConfig.topic,
      aggregateTypes: DISPATCHED_AGGREGATE_TYPES,
      pollIntervalMs: eventsConfig.pollIntervalMs,
    },
    "settings outbox dispatcher started",
  );
};

/** Stops the polling loop. */
export const shutdownSettingsOutboxDispatcher = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("settings outbox dispatcher stopped");
  }
};

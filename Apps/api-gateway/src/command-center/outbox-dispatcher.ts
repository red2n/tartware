/**
 * Composition root for the command outbox dispatcher.
 *
 * The loop itself is `createOutboxDispatcher` in `@tartware/outbox`, shared with
 * every other service that drains an outbox. This module supplies the gateway's
 * concrete pool, producer, and config, plus the two things specific to command
 * rows: which topic a command was routed to, and marking its dispatch row
 * published once the batch lands.
 */

import { createOutboxDispatcher, type OutboxRecord } from "@tartware/outbox";

import { commandOutboxConfig, kafkaConfig } from "../config.js";
import { publishRecordBatch } from "../kafka/producer.js";
import { gatewayLogger } from "../logger.js";

import {
  claimOutboxBatch,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
} from "./outbox.js";
import { updateCommandDispatchStatusBatch } from "./sql/command-dispatches.js";

/**
 * Only the rows the gateway's command accept path enqueues. Other producers own
 * their own types and dispatchers; a type enqueued here but missing from this
 * list would sit PENDING forever.
 */
const DISPATCHED_AGGREGATE_TYPES = ["command"] as const;

/**
 * The topic chosen when the command was accepted, carried in the stored
 * envelope. Falling back to the default matches what the inline publish did, so
 * a row written before this field existed still routes somewhere real.
 */
const resolveTopic = (record: OutboxRecord): string => {
  const metadata = record.payload?.metadata;
  if (metadata && typeof metadata === "object") {
    const targetTopic = (metadata as Record<string, unknown>).targetTopic;
    if (typeof targetTopic === "string" && targetTopic.length > 0) {
      return targetTopic;
    }
  }
  return kafkaConfig.commandTopic;
};

const dispatcher = createOutboxDispatcher({
  settings: commandOutboxConfig,
  logger: gatewayLogger.child({ module: "command-outbox-dispatcher" }),
  aggregateTypes: DISPATCHED_AGGREGATE_TYPES,
  resolveTopic,
  claimOutboxBatch,
  publishRecordBatch,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
  // One UPDATE for the batch rather than one per command — the same reason the
  // delivery marking is batched.
  afterDelivered: (records) =>
    updateCommandDispatchStatusBatch(
      records.map((record) => record.eventId),
      "PUBLISHED",
    ),
});

/**
 * Start draining accepted commands into Kafka.
 *
 * A gateway that does not run this still accepts commands — they commit to the
 * outbox — but nothing publishes them, so the toggle is honoured here where it
 * is visible rather than inside the loop.
 */
export const startCommandOutboxDispatcher = (): void => {
  if (!commandOutboxConfig.enabled) {
    gatewayLogger.warn(
      "command outbox dispatcher disabled — accepted commands will not reach Kafka until it runs",
    );
    return;
  }
  dispatcher.start();
};

export const shutdownCommandOutboxDispatcher = (): Promise<void> => dispatcher.shutdown();

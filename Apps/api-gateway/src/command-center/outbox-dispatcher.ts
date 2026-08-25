/**
 * Composition root for the command outbox dispatcher.
 *
 * The loop itself lives in `dispatcher.ts` and knows nothing about this
 * gateway's pool, producer, or config. This module is the one place those
 * concrete choices are made, so swapping any of them — or driving the loop from
 * a test — does not mean touching the logic.
 */

import { commandOutboxConfig, kafkaConfig } from "../config.js";
import { publishRecordBatch } from "../kafka/producer.js";
import { gatewayLogger } from "../logger.js";

import { createCommandOutboxDispatcher } from "./dispatcher.js";
import {
  claimOutboxBatch,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
} from "./outbox.js";
import { updateCommandDispatchStatusBatch } from "./sql/command-dispatches.js";

const dispatcher = createCommandOutboxDispatcher({
  settings: commandOutboxConfig,
  logger: gatewayLogger.child({ module: "command-outbox-dispatcher" }),
  defaultTopic: kafkaConfig.commandTopic,
  claimOutboxBatch,
  publishRecordBatch,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
  updateCommandDispatchStatusBatch,
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

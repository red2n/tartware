import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import { createServiceLogger } from "@tartware/telemetry";
import type { Consumer } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/settings-kafka-client.js";
import { publishDlqEvent } from "../kafka/settings-kafka-producer.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/settings-metrics.js";
import {
  approveSettingsValue,
  bulkSetSettingsValues,
  revertSettingsValue,
  setSettingsValue,
} from "../services/settings-command-service.js";

let consumer: Consumer | null = null;

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
}).child({ module: "settings-command-consumer" });

export const startSettingsCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: config.settings.commandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: config.settings.commandCenter.maxBatchBytes,
  });

  // consumer is guaranteed non-null after assignment above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = consumer!;
  await c.connect();
  await c.subscribe({
    topic: config.settings.commandCenter.topic,
    fromBeginning: false,
  });

  await c.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: config.settings.commandCenter.topic,
      groupId: config.settings.commandCenter.consumerGroupId,
      targetService: config.settings.commandCenter.targetServiceId,
    },
    "settings command consumer started",
  );
};

export const shutdownSettingsCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("settings command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const routeSettingsCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "settings.value.set":
      await setSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.bulk_set":
      await bulkSetSettingsValues(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.approve":
      await approveSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.revert":
      await revertSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no settings handler registered for command",
      );
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.settings.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.settings.commandCenter.maxRetries,
    baseDelayMs: config.settings.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.settings.commandCenter.retryScheduleMs.length > 0
        ? config.settings.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeSettingsCommand,
  commandLabel: "settings",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

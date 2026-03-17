import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import type { Consumer } from "kafkajs";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import {
  handleCreateAutomatedMessage,
  handleCreateTemplate,
  handleDeleteAutomatedMessage,
  handleDeleteTemplate,
  handleSendNotification,
  handleUpdateAutomatedMessage,
  handleUpdateTemplate,
} from "../services/notification-command-service.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "notification-command-consumer" });

export const startNotificationCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: config.commandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: config.commandCenter.maxBatchBytes,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.commandCenter.topic,
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: config.commandCenter.topic,
      groupId: config.commandCenter.consumerGroupId,
      targetService: config.commandCenter.targetServiceId,
    },
    "notification command consumer started",
  );
};

export const shutdownNotificationCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("notification command consumer disconnected");
  } finally {
    consumer = null;
  }
};

/**
 * Route notification commands to their handlers.
 */
const routeNotificationCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "notification.send":
      await handleSendNotification(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.create":
      await handleCreateTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.update":
      await handleUpdateTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.delete":
      await handleDeleteTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.create":
      await handleCreateAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.update":
      await handleUpdateAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.delete":
      await handleDeleteAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no notification handler registered for command",
      );
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.commandCenter.maxRetries,
    baseDelayMs: config.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.commandCenter.retryScheduleMs.length > 0
        ? config.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeNotificationCommand,
  commandLabel: "notification",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

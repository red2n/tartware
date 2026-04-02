import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import type { Consumer } from "kafkajs";

import { config } from "../../../config.js";
import { kafka } from "../../../kafka/client.js";
import { publishDlqEvent } from "../../../kafka/producer.js";
import { appLogger } from "../../../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../../../lib/metrics.js";
import {
  cashierHandover,
  closeCashierSession,
  openCashierSession,
} from "../../../services/billing-commands/index.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "billing-hosted-cashier-command-consumer" });

const hostedCashierCommandCenter = {
  topic: process.env.CASHIER_COMMAND_CENTER_TOPIC ?? config.commandCenter.topic,
  consumerGroupId:
    process.env.CASHIER_COMMAND_CENTER_CONSUMER_GROUP ?? "cashier-command-center-consumer",
  targetServiceId: process.env.CASHIER_COMMAND_CENTER_TARGET_SERVICE_ID ?? "cashier-service",
  maxBatchBytes: config.commandCenter.maxBatchBytes,
  dlqTopic: process.env.CASHIER_COMMAND_CENTER_DLQ_TOPIC ?? config.commandCenter.dlqTopic,
  maxRetries: config.commandCenter.maxRetries,
  retryBackoffMs: config.commandCenter.retryBackoffMs,
  retryScheduleMs: config.commandCenter.retryScheduleMs,
};

export const startHostedCashierCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: hostedCashierCommandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: hostedCashierCommandCenter.maxBatchBytes,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: hostedCashierCommandCenter.topic,
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: hostedCashierCommandCenter.topic,
      groupId: hostedCashierCommandCenter.consumerGroupId,
      targetService: hostedCashierCommandCenter.targetServiceId,
    },
    "hosted cashier command consumer started",
  );
};

export const shutdownHostedCashierCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("hosted cashier command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const routeCashierCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "billing.cashier.open":
      await openCashierSession(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cashier.close":
      await closeCashierSession(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cashier.handover":
      await cashierHandover(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "ignoring command not targeted at hosted cashier",
      );
      return;
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: hostedCashierCommandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: hostedCashierCommandCenter.maxRetries,
    baseDelayMs: hostedCashierCommandCenter.retryBackoffMs,
    delayScheduleMs:
      hostedCashierCommandCenter.retryScheduleMs.length > 0
        ? hostedCashierCommandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeCashierCommand,
  commandLabel: "cashier",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

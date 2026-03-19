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
  cashierHandover,
  closeCashierSession,
  openCashierSession,
} from "../services/cashier-commands.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "cashier-command-consumer" });

export const startCashierCommandCenterConsumer = async (): Promise<void> => {
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
    "cashier command consumer started",
  );
};

export const shutdownCashierCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("cashier command consumer disconnected");
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
        "ignoring command not targeted at cashier-service",
      );
      return;
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
  routeCommand: routeCashierCommand,
  commandLabel: "cashier",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

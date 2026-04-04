/**
 * Accounts-service command consumer — absorbed into billing-service (Phase 6).
 *
 * Handles commands targeted at `accounts-service` consumer group.
 * Reuses billing's Kafka client, producer, and metrics.
 * All handler implementations live in billing-command-service / billing-commands.
 */
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
  ageArEntries,
  applyArPayment,
  postArEntry,
  writeOffAr,
} from "../services/billing-commands/accounts-receivable.js";
import {
  adjustInvoice,
  createInvoice,
  finalizeInvoice,
} from "../services/billing-commands/invoice.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "accounts-command-consumer" });

export const startAccountsCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) return;

  consumer = kafka.consumer({
    groupId: config.accounts.commandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: config.accounts.commandCenter.maxBatchBytes,
  });

  const c = consumer;
  await c.connect();
  await c.subscribe({
    topic: config.accounts.commandCenter.topic,
    fromBeginning: false,
  });
  await c.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: config.accounts.commandCenter.topic,
      groupId: config.accounts.commandCenter.consumerGroupId,
      targetService: config.accounts.commandCenter.targetServiceId,
    },
    "accounts command consumer started",
  );
};

export const shutdownAccountsCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await consumer.disconnect();
    logger.info("accounts command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const routeAccountsCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  const ctx = { tenantId: metadata.tenantId, initiatedBy: metadata.initiatedBy ?? null };
  switch (metadata.commandName) {
    case "billing.ar.post":
      await postArEntry(envelope.payload, ctx);
      return;
    case "billing.ar.apply_payment":
      await applyArPayment(envelope.payload, ctx);
      return;
    case "billing.ar.age":
      await ageArEntries(envelope.payload, ctx);
      return;
    case "billing.ar.write_off":
      await writeOffAr(envelope.payload, ctx);
      return;
    case "billing.invoice.create":
      await createInvoice(envelope.payload, ctx);
      return;
    case "billing.invoice.adjust":
      await adjustInvoice(envelope.payload, ctx);
      return;
    case "billing.invoice.finalize":
      await finalizeInvoice(envelope.payload, ctx);
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "ignoring command not targeted at accounts-service",
      );
      return;
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.accounts.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.accounts.commandCenter.maxRetries,
    baseDelayMs: config.accounts.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.accounts.commandCenter.retryScheduleMs.length > 0
        ? config.accounts.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeAccountsCommand,
  commandLabel: "accounts",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

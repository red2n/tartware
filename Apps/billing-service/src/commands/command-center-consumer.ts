import {
  createCommandCenterHandlers,
  type CommandEnvelope,
  type CommandMetadata,
} from "@tartware/command-consumer-utils";

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
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import {
  adjustInvoice,
  applyPayment,
  captureBillingPayment,
  createInvoice,
  postCharge,
  refundBillingPayment,
  transferFolio,
} from "../services/billing-command-service.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "billing-command-consumer" });

export const startBillingCommandCenterConsumer = async (): Promise<void> => {
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
    "billing command consumer started",
  );
};

export const shutdownBillingCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("billing command consumer disconnected");
  } finally {
    consumer = null;
  }
};


const buildDlqPayload = (input: {
  envelope?: CommandEnvelope;
  rawValue: string;
  topic: string;
  partition: number;
  offset: string;
  attempts: number;
  failureReason: "PARSING_ERROR" | "HANDLER_FAILURE";
  error: unknown;
}) => {
  const error =
    input.error instanceof Error
      ? { name: input.error.name, message: input.error.message }
      : { name: "Error", message: String(input.error) };

  return {
    metadata: {
      failureReason: input.failureReason,
      attempts: input.attempts,
      topic: input.topic,
      partition: input.partition,
      offset: input.offset,
      commandId: input.envelope?.metadata?.commandId,
      commandName: input.envelope?.metadata?.commandName,
      tenantId: input.envelope?.metadata?.tenantId,
      requestId: input.envelope?.metadata?.requestId,
      targetService: input.envelope?.metadata?.targetService,
    },
    error,
    payload: input.envelope?.payload ?? null,
    raw: input.rawValue,
    emittedAt: new Date().toISOString(),
  };
};

const routeBillingCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "billing.payment.capture":
      await captureBillingPayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.payment.refund":
      await refundBillingPayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.invoice.create":
      await createInvoice(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.invoice.adjust":
      await adjustInvoice(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.charge.post":
      await postCharge(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.payment.apply":
      await applyPayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio.transfer":
      await transferFolio(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no billing handler registered for command",
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
  routeCommand: routeBillingCommand,
  commandLabel: "billing",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

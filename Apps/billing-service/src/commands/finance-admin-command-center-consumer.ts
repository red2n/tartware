/**
 * Finance-admin-service command consumer — absorbed into billing-service (Phase 6).
 *
 * Handles commands targeted at `finance-admin-service` consumer group.
 * Reuses billing's Kafka client, producer, and metrics.
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
  approveCommission,
  calculateCommission,
  generateCommissionStatement,
  markCommissionPaid,
} from "../services/finance-admin-commands/commission.js";
import {
  closeFiscalPeriod,
  lockFiscalPeriod,
  reopenFiscalPeriod,
} from "../services/finance-admin-commands/fiscal-period.js";
import {
  bulkGeneratePricingRecommendations,
  evaluatePricingRules,
} from "../services/finance-admin-commands/pricing.js";
import {
  createTaxConfig,
  deleteTaxConfig,
  updateTaxConfig,
} from "../services/finance-admin-commands/tax-config.js";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "finance-admin-command-consumer" });

export const startFinanceAdminCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) return;

  consumer = kafka.consumer({
    groupId: config.finance.commandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: config.finance.commandCenter.maxBatchBytes,
  });

  const c = consumer;
  await c.connect();
  await c.subscribe({
    topic: config.finance.commandCenter.topic,
    fromBeginning: false,
  });
  await c.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: config.finance.commandCenter.topic,
      groupId: config.finance.commandCenter.consumerGroupId,
      targetService: config.finance.commandCenter.targetServiceId,
    },
    "finance-admin command consumer started",
  );
};

export const shutdownFinanceAdminCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await consumer.disconnect();
    logger.info("finance-admin command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const routeFinanceAdminCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  const ctx = { tenantId: metadata.tenantId, initiatedBy: metadata.initiatedBy ?? null };
  switch (metadata.commandName) {
    case "billing.tax_config.create":
      await createTaxConfig(envelope.payload, ctx);
      return;
    case "billing.tax_config.update":
      await updateTaxConfig(envelope.payload, ctx);
      return;
    case "billing.tax_config.delete":
      await deleteTaxConfig(envelope.payload, ctx);
      return;
    case "billing.fiscal_period.close":
      await closeFiscalPeriod(envelope.payload, ctx);
      return;
    case "billing.fiscal_period.lock":
      await lockFiscalPeriod(envelope.payload, ctx);
      return;
    case "billing.fiscal_period.reopen":
      await reopenFiscalPeriod(envelope.payload, ctx);
      return;
    case "commission.calculate":
      await calculateCommission(envelope.payload, ctx);
      return;
    case "commission.approve":
      await approveCommission(envelope.payload, ctx);
      return;
    case "commission.mark_paid":
      await markCommissionPaid(envelope.payload, ctx);
      return;
    case "commission.statement.generate":
      await generateCommissionStatement(envelope.payload, ctx);
      return;
    case "billing.pricing.evaluate":
      await evaluatePricingRules(envelope.payload, ctx);
      return;
    case "billing.pricing.bulk_recommend":
      await bulkGeneratePricingRecommendations(envelope.payload, ctx);
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "ignoring command not targeted at finance-admin-service",
      );
      return;
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.finance.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.finance.commandCenter.maxRetries,
    baseDelayMs: config.finance.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.finance.commandCenter.retryScheduleMs.length > 0
        ? config.finance.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeFinanceAdminCommand,
  commandLabel: "finance-admin",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

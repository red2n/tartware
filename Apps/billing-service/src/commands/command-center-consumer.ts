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
  adjustInvoice,
  ageArEntries,
  applyArPayment,
  applyPayment,
  approveCommission,
  authorizePayment,
  bulkGeneratePricingRecommendations,
  calculateCommission,
  captureBillingPayment,
  closeCashierSession,
  closeFolio,
  createInvoice,
  evaluatePricingRules,
  executeNightAudit,
  finalizeInvoice,
  incrementAuthorization,
  manualDateRoll,
  markCommissionPaid,
  openCashierSession,
  postArEntry,
  postCharge,
  recordChargeback,
  refundBillingPayment,
  splitCharge,
  transferCharge,
  transferFolio,
  voidCharge,
  voidPayment,
  writeOffAr,
} from "../services/billing-command-service.js";
import {
  cashierHandover,
  closeFiscalPeriod,
  createFolioWindow,
  createTaxConfig,
  deleteTaxConfig,
  expressCheckout,
  lockFiscalPeriod,
  reopenFiscalPeriod,
  updateTaxConfig,
} from "../services/billing-commands/index.js";

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
    case "billing.payment.authorize":
      await authorizePayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.payment.authorize_increment":
      await incrementAuthorization(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.night_audit.execute":
      await executeNightAudit(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.date_roll.manual":
      await manualDateRoll(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio.close":
      await closeFolio(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.payment.void":
      await voidPayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.charge.void":
      await voidCharge(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.invoice.finalize":
      await finalizeInvoice(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "commission.calculate":
      await calculateCommission(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "commission.approve":
      await approveCommission(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "commission.mark_paid":
      await markCommissionPaid(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.charge.transfer":
      await transferCharge(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio.split":
      await splitCharge(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.ar.post":
      await postArEntry(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.ar.apply_payment":
      await applyArPayment(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.ar.age":
      await ageArEntries(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.ar.write_off":
      await writeOffAr(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
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
    case "billing.pricing.evaluate":
      await evaluatePricingRules(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.pricing.bulk_recommend":
      await bulkGeneratePricingRecommendations(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.chargeback.record":
      await recordChargeback(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.fiscal_period.close":
      await closeFiscalPeriod(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.fiscal_period.lock":
      await lockFiscalPeriod(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.fiscal_period.reopen":
      await reopenFiscalPeriod(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio_window.create":
      await createFolioWindow(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.tax_config.create":
      await createTaxConfig(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.tax_config.update":
      await updateTaxConfig(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.tax_config.delete":
      await deleteTaxConfig(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.express_checkout":
      await expressCheckout(envelope.payload, {
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

/**
 * Finance-admin-service command consumer — absorbed into billing-service (Phase 6).
 *
 * Handles commands targeted at `finance-admin-service` consumer group.
 * Reuses billing's Kafka client, producer, and metrics.
 */
import type { CommandEnvelope, CommandMetadata } from "@tartware/command-consumer-utils";
import { createConsumerLifecycle } from "@tartware/command-consumer-utils/lifecycle";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import { BillingCommandError } from "../services/billing-commands/common.js";
import {
  approveCommission,
  bulkGeneratePricingRecommendations,
  calculateCommission,
  closeFiscalPeriod,
  createTaxConfig,
  deleteTaxConfig,
  evaluatePricingRules,
  generateCommissionStatement,
  lockFiscalPeriod,
  markCommissionPaid,
  reopenFiscalPeriod,
  updateTaxConfig,
} from "../services/billing-commands/index.js";

const logger = appLogger.child({ module: "finance-admin-command-consumer" });

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

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.finance.commandCenter,
  serviceName: config.service.name,
  commandLabel: "finance-admin",
  logger,
  routeCommand: routeFinanceAdminCommand,
  publishDlqEvent,
  isRetryable: (error) => !(error instanceof BillingCommandError),
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startFinanceAdminCommandCenterConsumer = start;
export const shutdownFinanceAdminCommandCenterConsumer = shutdown;

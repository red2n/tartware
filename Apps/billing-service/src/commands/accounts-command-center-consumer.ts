/**
 * Accounts-service command consumer — absorbed into billing-service (Phase 6).
 *
 * Handles commands targeted at `accounts-service` consumer group.
 * Reuses billing's Kafka client, producer, and metrics.
 * All handler implementations live in billing-command-service / billing-commands.
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
import {
  ageArEntries,
  applyArPayment,
  postArEntry,
  writeOffAr,
} from "../services/billing-commands/accounts-receivable.js";
import { BillingCommandError } from "../services/billing-commands/common.js";
import {
  adjustInvoice,
  createInvoice,
  finalizeInvoice,
} from "../services/billing-commands/invoice.js";

const logger = appLogger.child({ module: "accounts-command-consumer" });

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

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.accounts.commandCenter,
  serviceName: config.service.name,
  commandLabel: "accounts",
  logger,
  routeCommand: routeAccountsCommand,
  publishDlqEvent,
  isRetryable: (error) => !(error instanceof BillingCommandError),
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startAccountsCommandCenterConsumer = start;
export const shutdownAccountsCommandCenterConsumer = shutdown;

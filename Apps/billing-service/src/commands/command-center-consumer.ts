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
  checkCommandIdempotency,
  recordCommandIdempotency,
} from "../repositories/idempotency-repository.js";
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
  applyTaxExemption,
  cashierHandover,
  chargeCancellationPenalty,
  chargeLateCheckout,
  chargeNoShow,
  closeFiscalPeriod,
  createCreditNote,
  createFolio,
  createFolioWindow,
  createTaxConfig,
  deleteTaxConfig,
  expressCheckout,
  lockFiscalPeriod,
  mergeFolios,
  postComp,
  reopenFiscalPeriod,
  reopenFolio,
  reopenInvoice,
  updateChargebackStatus,
  updateTaxConfig,
  voidInvoice,
} from "../services/billing-commands/index.js";

const logger = appLogger.child({ module: "billing-command-consumer" });

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
    case "billing.folio.create":
      await createFolio(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.invoice.void":
      await voidInvoice(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.credit_note.create":
      await createCreditNote(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.invoice.reopen":
      await reopenInvoice(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio.reopen":
      await reopenFolio(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.folio.merge":
      await mergeFolios(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.chargeback.update_status":
      await updateChargebackStatus(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.no_show.charge":
      await chargeNoShow(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.late_checkout.charge":
      await chargeLateCheckout(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.tax_exemption.apply":
      await applyTaxExemption(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cancellation.penalty":
      await chargeCancellationPenalty(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.comp.post":
      await postComp(envelope.payload, {
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

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.commandCenter,
  serviceName: config.service.name,
  commandLabel: "billing",
  logger,
  routeCommand: routeBillingCommand,
  publishDlqEvent,
  checkIdempotency: checkCommandIdempotency,
  recordIdempotency: recordCommandIdempotency,
  idempotencyFailureMode: "fail-open",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startBillingCommandCenterConsumer = start;
export const shutdownBillingCommandCenterConsumer = shutdown;

/**
 * Billing Commands
 *
 * Domain-grouped command handlers for the billing service.
 *
 *  ├─ Payment       — capture, refund, apply, authorize, void, increment auth
 *  ├─ Invoice       — create, adjust, finalize, reopen, void, credit note
 *  ├─ Charge        — post, void, transfer, split
 *  ├─ Chargeback    — record, update status (state machine)
 *  ├─ Folio         — transfer, close, reopen, merge
 *  ├─ Folio Window  — date-based split billing windows
 *  ├─ Fiscal Period — close, lock, reopen
 *  ├─ Night Audit   — execute nightly reconciliation
 *  ├─ Commission    — calculate, approve, pay, statement
 *  ├─ AR            — post, apply, age, write-off
 *  ├─ Cashier       — open/close sessions
 *  ├─ Pricing       — evaluate rules, bulk recommendations
 *  ├─ Tax Config    — create, update, delete tax rules
 *  ├─ Tax Exemption — apply exemption certificate to folio
 *  ├─ No-Show       — charge no-show penalty
 *  ├─ Late Checkout — charge late checkout fee
 *  ├─ Cancel Penalty — post cancellation penalty
 *  ├─ Comp Post     — complimentary charges with budget tracking
 *  └─ Express CO    — auto-settle + checkout
 */

export {
  ageArEntries,
  applyArPayment,
  postArEntry,
  writeOffAr,
} from "./accounts-receivable.js";
export { chargeCancellationPenalty } from "./cancellation-penalty.js";
export {
  closeCashierSession,
  openCashierSession,
} from "./cashier.js";
export {
  postCharge,
  splitCharge,
  transferCharge,
  voidCharge,
} from "./charge.js";
export { recordChargeback, updateChargebackStatus } from "./chargeback.js";
export {
  approveCommission,
  calculateCommission,
  generateCommissionStatement,
  markCommissionPaid,
} from "./commission.js";
export { postComp } from "./comp-post.js";
export { manualDateRoll } from "./date-roll.js";
export { expressCheckout } from "./express-checkout.js";
export {
  closeFiscalPeriod,
  lockFiscalPeriod,
  reopenFiscalPeriod,
} from "./fiscal-period.js";
export {
  closeFolio,
  createFolio,
  mergeFolios,
  reopenFolio,
  transferFolio,
} from "./folio.js";
export { createFolioWindow } from "./folio-window.js";
export {
  adjustInvoice,
  createCreditNote,
  createInvoice,
  finalizeInvoice,
  reopenInvoice,
  voidInvoice,
} from "./invoice.js";
export { chargeLateCheckout } from "./late-checkout.js";
export { exportGlBatch, postLedger } from "./ledger.js";
export { executeNightAudit } from "./night-audit.js";
export { chargeNoShow } from "./no-show-charge.js";
export { handleOverpayment } from "./overpayment.js";
export { captureBillingPayment } from "./payment.js";
export { applyPayment } from "./payment-apply.js";
export { authorizePayment, incrementAuthorization, voidPayment } from "./payment-authorize.js";
export { refundBillingPayment } from "./payment-refund.js";
export {
  bulkGeneratePricingRecommendations,
  evaluatePricingRules,
} from "./pricing.js";
export {
  cloneRoutingRuleTemplate,
  createRoutingRule,
  deleteRoutingRule,
  updateRoutingRule,
} from "./routing-rule.js";
export { cashierHandover } from "./shift-handover.js";
export {
  createTaxConfig,
  deleteTaxConfig,
  updateTaxConfig,
} from "./tax-config.js";
export { applyTaxExemption } from "./tax-exemption.js";

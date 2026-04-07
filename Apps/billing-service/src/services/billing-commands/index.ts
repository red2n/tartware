/**
 * Billing Commands
 *
 * Domain-grouped command handlers for the billing service.
 *
 *  ├─ Payment       — capture, refund, apply, authorize, void, increment auth
 *  ├─ Invoice       — create, adjust, finalize
 *  ├─ Charge        — post, void, transfer, split
 *  ├─ Chargeback    — record processor-initiated chargebacks
 *  ├─ Folio         — transfer, close
 *  ├─ Folio Window  — date-based split billing windows
 *  ├─ Fiscal Period — close, lock, reopen
 *  ├─ Night Audit   — execute nightly reconciliation
 *  ├─ Commission    — calculate, approve, pay, statement
 *  ├─ AR            — post, apply, age, write-off
 *  ├─ Cashier       — open/close sessions
 *  ├─ Pricing       — evaluate rules, bulk recommendations
 *  ├─ Tax Config    — create, update, delete tax rules
 *  └─ Express CO    — auto-settle + checkout
 */

export {
  ageArEntries,
  applyArPayment,
  postArEntry,
  writeOffAr,
} from "./accounts-receivable.js";
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
export { recordChargeback } from "./chargeback.js";
export {
  approveCommission,
  calculateCommission,
  generateCommissionStatement,
  markCommissionPaid,
} from "./commission.js";
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
  transferFolio,
} from "./folio.js";
export { createFolioWindow } from "./folio-window.js";
export {
  adjustInvoice,
  createCreditNote,
  createInvoice,
  finalizeInvoice,
  voidInvoice,
} from "./invoice.js";
export { executeNightAudit } from "./night-audit.js";
export {
  applyPayment,
  authorizePayment,
  captureBillingPayment,
  incrementAuthorization,
  refundBillingPayment,
  voidPayment,
} from "./payment.js";

export {
  bulkGeneratePricingRecommendations,
  evaluatePricingRules,
} from "./pricing.js";
export { cashierHandover } from "./shift-handover.js";
export {
  createTaxConfig,
  deleteTaxConfig,
  updateTaxConfig,
} from "./tax-config.js";

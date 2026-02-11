/**
 * Billing Commands
 *
 * Domain-grouped command handlers for the billing service.
 *
 *  ├─ Payment       — capture, refund, apply, authorize, void
 *  ├─ Invoice       — create, adjust, finalize
 *  ├─ Charge        — post, void, transfer, split
 *  ├─ Folio         — transfer, close
 *  ├─ Night Audit   — execute nightly reconciliation
 *  ├─ Commission    — calculate, approve, pay, statement
 *  ├─ AR            — post, apply, age, write-off
 *  ├─ Cashier       — open/close sessions
 *  └─ Pricing       — evaluate rules, bulk recommendations
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
export {
  approveCommission,
  calculateCommission,
  generateCommissionStatement,
  markCommissionPaid,
} from "./commission.js";
export {
  closeFolio,
  transferFolio,
} from "./folio.js";
export {
  adjustInvoice,
  createInvoice,
  finalizeInvoice,
} from "./invoice.js";
export { executeNightAudit } from "./night-audit.js";
export {
  applyPayment,
  authorizePayment,
  captureBillingPayment,
  refundBillingPayment,
  voidPayment,
} from "./payment.js";

export {
  bulkGeneratePricingRecommendations,
  evaluatePricingRules,
} from "./pricing.js";

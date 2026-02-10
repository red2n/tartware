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
  type CommandContext,
  BillingCommandError,
  APP_ACTOR,
  SYSTEM_ACTOR_ID,
  UUID_REGEX,
  asUuid,
  resolveActorId,
  resolveFolioId,
  resolveInvoiceId,
} from "./common.js";

export {
  captureBillingPayment,
  refundBillingPayment,
  applyPayment,
  authorizePayment,
  voidPayment,
} from "./payment.js";

export {
  createInvoice,
  adjustInvoice,
  finalizeInvoice,
} from "./invoice.js";

export {
  postCharge,
  voidCharge,
  transferCharge,
  splitCharge,
} from "./charge.js";

export {
  transferFolio,
  closeFolio,
} from "./folio.js";

export {
  executeNightAudit,
} from "./night-audit.js";

export {
  calculateCommission,
  approveCommission,
  markCommissionPaid,
  generateCommissionStatement,
} from "./commission.js";

export {
  postArEntry,
  applyArPayment,
  ageArEntries,
  writeOffAr,
} from "./accounts-receivable.js";

export {
  openCashierSession,
  closeCashierSession,
} from "./cashier.js";

export {
  evaluatePricingRules,
  bulkGeneratePricingRecommendations,
} from "./pricing.js";

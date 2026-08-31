/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: billing-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "billing-service",
  version: "1.0.0",
  flows: {
    [FlowId.RATE_PRICING]: {
      commands: [
        { commandName: "billing.pricing.evaluate", description: "Evaluate rate for a stay" },
      ],
    },

    [FlowId.CHECK_IN]: {
      commands: [
        { commandName: "billing.folio.create", description: "Create folio on check-in" },
        { commandName: "billing.payment.authorize", description: "Pre-auth deposit on check-in" },
      ],
    },

    [FlowId.IN_HOUSE]: {
      commands: [
        { commandName: "billing.charge.post", description: "Post charge to folio" },
        { commandName: "billing.payment.apply", description: "Apply payment to folio" },
        { commandName: "billing.folio.transfer", description: "Transfer folio window" },
        { commandName: "billing.charge.transfer", description: "Transfer charge between folios" },
      ],
    },

    [FlowId.NIGHT_AUDIT]: {
      commands: [
        { commandName: "billing.night_audit.execute", description: "Execute night audit sequence" },
        { commandName: "billing.date_roll.manual", description: "Manual date roll" },
      ],
      gates: [
        {
          gateName: "open_arrivals_check",
          guardsCommand: "billing.night_audit.execute",
          description: "Block audit if unresolved arrivals",
        },
        {
          gateName: "open_departures_check",
          guardsCommand: "billing.night_audit.execute",
          description: "Block audit if unresolved departures",
        },
        {
          gateName: "unbalanced_folios_check",
          guardsCommand: "billing.night_audit.execute",
          description: "Block audit if folios unbalanced",
        },
        {
          gateName: "night_audit_precondition_bypass",
          guardsCommand: "billing.night_audit.execute",
          description: "Records a skip_preconditions override, one row per gate bypassed",
        },
      ],
    },

    [FlowId.CHECK_OUT]: {
      commands: [
        { commandName: "billing.folio.close", description: "Close folio on checkout" },
        { commandName: "billing.express_checkout", description: "Express checkout flow" },
        { commandName: "billing.invoice.create", description: "Generate invoice post-checkout" },
      ],
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.checked_out",
          description: "Trigger AR city-ledger transfer on checkout if direct-bill routing exists",
        },
      ],
    },

    [FlowId.CASHIER_SHIFT]: {
      commands: [
        { commandName: "billing.cashier.open", description: "Open a drawer with a float" },
        {
          commandName: "billing.cashier.handover",
          description: "Hand the drawer to the next cashier",
        },
        {
          commandName: "billing.cashier.close",
          description: "Close the drawer with a counted variance",
        },
      ],
    },

    // Everything that reverses, forgives or reopens a posted entry. These were
    // named by no flow at all until 30 Aug — the registry covered the guest
    // lifecycle and stopped at the ledger, so nothing asserted that a void or a
    // write-off still had a handler behind it.
    [FlowId.LEDGER_CONTROL]: {
      commands: [
        { commandName: "billing.charge.void", description: "Void a posted charge" },
        { commandName: "billing.payment.void", description: "Void a payment" },
        { commandName: "billing.payment.refund", description: "Refund a captured payment" },
        { commandName: "billing.invoice.void", description: "Void a finalised invoice" },
        { commandName: "billing.credit_note.create", description: "Issue a credit note" },
        { commandName: "billing.comp.post", description: "Post a comp against a budget" },
        { commandName: "billing.deposit.waive", description: "Waive a required deposit" },
        { commandName: "billing.folio.reopen", description: "Reopen a closed folio" },
        { commandName: "billing.invoice.reopen", description: "Reopen a finalised invoice" },
        { commandName: "billing.fiscal_period.lock", description: "Lock a fiscal period" },
        { commandName: "billing.fiscal_period.reopen", description: "Reopen a locked period" },
        {
          commandName: "billing.suspense.write_off",
          description: "Write off an unresolved suspense balance",
        },
        {
          commandName: "ar.city_ledger.write_off",
          description: "Write off a city ledger balance as bad debt",
        },
        {
          commandName: "ar.payment.unapply",
          description: "Unapply a payment from an invoice",
        },
      ],
    },

    [FlowId.AR_COLLECTIONS]: {
      commands: [
        { commandName: "billing.ar.post", description: "Post to accounts receivable" },
        { commandName: "billing.ar.apply_payment", description: "Apply AR payment" },
        { commandName: "billing.ar.age", description: "Run AR aging" },
        { commandName: "billing.ar.write_off", description: "Write off AR balance" },
      ],
    },
  },
};

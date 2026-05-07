/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: billing-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "billing-service",
  flows: {
    [FlowId.RATE_PRICING]: {
      commands: [
        { commandName: "billing.pricing.evaluate", description: "Evaluate rate for a stay" },
        {
          commandName: "billing.pricing.bulk_recommend",
          description: "Bulk pricing recommendations",
        },
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
      ],
    },

    [FlowId.CHECK_OUT]: {
      commands: [
        { commandName: "billing.folio.close", description: "Close folio on checkout" },
        { commandName: "billing.express_checkout", description: "Express checkout flow" },
        { commandName: "billing.invoice.create", description: "Generate invoice post-checkout" },
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

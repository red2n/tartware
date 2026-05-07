/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: revenue-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "revenue-service",
  flows: {
    [FlowId.RATE_PRICING]: {
      commands: [
        { commandName: "revenue.pricing_rule.create", description: "Create pricing rule" },
        { commandName: "revenue.pricing_rule.update", description: "Update pricing rule" },
        { commandName: "revenue.pricing_rule.activate", description: "Activate pricing rule" },
        { commandName: "revenue.pricing_rule.deactivate", description: "Deactivate pricing rule" },
      ],
    },

    [FlowId.NIGHT_AUDIT]: {
      commands: [
        { commandName: "revenue.daily_close.process", description: "Process daily revenue close" },
      ],
    },
  },
};

/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: api-gateway
 *
 * The gateway had no manifest at all, which was a fair reflection of the old
 * arrangement: it routed commands and decided nothing about them. That is no
 * longer true. Authorization now happens here — the per-command floor (A02) and
 * the dual-control deferral (A04) are both applied inside `acceptCommand`,
 * before anything reaches the outbox — so the service that enforces the gates
 * is the service that should declare them.
 *
 * It claims **gates only**, and no commands. Every command is still handled by
 * the domain service that owns it, and a gateway claim would read as a second
 * handler to `validateFlowCompliance` (which reports a command claimed twice as
 * a violation, correctly).
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "api-gateway",
  version: "1.0.0",
  flows: {
    /**
     * The five commands that undo a completed accounting control are not
     * dispatched on one login's authority: `acceptCommand` records an approval
     * request and the command runs when a second person with the approver role
     * releases it.
     *
     * Declaring it here is what makes its removal loud. Delete the deferral and
     * every one of these keeps working — a void is still a void, a write-off
     * still writes off — so no test of the command's behaviour would notice.
     * The boot validator does: the gate goes unclaimed and the system refuses
     * to start.
     */
    [FlowId.LEDGER_CONTROL]: {
      gates: [
        {
          gateName: "dual_control",
          guardsCommand: "ar.city_ledger.write_off",
          description: "Second approver required before the command is dispatched",
        },
        {
          gateName: "dual_control",
          guardsCommand: "billing.ar.write_off",
          description: "Second approver required before the command is dispatched",
        },
        {
          gateName: "dual_control",
          guardsCommand: "billing.suspense.write_off",
          description: "Second approver required before the command is dispatched",
        },
        {
          gateName: "dual_control",
          guardsCommand: "billing.fiscal_period.reopen",
          description: "Second approver required before the command is dispatched",
        },
        {
          gateName: "dual_control",
          guardsCommand: "billing.date_roll.manual",
          description: "Second approver required before the command is dispatched",
        },
      ],
    },
  },
};

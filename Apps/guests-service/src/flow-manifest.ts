/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: guests-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "guests-service",
  flows: {
    [FlowId.GUEST_PROFILE]: {
      commands: [
        { commandName: "guest.register", description: "Register new guest profile" },
        { commandName: "guest.update_profile", description: "Update guest profile" },
        { commandName: "guest.merge", description: "Merge duplicate guest profiles" },
        { commandName: "guest.set_blacklist", description: "Set guest blacklist status" },
        { commandName: "guest.set_vip", description: "Set guest VIP status" },
        { commandName: "guest.set_loyalty", description: "Set guest loyalty tier" },
      ],
    },
  },
};

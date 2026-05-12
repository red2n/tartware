/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: rooms-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "rooms-service",
  version: "1.0.0",
  flows: {
    [FlowId.PROPERTY_SETUP]: {
      commands: [
        { commandName: "rooms.inventory.block", description: "Block room from inventory" },
        { commandName: "rooms.inventory.release", description: "Release room back to inventory" },
        { commandName: "rooms.status.update", description: "Update room status" },
        { commandName: "rooms.out_of_order", description: "Mark room out of order" },
        { commandName: "rooms.out_of_service", description: "Mark room out of service" },
      ],
    },

    [FlowId.IN_HOUSE]: {
      commands: [{ commandName: "rooms.move", description: "Move guest to different room" }],
    },

    [FlowId.HOUSEKEEPING]: {
      commands: [
        { commandName: "rooms.housekeeping_status.update", description: "Update room HK status" },
      ],
    },
  },
};

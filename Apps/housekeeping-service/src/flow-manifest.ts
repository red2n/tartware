/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: housekeeping-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "housekeeping-service",
  flows: {
    [FlowId.HOUSEKEEPING]: {
      commands: [
        { commandName: "housekeeping.task.create", description: "Create housekeeping task" },
        { commandName: "housekeeping.task.assign", description: "Assign task to attendant" },
        { commandName: "housekeeping.task.complete", description: "Mark task complete" },
      ],
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.checked_out",
          description: "Auto-create cleaning task on checkout",
        },
      ],
    },

    [FlowId.CHECK_OUT]: {
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.checked_out",
          description: "Listen for checkout to trigger HK",
        },
      ],
    },
  },
};

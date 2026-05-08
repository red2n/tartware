/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: notification-service
 *
 * The notification service is an event consumer — it listens for reservation lifecycle
 * events and dispatches guest-facing notifications (email, SMS, push).
 * It handles no commands or gates; it is purely reactive.
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "notification-service",
  version: "1.0.0",
  flows: {
    [FlowId.RESERVATION]: {
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.created",
          description: "Send booking confirmation notification to guest",
        },
      ],
    },

    [FlowId.CHECK_IN]: {
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.checked_in",
          description: "Send check-in confirmation notification to guest",
        },
      ],
    },

    [FlowId.CHECK_OUT]: {
      events: [
        {
          topic: "reservations.events",
          eventType: "reservation.checked_out",
          description: "Send checkout confirmation and invoice to guest",
        },
      ],
    },
  },
};

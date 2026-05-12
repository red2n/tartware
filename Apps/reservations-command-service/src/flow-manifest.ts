/**
 * DEV DOC
 * Module: flow-manifest.ts
 * Purpose: Declares which PMS flows this service participates in and what it contributes.
 * Ownership: reservations-command-service
 */

import { FlowId, type ServiceFlowManifest } from "@tartware/schemas";

export const FLOW_MANIFEST: ServiceFlowManifest = {
  serviceId: "reservations-command-service",
  version: "1.0.0",
  flows: {
    [FlowId.RESERVATION]: {
      commands: [
        { commandName: "reservation.create", description: "Create new reservation" },
        { commandName: "reservation.modify", description: "Modify existing reservation" },
        { commandName: "reservation.cancel", description: "Cancel reservation" },
        { commandName: "reservation.assign_room", description: "Assign room to reservation" },
        { commandName: "reservation.no_show", description: "Mark reservation as no-show" },
        { commandName: "group.create", description: "Create group block" },
        { commandName: "group.add_rooms", description: "Add rooms to group" },
        { commandName: "group.upload_rooming_list", description: "Upload group rooming list" },
      ],
      gates: [
        {
          gateName: "blacklist_check",
          guardsCommand: "reservation.create",
          description: "Block blacklisted guests from booking",
        },
      ],
    },

    [FlowId.PRE_ARRIVAL]: {
      commands: [
        { commandName: "reservation.mobile_checkin.start", description: "Start mobile check-in" },
        {
          commandName: "reservation.mobile_checkin.complete",
          description: "Complete mobile check-in",
        },
        {
          commandName: "reservation.generate_registration_card",
          description: "Generate reg card PDF",
        },
      ],
    },

    [FlowId.CHECK_IN]: {
      commands: [
        { commandName: "reservation.check_in", description: "Check in guest" },
        { commandName: "reservation.walkin_checkin", description: "Walk-in check-in" },
      ],
    },

    [FlowId.IN_HOUSE]: {
      commands: [
        { commandName: "reservation.extend_stay", description: "Extend stay dates" },
        { commandName: "reservation.rate_override", description: "Override rate for reservation" },
      ],
    },

    [FlowId.CHECK_OUT]: {
      commands: [{ commandName: "reservation.check_out", description: "Check out guest" }],
    },

    [FlowId.CHANNEL_DISTRIBUTION]: {
      commands: [
        { commandName: "integration.ota.sync_request", description: "Sync availability to OTA" },
        { commandName: "integration.ota.rate_push", description: "Push rates to OTA" },
        { commandName: "integration.ota.content_sync", description: "Sync content to OTA" },
      ],
    },
  },
};

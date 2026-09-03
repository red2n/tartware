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
        {
          commandName: "reservation.mass_cancel",
          description: "Cancel many reservations in one batch",
        },
        {
          commandName: "reservation.mass_update",
          description: "Apply one set of changes to many reservations",
        },
        {
          commandName: "reservation.reinstate",
          description: "Reinstate a cancelled reservation",
        },
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
        {
          gateName: "reinstate_reservation",
          guardsCommand: "reservation.reinstate",
          description: "Records the reinstatement and the hold it had to take back",
        },
      ],
    },

    [FlowId.PRE_ARRIVAL]: {
      commands: [
        {
          commandName: "reservation.generate_registration_card",
          description: "Generate reg card PDF",
        },
        {
          commandName: "reservation.add_deposit",
          description: "Take a guarantee before the guest travels",
        },
        {
          commandName: "reservation.release_deposit",
          description: "Release a held guarantee",
        },
      ],
    },

    [FlowId.CHECK_IN]: {
      commands: [
        { commandName: "reservation.check_in", description: "Check in guest" },
        { commandName: "reservation.walkin_checkin", description: "Walk-in check-in" },
        {
          commandName: "reservation.reverse_check_in",
          description: "Undo a check-in and void what it posted",
        },
        {
          commandName: "reservation.mass_check_in",
          description: "Check in many reservations in one batch",
        },
      ],
      gates: [
        {
          gateName: "reservation_status_check",
          guardsCommand: "reservation.check_in",
          description: "Refuse an arrival the lifecycle does not allow",
        },
        {
          gateName: "deposit_required_check",
          guardsCommand: "reservation.check_in",
          description: "Refuse an arrival with a blocking deposit outstanding",
        },
        {
          gateName: "deposit_required_check",
          guardsCommand: "group.check_in",
          description:
            "The same deposit gate for a whole group arrival, which forced past it unauthorised",
        },
        {
          gateName: "reverse_check_in",
          guardsCommand: "reservation.reverse_check_in",
          description: "Records every check-in reversal",
        },
      ],
    },

    [FlowId.IN_HOUSE]: {
      commands: [
        { commandName: "reservation.extend_stay", description: "Extend stay dates" },
        { commandName: "reservation.rate_override", description: "Override rate for reservation" },
        {
          commandName: "reservation.room_move",
          description: "Move an in-house guest to a different room",
        },
      ],
      gates: [
        {
          gateName: "rate_override",
          guardsCommand: "reservation.rate_override",
          description:
            "Records every rate override, under a RATE_OVERRIDE code the caller's role clears",
        },
        {
          gateName: "room_move",
          guardsCommand: "reservation.room_move",
          description: "Records every move, with the reason code and whether a gate was forced",
        },
      ],
    },

    [FlowId.CHECK_OUT]: {
      commands: [
        { commandName: "reservation.check_out", description: "Check out guest" },
        {
          commandName: "reservation.reverse_check_out",
          description: "Undo a check-out and reopen the folio",
        },
      ],
      gates: [
        {
          gateName: "folio_settlement_check",
          guardsCommand: "reservation.check_out",
          description: "Refuse a departure over an unsettled folio",
        },
        {
          gateName: "reverse_check_out",
          guardsCommand: "reservation.reverse_check_out",
          description: "Records every check-out reversal",
        },
      ],
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

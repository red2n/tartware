/**
 * DEV DOC
 * Module: flow-registry.ts
 * Purpose: Master registry of all 12 PMS flows and their requirements.
 * Ownership: Schema package (single source of truth)
 *
 * This defines WHAT each flow needs — the boot-time validator checks that
 * service manifests collectively cover every requirement.
 */

import { FlowId } from "./flow-ids.js";
import type { FlowRegistry } from "./types.js";

/**
 * The canonical flow registry.
 * Each flow declares the commands, events, and gates it requires.
 * The validator ensures every entry has at least one service claiming responsibility.
 */
export const FLOW_REGISTRY: FlowRegistry = {
  [FlowId.PROPERTY_SETUP]: {
    name: "Property Setup",
    requiredCommands: [
      "rooms.inventory.block",
      "rooms.inventory.release",
      "rooms.status.update",
      "rooms.out_of_order",
      "rooms.out_of_service",
    ],
    dependsOn: [],
  },

  [FlowId.RATE_PRICING]: {
    name: "Rate & Pricing",
    requiredCommands: [
      "revenue.pricing_rule.create",
      "revenue.pricing_rule.update",
      "revenue.pricing_rule.activate",
      "revenue.pricing_rule.deactivate",
      "billing.pricing.evaluate",
    ],
    dependsOn: [FlowId.PROPERTY_SETUP],
  },

  [FlowId.GUEST_PROFILE]: {
    name: "Guest Profile",
    requiredCommands: [
      "guest.register",
      "guest.update_profile",
      "guest.merge",
      "guest.set_blacklist",
      "guest.set_vip",
      "guest.set_loyalty",
    ],
    dependsOn: [],
  },

  [FlowId.RESERVATION]: {
    name: "Reservation",
    requiredCommands: [
      "reservation.create",
      "reservation.modify",
      "reservation.cancel",
      "reservation.assign_room",
      "reservation.no_show",
      "group.create",
      "group.add_rooms",
      "group.upload_rooming_list",
    ],
    requiredGates: [
      { gateName: "blacklist_check", guardsCommand: "reservation.create" },
    ],
    requiredEvents: [
      { topic: "reservations.events", eventType: "reservation.created" },
    ],
    dependsOn: [FlowId.PROPERTY_SETUP, FlowId.RATE_PRICING, FlowId.GUEST_PROFILE],
  },

  [FlowId.PRE_ARRIVAL]: {
    name: "Pre-Arrival",
    requiredCommands: [
      "reservation.mobile_checkin.start",
      "reservation.mobile_checkin.complete",
      "reservation.generate_registration_card",
    ],
    dependsOn: [FlowId.RESERVATION],
  },

  [FlowId.CHECK_IN]: {
    name: "Check-In",
    requiredCommands: [
      "reservation.check_in",
      "reservation.walkin_checkin",
      "billing.folio.create",
      "billing.payment.authorize",
    ],
    requiredEvents: [
      { topic: "reservations.events", eventType: "reservation.checked_in" },
    ],
    dependsOn: [FlowId.RESERVATION],
  },

  [FlowId.IN_HOUSE]: {
    name: "In-House",
    requiredCommands: [
      "billing.charge.post",
      "billing.payment.apply",
      "billing.folio.transfer",
      "billing.charge.transfer",
      "reservation.extend_stay",
      "reservation.rate_override",
      "rooms.move",
    ],
    dependsOn: [FlowId.CHECK_IN],
  },

  [FlowId.NIGHT_AUDIT]: {
    name: "Night Audit",
    requiredCommands: [
      "billing.night_audit.execute",
      "billing.date_roll.manual",
      "revenue.daily_close.process",
    ],
    requiredGates: [
      { gateName: "open_arrivals_check", guardsCommand: "billing.night_audit.execute" },
      { gateName: "open_departures_check", guardsCommand: "billing.night_audit.execute" },
      { gateName: "unbalanced_folios_check", guardsCommand: "billing.night_audit.execute" },
    ],
    dependsOn: [FlowId.IN_HOUSE],
  },

  [FlowId.CHECK_OUT]: {
    name: "Check-Out",
    requiredCommands: [
      "reservation.check_out",
      "billing.folio.close",
      "billing.express_checkout",
      "billing.invoice.create",
    ],
    requiredEvents: [
      { topic: "reservations.events", eventType: "reservation.checked_out" },
    ],
    dependsOn: [FlowId.IN_HOUSE],
  },

  [FlowId.HOUSEKEEPING]: {
    name: "Housekeeping",
    requiredCommands: [
      "housekeeping.task.create",
      "housekeeping.task.assign",
      "housekeeping.task.complete",
      "rooms.housekeeping_status.update",
    ],
    requiredEvents: [
      { topic: "reservations.events", eventType: "reservation.checked_out" },
    ],
    dependsOn: [FlowId.CHECK_OUT],
  },

  [FlowId.AR_COLLECTIONS]: {
    name: "AR & Collections",
    requiredCommands: [
      "billing.ar.post",
      "billing.ar.apply_payment",
      "billing.ar.age",
      "billing.ar.write_off",
    ],
    dependsOn: [FlowId.CHECK_OUT],
  },

  [FlowId.CHANNEL_DISTRIBUTION]: {
    name: "Channel Distribution",
    requiredCommands: [
      "integration.ota.sync_request",
      "integration.ota.rate_push",
      "integration.ota.content_sync",
    ],
    dependsOn: [FlowId.PROPERTY_SETUP, FlowId.RATE_PRICING],
  },
};

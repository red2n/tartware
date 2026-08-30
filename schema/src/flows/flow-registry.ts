/**
 * DEV DOC
 * Module: flow-registry.ts
 * Purpose: Master registry of all 14 PMS flows and their requirements.
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
			"reservation.reinstate",
			"reservation.assign_room",
			"reservation.no_show",
			// Mass cancel and mass update are the same two commands applied to
			// many targets through the batch envelope (WS-04 / PMS-01-21,
			// PMS-01-22); a front desk that can only act one booking at a time
			// falls back to spreadsheets on the days it matters most.
			"reservation.mass_cancel",
			"reservation.mass_update",
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
		dependsOn: [
			FlowId.PROPERTY_SETUP,
			FlowId.RATE_PRICING,
			FlowId.GUEST_PROFILE,
		],
	},

	[FlowId.PRE_ARRIVAL]: {
		name: "Pre-Arrival",
		// `reservation.mobile_checkin.*` were removed 2026-08-18: the guest portal
		// does mobile check-in over REST on guests-service (`routes/checkin.ts`), so
		// the commands were a third entry point nothing dispatched.
		// See ui-gaps/17-command-reachability.md.
		requiredCommands: [
			"reservation.generate_registration_card",
			// A guarantee taken before the guest travels is what makes the
			// booking real. Both commands existed and were reachable, and no
			// flow asserted either — so nothing checked that a property can
			// actually secure a reservation.
			"reservation.add_deposit",
			"reservation.release_deposit",
		],
		dependsOn: [FlowId.RESERVATION],
	},

	[FlowId.CHECK_IN]: {
		name: "Check-In",
		requiredCommands: [
			"reservation.check_in",
			"reservation.walkin_checkin",
			// A check-in nobody can undo means the only recovery from a mis-key
			// on an arrival day is direct database work (WS-04 / PMS-02-01).
			"reservation.reverse_check_in",
			// Arrival day is when bulk matters: a coach party is one action,
			// not forty (WS-04 / PMS-02-05).
			"reservation.mass_check_in",
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
			// Moving an in-house guest: the one lifecycle event a front desk
			// performs daily that had no command (WS-04 / PMS-02-02).
			"reservation.room_move",
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
			{
				gateName: "open_arrivals_check",
				guardsCommand: "billing.night_audit.execute",
			},
			{
				gateName: "open_departures_check",
				guardsCommand: "billing.night_audit.execute",
			},
			{
				gateName: "unbalanced_folios_check",
				guardsCommand: "billing.night_audit.execute",
			},
		],
		dependsOn: [FlowId.IN_HOUSE],
	},

	[FlowId.CHECK_OUT]: {
		name: "Check-Out",
		requiredCommands: [
			"reservation.check_out",
			"reservation.reverse_check_out",
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

	[FlowId.CASHIER_SHIFT]: {
		name: "Cashier Shift",
		/*
		 * Front-office money handling is a shift, not a series of unrelated
		 * postings: a drawer is opened with a float, money is taken against it,
		 * it is handed to the next cashier or closed with a counted variance.
		 * All three commands existed and were reachable, and no flow named any
		 * of them — so the one part of the product where cash physically
		 * changes hands had no compliance check at all.
		 */
		requiredCommands: [
			"billing.cashier.open",
			"billing.cashier.handover",
			"billing.cashier.close",
		],
		dependsOn: [FlowId.CHECK_IN],
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

	/**
	 * Everything that reverses, forgives or reopens an entry the ledger has
	 * already accepted.
	 *
	 * The registry grew around the guest lifecycle and stopped at the ledger:
	 * 136 of 202 catalogued commands were named by no flow, and they included
	 * almost every operation an auditor would call high-risk — voids, comps,
	 * write-offs, folio and invoice reopens, the fiscal period calendar. Nothing
	 * asserted that any of them had a handler, a catalogue row, or a control in
	 * front of them.
	 *
	 * `requiredGates` is the part that earns this entry. Until dual control
	 * landed (A04), a gate here could only have named a check that did not
	 * exist; now the five commands that undo a completed accounting control are
	 * refused at `acceptCommand` unless a second person releases them, and the
	 * boot validator refuses to start a system where that has been removed.
	 * A regression there is otherwise silent — the command keeps working, which
	 * is the problem.
	 */
	[FlowId.LEDGER_CONTROL]: {
		name: "Ledger Control",
		requiredCommands: [
			// Reversal of a posted document. The void is the transaction of
			// record afterwards.
			"billing.charge.void",
			"billing.payment.void",
			"billing.payment.refund",
			"billing.invoice.void",
			"billing.credit_note.create",
			// Revenue given away against a budget.
			"billing.comp.post",
			"billing.deposit.waive",
			// A closed record reopened.
			"billing.folio.reopen",
			"billing.invoice.reopen",
			"billing.fiscal_period.lock",
			"billing.fiscal_period.reopen",
			// Debt that leaves the books, and the payment application that
			// decides which invoice it left.
			"billing.suspense.write_off",
			"ar.city_ledger.write_off",
			"ar.payment.unapply",
		],
		requiredGates: [
			// The five commands under dual control (COMMAND_DUAL_CONTROL in
			// schema/src/api/command-approvals.ts). `billing.ar.write_off` and
			// `billing.date_roll.manual` are required by AR_COLLECTIONS and
			// NIGHT_AUDIT respectively — a command is claimed once, but the gate
			// in front of it belongs here with the rest of the set.
			{
				gateName: "dual_control",
				guardsCommand: "ar.city_ledger.write_off",
			},
			{ gateName: "dual_control", guardsCommand: "billing.ar.write_off" },
			{
				gateName: "dual_control",
				guardsCommand: "billing.suspense.write_off",
			},
			{
				gateName: "dual_control",
				guardsCommand: "billing.fiscal_period.reopen",
			},
			{ gateName: "dual_control", guardsCommand: "billing.date_roll.manual" },
		],
		dependsOn: [FlowId.NIGHT_AUDIT, FlowId.AR_COLLECTIONS],
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

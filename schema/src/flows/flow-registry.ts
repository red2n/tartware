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
import type { FlowControlKind, FlowRegistry } from "./types.js";

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
			{
				gateName: "blacklist_check",
				guardsCommand: "reservation.create",
				description:
					"Refuse a booking for a blacklisted guest; an override needs a BLACKLIST reason code whose approval level the caller's role clears",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/core.ts",
						token: "is_blacklisted",
					},
					// The gate refused from the day it was written and had no way
					// through it (A05) — its own message named a GM override the
					// product did not implement. These two tokens are what make the
					// override a control rather than a flag: the row it writes, and
					// the authority check that has to pass before it is written.
					// The way *through* the gate lives in its own module, so it can be
					// called — and therefore tested — directly. It was ten private
					// lines inside `core.ts`, which is how the override shipped with
					// no test of any kind while billing's identical credit-limit gate
					// shipped with fourteen.
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/blacklist-gate.ts",
						token: 'gateName: "blacklist_check"',
					},
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/blacklist-gate.ts",
						token: "assertOverrideAuthority",
					},
				],
			},
			{
				gateName: "reinstate_reservation",
				guardsCommand: "reservation.reinstate",
				kind: "record",
				description:
					"Every reinstatement lands a row — the availability hold it had to take back is the controlled part",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/reversals.ts",
						token: 'gateName: "reinstate_reservation"',
					},
				],
			},
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
		// Both of these were enforced in the handler and declared nowhere, which
		// is the same disconnection as an undeclared command: the registry could
		// not say what check-in refuses, so nothing noticed if it stopped.
		requiredGates: [
			{
				gateName: "reservation_status_check",
				guardsCommand: "reservation.check_in",
				description:
					"Only a booking the lifecycle allows in; force reinstates a NO_SHOW who turned up",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/checkin-checkout.ts",
						token: 'gateName: "reservation_status_check"',
					},
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/checkin-checkout.ts",
						token: "assertReservationTransition",
					},
				],
			},
			{
				gateName: "deposit_required_check",
				guardsCommand: "reservation.check_in",
				description:
					"A blocking deposit schedule stops the arrival until it is paid",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/checkin-checkout.ts",
						token: 'gateName: "deposit_required_check"',
					},
				],
			},
			{
				gateName: "credit_limit_check",
				guardsCommand: "billing.payment.authorize",
				description:
					"A guest past their credit block threshold cannot be pre-authorised; an override needs a CREDIT_LIMIT reason code whose approval level the caller's role clears",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/payment-authorize.ts",
						token: "enforceCreditLimit",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: 'gate_name: "credit_limit_check"',
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: "assertOverrideAuthority",
					},
				],
			},
			{
				gateName: "reverse_check_in",
				guardsCommand: "reservation.reverse_check_in",
				kind: "record",
				description: "Every check-in reversal lands a row, forced or not",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/reversals.ts",
						token: 'gateName: "reverse_check_in"',
					},
				],
			},
		],
		dependsOn: [FlowId.RESERVATION],
	},

	[FlowId.IN_HOUSE]: {
		name: "In-House",
		requiredCommands: [
			"billing.charge.post",
			"billing.payment.apply",
			// Named here because A05 gave it a control: taking a payment past a
			// guest's credit block is a decision someone has to be entitled to make,
			// and a gate cannot guard a command no flow claims.
			"billing.payment.capture",
			"billing.folio.transfer",
			"billing.charge.transfer",
			"reservation.extend_stay",
			"reservation.rate_override",
			// Moving an in-house guest: the one lifecycle event a front desk
			// performs daily that had no command (WS-04 / PMS-02-02).
			"reservation.room_move",
			"rooms.move",
		],
		requiredGates: [
			{
				gateName: "credit_limit_check",
				guardsCommand: "billing.payment.capture",
				description:
					"The same block on the capture: a payment that would push the guest past their threshold needs an authorised, recorded override",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/payment.ts",
						token: "clearCreditLimitGate",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: 'gate_name: "credit_limit_check"',
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: "assertOverrideAuthority",
					},
				],
			},
			{
				gateName: "rate_override",
				guardsCommand: "reservation.rate_override",
				kind: "record",
				description:
					"Every rate override lands a row under a RATE_OVERRIDE code the caller's role clears — the most common way money leaves a hotel, and the last one with no record",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/financial-ops.ts",
						token: 'gateName: "rate_override"',
					},
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/financial-ops.ts",
						token: "assertOverrideAuthority",
					},
				],
			},
			{
				gateName: "room_move",
				guardsCommand: "reservation.room_move",
				kind: "record",
				description:
					"Every move lands a row carrying the reason code, and `forced` when a gate was bypassed",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/room-move.ts",
						token: 'gateName: "room_move"',
					},
				],
			},
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
			// One token each, not one shared one. Deleting a single precondition
			// is the realistic regression — all three vanishing at once would be
			// noticed; "Check 2 quietly stopped running" would not.
			{
				gateName: "open_arrivals_check",
				guardsCommand: "billing.night_audit.execute",
				description: "Arrivals due today must be checked in or no-showed first",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/night-audit.ts",
						token: "rows: openArrivals",
					},
				],
			},
			{
				gateName: "open_departures_check",
				guardsCommand: "billing.night_audit.execute",
				description: "In-house guests due out today must be checked out first",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/night-audit.ts",
						token: "rows: openDepartures",
					},
				],
			},
			{
				gateName: "unbalanced_folios_check",
				guardsCommand: "billing.night_audit.execute",
				description: "Open in-house folios must balance before the date rolls",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/night-audit.ts",
						token: "rows: unbalancedFolios",
					},
				],
			},
			// The bypass is part of the control, so it is declared with them. A
			// skip that records nothing is an unaudited override, which is what
			// this gate column exists to make impossible.
			{
				gateName: "night_audit_precondition_bypass",
				guardsCommand: "billing.night_audit.execute",
				kind: "record",
				description:
					"skip_preconditions=true records one row per gate, against a resolved reason code",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/night-audit.ts",
						token: "NIGHT_AUDIT_PRECONDITION_GATES",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/night-audit.ts",
						token: "resolveReasonCode",
					},
				],
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
		requiredGates: [
			{
				gateName: "folio_settlement_check",
				guardsCommand: "reservation.check_out",
				description:
					"An unsettled folio stops the departure; forcing it moves the balance to city ledger",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/checkin-checkout.ts",
						token: 'gateName: "folio_settlement_check"',
					},
				],
			},
			{
				gateName: "reverse_check_out",
				guardsCommand: "reservation.reverse_check_out",
				kind: "record",
				description: "Every check-out reversal lands a row, forced or not",
				evidence: [
					{
						file: "Apps/reservations-command-service/src/services/reservation-commands/reversals.ts",
						token: 'gateName: "reverse_check_out"',
					},
				],
			},
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
			// The move that puts a guest's balance on a company's account, and the
			// only one of these four with a control in front of it.
			"ar.city_ledger.transfer",
		],
		requiredGates: [
			{
				gateName: "credit_limit_check",
				guardsCommand: "ar.city_ledger.transfer",
				description:
					"A transfer beyond the AR account's available credit is refused; the same CREDIT_LIMIT override applies, recorded against the folio",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/ara.ts",
						token: "clearCreditLimitGate",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: 'gate_name: "credit_limit_check"',
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/credit-limit-gate.ts",
						token: "assertOverrideAuthority",
					},
				],
			},
			// The bad-debt write-off is claimed by this flow, so its control is
			// declared here — the same `write_off` gate LEDGER_CONTROL declares
			// for the other two, entered through the same module.
			{
				gateName: "write_off",
				guardsCommand: "billing.ar.write_off",
				kind: "record",
				description:
					"A stated WRITE_OFF reason code, an acting role that clears its approval level, and an amount within that role's ladder — recorded once the balance has actually gone",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/accounts-receivable.ts",
						token: "clearWriteOffGate",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/accounts-receivable.ts",
						token: "recordWriteOff",
					},
				],
			},
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
			// All three write-offs enter one gate. A07 hardened the city-ledger one
			// and left the other two on free text because both had UI callers and
			// no reason-code picker existed; the picker exists now, and three
			// copies of the same control would have become three controls.
			{
				gateName: "write_off",
				guardsCommand: "ar.city_ledger.write_off",
				kind: "record",
				description:
					"The decision itself: a WRITE_OFF reason code, resolved and authorised, recorded with the amount that left the books — dual control says who, this says what was decided",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/write-off-gate.ts",
						token: 'gate_name: "write_off"',
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/write-off-gate.ts",
						token: "assertOverrideAuthority",
					},
					// The amount ladder — the half A07 could not build, because
					// `resolveSettings` lived inside core-service where billing had
					// no way to ask what a tenant's threshold was.
					{
						file: "Apps/billing-service/src/services/billing-commands/write-off-gate.ts",
						token: "requiredRoleForWriteOff",
					},
					{
						file: "Apps/billing-service/src/services/billing-commands/ara.ts",
						token: "clearWriteOffGate",
					},
				],
			},
			{
				gateName: "write_off",
				guardsCommand: "billing.suspense.write_off",
				kind: "record",
				description:
					"A suspense balance the property could not attribute to anyone, cleared to bad debt — the same stated reason and the same authority as any other write-off",
				evidence: [
					{
						file: "Apps/billing-service/src/services/billing-commands/suspense.ts",
						token: "clearWriteOffGate",
					},
				],
			},
			// The five commands under dual control (COMMAND_DUAL_CONTROL in
			// schema/src/api/command-approvals.ts). `billing.ar.write_off` and
			// `billing.date_roll.manual` are required by AR_COLLECTIONS and
			// NIGHT_AUDIT respectively — a command is claimed once, but the gate
			// in front of it belongs here with the rest of the set.
			{
				gateName: "dual_control",
				guardsCommand: "ar.city_ledger.write_off",
				description:
					"Recorded as an approval_requests row instead of dispatched",
				evidence: [
					{
						file: "schema/src/api/command-approvals.ts",
						token: '"ar.city_ledger.write_off"',
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "commandApproverRole",
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "pending_approval",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "approveCommandRequest",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "acceptCommand",
					},
				],
			},
			{
				gateName: "dual_control",
				guardsCommand: "billing.ar.write_off",
				description:
					"Recorded as an approval_requests row instead of dispatched",
				evidence: [
					{
						file: "schema/src/api/command-approvals.ts",
						token: '"billing.ar.write_off"',
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "commandApproverRole",
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "pending_approval",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "approveCommandRequest",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "acceptCommand",
					},
				],
			},
			{
				gateName: "dual_control",
				guardsCommand: "billing.suspense.write_off",
				description:
					"Recorded as an approval_requests row instead of dispatched",
				evidence: [
					{
						file: "schema/src/api/command-approvals.ts",
						token: '"billing.suspense.write_off"',
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "commandApproverRole",
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "pending_approval",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "approveCommandRequest",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "acceptCommand",
					},
				],
			},
			{
				gateName: "dual_control",
				guardsCommand: "billing.fiscal_period.reopen",
				description:
					"Recorded as an approval_requests row instead of dispatched",
				evidence: [
					{
						file: "schema/src/api/command-approvals.ts",
						token: '"billing.fiscal_period.reopen"',
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "commandApproverRole",
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "pending_approval",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "approveCommandRequest",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "acceptCommand",
					},
				],
			},
			{
				gateName: "dual_control",
				guardsCommand: "billing.date_roll.manual",
				description:
					"Recorded as an approval_requests row instead of dispatched",
				evidence: [
					{
						file: "schema/src/api/command-approvals.ts",
						token: '"billing.date_roll.manual"',
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "commandApproverRole",
					},
					{
						file: "Apps/command-center-shared/src/services/command-dispatch.ts",
						token: "pending_approval",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "approveCommandRequest",
					},
					{
						file: "Apps/api-gateway/src/command-center/command-approval-service.ts",
						token: "acceptCommand",
					},
				],
			},
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

/**
 * The controls a flow declares for one command, by name.
 *
 * Exists so a handler can read its own gate list from the registry instead of
 * restating it. Night audit held a fourth copy of its three gate names — a
 * literal array beside the checks, beside the manifest, beside the registry —
 * and a copy is where a control quietly stops matching what is declared.
 *
 * Defaults to `kind: "gate"`, the preconditions: a caller asking "what am I
 * bypassing?" means the things that refuse, not the record of the bypass.
 */
export const flowControlNames = (
	flowId: FlowId,
	options: { guardsCommand?: string; kind?: FlowControlKind } = {},
): readonly string[] => {
	const wanted = options.kind ?? "gate";
	return (FLOW_REGISTRY[flowId].requiredGates ?? [])
		.filter(
			(control) =>
				(control.kind ?? "gate") === wanted &&
				(options.guardsCommand === undefined ||
					control.guardsCommand === options.guardsCommand),
		)
		.map((control) => control.gateName);
};

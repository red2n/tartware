/**
 * DEV DOC
 * Module: api/command-permissions.ts
 * Purpose: Which role may run which command, and how one membership is granted
 *          or denied a single command regardless of its role.
 * Ownership: Schema package (single source of truth)
 *
 * Every command used to require `MANAGER`, which meant the clerk who checks a
 * guest in held the same authority as the one who writes off bad debt. The
 * declaration below is that missing distinction: one floor per command, on the
 * same five-rung ladder as every other role check in the product
 * (`TENANT_ROLE_PRIORITY`), so there is no second ordering to keep in step.
 *
 * The floor is deliberately a *default*, not a ceiling on policy: a property
 * that wants its night auditor to reopen a fiscal period grants that one
 * command on that one membership rather than promoting the person to OWNER.
 * That is what makes it safe to set the strict tiers strictly.
 */

import {
	type TenantRole,
	TENANT_ROLE_PRIORITY,
	tenantRoleAtLeast,
} from "../shared/enums.js";

/**
 * Routine operations — the work a front desk clerk or room attendant does on
 * every shift, and the postings that follow from it.
 *
 * Nothing here takes money away from the house or rewrites a closed record: a
 * charge is posted, a payment is taken, a folio is settled at its own balance,
 * a room changes status. Requiring a manager for these is what pushed
 * properties into sharing a manager login, which is worse than the tier it was
 * protecting.
 */
const STAFF_COMMANDS = [
	"reservation.create",
	"reservation.modify",
	"reservation.cancel",
	"reservation.check_in",
	"reservation.check_out",
	"reservation.assign_room",
	"reservation.unassign_room",
	"reservation.extend_stay",
	"reservation.add_deposit",
	"reservation.no_show",
	"reservation.walkin_checkin",
	"reservation.waitlist_add",
	"reservation.waitlist_convert",
	"reservation.send_quote",
	"reservation.convert_quote",
	"reservation.generate_registration_card",
	"guest.register",
	"guest.update_profile",
	"guest.update_contact",
	"guest.preference.update",
	"guest.consent.update",
	"rooms.status.update",
	"rooms.housekeeping_status.update",
	"rooms.features.update",
	"rooms.key.issue",
	"rooms.key.revoke",
	"housekeeping.task.create",
	"housekeeping.task.assign",
	"housekeeping.task.reassign",
	"housekeeping.task.complete",
	"housekeeping.task.add_note",
	"housekeeping.task.bulk_status",
	"billing.charge.post",
	"billing.payment.capture",
	"billing.payment.apply",
	"billing.payment.authorize",
	"billing.payment.authorize_increment",
	"billing.folio.close",
	"billing.folio.create",
	"billing.folio_window.create",
	"billing.invoice.create",
	"billing.express_checkout",
	"billing.cashier.open",
	"billing.cashier.close",
	"loyalty.program.enroll",
	"loyalty.points.earn",
	"loyalty.points.redeem",
	"notification.send",
	"metasearch.click.record",
] as const;

/**
 * Supervisory operations — anything that reverses, waives, overrides or applies
 * in bulk.
 *
 * The common thread is that a guest ends up better off than the tariff says, or
 * an action already taken is undone: refunds, voids, rate overrides, the three
 * WS-04 reversals, walking a guest, and every mass command (one mistake times
 * five hundred bookings). Configuration that steers pricing, distribution and
 * messaging sits here too — it is not a per-stay decision, but it is reversible
 * and it is a duty manager's job.
 */
const MANAGER_COMMANDS = [
	"reservation.reverse_check_in",
	"reservation.reverse_check_out",
	"reservation.reinstate",
	"reservation.room_move",
	"reservation.mass_cancel",
	"reservation.mass_check_in",
	"reservation.mass_update",
	"reservation.rate_override",
	"reservation.release_deposit",
	"reservation.batch_no_show",
	"reservation.expire",
	"reservation.walk_guest",
	"reservation.waitlist_offer",
	"reservation.waitlist_expire_sweep",
	"guest.merge",
	"guest.set_vip",
	"guest.set_loyalty",
	"guest.set_blacklist",
	"rooms.inventory.block",
	"rooms.inventory.release",
	"rooms.out_of_order",
	"rooms.out_of_service",
	"rooms.move",
	"housekeeping.task.reopen",
	"billing.payment.refund",
	"billing.payment.void",
	"billing.charge.void",
	"billing.charge.transfer",
	"billing.folio.transfer",
	"billing.folio.split",
	"billing.folio.merge",
	"billing.invoice.adjust",
	"billing.invoice.finalize",
	"billing.invoice.void",
	"billing.cashier.handover",
	"billing.deposit.record",
	"billing.deposit.transfer",
	"billing.deposit.refund",
	"billing.suspense.resolve",
	"billing.tax_exemption.apply",
	"billing.no_show.charge",
	"billing.late_checkout.charge",
	"billing.cancellation.penalty",
	"billing.chargeback.record",
	"billing.chargeback.update_status",
	"billing.routing_rule.create",
	"billing.routing_rule.update",
	"billing.routing_rule.delete",
	"billing.routing_rule.clone_template",
	"billing.event.setup",
	"billing.event.post_charges",
	"billing.pricing.evaluate",
	"billing.pricing.bulk_recommend",
	"billing.group.setup",
	"billing.group.checkout",
	"billing.group.add_reservation",
	"group.create",
	"group.add_rooms",
	"group.upload_rooming_list",
	"group.cutoff_enforce",
	"group.billing.setup",
	"group.check_in",
	"commission.calculate",
	"commission.approve",
	"commission.mark_paid",
	"commission.statement.generate",
	"loyalty.points.expire_sweep",
	"notification.template.create",
	"notification.template.update",
	"notification.template.delete",
	"notification.automated.create",
	"notification.automated.update",
	"notification.automated.delete",
	"operations.asset.update",
	"operations.inventory.adjust",
	"operations.schedule.create",
	"operations.schedule.update",
	"integration.ota.sync_request",
	"integration.ota.content_sync",
	"integration.ota.rate_push",
	"integration.webhook.retry",
	"metasearch.config.create",
	"metasearch.config.update",
	"analytics.metric.ingest",
	"analytics.report.schedule",
	"revenue.forecast.compute",
	"revenue.forecast.adjust",
	"revenue.forecast.evaluate",
	"revenue.pricing_rule.create",
	"revenue.pricing_rule.update",
	"revenue.pricing_rule.activate",
	"revenue.pricing_rule.deactivate",
	"revenue.demand.update",
	"revenue.demand.import_events",
	"revenue.competitor.record",
	"revenue.competitor.bulk_import",
	"revenue.competitor.configure_compset",
	"revenue.competitor.auto_collect",
	"revenue.competitive_response.configure",
	"revenue.restriction.set",
	"revenue.restriction.remove",
	"revenue.restriction.bulk_set",
	"revenue.hurdle_rate.set",
	"revenue.hurdle_rate.calculate",
	"revenue.goal.create",
	"revenue.goal.update",
	"revenue.goal.track_actual",
	"revenue.booking_pace.snapshot",
	"revenue.group.evaluate",
	"revenue.recommendation.generate",
	"revenue.recommendation.approve",
	"revenue.recommendation.reject",
	"revenue.recommendation.apply",
	"revenue.recommendation.bulk_approve",
	"ar.dunning.trigger",
	"ar.dunning.suppress",
	"ar.dispute.raise",
] as const;

/**
 * Controller operations — permanent movements in the ledger, and the
 * configuration that decides how money is recorded.
 *
 * These leave a trace no front-office action can correct: the general ledger
 * batch, the night audit, comps against a budget, tax configuration, AR account
 * terms, the fiscal period calendar. `guest.gdpr.erase` is here for the same
 * reason and not because it is financial — it destroys data irrecoverably.
 */
const ADMIN_COMMANDS = [
	"guest.gdpr.erase",
	"billing.night_audit.execute",
	"billing.ledger.post",
	"billing.gl_batch.export",
	"billing.credit_note.create",
	"billing.invoice.reopen",
	"billing.folio.reopen",
	"billing.comp.post",
	"billing.deposit.waive",
	"billing.ar.post",
	"billing.ar.apply_payment",
	"billing.ar.age",
	"billing.tax_config.create",
	"billing.tax_config.update",
	"billing.tax_config.delete",
	"billing.fiscal_period.create",
	"billing.fiscal_period.close",
	"billing.fiscal_period.lock",
	"integration.mapping.update",
	"revenue.pricing_rule.delete",
	"revenue.goal.delete",
	"revenue.daily_close.process",
	"ar.account.create",
	"ar.account.update_terms",
	"ar.city_ledger.transfer",
	"ar.aging.compute",
	"ar.dunning.escalate",
	"ar.payment.apply",
	"ar.payment.unapply",
	"ar.dispute.resolve",
	"ar.dispute.escalate",
] as const;

/**
 * The five commands that undo a completed accounting control.
 *
 * A closed period reopened, a business date moved without the audit that
 * justifies it, or a balance written off has left the books — there is no
 * higher authority to appeal to afterwards, so the authority has to be asked
 * for beforehand. This tier is small on purpose: an OWNER floor that covered
 * thirty commands would be routed around by handing out OWNER.
 */
const OWNER_COMMANDS = [
	"billing.fiscal_period.reopen",
	"billing.date_roll.manual",
	"billing.ar.write_off",
	"billing.suspense.write_off",
	"ar.city_ledger.write_off",
] as const;

const declare = (
	commands: readonly string[],
	role: TenantRole,
): [string, TenantRole][] => commands.map((name) => [name, role]);

/**
 * The declared floor for every command in the catalogue.
 *
 * Exhaustive against `registeredCommandNames` — a command with a payload
 * validator and no entry here is refused at the gateway rather than defaulted,
 * and `command-permissions.test.ts` fails the build before it ships.
 */
export const COMMAND_MIN_ROLE: ReadonlyMap<string, TenantRole> = new Map([
	...declare(STAFF_COMMANDS, "STAFF"),
	...declare(MANAGER_COMMANDS, "MANAGER"),
	...declare(ADMIN_COMMANDS, "ADMIN"),
	...declare(OWNER_COMMANDS, "OWNER"),
]);

/**
 * The lowest role that can run any command at all.
 *
 * Computed rather than written down: the command endpoints use it as their
 * route-level membership gate, and a hardcoded copy would silently stop
 * matching the day a command is declared below it.
 */
export const COMMAND_AUTHORITY_FLOOR: TenantRole = [
	...COMMAND_MIN_ROLE.values(),
].reduce(
	(lowest, role) =>
		TENANT_ROLE_PRIORITY[role] < TENANT_ROLE_PRIORITY[lowest] ? role : lowest,
	"OWNER" as TenantRole,
);

/** The declared floor for `commandName`, or `undefined` if it has none. */
export const commandMinRole = (
	commandName: string,
): TenantRole | undefined => COMMAND_MIN_ROLE.get(commandName);

/**
 * Per-membership overrides, read from `user_tenant_associations.permissions`.
 *
 * The column has been loaded into every request's auth context since the
 * beginning and read by nothing. This is the shape that gives it meaning,
 * namespaced under `commands` so it can share the object with whatever else
 * a tenant keeps there.
 *
 * ```json
 * { "commands": { "allow": ["billing.fiscal_period.reopen"], "deny": ["billing.charge.void"] } }
 * ```
 *
 * Exact command names only. A `billing.*` wildcard would be convenient and is
 * precisely the shortcut this finding exists to remove — the point is to say
 * which right is being handed over.
 */
export type CommandGrants = {
	allow: ReadonlySet<string>;
	deny: ReadonlySet<string>;
};

const EMPTY_GRANTS: CommandGrants = {
	allow: new Set<string>(),
	deny: new Set<string>(),
};

const stringSet = (value: unknown): Set<string> =>
	new Set(
		Array.isArray(value)
			? value.filter((entry): entry is string => typeof entry === "string")
			: [],
	);

/**
 * Read the grants out of a raw `permissions` JSONB value.
 *
 * Lenient by necessity — the column is free-form JSONB with no constraint, so
 * anything can be in it. Non-string entries are dropped rather than thrown on:
 * a malformed block yields no grants and the caller falls back to the role
 * floor, which is the conservative direction for `allow`. `deny` is a
 * segregation-of-duties control layered on top of that floor, never the only
 * thing standing between a role and a command.
 */
export const readCommandGrants = (permissions: unknown): CommandGrants => {
	if (typeof permissions !== "object" || permissions === null) {
		return EMPTY_GRANTS;
	}
	const commands = (permissions as { commands?: unknown }).commands;
	if (typeof commands !== "object" || commands === null) {
		return EMPTY_GRANTS;
	}
	const { allow, deny } = commands as { allow?: unknown; deny?: unknown };
	return { allow: stringSet(allow), deny: stringSet(deny) };
};

/** Why a command was admitted, or why it was refused. */
export type CommandAuthorityReason =
	| "ROLE"
	| "GRANT"
	| "UNDECLARED"
	| "ROLE_INSUFFICIENT"
	| "EXPLICIT_DENY";

export type CommandAuthorityDecision = {
	allowed: boolean;
	reason: CommandAuthorityReason;
	/** The declared floor, or `null` when the command declares none. */
	requiredRole: TenantRole | null;
};

/**
 * Decide whether this membership may run this command.
 *
 * Order matters and is the whole policy:
 *
 * 1. **An explicit deny wins over everything**, including OWNER. Denying a role
 *    a command it would otherwise hold is a deliberate act — the hotel that
 *    keeps its GM out of `billing.charge.void` is separating duties, not
 *    misconfiguring.
 * 2. **An undeclared command is refused.** A new command reaches this function
 *    before anyone has thought about who should run it; defaulting it to a
 *    middle tier is how the single-`MANAGER` model happened in the first place.
 * 3. **An explicit allow admits regardless of role**, which is what makes a
 *    strict floor workable without promoting people.
 * 4. Otherwise the role is compared against the floor.
 */
export const resolveCommandAuthority = (input: {
	commandName: string;
	role: string | null | undefined;
	permissions?: unknown;
}): CommandAuthorityDecision => {
	const requiredRole = COMMAND_MIN_ROLE.get(input.commandName) ?? null;
	const grants = readCommandGrants(input.permissions);

	if (grants.deny.has(input.commandName)) {
		return { allowed: false, reason: "EXPLICIT_DENY", requiredRole };
	}
	if (requiredRole === null) {
		return { allowed: false, reason: "UNDECLARED", requiredRole: null };
	}
	if (grants.allow.has(input.commandName)) {
		return { allowed: true, reason: "GRANT", requiredRole };
	}
	if (tenantRoleAtLeast(input.role, requiredRole)) {
		return { allowed: true, reason: "ROLE", requiredRole };
	}
	return { allowed: false, reason: "ROLE_INSUFFICIENT", requiredRole };
};

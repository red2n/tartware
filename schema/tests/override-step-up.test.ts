import { describe, expect, it } from "vitest";

import { COMMAND_DUAL_CONTROL } from "../src/api/command-approvals.js";
import { COMMAND_MIN_ROLE } from "../src/api/command-permissions.js";
import {
	evaluateStepUpGrant,
	isStepUpEligibleCommand,
	type OverrideStepUpGrant,
	type OverrideStepUpGrantRow,
	resolveOverrideAuthority,
	STEP_UP_TTL_SECONDS,
	stepUpEligibilityRefusal,
} from "../src/api/override-step-up.js";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const MINUTE = 60 * 1000;
const LATER = new Date(NOW.getTime() + 5 * MINUTE).toISOString();
const EARLIER = new Date(NOW.getTime() - MINUTE).toISOString();

const ROOM = "bd77c3a1-34dc-4afc-a9a2-122d9bf9d183";
const OTHER_ROOM = "c201f905-4c63-4388-8194-888c46fe7f5f";

const row = (
	over: Partial<OverrideStepUpGrantRow> = {},
): OverrideStepUpGrantRow => ({
	grant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
	tenant_id: "tenant-1",
	property_id: null,
	command_name: "reservation.room_move",
	entity_id: ROOM,
	supervisor_id: "supervisor-1",
	supervisor_role: "MANAGER",
	requested_by: "clerk-1",
	created_at: NOW.toISOString(),
	expires_at: LATER,
	consumed_at: null,
	consumed_command_id: null,
	...over,
});

const spend = (
	over: Partial<OverrideStepUpGrantRow> = {},
	args: {
		commandName?: string;
		entityId?: string | null;
		tenantId?: string;
	} = {},
) =>
	evaluateStepUpGrant({
		grant: row(over),
		tenantId: args.tenantId ?? "tenant-1",
		commandName: args.commandName ?? "reservation.room_move",
		entityId: args.entityId === undefined ? ROOM : args.entityId,
		now: NOW,
	});

describe("what may be stepped up", () => {
	it("refuses every dual-control command", () => {
		// This is the decision that keeps step-up from becoming a way around A04.
		// A credential typed at a counter is a second person, not deliberation.
		for (const name of COMMAND_DUAL_CONTROL.keys()) {
			expect(isStepUpEligibleCommand(name)).toBe(false);
			expect(stepUpEligibilityRefusal(name)?.code).toBe(
				"STEP_UP_COMMAND_NOT_ELIGIBLE",
			);
		}
	});

	it("tells the operator to use the queue instead, and names the role it needs", () => {
		const refusal = stepUpEligibilityRefusal("billing.ar.write_off");
		expect(refusal?.message).toContain("approval queue");
		expect(refusal?.message).toContain("OWNER");
	});

	it("refuses an undeclared command rather than defaulting it", () => {
		// A02's rule. A new command that is silently step-uppable is how the
		// single-MANAGER model happened the first time.
		expect(isStepUpEligibleCommand("reservation.teleport")).toBe(false);
	});

	it("allows the front-desk overrides the audit left standing", () => {
		for (const name of [
			"reservation.room_move",
			"reservation.check_in",
			"reservation.check_out",
			"reservation.rate_override",
			"reservation.reverse_check_in",
		]) {
			expect(COMMAND_MIN_ROLE.has(name)).toBe(true);
			expect(isStepUpEligibleCommand(name)).toBe(true);
		}
	});

	it("keeps the window short enough to mean 'standing here'", () => {
		expect(STEP_UP_TTL_SECONDS).toBeLessThanOrEqual(600);
	});
});

describe("spending a grant", () => {
	it("accepts the command and record it was given for", () => {
		expect(spend()).toEqual({ ok: true });
	});

	it("refuses one already used", () => {
		const verdict = spend({ consumed_at: NOW.toISOString() });
		expect(verdict).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_CONSUMED",
		});
	});

	it("refuses one that has expired", () => {
		expect(spend({ expires_at: EARLIER })).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_EXPIRED",
		});
	});

	it("refuses a different command", () => {
		// Authority for one operation, not for the next five minutes of whatever
		// the operator types.
		expect(spend({}, { commandName: "reservation.check_out" })).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_COMMAND_MISMATCH",
		});
	});

	it("refuses a different record", () => {
		// A supervisor authorising a room move for one booking must not move a
		// different guest.
		expect(spend({}, { entityId: OTHER_ROOM })).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_ENTITY_MISMATCH",
		});
	});

	it("refuses a grant bound to a record when the command names none", () => {
		expect(spend({}, { entityId: null })).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_ENTITY_MISMATCH",
		});
	});

	it("lets an unbound grant authorise a command that names no record", () => {
		// The few commands with no single natural subject. An unbound grant is not
		// a wildcard over bound ones — it is the only thing these can use.
		expect(spend({ entity_id: null }, { entityId: null })).toEqual({
			ok: true,
		});
	});

	it("refuses another tenant's grant", () => {
		expect(spend({}, { tenantId: "tenant-2" })).toMatchObject({
			ok: false,
			code: "STEP_UP_GRANT_TENANT_MISMATCH",
		});
	});

	it("reports consumed before expired, so a replay reads as a replay", () => {
		const verdict = spend({
			consumed_at: NOW.toISOString(),
			expires_at: EARLIER,
		});
		expect(verdict).toMatchObject({ code: "STEP_UP_GRANT_CONSUMED" });
	});
});

describe("whose authority the override is recorded under", () => {
	const grant = (role: string): OverrideStepUpGrant => ({
		grantId: "g1",
		supervisorId: "supervisor-1",
		supervisorRole: role as OverrideStepUpGrant["supervisorRole"],
		entityId: ROOM,
		grantedAt: NOW.toISOString(),
	});

	it("is the operator when nobody stepped up", () => {
		expect(resolveOverrideAuthority({ id: "clerk-1", role: "STAFF" })).toEqual({
			role: "STAFF",
			actorId: "clerk-1",
			viaStepUp: false,
			grantId: null,
		});
	});

	it("is the supervisor when they outrank the operator", () => {
		// "Recorded against the supervisor" is the half of OPERA's model that makes
		// the trail worth keeping.
		expect(
			resolveOverrideAuthority(
				{ id: "clerk-1", role: "STAFF" },
				grant("MANAGER"),
			),
		).toMatchObject({
			role: "MANAGER",
			actorId: "supervisor-1",
			viaStepUp: true,
			grantId: "g1",
		});
	});

	it("never lowers an authority the operator already held", () => {
		// A supervisor stepping up for a manager must not hand them less than they
		// walked in with.
		expect(
			resolveOverrideAuthority(
				{ id: "boss-1", role: "OWNER" },
				grant("MANAGER"),
			),
		).toMatchObject({ role: "OWNER", actorId: "boss-1", viaStepUp: false });
	});

	it("still reports the grant it was given, even when it changed nothing", () => {
		// So a reader can tell "no step-up" from "a step-up that was not needed".
		expect(
			resolveOverrideAuthority(
				{ id: "boss-1", role: "OWNER" },
				grant("MANAGER"),
			),
		).toMatchObject({ grantId: "g1" });
	});

	it("treats an unrecognised operator role as clearing nothing", () => {
		// SYSTEM_ACTOR_ROLE rides scheduler and replay envelopes, and is exactly the
		// actor a supervisor's grant should be able to outrank.
		expect(
			resolveOverrideAuthority(
				{ id: "sched", role: "SYSTEM" },
				grant("MANAGER"),
			),
		).toMatchObject({ role: "MANAGER", viaStepUp: true });
	});
});

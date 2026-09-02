import { describe, expect, it } from "vitest";

import {
	COMMAND_APPROVER_FLOOR,
	COMMAND_DUAL_CONTROL,
	commandApproverRole,
	evaluateApprovalAction,
	requiresDualControl,
} from "../src/api/command-approvals.js";
import { COMMAND_MIN_ROLE } from "../src/api/command-permissions.js";
import { registeredCommandNames } from "../src/command-validators.js";
import { TENANT_ROLE_PRIORITY, TenantRoleEnum } from "../src/shared/enums.js";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-08-30T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + HOUR).toISOString();
const EARLIER = new Date(NOW.getTime() - HOUR).toISOString();

describe("COMMAND_DUAL_CONTROL — what is deferred", () => {
	it("names only commands that exist", () => {
		const unknown = [...COMMAND_DUAL_CONTROL.keys()]
			.filter((name) => !registeredCommandNames.has(name))
			.sort();
		expect(unknown).toEqual([]);
	});

	it("uses only roles from TenantRoleEnum", () => {
		for (const [name, role] of COMMAND_DUAL_CONTROL) {
			expect(TenantRoleEnum.safeParse(role).success, name).toBe(true);
		}
	});

	it("never asks for an approver junior to the command's own floor", () => {
		// A second signature from someone who could not have run the command in
		// the first place is not a control.
		const inverted = [...COMMAND_DUAL_CONTROL.entries()]
			.filter(([name, approver]) => {
				const floor = COMMAND_MIN_ROLE.get(name);
				return (
					floor !== undefined &&
					TENANT_ROLE_PRIORITY[approver] < TENANT_ROLE_PRIORITY[floor]
				);
			})
			.map(([name]) => name);
		expect(inverted).toEqual([]);
	});

	it("declares a floor for every deferred command", () => {
		const undeclared = [...COMMAND_DUAL_CONTROL.keys()]
			.filter((name) => !COMMAND_MIN_ROLE.has(name))
			.sort();
		expect(undeclared).toEqual([]);
	});

	it("covers every command that undoes a completed accounting control", () => {
		for (const name of [
			"ar.city_ledger.write_off",
			"billing.ar.write_off",
			"billing.suspense.write_off",
			"billing.fiscal_period.reopen",
			"billing.date_roll.manual",
		]) {
			expect(requiresDualControl(name), name).toBe(true);
		}
	});

	it("is exactly the OWNER tier — the two declarations agree on the set", () => {
		// If they ever diverge it should be a deliberate edit here, not a
		// surprise: dual control and the OWNER floor are the same argument.
		const ownerTier = [...COMMAND_MIN_ROLE.entries()]
			.filter(([, role]) => role === "OWNER")
			.map(([name]) => name)
			.sort();
		expect([...COMMAND_DUAL_CONTROL.keys()].sort()).toEqual(ownerTier);
	});

	it("leaves reversible front-office work alone, however sensitive", () => {
		// A void, a folio reopen and a comp are all correctable inside the front
		// office. They carry a floor and, once A06/A08 land, a threshold — a
		// mandatory second signature on each is what turns a queue into a
		// rubber stamp.
		for (const name of [
			"reservation.check_in",
			"billing.charge.post",
			"billing.charge.void",
			"billing.folio.reopen",
			"billing.comp.post",
			"rooms.status.update",
		]) {
			expect(requiresDualControl(name), name).toBe(false);
			expect(commandApproverRole(name), name).toBeUndefined();
		}
	});

	it("computes the approver floor rather than restating it", () => {
		const lowest = [...COMMAND_DUAL_CONTROL.values()].reduce((low, role) =>
			TENANT_ROLE_PRIORITY[role] < TENANT_ROLE_PRIORITY[low] ? role : low,
		);
		expect(COMMAND_APPROVER_FLOOR).toBe(lowest);
		// And it keeps a viewer off the endpoint regardless.
		expect(TENANT_ROLE_PRIORITY[COMMAND_APPROVER_FLOOR]).toBeGreaterThan(
			TENANT_ROLE_PRIORITY.VIEWER,
		);
	});
});

describe("evaluateApprovalAction — the four rules", () => {
	const base = {
		action: "APPROVE" as const,
		status: "PENDING",
		expiresAt: LATER,
		requestedBy: "clerk",
		requiredRole: "OWNER",
		actorId: "owner",
		actorRole: "OWNER",
		now: NOW,
	};

	it("admits a second person who holds the role", () => {
		expect(evaluateApprovalAction(base)).toEqual({ ok: true });
	});

	it("refuses a request that is not pending", () => {
		const decision = evaluateApprovalAction({ ...base, status: "APPROVED" });
		expect(decision).toMatchObject({ ok: false, code: "APPROVAL_NOT_PENDING" });
	});

	it("refuses an expired request even for an owner", () => {
		const decision = evaluateApprovalAction({ ...base, expiresAt: EARLIER });
		expect(decision).toMatchObject({ ok: false, code: "APPROVAL_EXPIRED" });
	});

	it("refuses the requester approving their own request", () => {
		const decision = evaluateApprovalAction({
			...base,
			actorId: "clerk",
			actorRole: "OWNER",
		});
		expect(decision).toMatchObject({
			ok: false,
			code: "SELF_APPROVAL_FORBIDDEN",
		});
	});

	it("refuses an approver below required_role", () => {
		const decision = evaluateApprovalAction({ ...base, actorRole: "MANAGER" });
		expect(decision).toMatchObject({
			ok: false,
			code: "APPROVER_ROLE_INSUFFICIENT",
		});
	});

	it("fails closed on a stored role that is not a role", () => {
		const decision = evaluateApprovalAction({
			...base,
			requiredRole: "GM_OVERRIDE",
		});
		expect(decision).toMatchObject({
			ok: false,
			code: "APPROVER_ROLE_INSUFFICIENT",
		});
	});

	it("does not gate a rejection on role — declining is not an escalation", () => {
		const decision = evaluateApprovalAction({
			...base,
			action: "REJECT",
			actorRole: "STAFF",
		});
		expect(decision).toEqual({ ok: true });
	});

	it("still refuses a self-rejection", () => {
		const decision = evaluateApprovalAction({
			...base,
			action: "REJECT",
			actorId: "clerk",
		});
		expect(decision).toMatchObject({
			ok: false,
			code: "SELF_APPROVAL_FORBIDDEN",
		});
	});

	it("treats the expiry instant itself as expired", () => {
		const decision = evaluateApprovalAction({
			...base,
			expiresAt: NOW.toISOString(),
		});
		expect(decision).toMatchObject({ ok: false, code: "APPROVAL_EXPIRED" });
	});
});

import { describe, expect, it } from "vitest";

import {
	COMMAND_AUTHORITY_FLOOR,
	COMMAND_MIN_ROLE,
	commandMinRole,
	readCommandGrants,
	resolveCommandAuthority,
} from "../src/api/command-permissions.js";
import { registeredCommandNames } from "../src/command-validators.js";
import { TENANT_ROLE_PRIORITY, TenantRoleEnum } from "../src/shared/enums.js";

describe("COMMAND_MIN_ROLE — coverage", () => {
	it("declares a floor for every command that has a payload validator", () => {
		const undeclared = [...registeredCommandNames]
			.filter((name) => !COMMAND_MIN_ROLE.has(name))
			.sort();
		expect(undeclared).toEqual([]);
	});

	it("declares no command that has no payload validator", () => {
		const orphaned = [...COMMAND_MIN_ROLE.keys()]
			.filter((name) => !registeredCommandNames.has(name))
			.sort();
		expect(orphaned).toEqual([]);
	});

	it("uses only roles from TenantRoleEnum", () => {
		for (const [name, role] of COMMAND_MIN_ROLE) {
			expect(TenantRoleEnum.safeParse(role).success, name).toBe(true);
		}
	});

	it("never puts a command within reach of VIEWER", () => {
		// A read-only role that can dispatch a write is not a read-only role.
		const viewable = [...COMMAND_MIN_ROLE.entries()]
			.filter(
				([, role]) => TENANT_ROLE_PRIORITY[role] <= TENANT_ROLE_PRIORITY.VIEWER,
			)
			.map(([name]) => name);
		expect(viewable).toEqual([]);
	});
});

describe("COMMAND_AUTHORITY_FLOOR", () => {
	it("is the lowest role any command declares", () => {
		const lowest = Math.min(
			...[...COMMAND_MIN_ROLE.values()].map((r) => TENANT_ROLE_PRIORITY[r]),
		);
		expect(TENANT_ROLE_PRIORITY[COMMAND_AUTHORITY_FLOOR]).toBe(lowest);
	});

	it("admits no command below itself", () => {
		// The command routes gate on this value, so a command declared below it
		// would be unreachable through its own endpoint.
		const below = [...COMMAND_MIN_ROLE.entries()].filter(
			([, role]) =>
				TENANT_ROLE_PRIORITY[role] <
				TENANT_ROLE_PRIORITY[COMMAND_AUTHORITY_FLOOR],
		);
		expect(below).toEqual([]);
	});
});

describe("the tiers say what the finding said they should", () => {
	it("does not hold routine front desk work to a manager", () => {
		for (const name of [
			"reservation.check_in",
			"reservation.check_out",
			"billing.charge.post",
			"rooms.status.update",
			"housekeeping.task.complete",
		]) {
			expect(commandMinRole(name), name).toBe("STAFF");
		}
	});

	it("puts every reversal and override above the clerk who did the thing", () => {
		for (const name of [
			"reservation.reverse_check_in",
			"reservation.reverse_check_out",
			"reservation.rate_override",
			"reservation.walk_guest",
			"billing.charge.void",
			"billing.payment.refund",
		]) {
			expect(commandMinRole(name), name).toBe("MANAGER");
		}
	});

	it("keeps the ledger commands the audit named out of a manager's hands", () => {
		for (const name of [
			"billing.comp.post",
			"billing.deposit.waive",
			"billing.folio.reopen",
		]) {
			expect(commandMinRole(name), name).toBe("ADMIN");
		}
	});

	it("puts undoing a completed accounting control at the top", () => {
		for (const name of [
			"billing.fiscal_period.reopen",
			"ar.city_ledger.write_off",
			"billing.ar.write_off",
		]) {
			expect(commandMinRole(name), name).toBe("OWNER");
		}
	});
});

describe("resolveCommandAuthority", () => {
	const at = (role: string, commandName: string, permissions?: unknown) =>
		resolveCommandAuthority({ commandName, role, permissions });

	it("admits a role at the floor", () => {
		expect(at("STAFF", "reservation.check_in")).toEqual({
			allowed: true,
			reason: "ROLE",
			requiredRole: "STAFF",
		});
	});

	it("admits a role above the floor", () => {
		expect(at("OWNER", "reservation.check_in").allowed).toBe(true);
	});

	it("refuses a role below the floor", () => {
		expect(at("STAFF", "ar.city_ledger.write_off")).toEqual({
			allowed: false,
			reason: "ROLE_INSUFFICIENT",
			requiredRole: "OWNER",
		});
	});

	it("refuses a command with no declared floor", () => {
		// The failure mode this exists for: a command lands with a validator and
		// a catalogue row but no decision about who may run it.
		expect(at("OWNER", "billing.something.new")).toEqual({
			allowed: false,
			reason: "UNDECLARED",
			requiredRole: null,
		});
	});

	it("refuses an unrecognised role rather than scoring it zero", () => {
		expect(at("SUPERVISOR", "reservation.check_in").allowed).toBe(false);
		expect(at(null as unknown as string, "reservation.check_in").allowed).toBe(
			false,
		);
	});

	it("admits a granted command the role could not reach", () => {
		const grants = {
			commands: { allow: ["billing.fiscal_period.reopen"] },
		};
		expect(at("MANAGER", "billing.fiscal_period.reopen", grants)).toEqual({
			allowed: true,
			reason: "GRANT",
			requiredRole: "OWNER",
		});
	});

	it("grants one command, not its neighbours", () => {
		const grants = {
			commands: { allow: ["billing.fiscal_period.reopen"] },
		};
		expect(at("MANAGER", "billing.fiscal_period.lock", grants).allowed).toBe(
			false,
		);
		expect(at("MANAGER", "ar.city_ledger.write_off", grants).allowed).toBe(
			false,
		);
	});

	it("does not read a wildcard as a grant", () => {
		const grants = { commands: { allow: ["billing.*", "*"] } };
		expect(at("STAFF", "billing.comp.post", grants).allowed).toBe(false);
	});

	it("lets a deny beat the role, including OWNER", () => {
		const grants = { commands: { deny: ["billing.charge.void"] } };
		expect(at("OWNER", "billing.charge.void", grants)).toEqual({
			allowed: false,
			reason: "EXPLICIT_DENY",
			requiredRole: "MANAGER",
		});
	});

	it("lets a deny beat a grant of the same command", () => {
		const grants = {
			commands: {
				allow: ["billing.charge.void"],
				deny: ["billing.charge.void"],
			},
		};
		expect(at("STAFF", "billing.charge.void", grants).reason).toBe(
			"EXPLICIT_DENY",
		);
	});
});

describe("readCommandGrants", () => {
	it("reads nothing out of the shapes the column actually holds", () => {
		for (const value of [null, undefined, {}, [], "", 7, { commands: 3 }]) {
			const grants = readCommandGrants(value);
			expect(grants.allow.size, JSON.stringify(value)).toBe(0);
			expect(grants.deny.size, JSON.stringify(value)).toBe(0);
		}
	});

	it("keeps the string entries and drops the rest", () => {
		const grants = readCommandGrants({
			commands: { allow: ["billing.comp.post", 42, null, { a: 1 }] },
		});
		expect([...grants.allow]).toEqual(["billing.comp.post"]);
	});

	it("ignores unrelated keys already living in the column", () => {
		const grants = readCommandGrants({
			screens: ["front-desk"],
			commands: { deny: ["billing.charge.void"] },
		});
		expect([...grants.deny]).toEqual(["billing.charge.void"]);
	});
});

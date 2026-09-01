/**
 * Thresholds: authorizing the *size* of an override, not only the act.
 *
 * A02 gave every command a floor and A05–A07 gave the overrides a reason code
 * whose `approval_level` the acting role must clear. Both authorize the act.
 * Until now nothing looked at the number, so a 5% courtesy and a 90% giveaway
 * were the same command cleared by the same role — which is what A06 and A07
 * both closed as "half done" on.
 *
 * The two hard parts are here rather than in a handler: the ladder is a JSON
 * blob a human edits, and it is written in a vocabulary the product's role enum
 * does not contain.
 */

import { describe, expect, it } from "vitest";

import {
	actorClearsThreshold,
	approverRoleMinRole,
	DEFAULT_RATE_APPROVAL_POLICY,
	DEFAULT_WRITE_OFF_APPROVAL_POLICY,
	discountPercent,
	RateApprovalPolicySchema,
	requiredRoleForDiscount,
	requiredRoleForWriteOff,
	WriteOffApprovalPolicySchema,
} from "../src/api/override-thresholds.js";

describe("the approver vocabulary is translated, never compared", () => {
	it("maps the catalogue's org-chart roles onto membership roles", () => {
		expect(approverRoleMinRole("REVENUE_MANAGER")).toBe("MANAGER");
		expect(approverRoleMinRole("GENERAL_MANAGER")).toBe("OWNER");
		expect(approverRoleMinRole("FINANCE_DIRECTOR")).toBe("ADMIN");
	});

	it("rounds up where the product has no equivalent tier", () => {
		// There is no SUPERVISOR membership. Rounding down to "anyone" would make
		// the lowest rung of every ladder meaningless.
		expect(approverRoleMinRole("SUPERVISOR")).toBe("MANAGER");
		expect(approverRoleMinRole("DIRECTOR")).toBe("ADMIN");
	});

	it("accepts a policy written in the product's own roles", () => {
		expect(approverRoleMinRole("owner")).toBe("OWNER");
		expect(approverRoleMinRole(" Admin ")).toBe("ADMIN");
	});

	it("throws on a name no mapping covers, rather than reading it as no demand", () => {
		// A settings blob is hand-edited far more often than a reason code is, so
		// a typo must not be the way past every threshold in the product.
		expect(() => approverRoleMinRole("REGIONAL_VP")).toThrow(
			/Unknown approver role/,
		);
	});
});

describe("the discount ladder", () => {
	it("demands nothing below the lowest rung", () => {
		expect(requiredRoleForDiscount(DEFAULT_RATE_APPROVAL_POLICY, 5)).toBeNull();
	});

	it("applies a rung at its percent, not above it", () => {
		// "10% needs a revenue manager" reads as 10% already being their decision.
		expect(requiredRoleForDiscount(DEFAULT_RATE_APPROVAL_POLICY, 10)).toBe(
			"MANAGER",
		);
	});

	it("takes the highest rung reached, not the first listed", () => {
		expect(requiredRoleForDiscount(DEFAULT_RATE_APPROVAL_POLICY, 35)).toBe(
			"OWNER",
		);
	});

	it("is not fooled by a ladder listed out of order", () => {
		// Small, hand-edited arrays. Assuming they arrive sorted would let a 20%
		// rung placed above a 10% one quietly demote every large discount.
		const policy = RateApprovalPolicySchema.parse({
			discountApprovalThresholds: [
				{ percent: 20, approverRole: "GENERAL_MANAGER" },
				{ percent: 10, approverRole: "REVENUE_MANAGER" },
			],
		});
		expect(requiredRoleForDiscount(policy, 25)).toBe("OWNER");
	});

	it("demands nothing when the rate goes up", () => {
		expect(requiredRoleForDiscount(DEFAULT_RATE_APPROVAL_POLICY, 0)).toBeNull();
		expect(
			requiredRoleForDiscount(DEFAULT_RATE_APPROVAL_POLICY, -30),
		).toBeNull();
	});
});

describe("the write-off ladder", () => {
	it("grades by amount, mirroring the seeded WRITE_OFF codes", () => {
		expect(requiredRoleForWriteOff(DEFAULT_WRITE_OFF_APPROVAL_POLICY, 40)).toBe(
			"MANAGER",
		);
		expect(
			requiredRoleForWriteOff(DEFAULT_WRITE_OFF_APPROVAL_POLICY, 2_500),
		).toBe("ADMIN");
		expect(
			requiredRoleForWriteOff(DEFAULT_WRITE_OFF_APPROVAL_POLICY, 40_000),
		).toBe("OWNER");
	});

	it("demands nothing for a zero or negative amount", () => {
		expect(
			requiredRoleForWriteOff(DEFAULT_WRITE_OFF_APPROVAL_POLICY, 0),
		).toBeNull();
	});
});

describe("measuring the discount", () => {
	it("reports how far below the original the new amount sits", () => {
		expect(discountPercent(200, 150)).toBeCloseTo(25);
	});

	it("reports zero for a booking with no prior amount", () => {
		// A quote with no price has no discount to measure, and inventing one
		// would refuse legitimate overrides at random.
		expect(discountPercent(null, 150)).toBe(0);
		expect(discountPercent(0, 150)).toBe(0);
	});

	it("reports zero when the rate goes up", () => {
		expect(discountPercent(150, 200)).toBe(0);
	});
});

describe("clearing a threshold", () => {
	it("lets anyone past a threshold that demanded nothing", () => {
		expect(actorClearsThreshold("STAFF", null)).toBe(true);
	});

	it("treats the ladder as a floor, not an equality", () => {
		expect(actorClearsThreshold("OWNER", "MANAGER")).toBe(true);
		expect(actorClearsThreshold("STAFF", "MANAGER")).toBe(false);
	});

	it("refuses a scheduler or replay", () => {
		// SYSTEM_ACTOR_ROLE is deliberately not a member of TenantRoleEnum, so it
		// scores nothing — an unattended actor must not clear a ladder no human
		// was asked about.
		expect(actorClearsThreshold("SYSTEM", "MANAGER")).toBe(false);
		expect(actorClearsThreshold(null, "MANAGER")).toBe(false);
	});
});

describe("the policy blobs a human edits", () => {
	it("parses a policy that sets only one field, without blanking the ladder", () => {
		const policy = RateApprovalPolicySchema.parse({ compNightsLimit: 3 });
		expect(policy.discountApprovalThresholds).toEqual([]);
		expect(policy.compNightsLimit).toBe(3);
	});

	it("refuses a ladder whose rungs are the wrong shape", () => {
		expect(
			RateApprovalPolicySchema.safeParse({
				discountApprovalThresholds: [{ percent: 10 }],
			}).success,
		).toBe(false);
	});

	it("refuses a percentage outside 0–100", () => {
		expect(
			RateApprovalPolicySchema.safeParse({
				discountApprovalThresholds: [{ percent: 140, approverRole: "OWNER" }],
			}).success,
		).toBe(false);
	});

	it("parses an amount ladder", () => {
		expect(
			WriteOffApprovalPolicySchema.parse({
				amountApprovalThresholds: [{ amount: "500", approverRole: "MANAGER" }],
			}).amountApprovalThresholds[0]?.amount,
		).toBe(500);
	});
});

describe("the shipped defaults are what the catalogue shows", () => {
	it("keeps the numbers the catalogue has always declared", () => {
		// The catalogue imports these rather than restating them; this pins the
		// values so a change is deliberate rather than incidental.
		expect(DEFAULT_RATE_APPROVAL_POLICY.discountApprovalThresholds).toEqual([
			{ percent: 10, approverRole: "REVENUE_MANAGER" },
			{ percent: 20, approverRole: "GENERAL_MANAGER" },
		]);
		expect(DEFAULT_RATE_APPROVAL_POLICY.compNightsLimit).toBe(2);
		expect(
			DEFAULT_RATE_APPROVAL_POLICY.refundPolicy?.requireApprovalAbove,
		).toBe(500);
	});

	it("parses as its own schema — a default that did not would refuse every override", () => {
		expect(
			RateApprovalPolicySchema.safeParse(DEFAULT_RATE_APPROVAL_POLICY).success,
		).toBe(true);
		expect(
			WriteOffApprovalPolicySchema.safeParse(DEFAULT_WRITE_OFF_APPROVAL_POLICY)
				.success,
		).toBe(true);
	});

	it("names only roles the translation covers", () => {
		for (const rung of DEFAULT_RATE_APPROVAL_POLICY.discountApprovalThresholds) {
			expect(() => approverRoleMinRole(rung.approverRole)).not.toThrow();
		}
		for (const rung of DEFAULT_WRITE_OFF_APPROVAL_POLICY.amountApprovalThresholds) {
			expect(() => approverRoleMinRole(rung.approverRole)).not.toThrow();
		}
	});
});

import { describe, expect, it } from "vitest";

import {
	describeRefusals,
	evaluateRestrictions,
	type NightInventory,
	type RestrictionRule,
	type StayRestrictionQuery,
} from "../src/api/restrictions.js";

const d = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Arrive the 10th, depart the 13th — three nights: 10th, 11th, 12th. */
const stay: StayRestrictionQuery = {
	arrival: d("2026-09-10"),
	departure: d("2026-09-13"),
	booking_date: d("2026-09-01"),
	rooms_requested: 1,
};

const rule = (over: Partial<RestrictionRule>): RestrictionRule => ({
	scope: "PROPERTY",
	restriction_type: "CLOSED",
	stay_date: d("2026-09-10"),
	...over,
});

describe("evaluateRestrictions — nothing configured", () => {
	it("allows a stay when there are no rules at all", () => {
		expect(evaluateRestrictions(stay, [])).toEqual({
			allowed: true,
			refusals: [],
		});
	});

	it("allows a stay when the rules cover other dates", () => {
		const rules = [
			rule({ restriction_type: "CTA", stay_date: d("2026-09-20") }),
		];
		expect(evaluateRestrictions(stay, rules).allowed).toBe(true);
	});
});

describe("closed to arrival / departure", () => {
	it("refuses arrival on a CTA date", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CTA", stay_date: d("2026-09-10") }),
		]);
		expect(result.allowed).toBe(false);
		expect(result.refusals[0]!.code).toBe("RESTRICTION_CTA");
	});

	it("ignores a CTA on a night the guest only stays through", () => {
		// CTA closes arrivals, not occupancy — the 11th is mid-stay.
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CTA", stay_date: d("2026-09-11") }),
		]);
		expect(result.allowed).toBe(true);
	});

	it("refuses departure on a CTD date", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CTD", stay_date: d("2026-09-13") }),
		]);
		expect(result.allowed).toBe(false);
		expect(result.refusals[0]!.code).toBe("RESTRICTION_CTD");
	});

	it("does not treat the departure date as an occupied night for CLOSED", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CLOSED", stay_date: d("2026-09-13") }),
		]);
		expect(result.allowed).toBe(true);
	});

	it("refuses when any occupied night is closed", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CLOSED", stay_date: d("2026-09-11") }),
		]);
		expect(result.refusals[0]!.code).toBe("RESTRICTION_CLOSED");
	});
});

describe("length of stay", () => {
	it("refuses a stay shorter than min-LOS and reports both numbers", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "MIN_LOS", value: 5 }),
		]);
		expect(result.allowed).toBe(false);
		expect(result.refusals[0]).toMatchObject({
			code: "RESTRICTION_MIN_LOS",
			required: 5,
			actual: 3,
		});
	});

	it("allows a stay exactly at min-LOS", () => {
		expect(
			evaluateRestrictions(stay, [
				rule({ restriction_type: "MIN_LOS", value: 3 }),
			]).allowed,
		).toBe(true);
	});

	it("refuses a stay longer than max-LOS", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "MAX_LOS", value: 2 }),
		]);
		expect(result.refusals[0]!.code).toBe("RESTRICTION_MAX_LOS");
	});

	it("evaluates LOS at arrival, not on later nights", () => {
		// A min-LOS on the 12th must not lengthen a stay that began on the 10th.
		const result = evaluateRestrictions(stay, [
			rule({
				restriction_type: "MIN_LOS",
				value: 7,
				stay_date: d("2026-09-12"),
			}),
		]);
		expect(result.allowed).toBe(true);
	});
});

describe("advance windows", () => {
	it("refuses a booking made inside the minimum advance window", () => {
		const result = evaluateRestrictions(
			{ ...stay, booking_date: d("2026-09-09") },
			[rule({ restriction_type: "MIN_ADVANCE", value: 7 })],
		);
		expect(result.refusals[0]).toMatchObject({
			code: "RESTRICTION_ADVANCE",
			required: 7,
			actual: 1,
		});
	});

	it("refuses a booking made further ahead than the maximum window", () => {
		const result = evaluateRestrictions(
			{ ...stay, booking_date: d("2026-01-01") },
			[rule({ restriction_type: "MAX_ADVANCE", value: 30 })],
		);
		expect(result.refusals[0]!.code).toBe("RESTRICTION_ADVANCE");
	});

	it("measures the window from the business date, not from now", () => {
		const result = evaluateRestrictions(
			{ ...stay, booking_date: d("2026-09-03") },
			[rule({ restriction_type: "MIN_ADVANCE", value: 7 })],
		);
		expect(result.allowed).toBe(true);
	});
});

describe("scope precedence", () => {
	it("lets a rate-scoped rule override a property-wide one", () => {
		const result = evaluateRestrictions(stay, [
			rule({ scope: "PROPERTY", restriction_type: "MIN_LOS", value: 5 }),
			rule({ scope: "RATE", restriction_type: "MIN_LOS", value: 2 }),
		]);
		expect(result.allowed).toBe(true);
	});

	it("lets a channel-scoped rule override a rate one", () => {
		const result = evaluateRestrictions(stay, [
			rule({ scope: "RATE", restriction_type: "MIN_LOS", value: 2 }),
			rule({ scope: "CHANNEL", restriction_type: "MIN_LOS", value: 4 }),
		]);
		expect(result.allowed).toBe(false);
		expect(result.refusals[0]!.scope).toBe("CHANNEL");
	});

	it("keeps precedence per date, so a rule on one night does not shadow another", () => {
		const result = evaluateRestrictions(stay, [
			rule({
				scope: "RATE",
				restriction_type: "CLOSED",
				stay_date: d("2026-09-11"),
			}),
		]);
		expect(result.refusals).toHaveLength(1);
		expect(result.refusals[0]!.stay_date).toBe("2026-09-11");
	});
});

describe("sellable ceiling", () => {
	const inventory = (over: Partial<NightInventory>[]): NightInventory[] =>
		over.map((o) => ({
			stay_date: d("2026-09-10"),
			rooms_to_sell: 10,
			rooms_sold: 0,
			...o,
		}));

	it("allows a booking that fits the published ceiling", () => {
		const result = evaluateRestrictions(
			{ ...stay, rooms_requested: 3 },
			[],
			inventory([{ rooms_to_sell: 10, rooms_sold: 5 }]),
		);
		expect(result.allowed).toBe(true);
	});

	it("refuses a booking that would exceed rooms_to_sell", () => {
		const result = evaluateRestrictions(
			{ ...stay, rooms_requested: 3 },
			[],
			inventory([{ rooms_to_sell: 10, rooms_sold: 8 }]),
		);
		expect(result.refusals[0]).toMatchObject({
			code: "RESTRICTION_SELL_LIMIT",
			required: 10,
			actual: 11,
			source: "rate_calendar",
		});
	});

	it("counts the rooms requested, not the reservations", () => {
		// One booking of three rooms consumes three, which is the whole point of
		// checking this after WS-01.
		const one = evaluateRestrictions(
			{ ...stay, rooms_requested: 1 },
			[],
			inventory([{ rooms_to_sell: 10, rooms_sold: 9 }]),
		);
		const three = evaluateRestrictions(
			{ ...stay, rooms_requested: 3 },
			[],
			inventory([{ rooms_to_sell: 10, rooms_sold: 9 }]),
		);
		expect(one.allowed).toBe(true);
		expect(three.allowed).toBe(false);
	});

	it("treats a night with no published ceiling as unconstrained", () => {
		const result = evaluateRestrictions(
			{ ...stay, rooms_requested: 50 },
			[],
			inventory([{ rooms_to_sell: null, rooms_sold: 40 }]),
		);
		expect(result.allowed).toBe(true);
	});

	it("lets a scoped SELL_LIMIT override the rate calendar's ceiling", () => {
		const result = evaluateRestrictions(
			{ ...stay, rooms_requested: 2 },
			[rule({ scope: "CHANNEL", restriction_type: "SELL_LIMIT", value: 4 })],
			inventory([{ rooms_to_sell: 100, rooms_sold: 3 }]),
		);
		expect(result.refusals[0]).toMatchObject({
			code: "RESTRICTION_SELL_LIMIT",
			scope: "CHANNEL",
			required: 4,
		});
	});
});

describe("reporting", () => {
	it("returns every applicable refusal, not just the first", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "CTA" }),
			rule({ restriction_type: "MIN_LOS", value: 5 }),
		]);
		expect(result.refusals.map((r) => r.code).sort()).toEqual([
			"RESTRICTION_CTA",
			"RESTRICTION_MIN_LOS",
		]);
	});

	it("summarises refusals into one readable line", () => {
		const result = evaluateRestrictions(stay, [
			rule({ restriction_type: "MIN_LOS", value: 5 }),
		]);
		expect(describeRefusals(result.refusals)).toContain(
			"minimum stay of 5 nights",
		);
	});
});

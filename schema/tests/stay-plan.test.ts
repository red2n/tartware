import { describe, expect, it } from "vitest";

import {
	chargeableStayTotal,
	expandStayPlan,
	StayPlanError,
} from "../src/api/stay-plan.js";

const defaults = {
	check_in_date: new Date("2026-09-10T00:00:00Z"),
	check_out_date: new Date("2026-09-13T00:00:00Z"),
	room_type_id: "11111111-1111-4111-8111-111111111111",
	guest_id: "22222222-2222-4222-8222-222222222222",
	currency: "usd",
	total_amount: 300,
};

const dates = (nights: { stay_date: Date }[]): string[] =>
	nights.map((night) => night.stay_date.toISOString().slice(0, 10));

describe("expandStayPlan — no rooms supplied", () => {
	it("produces one room covering every night of the window", () => {
		const plan = expandStayPlan(defaults);

		expect(plan.rooms).toHaveLength(1);
		expect(dates(plan.rooms[0]!.nights)).toEqual([
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
		]);
		// Never the departure date.
		expect(dates(plan.rooms[0]!.nights)).not.toContain("2026-09-13");
	});

	it("splits total_amount across the nights and normalises the currency", () => {
		const plan = expandStayPlan(defaults);

		expect(plan.rooms[0]!.nights.map((n) => n.rate_amount)).toEqual([
			100, 100, 100,
		]);
		expect(plan.total_amount).toBe(300);
		expect(plan.rooms[0]!.nights[0]!.currency).toBe("USD");
	});

	it("puts the rounding remainder on the earliest nights so the parts sum back", () => {
		const plan = expandStayPlan({ ...defaults, total_amount: 100 });
		const amounts = plan.rooms[0]!.nights.map((n) => n.rate_amount);

		expect(amounts).toEqual([33.34, 33.33, 33.33]);
		expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(
			100,
			2,
		);
	});

	it("inherits the reservation's room type and guest", () => {
		const room = expandStayPlan(defaults).rooms[0]!;

		expect(room.room_type_id).toBe(defaults.room_type_id);
		expect(room.guest_id).toBe(defaults.guest_id);
		expect(room.room_sequence).toBe(1);
	});
});

describe("expandStayPlan — multiple rooms", () => {
	it("numbers rooms in array order and shares the total across all room-nights", () => {
		const plan = expandStayPlan({ ...defaults, total_amount: 600 }, [{}, {}]);

		expect(plan.rooms.map((room) => room.room_sequence)).toEqual([1, 2]);
		expect(plan.rooms.every((room) => room.nights.length === 3)).toBe(true);
		expect(plan.total_amount).toBe(600);
		expect(plan.rooms[0]!.total_amount).toBe(300);
	});

	it("lets one room price itself while the rest absorb the remaining total", () => {
		const plan = expandStayPlan({ ...defaults, total_amount: 500 }, [
			{
				nights: [
					{ stay_date: new Date("2026-09-10T00:00:00Z"), rate_amount: 100 },
					{ stay_date: new Date("2026-09-11T00:00:00Z"), rate_amount: 150 },
					{ stay_date: new Date("2026-09-12T00:00:00Z"), rate_amount: 50 },
				],
			},
			{},
		]);

		// Split-rate stay: the same room changes price mid-stay.
		expect(plan.rooms[0]!.nights.map((n) => n.rate_amount)).toEqual([
			100, 150, 50,
		]);
		expect(plan.rooms[0]!.total_amount).toBe(300);
		// 500 quoted − 300 priced by hand = 200 spread over room 2's three nights.
		expect(plan.rooms[1]!.total_amount).toBe(200);
	});

	it("keeps per-room occupancy independent of the reservation's", () => {
		const plan = expandStayPlan({ ...defaults, adults: 2 }, [
			{ adults: 1 },
			{ adults: 3, children: 2 },
		]);

		expect(plan.rooms[0]!.adults).toBe(1);
		expect(plan.rooms[1]!.adults).toBe(3);
		expect(plan.rooms[1]!.children).toBe(2);
	});

	it("derives each room's own window from its nights", () => {
		const plan = expandStayPlan(defaults, [
			{
				nights: [
					{ stay_date: new Date("2026-09-11T00:00:00Z"), rate_amount: 90 },
				],
			},
		]);

		expect(plan.rooms[0]!.check_in_date.toISOString().slice(0, 10)).toBe(
			"2026-09-11",
		);
		expect(plan.rooms[0]!.check_out_date.toISOString().slice(0, 10)).toBe(
			"2026-09-12",
		);
	});
});

describe("expandStayPlan — refusals", () => {
	it("refuses a window shorter than one night", () => {
		expect(() =>
			expandStayPlan({
				...defaults,
				check_out_date: new Date("2026-09-10T00:00:00Z"),
			}),
		).toThrow(StayPlanError);
	});

	it("refuses a night outside the stay window", () => {
		expect(() =>
			expandStayPlan(defaults, [
				{
					nights: [
						{ stay_date: new Date("2026-09-20T00:00:00Z"), rate_amount: 100 },
					],
				},
			]),
		).toThrow(expect.objectContaining({ code: "INVALID_STAY_NIGHT" }));
	});

	it("refuses the departure date as a night", () => {
		expect(() =>
			expandStayPlan(defaults, [
				{
					nights: [
						{ stay_date: new Date("2026-09-13T00:00:00Z"), rate_amount: 100 },
					],
				},
			]),
		).toThrow(expect.objectContaining({ code: "INVALID_STAY_NIGHT" }));
	});

	it("refuses the same night priced twice for one room", () => {
		expect(() =>
			expandStayPlan(defaults, [
				{
					nights: [
						{ stay_date: new Date("2026-09-10T00:00:00Z"), rate_amount: 100 },
						{ stay_date: new Date("2026-09-10T00:00:00Z"), rate_amount: 120 },
					],
				},
			]),
		).toThrow(expect.objectContaining({ code: "DUPLICATE_STAY_NIGHT" }));
	});

	it("refuses two rooms claiming the same sequence", () => {
		expect(() =>
			expandStayPlan(defaults, [{ room_sequence: 1 }, { room_sequence: 1 }]),
		).toThrow(expect.objectContaining({ code: "DUPLICATE_ROOM_SEQUENCE" }));
	});
});

describe("chargeableStayTotal", () => {
	it("excludes complimentary nights", () => {
		const plan = expandStayPlan(defaults, [
			{
				nights: [
					{ stay_date: new Date("2026-09-10T00:00:00Z"), rate_amount: 100 },
					{
						stay_date: new Date("2026-09-11T00:00:00Z"),
						rate_amount: 100,
						is_complimentary: true,
					},
				],
			},
		]);

		expect(plan.total_amount).toBe(200);
		expect(chargeableStayTotal(plan)).toBe(100);
	});
});

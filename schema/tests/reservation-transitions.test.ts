import { describe, expect, it } from "vitest";

import {
	classifyReservationTransition,
	describeReservationStatuses,
	isLegalReservationTransition,
	RESERVATION_FORCED_TRANSITIONS,
	classifyReservationCommandTransition,
	RESERVATION_COMMAND_TRANSITIONS,
	RESERVATION_INITIAL_STATUSES,
	RESERVATION_LEGAL_TRANSITIONS,
	RESERVATION_UNCLAIMED_TRANSITIONS,
	reservationStatusesFor,
} from "../src/api/reservations.js";
import { registeredCommandNames } from "../src/command-validators.js";
import {
	type ReservationStatus,
	ReservationStatusEnum,
} from "../src/shared/enums.js";

const ALL = ReservationStatusEnum.options;

describe("RESERVATION_LEGAL_TRANSITIONS — shape", () => {
	it("covers every status in the enum, and nothing else", () => {
		expect(Object.keys(RESERVATION_LEGAL_TRANSITIONS).sort()).toEqual(
			[...ALL].sort(),
		);
	});

	it("only ever names a real status as a destination", () => {
		for (const [from, targets] of Object.entries(
			RESERVATION_LEGAL_TRANSITIONS,
		)) {
			for (const to of targets) {
				expect(ReservationStatusEnum.safeParse(to).success, `${from}→${to}`).toBe(
					true,
				);
			}
		}
	});

	it("never lists a status as its own successor", () => {
		for (const [from, targets] of Object.entries(
			RESERVATION_LEGAL_TRANSITIONS,
		)) {
			expect(targets, from).not.toContain(from);
		}
	});

	it("names no destination twice", () => {
		for (const [from, targets] of Object.entries(
			RESERVATION_LEGAL_TRANSITIONS,
		)) {
			expect(new Set(targets).size, from).toBe(targets.length);
		}
	});

	it("is frozen, so a caller cannot widen the lifecycle at runtime", () => {
		expect(Object.isFrozen(RESERVATION_LEGAL_TRANSITIONS)).toBe(true);
		expect(Object.isFrozen(RESERVATION_FORCED_TRANSITIONS)).toBe(true);
	});

	it("leaves every status reachable from a legal starting point", () => {
		// A status nothing can reach and nothing starts in is dead weight in the
		// enum — either the table is missing an edge or the value should go.
		const reachable = new Set<ReservationStatus>(RESERVATION_INITIAL_STATUSES);
		let grew = true;
		while (grew) {
			grew = false;
			for (const from of reachable) {
				for (const to of RESERVATION_LEGAL_TRANSITIONS[from]) {
					if (!reachable.has(to)) {
						reachable.add(to);
						grew = true;
					}
				}
			}
		}
		expect([...ALL].filter((s) => !reachable.has(s))).toEqual([]);
	});
});

describe("the lifecycle the tables actually declare", () => {
	it("walks the ordinary stay end to end", () => {
		const stay: ReservationStatus[] = [
			"INQUIRY",
			"QUOTED",
			"PENDING",
			"CONFIRMED",
			"CHECKED_IN",
			"CHECKED_OUT",
		];
		for (let i = 0; i < stay.length - 1; i += 1) {
			const [from, to] = [stay[i], stay[i + 1]] as [
				ReservationStatus,
				ReservationStatus,
			];
			expect(isLegalReservationTransition(from, to), `${from}→${to}`).toBe(true);
		}
	});

	it("allows the three WS-04 reversals and nothing adjacent to them", () => {
		expect(isLegalReservationTransition("CHECKED_IN", "CONFIRMED")).toBe(true);
		expect(isLegalReservationTransition("CHECKED_OUT", "CHECKED_IN")).toBe(true);
		expect(isLegalReservationTransition("CANCELLED", "CONFIRMED")).toBe(true);
		expect(isLegalReservationTransition("CANCELLED", "PENDING")).toBe(true);

		// A reversal undoes one step, not two.
		expect(isLegalReservationTransition("CHECKED_OUT", "CONFIRMED")).toBe(false);
		expect(isLegalReservationTransition("CHECKED_OUT", "CANCELLED")).toBe(false);
		expect(isLegalReservationTransition("CANCELLED", "CHECKED_IN")).toBe(false);
	});

	it("refuses the moves no command should ever make", () => {
		expect(classifyReservationTransition("CHECKED_OUT", "PENDING")).toBe(
			"ILLEGAL",
		);
		expect(classifyReservationTransition("CANCELLED", "CHECKED_OUT")).toBe(
			"ILLEGAL",
		);
		expect(classifyReservationTransition("NO_SHOW", "CONFIRMED")).toBe("ILLEGAL");
		expect(classifyReservationTransition("EXPIRED", "CONFIRMED")).toBe("ILLEGAL");
	});

	it("treats a status echoed back unchanged as legal", () => {
		for (const status of ALL) {
			expect(classifyReservationTransition(status, status), status).toBe("LEGAL");
		}
	});

	it("keeps NO_SHOW and EXPIRED terminal without an override", () => {
		expect(RESERVATION_LEGAL_TRANSITIONS.NO_SHOW).toEqual([]);
		expect(RESERVATION_LEGAL_TRANSITIONS.EXPIRED).toEqual([]);
	});
});

describe("RESERVATION_FORCED_TRANSITIONS", () => {
	it("opens NO_SHOW → CHECKED_IN, and only on an override", () => {
		expect(classifyReservationTransition("NO_SHOW", "CHECKED_IN")).toBe(
			"REQUIRES_OVERRIDE",
		);
		expect(isLegalReservationTransition("NO_SHOW", "CHECKED_IN")).toBe(false);
	});

	it("never re-declares a move the ordinary table already allows", () => {
		// An edge in both maps would be an override that silently isn't one, and
		// classify() would never return REQUIRES_OVERRIDE for it.
		for (const [from, targets] of Object.entries(
			RESERVATION_FORCED_TRANSITIONS,
		)) {
			const ordinary = RESERVATION_LEGAL_TRANSITIONS[from as ReservationStatus];
			for (const to of targets ?? []) {
				expect(ordinary, `${from}→${to}`).not.toContain(to);
			}
		}
	});
});

describe("RESERVATION_COMMAND_TRANSITIONS — who owns which edge", () => {
	it("never claims a move the lifecycle does not allow", () => {
		for (const [name, claim] of Object.entries(RESERVATION_COMMAND_TRANSITIONS)) {
			for (const from of claim.from) {
				for (const to of claim.to) {
					expect(
						classifyReservationTransition(from, to),
						`${name}: ${from}→${to}`,
					).toBe("LEGAL");
				}
			}
		}
	});

	it("only declares forcedFrom where the forced table agrees", () => {
		for (const [name, claim] of Object.entries(RESERVATION_COMMAND_TRANSITIONS)) {
			for (const from of claim.forcedFrom ?? []) {
				for (const to of claim.to) {
					expect(
						classifyReservationTransition(from, to),
						`${name}: ${from}→${to}`,
					).toBe("REQUIRES_OVERRIDE");
				}
			}
		}
	});

	it("names only commands that exist", () => {
		const unknown = Object.keys(RESERVATION_COMMAND_TRANSITIONS)
			.filter((name) => !registeredCommandNames.has(name))
			.sort();
		expect(unknown).toEqual([]);
	});

	it("names only real statuses on both ends", () => {
		for (const [name, claim] of Object.entries(RESERVATION_COMMAND_TRANSITIONS)) {
			for (const status of [
				...claim.from,
				...claim.to,
				...(claim.forcedFrom ?? []),
			]) {
				expect(ReservationStatusEnum.safeParse(status).success, name).toBe(true);
			}
		}
	});

	it("never lets a command accept a status it also writes", () => {
		// A command whose from and to overlap would be a no-op for that status,
		// which is a sign the claim is wrong rather than a useful move.
		for (const [name, claim] of Object.entries(RESERVATION_COMMAND_TRANSITIONS)) {
			for (const to of claim.to) {
				expect(claim.from, `${name} → ${to}`).not.toContain(to);
			}
		}
	});
});

describe("classifyReservationCommandTransition — the guard handlers use", () => {
	it("refuses to let check-in undo a check-out", () => {
		// CHECKED_OUT → CHECKED_IN is a legal edge, but it is reverse_check_out's:
		// it reopens the folio and refuses once the balance is in city ledger.
		// Gating check-in on the lifecycle table alone would have opened this.
		expect(classifyReservationTransition("CHECKED_OUT", "CHECKED_IN")).toBe(
			"LEGAL",
		);
		expect(
			classifyReservationCommandTransition(
				"reservation.check_in",
				"CHECKED_OUT",
				"CHECKED_IN",
			),
		).toBe("ILLEGAL");
		expect(
			classifyReservationCommandTransition(
				"reservation.reverse_check_out",
				"CHECKED_OUT",
				"CHECKED_IN",
			),
		).toBe("LEGAL");
	});

	it("refuses to let cancel stand in for walk_guest, and the reverse", () => {
		// Both write CANCELLED; only cancel takes an INQUIRY, because there is no
		// room held to walk the guest out of.
		expect(
			classifyReservationCommandTransition(
				"reservation.cancel",
				"INQUIRY",
				"CANCELLED",
			),
		).toBe("LEGAL");
		expect(
			classifyReservationCommandTransition(
				"reservation.walk_guest",
				"INQUIRY",
				"CANCELLED",
			),
		).toBe("ILLEGAL");
	});

	it("opens NO_SHOW → CHECKED_IN for check-in alone, and only as an override", () => {
		expect(
			classifyReservationCommandTransition(
				"reservation.check_in",
				"NO_SHOW",
				"CHECKED_IN",
			),
		).toBe("REQUIRES_OVERRIDE");
		expect(
			classifyReservationCommandTransition(
				"reservation.reverse_check_out",
				"NO_SHOW",
				"CHECKED_IN",
			),
		).toBe("ILLEGAL");
	});

	it("refuses an unknown command rather than inheriting the loosest rule", () => {
		expect(
			classifyReservationCommandTransition(
				"reservation.not_a_command",
				"PENDING",
				"CONFIRMED",
			),
		).toBe("ILLEGAL");
	});

	it("refuses a target the command never writes", () => {
		expect(
			classifyReservationCommandTransition(
				"reservation.check_in",
				"PENDING",
				"CANCELLED",
			),
		).toBe("ILLEGAL");
	});
});

describe("RESERVATION_UNCLAIMED_TRANSITIONS — what reservation.modify may do", () => {
	it("is exactly the legal edges no command claims", () => {
		expect(RESERVATION_UNCLAIMED_TRANSITIONS).toEqual({
			PENDING: ["CONFIRMED"],
			WAITLISTED: ["PENDING", "CONFIRMED"],
		});
	});

	it("holds nothing a dedicated command owns", () => {
		for (const [from, targets] of Object.entries(
			RESERVATION_UNCLAIMED_TRANSITIONS,
		)) {
			for (const to of targets ?? []) {
				const owner = Object.entries(RESERVATION_COMMAND_TRANSITIONS).find(
					([, claim]) =>
						claim.from.includes(from as ReservationStatus) &&
						claim.to.includes(to),
				);
				expect(owner?.[0], `${from}→${to}`).toBeUndefined();
			}
		}
	});

	it("holds nothing the lifecycle forbids", () => {
		for (const [from, targets] of Object.entries(
			RESERVATION_UNCLAIMED_TRANSITIONS,
		)) {
			for (const to of targets ?? []) {
				expect(
					isLegalReservationTransition(from as ReservationStatus, to),
					`${from}→${to}`,
				).toBe(true);
			}
		}
	});

	it("excludes every move modify used to wave through", () => {
		// Each of these was applied verbatim before the table existed, and
		// reservation.mass_update applied them 500 at a time.
		for (const [from, to] of [
			["CHECKED_OUT", "CHECKED_IN"],
			["CANCELLED", "CONFIRMED"],
			["PENDING", "CHECKED_IN"],
			["CHECKED_IN", "CHECKED_OUT"],
			["CONFIRMED", "CANCELLED"],
			["NO_SHOW", "CHECKED_IN"],
		] as const) {
			expect(RESERVATION_UNCLAIMED_TRANSITIONS[from] ?? [], `${from}→${to}`).not.toContain(
				to,
			);
		}
	});
});

describe("reservationStatusesFor — what each command guards on", () => {
	it("gives check-in exactly the set its handler used to hardcode", () => {
		expect(reservationStatusesFor("reservation.check_in")).toEqual([
			"PENDING",
			"CONFIRMED",
		]);
		expect(
			reservationStatusesFor("reservation.check_in", { includeForced: true }),
		).toEqual(["PENDING", "CONFIRMED", "NO_SHOW"]);
	});

	it("gives cancel the union the service and the screen had each half of", () => {
		// The handler allowed INQUIRY/QUOTED/PENDING/CONFIRMED; the screen offered
		// PENDING/CONFIRMED/WAITLISTED. Neither was the whole set.
		expect(reservationStatusesFor("reservation.cancel")).toEqual([
			"INQUIRY",
			"QUOTED",
			"PENDING",
			"CONFIRMED",
			"WAITLISTED",
		]);
	});

	it("returns statuses in enum order so refusal messages are stable", () => {
		for (const name of Object.keys(RESERVATION_COMMAND_TRANSITIONS)) {
			const got = reservationStatusesFor(name, { includeForced: true });
			expect([...got].sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b))).toEqual(
				got,
			);
		}
	});

	it("returns nothing for a command that claims no edge", () => {
		expect(reservationStatusesFor("reservation.modify")).toEqual([]);
	});

	it("agrees with the claim map on every command and status", () => {
		for (const [name, claim] of Object.entries(RESERVATION_COMMAND_TRANSITIONS)) {
			const plain = new Set(reservationStatusesFor(name));
			const forced = new Set(reservationStatusesFor(name, { includeForced: true }));
			expect([...plain].sort()).toEqual([...claim.from].sort());
			expect([...forced].sort()).toEqual(
				[...claim.from, ...(claim.forcedFrom ?? [])].sort(),
			);
		}
	});
});

describe("RESERVATION_INITIAL_STATUSES", () => {
	it("excludes the states a booking can only arrive at", () => {
		for (const terminalish of [
			"CHECKED_OUT",
			"CANCELLED",
			"NO_SHOW",
			"EXPIRED",
		] as const) {
			expect(RESERVATION_INITIAL_STATUSES, terminalish).not.toContain(terminalish);
		}
	});

	it("includes CHECKED_IN for the walk-in", () => {
		expect(RESERVATION_INITIAL_STATUSES).toContain("CHECKED_IN");
	});

	it("names only real statuses", () => {
		for (const status of RESERVATION_INITIAL_STATUSES) {
			expect(ReservationStatusEnum.safeParse(status).success, status).toBe(true);
		}
	});
});

describe("describeReservationStatuses", () => {
	it("reads as a sentence for the refusal message", () => {
		expect(describeReservationStatuses(["PENDING", "CONFIRMED"])).toBe(
			"PENDING or CONFIRMED",
		);
		expect(
			describeReservationStatuses(["PENDING", "CONFIRMED", "NO_SHOW"]),
		).toBe("PENDING, CONFIRMED or NO_SHOW");
		expect(describeReservationStatuses(["CHECKED_IN"])).toBe("CHECKED_IN");
	});

	it("says something rather than nothing when a status is terminal", () => {
		expect(describeReservationStatuses([])).toBe("none");
	});
});

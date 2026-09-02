/**
 * A forced check-in or check-out has to say why.
 *
 * A08 closed `force` on room move and the three reversals and stopped there.
 * Check-in and check-out were left as they were — which meant the only three
 * controls the flow registry declares as `kind: "gate"` rather than "record"
 * (`reservation_status_check`, `deposit_required_check`,
 * `folio_settlement_check`) were the three nobody was authorized against.
 *
 * They were skipped because the two halves are coupled: each passed a
 * hardcoded reason code with no row in `reason_codes`, so there was no
 * `approval_level` for an authority check to read. The refine below is the
 * first half — the same shape night audit's `skip_reason_code` uses, for the
 * same reason.
 */

import { describe, expect, it } from "vitest";

import {
	ReservationCheckInCommandSchema,
	ReservationCheckOutCommandSchema,
} from "../src/events/commands/reservations.js";

const RESERVATION_ID = "11111111-1111-4111-8111-111111111111";

describe("reservation.check_in — reason_code is required with force", () => {
	it("accepts an ordinary check-in with no reason code", () => {
		const parsed = ReservationCheckInCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
		});
		expect(parsed.success).toBe(true);
	});

	it("refuses a forced check-in that names no reason", () => {
		const parsed = ReservationCheckInCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			force: true,
		});
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.error.issues[0]?.path).toEqual(["reason_code"]);
	});

	it("accepts a forced check-in that names one", () => {
		const parsed = ReservationCheckInCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			force: true,
			reason_code: "CI_DEPOSIT_WAIVED",
		});
		expect(parsed.success).toBe(true);
	});

	// force: false is not an override, so it owes nothing. Demanding a code
	// there would make every ordinary check-in that spells the flag out fail.
	it("does not demand a reason when force is explicitly false", () => {
		const parsed = ReservationCheckInCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			force: false,
		});
		expect(parsed.success).toBe(true);
	});
});

describe("reservation.check_out — reason_code is required with force", () => {
	it("refuses a forced check-out that names no reason", () => {
		const parsed = ReservationCheckOutCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			force: true,
		});
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.error.issues[0]?.path).toEqual(["reason_code"]);
	});

	it("accepts a forced check-out that names one", () => {
		const parsed = ReservationCheckOutCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			force: true,
			reason_code: "CO_TO_CITY_LEDGER",
		});
		expect(parsed.success).toBe(true);
	});

	/**
	 * `express` settles the folio rather than bypassing the settlement check,
	 * so it is not an override and owes no code. Conflating the two would put a
	 * reason-code prompt in front of the fastest path the front desk has.
	 */
	it("treats express as settlement, not as an override", () => {
		const parsed = ReservationCheckOutCommandSchema.safeParse({
			reservation_id: RESERVATION_ID,
			express: true,
		});
		expect(parsed.success).toBe(true);
	});
});

/**
 * The rate override states why, and only for someone entitled to say it (A06).
 *
 * What this replaced: `reason` was optional free text that landed in
 * `internal_notes`, and the six RATE_OVERRIDE codes seeded since the table was
 * created — manager's discount, competitor match, service recovery, each with
 * the `approval_level` its decision takes — were resolved by nothing. The most
 * common way money leaves a hotel was the least answerable act in the product.
 *
 * The control is a record rather than a gate: overriding a rate is legitimate
 * daily work, so nothing is refused except an override the caller's role does
 * not reach.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReservationRateOverrideCommandSchema } from "../src/schemas/reservation-command.js";

const { queryMock, snapshotMock, enqueueMock, recordFlowApprovalMock } = vi.hoisted(() => ({
	queryMock: vi.fn(),
	snapshotMock: vi.fn(),
	enqueueMock: vi.fn(),
	recordFlowApprovalMock: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
	query: queryMock,
	queryWithClient: vi.fn(),
	withTransaction: vi.fn(),
	pool: {},
}));

vi.mock("../src/repositories/reservation-repository.js", () => ({
	fetchReservationStaySnapshot: snapshotMock,
}));

vi.mock("../src/utils/audit.js", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	recordFlowApproval: recordFlowApprovalMock,
}));

// `resolveReasonCode` and the error class stay real — they are half of what is
// under test. Only the enqueue is stubbed, because the write itself is another
// suite's subject.
vi.mock("../src/services/reservation-commands/common.js", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	enqueueReservationUpdate: enqueueMock,
}));

const base = {
  reservation_id: "11111111-1111-1111-1111-111111111111",
  total_amount: 149,
};

describe("the payload demands a code", () => {
  it("refuses an override that names no reason code", () => {
    const result = ReservationRateOverrideCommandSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("accepts one that does", () => {
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        ...base,
        reason_code: "RO_MGR_DISC",
      }).success,
    ).toBe(true);
  });

  it("still requires something to actually change", () => {
    // The older refinement stays: a command that names a code and moves
    // nothing is a record of a decision that was never taken.
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        reservation_id: base.reservation_id,
        reason_code: "RO_MGR_DISC",
      }).success,
    ).toBe(false);
  });

  it("rejects a code too short to be a real one", () => {
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        ...base,
        reason_code: "X",
      }).success,
    ).toBe(false);
  });

  it("keeps the free-text reason as notes, not as the record", () => {
    // `reason` survives — it is the sentence a clerk types — but it is no
    // longer the only thing saying why the rate moved.
    const parsed = ReservationRateOverrideCommandSchema.safeParse({
      ...base,
      reason_code: "RO_RECOVERY",
      reason: "guest was moved twice on arrival night",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("the discount is measured, not only recorded (A06's outstanding half)", () => {
	// The reason code authorises overriding a rate. Nothing authorised the size
	// of one: a 5% courtesy and a 90% giveaway were the same command, cleared by
	// the same role. `discountApprovalThresholds` has declared the policy since
	// before the audit — 10% needs a revenue manager, 20% a general manager —
	// and it was read by nothing, because `resolveSettings` lived in
	// core-service where this handler could not call it.
	const RESERVATION = "11111111-1111-1111-1111-111111111111";
	const PROPERTY = "22222222-2222-2222-2222-222222222222";

	const reasonRow = {
		reason_id: "33333333-3333-3333-3333-333333333333",
		reason_code: "RO_MGR_DISC",
		reason_name: "Manager's discount",
		reason_category: "RATE_OVERRIDE",
		requires_approval: false,
		approval_level: "NONE",
		has_financial_impact: true,
	};

	/**
	 * Two reads in order: the reason code, then the settings policy. Passing no
	 * policy row is the ordinary case — the catalogue installer writes its rows
	 * under the demo tenant — and exercises the shipped default.
	 */
	const wire = (policyRows: { code: string; value: unknown }[] = []) => {
		snapshotMock.mockResolvedValue({
			reservationId: RESERVATION,
			tenantId: "t",
			propertyId: PROPERTY,
			roomTypeId: "rt",
			checkInDate: new Date(),
			checkOutDate: new Date(),
			guestId: "g",
			status: "CONFIRMED",
			totalAmount: 200,
		});
		queryMock.mockReset();
		queryMock.mockResolvedValueOnce({ rows: [reasonRow] });
		queryMock.mockResolvedValueOnce({ rows: policyRows });
		enqueueMock.mockResolvedValue({ id: RESERVATION });
		recordFlowApprovalMock.mockResolvedValue(undefined);
	};

	const override = async (total: number, role: string) => {
		const { overrideRate } = await import(
			"../src/services/reservation-commands/financial-ops.js"
		);
		return overrideRate(
			"t",
			{
				reservation_id: RESERVATION,
				total_amount: total,
				reason_code: "RO_MGR_DISC",
				// biome-ignore lint/suspicious/noExplicitAny: only the four fields the
				// handler reads are needed here.
			} as any,
			{ actorId: "a", actorRole: role },
		);
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lets a small discount through on any role that can override at all", async () => {
		wire();
		// 200 → 195 is 2.5%, below the lowest rung.
		await expect(override(195, "STAFF")).resolves.toBeDefined();
		expect(enqueueMock).toHaveBeenCalled();
	});

	it("refuses a 25% discount from a clerk", async () => {
		wire();
		await expect(override(150, "STAFF")).rejects.toMatchObject({
			code: "DISCOUNT_EXCEEDS_AUTHORITY",
		});
		expect(enqueueMock).not.toHaveBeenCalled();
		expect(recordFlowApprovalMock).not.toHaveBeenCalled();
	});

	it("refuses a 25% discount from a manager — the second rung is an owner's", async () => {
		wire();
		await expect(override(150, "MANAGER")).rejects.toMatchObject({
			code: "DISCOUNT_EXCEEDS_AUTHORITY",
		});
	});

	it("lets an owner give it", async () => {
		wire();
		await expect(override(150, "OWNER")).resolves.toBeDefined();
	});

	it("lets a manager give a 15% discount — the first rung is theirs", async () => {
		wire();
		await expect(override(170, "MANAGER")).resolves.toBeDefined();
	});

	it("honours a tenant that has set its own ladder", async () => {
		wire([
			{
				code: "WORKFLOW.RATES.APPROVALS",
				value: { discountApprovalThresholds: [{ percent: 1, approverRole: "GENERAL_MANAGER" }] },
			},
		]);
		await expect(override(195, "MANAGER")).rejects.toMatchObject({
			code: "DISCOUNT_EXCEEDS_AUTHORITY",
		});
	});

	it("demands nothing when the rate goes up", async () => {
		wire();
		await expect(override(400, "STAFF")).resolves.toBeDefined();
	});

	it("does not measure a rate-code-only override", async () => {
		// Switching rate plan re-prices downstream; guessing at the resulting
		// amount here would refuse legitimate plan changes on a number this
		// command never saw.
		wire();
		const { overrideRate } = await import(
			"../src/services/reservation-commands/financial-ops.js"
		);
		await expect(
			overrideRate(
				"t",
				// biome-ignore lint/suspicious/noExplicitAny: as above.
				{ reservation_id: RESERVATION, rate_code: "BAR", reason_code: "RO_MGR_DISC" } as any,
				{ actorId: "a", actorRole: "STAFF" },
			),
		).resolves.toBeDefined();
	});
});

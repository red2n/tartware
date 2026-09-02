/**
 * What a forced check-in or check-out costs (A08, second half).
 *
 * Room move and the three reversals got their authority check on 2 September;
 * check-in and check-out did not, and they hold the only three controls the
 * flow registry declares as a real gate — `reservation_status_check` and
 * `deposit_required_check` on the way in, `folio_settlement_check` on the way
 * out. Each sat inside `if (command.force)`, wrote a `flow_approvals` row, and
 * asked nobody's permission.
 *
 * Every test here stops at the gate. The handlers past it open transactions,
 * take availability holds and settle folios, and none of that is what is under
 * test: the point is that a caller without the authority never reaches it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  withTransaction: vi.fn(),
  queryWithClient: vi.fn(),
  pool: {},
}));

vi.mock("../src/utils/audit.js", () => ({
  recordAuditLog: vi.fn(),
  recordFlowApproval: vi.fn(),
  hashIdentifier: (v: string) => v,
  redactPayload: (v: unknown) => v,
}));

const { checkInReservation, checkOutReservation } = await import(
  "../src/services/reservation-commands/checkin-checkout.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const RES = "77777777-7777-4777-8777-777777777701";

const reservation = (over: Record<string, unknown> = {}) => ({
  id: RES,
  status: "CONFIRMED",
  room_type_id: "44444444-4444-4444-4444-444444444444",
  guest_id: "g1",
  total_amount: 500,
  check_in_date: new Date("2026-09-01"),
  check_out_date: new Date("2026-09-04"),
  property_id: PROPERTY,
  rate_id: null,
  room_number: "101",
  actual_check_in: new Date("2026-09-01"),
  travel_agent_id: null,
  source: null,
  ...over,
});

const reasonRow = (over: Record<string, unknown> = {}) => ({
  reason_id: "r1",
  reason_code: "CI_DEPOSIT_WAIVED",
  reason_name: "Deposit waived",
  reason_category: "CHECK_IN_OVERRIDE",
  requires_approval: true,
  approval_level: "MANAGER",
  has_financial_impact: true,
  ...over,
});

/** Reservation read first, reason code second — the order the handler asks. */
const wire = (res: Record<string, unknown> | null, reason: Record<string, unknown> | null) => {
  queryMock.mockReset();
  queryMock
    .mockResolvedValueOnce({ rows: res === null ? [] : [res] })
    .mockResolvedValue({ rows: reason === null ? [] : [reason] });
};

beforeEach(() => {
  queryMock.mockReset();
});

describe("reservation.check_in — forcing costs the code's approval level", () => {
  it("refuses a clerk forcing past a code that demands a manager", async () => {
    wire(reservation(), reasonRow());
    await expect(
      checkInReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
        { actorRole: "STAFF" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("refuses a reason code that is not configured", async () => {
    wire(reservation(), null);
    await expect(
      checkInReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "NOT_A_CODE" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_NOT_FOUND" });
  });

  it("refuses a real code from the wrong category", async () => {
    // A room-move reason filed against a forced check-in makes the override
    // report read as a lie, which is what the category exists to prevent.
    wire(reservation(), reasonRow({ reason_category: "ROOM_MOVE", reason_code: "RM_VIP" }));
    await expect(
      checkInReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "RM_VIP" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
  });

  it("refuses an approval level the product cannot interpret", async () => {
    // The column is a VARCHAR behind a CHECK, and a CHECK is one migration
    // from gone. An unreadable level must not be the cheapest way past a gate.
    wire(reservation(), reasonRow({ approval_level: "REGIONAL_VP" }));
    await expect(
      checkInReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_UNKNOWN" });
  });

  it("lets a manager through the gate", async () => {
    wire(reservation(), reasonRow());
    const err = await checkInReservation(
      TENANT,
      { reservation_id: RES, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
      { actorRole: "MANAGER" },
    ).catch((e: { code?: string }) => e);
    // It fails later, on machinery this test does not wire — but not here.
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  it("asks for no reason code and no role on an ordinary check-in", async () => {
    wire(reservation(), null);
    const err = await checkInReservation(TENANT, { reservation_id: RES }, { actorRole: "STAFF" })
      .catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("REASON_CODE_NOT_FOUND");
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  // A scheduler or a replay carries SYSTEM_ACTOR_ROLE, which is deliberately
  // not a member of TenantRoleEnum. It must not clear a gate a person could not.
  it("refuses an unidentified actor", async () => {
    wire(reservation(), reasonRow());
    await expect(
      checkInReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
        {},
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });
});

describe("reservation.check_out — leaving with a balance is a credit decision", () => {
  const coReason = (over: Record<string, unknown> = {}) =>
    reasonRow({
      reason_code: "CO_DISPUTE_OPEN",
      reason_category: "CHECK_OUT_OVERRIDE",
      approval_level: "MANAGER",
      ...over,
    });

  it("refuses a clerk forcing an unsettled folio to the city ledger", async () => {
    wire(reservation({ status: "CHECKED_IN" }), coReason());
    await expect(
      checkOutReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "CO_DISPUTE_OPEN" },
        { actorRole: "STAFF" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("refuses a check-in reason filed against a check-out", async () => {
    wire(reservation({ status: "CHECKED_IN" }), coReason({ reason_category: "CHECK_IN_OVERRIDE" }));
    await expect(
      checkOutReservation(
        TENANT,
        { reservation_id: RES, force: true, reason_code: "CI_VIP" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
  });

  it("lets a manager through the gate", async () => {
    wire(reservation({ status: "CHECKED_IN" }), coReason());
    const err = await checkOutReservation(
      TENANT,
      { reservation_id: RES, force: true, reason_code: "CO_DISPUTE_OPEN" },
      { actorRole: "MANAGER" },
    ).catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  /**
   * `express` settles the folio instead of bypassing the check, so it is not
   * an override and resolves no code. Treating it as one would put an
   * authority prompt in front of the fastest path the front desk has.
   */
  it("does not treat express as an override", async () => {
    wire(reservation({ status: "CHECKED_IN" }), null);
    const err = await checkOutReservation(
      TENANT,
      { reservation_id: RES, express: true },
      { actorRole: "STAFF" },
    ).catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("REASON_CODE_NOT_FOUND");
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });
});

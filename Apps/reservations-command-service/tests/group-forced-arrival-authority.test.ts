/**
 * What forcing a whole group's arrival costs.
 *
 * `deposit_required_check` is one of the three controls the flow registry
 * declares as a real gate, and A08 made `reservation.check_in` pay for it: a
 * CHECK_IN_OVERRIDE code, and the acting role clearing that code's approval
 * level. `group.check_in` bypasses the same gate for up to 500 arrivals at once
 * and asked nobody — so the cheap way past a control was to bring more guests.
 *
 * Every test here stops at the gate. What follows it reads rooms, assigns them
 * and enqueues updates, and none of that is under test: the point is that a
 * caller without the authority never reaches it.
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

const { groupCheckIn } = await import("../src/services/reservation-commands/group-booking.js");

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const GROUP = "88888888-8888-4888-8888-888888888801";

const groupRow = (over: Record<string, unknown> = {}) => ({
  group_booking_id: GROUP,
  property_id: PROPERTY,
  block_status: "DEFINITE",
  group_name: "Rotary Club",
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

/** Group read first, reason code second — the order the handler asks. */
const wire = (group: Record<string, unknown> | null, reason: Record<string, unknown> | null) => {
  queryMock.mockReset();
  queryMock
    .mockResolvedValueOnce({ rows: group === null ? [] : [group] })
    .mockResolvedValue({ rows: reason === null ? [] : [reason] });
};

beforeEach(() => {
  queryMock.mockReset();
});

describe("group.check_in — forcing costs the code's approval level", () => {
  it("refuses a clerk forcing past a code that demands a manager", async () => {
    wire(groupRow(), reasonRow());
    await expect(
      groupCheckIn(
        TENANT,
        { group_booking_id: GROUP, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
        { actorRole: "STAFF" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("refuses a reason code that is not configured", async () => {
    wire(groupRow(), null);
    await expect(
      groupCheckIn(
        TENANT,
        { group_booking_id: GROUP, force: true, reason_code: "NOT_A_CODE" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_NOT_FOUND" });
  });

  it("refuses a real code from the wrong category", async () => {
    // The group path reuses CHECK_IN_OVERRIDE rather than getting a category of
    // its own, because it is the same decision at a different scale — and that
    // only holds if the category is still enforced here.
    wire(groupRow(), reasonRow({ reason_category: "ROOM_MOVE", reason_code: "RM_VIP" }));
    await expect(
      groupCheckIn(
        TENANT,
        { group_booking_id: GROUP, force: true, reason_code: "RM_VIP" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
  });

  it("refuses an approval level the product cannot interpret", async () => {
    wire(groupRow(), reasonRow({ approval_level: "REGIONAL_VP" }));
    await expect(
      groupCheckIn(
        TENANT,
        { group_booking_id: GROUP, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
        { actorRole: "OWNER" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_UNKNOWN" });
  });

  it("lets a manager through the gate", async () => {
    wire(groupRow(), reasonRow());
    const err = await groupCheckIn(
      TENANT,
      { group_booking_id: GROUP, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
      { actorRole: "MANAGER" },
    ).catch((e: { code?: string }) => e);
    // It fails later, on machinery this test does not wire — but not here.
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  it("accepts a supervisor's step-up in place of the operator's own role", async () => {
    // The whole point of a grant: the clerk still cannot clear the code, and
    // the arrival proceeds because a manager stood at the terminal.
    wire(groupRow(), reasonRow());
    const err = await groupCheckIn(
      TENANT,
      { group_booking_id: GROUP, force: true, reason_code: "CI_DEPOSIT_WAIVED" },
      {
        actorRole: "STAFF",
        stepUp: {
          grantId: "99999999-9999-4999-8999-999999999901",
          supervisorId: "33333333-3333-4333-8333-333333333301",
          supervisorRole: "MANAGER" as const,
          entityId: GROUP,
          grantedAt: new Date().toISOString(),
        },
      },
    ).catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  it("asks for no reason code and no role on an ordinary group arrival", async () => {
    // The gate is on the override, not on the command. Making a night manager
    // name a reason code to check a coach party in normally would be theatre.
    wire(groupRow(), null);
    const err = await groupCheckIn(TENANT, { group_booking_id: GROUP }, { actorRole: "STAFF" })
      .catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("REASON_CODE_NOT_FOUND");
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });
});

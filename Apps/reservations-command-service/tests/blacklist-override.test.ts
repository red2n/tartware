/**
 * The blacklist override (A05), and the tests it shipped without.
 *
 * `GUEST_BLACKLISTED` used to be a hard throw whose own message promised "a GM
 * override with documented reason" that existed nowhere in the repo. The
 * override now exists. What it did not have — found by re-verifying the audit
 * rather than by any failure — was a single test: `blacklist_override` appeared
 * in exactly two files, its handler and its schema, and in no test and no
 * end-to-end suite. Its sibling control, billing's credit-limit gate, shipped
 * with fourteen.
 *
 * These hold the same four outcomes that one does, because the order of the
 * three conditions is what makes this a control rather than a flag: asked for →
 * resolved in the right category → authorised for the role that asked. A
 * payload field alone would have been the `force: true` A05 exists to remove.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearBlacklistGate } from "../src/services/reservation-commands/blacklist-gate.js";
import { ReservationCreateCommandSchema } from "../src/schemas/reservation-command.js";

const { queryMock, recordFlowApprovalMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  recordFlowApprovalMock: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: vi.fn(),
  withTransaction: vi.fn(),
  pool: {},
}));

vi.mock("../src/utils/audit.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recordFlowApproval: recordFlowApprovalMock,
}));

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";
const ACTOR = "44444444-4444-4444-4444-444444444444";
const RESERVATION = "55555555-5555-5555-5555-555555555555";

/** A reason code as `resolveReasonCode` reads it back. */
const reasonRow = (over: Record<string, unknown> = {}) => ({
  reason_id: "66666666-6666-6666-6666-666666666666",
  reason_code: "BL_LISTING_DISPUTED",
  reason_name: "Listing disputed, under review",
  reason_category: "BLACKLIST",
  requires_approval: true,
  approval_level: "MANAGER",
  has_financial_impact: false,
  ...over,
});

const command = (over: Record<string, unknown> = {}) =>
  ({
    guest_id: GUEST,
    property_id: PROPERTY,
    blacklist_override: true,
    blacklist_override_reason_code: "BL_LISTING_DISPUTED",
    ...over,
    // biome-ignore lint/suspicious/noExplicitAny: the gate reads four fields of
    // a create command; building a whole valid one would test the schema, not
    // the gate.
  }) as any;

const options = (role: string | undefined) => ({
  correlationId: "corr-1",
  actorId: ACTOR,
  ...(role === undefined ? {} : { actorRole: role }),
});

beforeEach(() => {
  queryMock.mockReset();
  recordFlowApprovalMock.mockReset();
  recordFlowApprovalMock.mockResolvedValue(undefined);
  queryMock.mockResolvedValue({ rows: [reasonRow()] });
});

describe("without an override the refusal is what it always was", () => {
  it("refuses, and names the way through instead of an override that does not exist", async () => {
    await expect(
      clearBlacklistGate(TENANT, command({ blacklist_override: false }), RESERVATION, options("OWNER")),
    ).rejects.toMatchObject({ code: "GUEST_BLACKLISTED" });
    // The old message cited a GM override with no mechanism behind it. This one
    // names the field and the category a caller can actually use.
    await expect(
      clearBlacklistGate(TENANT, command({ blacklist_override: false }), RESERVATION, options("OWNER")),
    ).rejects.toThrow(/blacklist_override_reason_code/);
  });

  it("writes nothing when it refuses", async () => {
    await expect(
      clearBlacklistGate(TENANT, command({ blacklist_override: false }), RESERVATION, options("OWNER")),
    ).rejects.toThrow();
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });
});

describe("the code has to be real, and has to be a blacklist code", () => {
  it("refuses a code that resolves to nothing", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(
      clearBlacklistGate(
        TENANT,
        command({ blacklist_override_reason_code: "NOT_A_CODE" }),
        RESERVATION,
        options("OWNER"),
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_NOT_FOUND" });
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses a real code from another category", async () => {
    // A booking taken under a room-move reason produces a trail that reads as
    // a lie, which is worse than no trail.
    queryMock.mockResolvedValue({
      rows: [reasonRow({ reason_code: "RM_VIP", reason_category: "ROOM_MOVE" })],
    });
    await expect(
      clearBlacklistGate(
        TENANT,
        command({ blacklist_override_reason_code: "RM_VIP" }),
        RESERVATION,
        options("OWNER"),
      ),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });
});

describe("the acting role has to clear the level the code demands", () => {
  it("refuses a clerk naming a manager-level code", async () => {
    await expect(
      clearBlacklistGate(TENANT, command(), RESERVATION, options("STAFF")),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses a manager naming the GM-cleared code, which maps to OWNER", async () => {
    queryMock.mockResolvedValue({
      rows: [reasonRow({ reason_code: "BL_GM_CLEARED", approval_level: "GM" })],
    });
    await expect(
      clearBlacklistGate(
        TENANT,
        command({ blacklist_override_reason_code: "BL_GM_CLEARED" }),
        RESERVATION,
        options("MANAGER"),
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("lets an owner name it", async () => {
    queryMock.mockResolvedValue({
      rows: [reasonRow({ reason_code: "BL_GM_CLEARED", approval_level: "GM" })],
    });
    await expect(
      clearBlacklistGate(
        TENANT,
        command({ blacklist_override_reason_code: "BL_GM_CLEARED" }),
        RESERVATION,
        options("OWNER"),
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a scheduler or replay outright", async () => {
    // The role on an envelope with no membership is SYSTEM_ACTOR_ROLE, which is
    // deliberately not a member of TenantRoleEnum — it scores nothing, and this
    // is exactly the actor that must never clear a blacklist.
    await expect(
      clearBlacklistGate(TENANT, command(), RESERVATION, options(undefined)),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("refuses a level no mapping covers, rather than reading it as no demand", async () => {
    // `approval_level` is VARCHAR(20) behind a CHECK constraint, and a CHECK is
    // one migration from gone. Treating an unknown level as "nothing extra"
    // would make a hand-edited reason code the way past every override control.
    queryMock.mockResolvedValue({ rows: [reasonRow({ approval_level: "REGIONAL_VP" })] });
    await expect(
      clearBlacklistGate(TENANT, command(), RESERVATION, options("OWNER")),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_UNKNOWN" });
  });
});

describe("what the cleared gate records", () => {
  it("writes one blacklist_check row carrying the code and the real role", async () => {
    await clearBlacklistGate(TENANT, command(), RESERVATION, options("MANAGER"));
    expect(recordFlowApprovalMock).toHaveBeenCalledTimes(1);
    expect(recordFlowApprovalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        propertyId: PROPERTY,
        flowName: "reservation",
        gateName: "blacklist_check",
        entityType: "reservation",
        entityId: RESERVATION,
        approvedBy: ACTOR,
        roleAtApproval: "MANAGER",
        forced: true,
        reasonCode: "BL_LISTING_DISPUTED",
      }),
    );
  });

  it("prefers the operator's own note to the generated one", async () => {
    await clearBlacklistGate(
      TENANT,
      command({ blacklist_override_notes: "Listing belongs to a merged duplicate profile." }),
      RESERVATION,
      options("MANAGER"),
    );
    expect(recordFlowApprovalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonNotes: "Listing belongs to a merged duplicate profile.",
      }),
    );
  });
});

describe("the payload refuses an override with no stated reason", () => {
  // The gate's `?? ""` relies on this: by the time a handler sees the command,
  // an override without a code has already been rejected.
  const create = {
    property_id: PROPERTY,
    guest_id: GUEST,
    room_type_id: "77777777-7777-7777-7777-777777777777",
    check_in_date: "2026-10-01",
    check_out_date: "2026-10-03",
    total_amount: 240,
  };

  it("rejects blacklist_override with no code", () => {
    const result = ReservationCreateCommandSchema.safeParse({
      ...create,
      blacklist_override: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("blacklist_override_reason_code");
  });

  it("accepts one that names a code", () => {
    expect(
      ReservationCreateCommandSchema.safeParse({
        ...create,
        blacklist_override: true,
        blacklist_override_reason_code: "BL_LISTING_DISPUTED",
      }).success,
    ).toBe(true);
  });
});

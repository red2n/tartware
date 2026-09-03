/**
 * What stepping over the settlement control costs, on the two paths that were
 * never asked.
 *
 * `folio_settlement_check` is one of the three controls the flow registry
 * declares as a real gate, and since A08 `reservation.check_out` has paid for
 * it: a reason code, and the acting role clearing that code's approval level.
 * Two other commands reach past the same control and asked nobody —
 *
 *   `billing.folio.close`      closes a folio carrying an outstanding balance.
 *                              STAFF tier, with a force checkbox shipped in
 *                              pms-ui, and the balance goes nowhere: no
 *                              city-ledger transfer, no write-off entry, it
 *                              just stops being collectable through the folio.
 *   `billing.group.checkout`   departs a whole group over unsettled member
 *                              folios — the same bypass, once per room.
 *
 * Neither wrote a `flow_approvals` row, which is why the guardrail added with
 * A08 could not see them: it fires on files that record a bypass, and so trusts
 * a bypass to declare itself.
 *
 * Every test here stops at the gate. What follows opens transactions and closes
 * folios, and none of that is under test.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BillingFolioCloseCommandSchema,
  BillingGroupCheckoutCommandSchema,
} from "../src/schemas/billing-commands.js";

const { queryMock, queryWithClientMock, withTransactionMock, recordFlowApprovalMock, auditAsyncMock, auditWithClientMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    queryWithClientMock: vi.fn(),
    withTransactionMock: vi.fn(),
    recordFlowApprovalMock: vi.fn(),
    auditAsyncMock: vi.fn(),
    auditWithClientMock: vi.fn(),
  }));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: queryWithClientMock,
  withTransaction: withTransactionMock,
}));

vi.mock("../src/repositories/flow-approval-repository.js", () => ({
  recordFlowApproval: recordFlowApprovalMock,
}));

vi.mock("../src/lib/audit-logger.js", () => ({
  auditAsync: auditAsyncMock,
  auditWithClient: auditWithClientMock,
}));

vi.mock("../src/lib/folio-lock.js", () => ({ acquireFolioLock: vi.fn() }));

const { closeFolio } = await import("../src/services/billing-commands/folio.js");
const { checkoutGroup } = await import("../src/services/billing-commands/group-billing.js");

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const FOLIO = "33333333-3333-4333-8333-333333333301";
const GROUP = "44444444-4444-4444-8444-444444444401";

const ctx = (role: string | null, over: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  initiatedBy: role === null ? undefined : { userId: "55555555-5555-4555-8555-555555555501", role },
  correlationId: null,
  ...over,
});

const closeReason = (over: Record<string, unknown> = {}) => ({
  reason_id: "r1",
  reason_code: "FC_DISPUTE_HELD",
  reason_name: "Charge disputed",
  reason_category: "FOLIO_CLOSE_OVERRIDE",
  requires_approval: true,
  approval_level: "MANAGER",
  has_financial_impact: true,
  ...over,
});

const checkoutReason = (over: Record<string, unknown> = {}) => ({
  reason_id: "r2",
  reason_code: "CO_DISPUTE_OPEN",
  reason_name: "Charge disputed",
  reason_category: "CHECK_OUT_OVERRIDE",
  requires_approval: true,
  approval_level: "MANAGER",
  has_financial_impact: true,
  ...over,
});

beforeEach(() => {
  queryMock.mockReset();
  queryWithClientMock.mockReset();
  recordFlowApprovalMock.mockReset();
  withTransactionMock.mockReset();
});

/**
 * Run `closeFolio`'s transaction for real against a folio holding `balance`.
 *
 * Without this the callback never executes, and every assertion about what the
 * close records passes whatever the code does — which is how a test comes to
 * agree with a bug.
 */
const runCloseTransaction = (balance: string) => {
  queryWithClientMock
    .mockResolvedValueOnce({ rows: [{ folio_status: "OPEN", balance, version: 1 }] })
    .mockResolvedValueOnce({ rowCount: 1 });
  withTransactionMock.mockImplementation(
    async (fn: (client: unknown) => Promise<string>) => fn({}),
  );
};

// ─── The payload has to name a code ─────────────────────────────────────────

describe("the payload demands a code whenever force is set", () => {
  it("refuses a forced folio close with no reason code", () => {
    const result = BillingFolioCloseCommandSchema.safeParse({
      property_id: PROPERTY,
      folio_id: FOLIO,
      force: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("accepts a forced folio close that names one", () => {
    expect(
      BillingFolioCloseCommandSchema.safeParse({
        property_id: PROPERTY,
        folio_id: FOLIO,
        force: true,
        reason_code: "FC_DISPUTE_HELD",
      }).success,
    ).toBe(true);
  });

  it("asks for nothing on an ordinary close", () => {
    // The demand is on the override, not on the command: settling a folio at
    // zero is the work of a shift.
    expect(
      BillingFolioCloseCommandSchema.safeParse({ property_id: PROPERTY, folio_id: FOLIO }).success,
    ).toBe(true);
  });

  it("refuses a forced group checkout with no reason code", () => {
    const result = BillingGroupCheckoutCommandSchema.safeParse({
      property_id: PROPERTY,
      group_booking_id: GROUP,
      force: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("asks for nothing on an ordinary group checkout", () => {
    expect(
      BillingGroupCheckoutCommandSchema.safeParse({
        property_id: PROPERTY,
        group_booking_id: GROUP,
      }).success,
    ).toBe(true);
  });
});

// ─── billing.folio.close ────────────────────────────────────────────────────

describe("billing.folio.close — forcing costs the code's approval level", () => {
  const payload = {
    property_id: PROPERTY,
    folio_id: FOLIO,
    force: true,
    reason_code: "FC_DISPUTE_HELD",
  };

  it("refuses a clerk closing over a balance on a manager's code", () => {
    queryMock.mockResolvedValue({ rows: [closeReason()] });
    return expect(closeFolio(payload, ctx("STAFF"))).rejects.toMatchObject({
      code: "OVERRIDE_AUTHORITY_INSUFFICIENT",
    });
  });

  it("refuses a reason code that is not configured", () => {
    queryMock.mockResolvedValue({ rows: [] });
    return expect(
      closeFolio({ ...payload, reason_code: "NOT_A_CODE" }, ctx("OWNER")),
    ).rejects.toMatchObject({ code: "REASON_CODE_NOT_FOUND" });
  });

  it("refuses a check-out code filed against a folio close", () => {
    // The category split is the point of this command's own vocabulary:
    // CO_TO_CITY_LEDGER asserts a transfer that closing a folio never performs,
    // and it sits at level NONE, so reusing it would have waived the check as
    // well as misdescribed the act.
    queryMock.mockResolvedValue({
      rows: [closeReason({ reason_category: "CHECK_OUT_OVERRIDE", reason_code: "CO_TO_CITY_LEDGER" })],
    });
    return expect(
      closeFolio({ ...payload, reason_code: "CO_TO_CITY_LEDGER" }, ctx("OWNER")),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
  });

  it("refuses an approval level the product cannot interpret", () => {
    queryMock.mockResolvedValue({ rows: [closeReason({ approval_level: "REGIONAL_VP" })] });
    return expect(closeFolio(payload, ctx("OWNER"))).rejects.toMatchObject({
      code: "OVERRIDE_AUTHORITY_UNKNOWN",
    });
  });

  it("lets a manager close over a balance, and records what was abandoned", async () => {
    queryMock.mockResolvedValue({ rows: [closeReason()] });
    runCloseTransaction("150.00");

    await expect(closeFolio(payload, ctx("MANAGER"))).resolves.toBe(FOLIO);

    expect(recordFlowApprovalMock).toHaveBeenCalledTimes(1);
    expect(recordFlowApprovalMock.mock.calls[0]?.[0]).toMatchObject({
      gate_name: "folio_settlement_check",
      entity_type: "folio",
      entity_id: FOLIO,
      forced: true,
      reason_code: "FC_DISPUTE_HELD",
      role_at_approval: "MANAGER",
    });
    // The number is the whole point of the row: "a folio was closed" is not a
    // finding, "£150 stopped being collectable" is.
    expect(recordFlowApprovalMock.mock.calls[0]?.[0]?.reason_notes).toContain("150");
  });

  it("records nothing when the folio settled at zero", async () => {
    // Force was set and the balance turned out to be nil, so nothing was
    // bypassed. A row claiming an override that did not happen is worse than no
    // row — it is the free-text `force: true` this change exists to replace.
    queryMock.mockResolvedValue({ rows: [closeReason()] });
    runCloseTransaction("0.00");
    await closeFolio(payload, ctx("MANAGER"));
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("survives a record that cannot be written", async () => {
    // Fail-open, like every other bypass writer here: the folio is closed and
    // the balance is behind it, so throwing now would report a close that
    // happened as one that did not.
    queryMock.mockResolvedValue({ rows: [closeReason()] });
    runCloseTransaction("150.00");
    recordFlowApprovalMock.mockRejectedValueOnce(new Error("flow_approvals unavailable"));
    await expect(closeFolio(payload, ctx("MANAGER"))).resolves.toBe(FOLIO);
  });

  it("touches no reason code and no authority on an ordinary close", async () => {
    runCloseTransaction("0.00");
    const err = await closeFolio(
      { property_id: PROPERTY, folio_id: FOLIO },
      ctx("STAFF"),
    ).catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("REASON_CODE_NOT_FOUND");
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
    expect(queryMock).not.toHaveBeenCalled();
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses an unforced close over a balance", async () => {
    // The gate itself is unchanged: this is the refusal, not the override.
    runCloseTransaction("150.00");
    await expect(
      closeFolio({ property_id: PROPERTY, folio_id: FOLIO }, ctx("STAFF")),
    ).rejects.toMatchObject({ code: "FOLIO_UNSETTLED" });
  });
});

// ─── billing.group.checkout ─────────────────────────────────────────────────

describe("billing.group.checkout — the same control, once per room", () => {
  const payload = {
    property_id: PROPERTY,
    group_booking_id: GROUP,
    force: true,
    reason_code: "CO_DISPUTE_OPEN",
  };

  /** Master folio, then member folios, then the reason code. */
  const wire = (reason: Record<string, unknown> | null, memberBalance = "120.00") => {
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce({
        rows: [{ folio_id: "master-1", folio_status: "OPEN", balance: "0.00" }],
      })
      .mockResolvedValueOnce({
        rows: [{ folio_id: "member-1", balance: memberBalance, reservation_id: "res-1" }],
      })
      .mockResolvedValue({ rows: reason === null ? [] : [reason] });
  };

  it("refuses a clerk departing a group over unsettled folios", () => {
    wire(checkoutReason());
    return expect(checkoutGroup(payload, ctx("STAFF"))).rejects.toMatchObject({
      code: "OVERRIDE_AUTHORITY_INSUFFICIENT",
    });
  });

  it("refuses a folio-close code filed against a group departure", () => {
    wire(checkoutReason({ reason_category: "FOLIO_CLOSE_OVERRIDE", reason_code: "FC_DISPUTE_HELD" }));
    return expect(
      checkoutGroup({ ...payload, reason_code: "FC_DISPUTE_HELD" }, ctx("OWNER")),
    ).rejects.toMatchObject({ code: "REASON_CODE_WRONG_CATEGORY" });
  });

  it("lets a manager through the gate", async () => {
    wire(checkoutReason());
    withTransactionMock.mockResolvedValue(undefined);
    const err = await checkoutGroup(payload, ctx("MANAGER")).catch((e: { code?: string }) => e);
    expect((err as { code?: string })?.code).not.toBe("OVERRIDE_AUTHORITY_INSUFFICIENT");
  });

  it("records the bypass once the folios have actually closed", async () => {
    wire(checkoutReason());
    withTransactionMock.mockResolvedValue(undefined);
    await checkoutGroup(payload, ctx("MANAGER"));
    expect(recordFlowApprovalMock).toHaveBeenCalledTimes(1);
    expect(recordFlowApprovalMock.mock.calls[0]?.[0]).toMatchObject({
      gate_name: "folio_settlement_check",
      forced: true,
      reason_code: "CO_DISPUTE_OPEN",
      role_at_approval: "MANAGER",
    });
  });

  it("records nothing when every member folio was already settled", async () => {
    wire(checkoutReason(), "0.00");
    withTransactionMock.mockResolvedValue(undefined);
    await checkoutGroup(payload, ctx("MANAGER"));
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("still refuses an unforced departure over unsettled folios", () => {
    // The gate itself is unchanged: this is the refusal, not the override.
    wire(null);
    return expect(
      checkoutGroup({ property_id: PROPERTY, group_booking_id: GROUP }, ctx("OWNER")),
    ).rejects.toMatchObject({ code: "UNSETTLED_FOLIOS" });
  });
});

/**
 * The credit-limit override (A05).
 *
 * `CREDIT_LIMIT_EXCEEDED` was a hard throw with no way past it, on the guest's
 * block threshold and on an AR account's available credit. The only way through
 * was to raise the limit, which rewrites the control instead of recording that
 * it was overridden once, by whom, and why.
 *
 * What these hold is the order of the three conditions, because the order is
 * what makes it a control rather than a flag: asked for → resolved in the right
 * category → authorised for the role that asked. A payload field alone would
 * have been the `force: true` this finding exists to remove.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ArCityLedgerTransferCommandSchema,
  BillingPaymentAuthorizeCommandSchema,
  BillingPaymentCaptureCommandSchema,
} from "../src/schemas/billing-commands.js";
import {
  clearCreditLimitGate,
  recordCreditLimitOverride,
} from "../src/services/billing-commands/credit-limit-gate.js";

const { queryMock, recordFlowApprovalMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  recordFlowApprovalMock: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../src/repositories/flow-approval-repository.js", () => ({
  recordFlowApproval: recordFlowApprovalMock,
}));

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";
const ACTOR = "44444444-4444-4444-4444-444444444444";

/** A reason code as `resolveReasonCode` reads it back. */
const reasonRow = (over: Record<string, unknown> = {}) => ({
  reason_id: "55555555-5555-5555-5555-555555555555",
  reason_code: "CL_COMPANY_GUARANTEED",
  reason_name: "Guaranteed by the company account",
  reason_category: "CREDIT_LIMIT",
  requires_approval: true,
  approval_level: "MANAGER",
  has_financial_impact: true,
  ...over,
});

const gateInput = (role: string) => ({
  context: {
    tenantId: TENANT,
    correlationId: null,
    initiatedBy: { userId: ACTOR, role },
  },
  propertyId: PROPERTY,
  commandName: "billing.payment.capture",
  flowName: "in_house",
  entityType: "guest",
  entityId: GUEST,
  detail: "Payment of 500 would push utilization to 104.0%.",
});

const override = (over: Record<string, unknown> = {}) => ({
  requested: true,
  reasonCode: "CL_COMPANY_GUARANTEED",
  notes: undefined,
  ...over,
});

beforeEach(() => {
  queryMock.mockReset();
  recordFlowApprovalMock.mockReset();
  recordFlowApprovalMock.mockResolvedValue("approval-id");
});

describe("without an override the block is what it always was", () => {
  it("refuses, and names the way through rather than an override that does not exist", async () => {
    await expect(
      clearCreditLimitGate(gateInput("MANAGER"), override({ requested: false })),
    ).rejects.toThrow(/credit_limit_override_reason_code/);
    // Nothing is read and nothing is written on the path that refuses.
    expect(queryMock).not.toHaveBeenCalled();
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });
});

describe("the reason code has to be real, and of this kind", () => {
  it("refuses a code that resolves to nothing", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(
      clearCreditLimitGate(gateInput("MANAGER"), override({ reasonCode: "NOPE" })),
    ).rejects.toThrow(/REASON_CODE_NOT_FOUND|not configured/);
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses a real code from another category", async () => {
    // A credit decision filed under a room move makes the "why was this
    // overridden" report unanswerable, which is what the column is for.
    queryMock.mockResolvedValue({
      rows: [reasonRow({ reason_code: "RM_VIP", reason_category: "ROOM_MOVE" })],
    });
    await expect(
      clearCreditLimitGate(gateInput("MANAGER"), override({ reasonCode: "RM_VIP" })),
    ).rejects.toThrow(/category/);
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });
});

describe("the role has to clear the code's approval level", () => {
  it("refuses a clerk naming a manager-level code", async () => {
    queryMock.mockResolvedValue({ rows: [reasonRow()] });
    await expect(
      clearCreditLimitGate(gateInput("STAFF"), override()),
    ).rejects.toThrow(/OVERRIDE_AUTHORITY_INSUFFICIENT|requires MANAGER/);
    // The refusal is the point: no row, so nothing records an override the
    // clerk was not entitled to make.
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses a manager naming a director-level code", async () => {
    queryMock.mockResolvedValue({
      rows: [reasonRow({ reason_code: "CL_DIRECTOR_AUTHORIZED", approval_level: "DIRECTOR" })],
    });
    await expect(
      clearCreditLimitGate(gateInput("MANAGER"), override({ reasonCode: "CL_DIRECTOR_AUTHORIZED" })),
    ).rejects.toThrow(/ADMIN/);
  });

  it("refuses a level nobody can interpret rather than treating it as none", async () => {
    queryMock.mockResolvedValue({ rows: [reasonRow({ approval_level: "REGIONAL_VP" })] });
    await expect(
      clearCreditLimitGate(gateInput("OWNER"), override()),
    ).rejects.toThrow(/OVERRIDE_AUTHORITY_UNKNOWN|cannot enforce|not a level/);
  });

  it("refuses the system actor, which is not a membership at all", async () => {
    // A scheduler or a replay must not be able to clear a credit block.
    queryMock.mockResolvedValue({ rows: [reasonRow()] });
    await expect(
      clearCreditLimitGate(gateInput("SYSTEM"), override()),
    ).rejects.toThrow(/OVERRIDE_AUTHORITY_INSUFFICIENT|requires MANAGER/);
  });
});

describe("an authorised override is recorded, but only once it happened", () => {
  it("writes nothing at the gate itself", async () => {
    // The gate authorises; the caller records after the operation commits. The
    // first version wrote here, and the city-ledger transfer — which failed
    // after the gate on a 42P10 and retried — produced three rows for one
    // decision and a transfer that never occurred.
    queryMock.mockResolvedValue({ rows: [reasonRow()] });
    await clearCreditLimitGate(gateInput("MANAGER"), override());
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("writes one flow_approvals row carrying the resolved code and the real role", async () => {
    queryMock.mockResolvedValue({ rows: [reasonRow()] });

    const reason = await clearCreditLimitGate(gateInput("MANAGER"), override());
    await recordCreditLimitOverride(gateInput("MANAGER"), reason);

    expect(reason.reason_code).toBe("CL_COMPANY_GUARANTEED");
    expect(recordFlowApprovalMock).toHaveBeenCalledTimes(1);
    const row = recordFlowApprovalMock.mock.calls[0]?.[0];
    expect(row).toMatchObject({
      tenant_id: TENANT,
      property_id: PROPERTY,
      flow_name: "in_house",
      gate_name: "credit_limit_check",
      entity_type: "guest",
      entity_id: GUEST,
      approved_by: ACTOR,
      role_at_approval: "MANAGER",
      forced: true,
      reason_code: "CL_COMPANY_GUARANTEED",
    });
  });

  it("does not fail the operation when the record cannot be written", async () => {
    // Fail-open on the write only, and by then the money has moved: failing
    // here would report an override that did happen as one that did not.
    queryMock.mockResolvedValue({ rows: [reasonRow()] });
    recordFlowApprovalMock.mockRejectedValue(new Error("flow_approvals unavailable"));

    await expect(
      recordCreditLimitOverride(gateInput("MANAGER"), reasonRow()),
    ).resolves.toBeUndefined();
  });
});

describe("the payload refuses an override with no stated reason", () => {
  const captureBase = {
    property_id: PROPERTY,
    folio_id: "66666666-6666-6666-6666-666666666666",
    amount: 100,
    payment_method: "CREDIT_CARD",
    payment_reference: "TEST-1",
  };

  it("accepts an ordinary capture with no override fields", () => {
    expect(BillingPaymentCaptureCommandSchema.safeParse(captureBase).success).toBe(true);
  });

  it("refuses a capture override with no reason code", () => {
    const result = BillingPaymentCaptureCommandSchema.safeParse({
      ...captureBase,
      credit_limit_override: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      "credit_limit_override_reason_code",
    );
  });

  it("refuses an authorize override with no reason code", () => {
    const result = BillingPaymentAuthorizeCommandSchema.safeParse({
      property_id: PROPERTY,
      reservation_id: "77777777-7777-7777-7777-777777777777",
      guest_id: GUEST,
      amount: 100,
      payment_method: "CREDIT_CARD",
      payment_reference: "TEST-2",
      credit_limit_override: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      "credit_limit_override_reason_code",
    );
  });

  it("refuses a city-ledger transfer override with no reason code", () => {
    const result = ArCityLedgerTransferCommandSchema.safeParse({
      property_id: PROPERTY,
      folio_id: "66666666-6666-6666-6666-666666666666",
      ar_account_id: "88888888-8888-8888-8888-888888888888",
      credit_limit_override: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      "credit_limit_override_reason_code",
    );
  });
});

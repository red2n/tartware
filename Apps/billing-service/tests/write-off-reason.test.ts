/**
 * A write-off states what was decided, not just who decided it (A07).
 *
 * Dual control (A04) settled the *who*: two owners, one raising and one
 * releasing. The *what* was a sentence of free text with a ten-character floor,
 * so a year of write-offs could not be separated into bad debt, goodwill,
 * settled disputes and small balances — the first cut an auditor asks for.
 */

import { FlowId, flowControlNames } from "@tartware/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArCityLedgerWriteOffCommandSchema } from "../src/schemas/billing-commands.js";

const { queryMock, queryWithClientMock, withTransactionMock, postGlPairMock, recordFlowApprovalMock, auditAsyncMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    queryWithClientMock: vi.fn(),
    withTransactionMock: vi.fn(),
    postGlPairMock: vi.fn(),
    recordFlowApprovalMock: vi.fn(),
    auditAsyncMock: vi.fn(),
  }));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: queryWithClientMock,
  withTransaction: withTransactionMock,
}));

vi.mock("../src/lib/gl-posting.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  postGlPair: postGlPairMock,
}));

vi.mock("../src/repositories/flow-approval-repository.js", () => ({
  recordFlowApproval: recordFlowApprovalMock,
}));

vi.mock("../src/lib/audit-logger.js", () => ({ auditAsync: auditAsyncMock }));

const base = {
  property_id: "11111111-1111-1111-1111-111111111111",
  city_ledger_id: "22222222-2222-2222-2222-222222222222",
  amount: 250,
  reason: "collection agency returned the account as uncollectable",
};

describe("the payload demands a code", () => {
  it("refuses a write-off with narrative alone", () => {
    const result = ArCityLedgerWriteOffCommandSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("accepts one that names a code", () => {
    expect(
      ArCityLedgerWriteOffCommandSchema.safeParse({
        ...base,
        reason_code: "WO_BAD_DEBT",
      }).success,
    ).toBe(true);
  });

  it("still demands the narrative as well as the code", () => {
    // The code groups; the sentence explains this one. Neither replaces the
    // other, which is why `reason` keeps its ten-character floor.
    expect(
      ArCityLedgerWriteOffCommandSchema.safeParse({
        ...base,
        reason: "bad",
        reason_code: "WO_BAD_DEBT",
      }).success,
    ).toBe(false);
  });
});

describe("the control is declared where the ledger work lives", () => {
  it("LEDGER_CONTROL declares the write-off record", () => {
    expect(
      flowControlNames(FlowId.LEDGER_CONTROL, {
        guardsCommand: "ar.city_ledger.write_off",
        kind: "record",
      }),
    ).toEqual(["write_off"]);
  });

  it("and keeps it separate from the dual-control gate on the same command", () => {
    // Two different questions about one command: may this person run it alone
    // (gate), and what did they decide (record). Collapsing them would lose the
    // second the day the first changes.
    expect(
      flowControlNames(FlowId.LEDGER_CONTROL, {
        guardsCommand: "ar.city_ledger.write_off",
        kind: "gate",
      }),
    ).toContain("dual_control");
  });
});

describe("the amount is measured, not only the act (A07's outstanding half)", () => {
  // The reason code says why a balance was forgiven, the OWNER floor and dual
  // control say who may forgive one. Neither looked at how much: a small
  // residual and a five-figure bad debt were the same command. A07 closed as
  // half done for a concrete reason — there was no written policy to read, and
  // `resolveSettings` lived where billing could not call it.
  const TENANT = "11111111-1111-1111-1111-111111111111";
  const PROPERTY = "22222222-2222-2222-2222-222222222222";
  const ENTRY = "33333333-3333-3333-3333-333333333333";

  const entryRow = {
    entry_id: ENTRY,
    ar_account_id: "44444444-4444-4444-4444-444444444444",
    outstanding_balance: "5000",
    currency: "USD",
    entry_status: "OPEN",
  };

  const reasonRow = {
    reason_id: "55555555-5555-5555-5555-555555555555",
    reason_code: "WO_SMALL_BALANCE",
    reason_name: "Small balance below the collection floor",
    reason_category: "WRITE_OFF",
    requires_approval: true,
    approval_level: "NONE",
    has_financial_impact: true,
  };

  /** Three reads in order: the ledger entry, the reason code, the policy. */
  const wire = (policyRows: { code: string; value: unknown }[] = []) => {
    queryMock.mockReset();
    queryMock.mockResolvedValueOnce({ rows: [entryRow] });
    queryMock.mockResolvedValueOnce({ rows: [reasonRow] });
    queryMock.mockResolvedValueOnce({ rows: policyRows });
    queryWithClientMock.mockResolvedValue({ rows: [{ today: "2026-09-01" }] });
    withTransactionMock.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn({}));
    postGlPairMock.mockResolvedValue(undefined);
    recordFlowApprovalMock.mockResolvedValue(undefined);
  };

  const writeOff = async (amount: number, role: string) => {
    const { writeOffCityLedger } = await import("../src/services/billing-commands/ara.js");
    return writeOffCityLedger(
      {
        property_id: PROPERTY,
        city_ledger_id: ENTRY,
        amount,
        reason_code: "WO_SMALL_BALANCE",
        reason: "collection agency returned the account as uncollectable",
      },
      { tenantId: TENANT, initiatedBy: { userId: "66666666-6666-6666-6666-666666666666", role } },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a manager clear a small residual", async () => {
    wire();
    await expect(writeOff(40, "MANAGER")).resolves.toBe(ENTRY);
    expect(withTransactionMock).toHaveBeenCalled();
  });

  it("refuses a four-figure write-off from a manager", async () => {
    wire();
    await expect(writeOff(2_500, "MANAGER")).rejects.toMatchObject({
      code: "WRITE_OFF_EXCEEDS_AUTHORITY",
    });
    // Nothing was posted and nothing was recorded — the refusal is before the
    // transaction, not a rollback after it.
    expect(withTransactionMock).not.toHaveBeenCalled();
    expect(recordFlowApprovalMock).not.toHaveBeenCalled();
  });

  it("lets an admin clear it", async () => {
    wire();
    await expect(writeOff(2_500, "ADMIN")).resolves.toBe(ENTRY);
  });

  it("keeps the top rung for an owner", async () => {
    wire();
    await expect(writeOff(40_000, "ADMIN")).rejects.toMatchObject({
      code: "WRITE_OFF_EXCEEDS_AUTHORITY",
    });
    wire();
    await expect(writeOff(40_000, "OWNER")).resolves.toBe(ENTRY);
  });

  it("honours a tenant that has set its own ladder", async () => {
    wire([
      {
        code: "WORKFLOW.FINANCE.WRITE_OFF_APPROVALS",
        value: { amountApprovalThresholds: [{ amount: 10, approverRole: "GENERAL_MANAGER" }] },
      },
    ]);
    await expect(writeOff(40, "ADMIN")).rejects.toMatchObject({
      code: "WRITE_OFF_EXCEEDS_AUTHORITY",
    });
  });

  it("refuses a policy nobody can read, rather than falling back to the default", async () => {
    // Silently defaulting would let a malformed edit relax a threshold a
    // property had deliberately tightened.
    wire([
      { code: "WORKFLOW.FINANCE.WRITE_OFF_APPROVALS", value: { amountApprovalThresholds: "all" } },
    ]);
    await expect(writeOff(40, "OWNER")).rejects.toMatchObject({
      code: "OVERRIDE_POLICY_UNREADABLE",
    });
  });
});

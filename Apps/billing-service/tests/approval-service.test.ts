import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveRequest,
  cancelApprovalRequest,
  rejectRequest,
} from "../src/services/approval-service.js";

const { queryMock, queryWithClientMock, withTransactionMock, auditAsyncMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  queryWithClientMock: vi.fn(),
  withTransactionMock: vi.fn(),
  auditAsyncMock: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: queryWithClientMock,
  withTransaction: withTransactionMock,
}));

vi.mock("../src/lib/audit-logger.js", () => ({ auditAsync: auditAsyncMock }));

const TENANT = "11111111-1111-1111-1111-111111111111";
const APPROVAL = "22222222-2222-2222-2222-222222222222";
const ENTITY = "33333333-3333-3333-3333-333333333333";
const REQUESTER = "44444444-4444-4444-4444-444444444444";
const APPROVER = "55555555-5555-5555-5555-555555555555";

/** A PENDING row as `_resolveRequest` reads it back under FOR UPDATE. */
const pendingRow = (over: Record<string, unknown> = {}) => ({
  approval_id: APPROVAL,
  tenant_id: TENANT,
  property_id: null,
  operation_type: "WRITEOFF",
  entity_type: "folio",
  entity_id: ENTITY,
  operation_payload: {},
  description: null,
  required_role: "MANAGER",
  requested_by: REQUESTER,
  requested_by_name: null,
  status: "PENDING",
  actioned_by: null,
  actioned_by_name: null,
  actioned_at: null,
  action_reason: null,
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: null,
  updated_by: null,
  ...over,
});

const wire = (row: Record<string, unknown> | undefined) => {
  withTransactionMock.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn({}));
  queryWithClientMock.mockReset();
  // First call is the locking SELECT; every later call is the UPDATE.
  queryWithClientMock.mockResolvedValueOnce({ rows: row ? [row] : [] });
  queryWithClientMock.mockResolvedValue({ rows: [] });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveRequest — four eyes", () => {
  it("refuses when the approver is the requester", async () => {
    wire(pendingRow());
    await expect(
      approveRequest(
        {
          approval_id: APPROVAL,
          actioned_by: REQUESTER,
          actioned_by_role: "MANAGER",
        },
        TENANT,
      ),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
  });

  it("allows a different user who holds the required role", async () => {
    wire(pendingRow());
    const row = await approveRequest(
      { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "MANAGER" },
      TENANT,
    );
    expect(row.status).toBe("APPROVED");
  });
});

describe("approveRequest — required_role", () => {
  it("refuses an approver below the role the request demands", async () => {
    wire(pendingRow({ required_role: "OWNER" }));
    await expect(
      approveRequest(
        { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "MANAGER" },
        TENANT,
      ),
    ).rejects.toMatchObject({ code: "APPROVER_ROLE_INSUFFICIENT" });
  });

  it("allows an approver above it — the ladder is a floor, not an equality", async () => {
    wire(pendingRow({ required_role: "MANAGER" }));
    const row = await approveRequest(
      { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "OWNER" },
      TENANT,
    );
    expect(row.status).toBe("APPROVED");
  });

  it("refuses when the approver has no role at all", async () => {
    wire(pendingRow());
    await expect(
      approveRequest({ approval_id: APPROVAL, actioned_by: APPROVER }, TENANT),
    ).rejects.toMatchObject({ code: "APPROVER_ROLE_INSUFFICIENT" });
  });

  it("fails closed on a stored role that is not a known role", async () => {
    // required_role is VARCHAR(60); a legacy or hand-edited row can hold
    // anything. Scoring an unknown string as 0 would admit everyone.
    wire(pendingRow({ required_role: "GENERAL_MANAGER" }));
    await expect(
      approveRequest(
        { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "OWNER" },
        TENANT,
      ),
    ).rejects.toMatchObject({ code: "APPROVER_ROLE_INSUFFICIENT" });
  });
});

describe("rejectRequest", () => {
  it("needs no particular role — declining is not an escalation", async () => {
    wire(pendingRow({ required_role: "OWNER" }));
    const row = await rejectRequest(
      { approval_id: APPROVAL, actioned_by: APPROVER, reason: "Not justified" },
      TENANT,
    );
    expect(row.status).toBe("REJECTED");
  });

  it("still refuses a self-rejection", async () => {
    wire(pendingRow());
    await expect(
      rejectRequest(
        { approval_id: APPROVAL, actioned_by: REQUESTER, reason: "Withdrawn" },
        TENANT,
      ),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
  });
});

describe("cancelApprovalRequest", () => {
  it("lets the original requester withdraw their own request", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ approval_id: APPROVAL, status: "CANCELLED" }] });
    await expect(
      cancelApprovalRequest({ approval_id: APPROVAL, cancelled_by: REQUESTER }, TENANT),
    ).resolves.toBe(APPROVAL);
  });

  it("refuses someone else withdrawing it", async () => {
    // The UPDATE matches nothing because of the requested_by predicate, then
    // the lookup explains which of the three reasons applied.
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({
      rows: [{ status: "PENDING", requested_by: REQUESTER }],
    });
    await expect(
      cancelApprovalRequest({ approval_id: APPROVAL, cancelled_by: APPROVER }, TENANT),
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_REQUESTER" });
  });

  it("still reports a genuinely missing or already-actioned request", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(
      cancelApprovalRequest({ approval_id: APPROVAL, cancelled_by: REQUESTER }, TENANT),
    ).rejects.toMatchObject({ code: "APPROVAL_CANCEL_FAILED" });
  });
});

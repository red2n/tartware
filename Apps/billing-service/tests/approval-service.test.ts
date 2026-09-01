import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveRequest,
  cancelApprovalRequest,
  getApprovalRequest,
  listPendingApprovals,
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

describe("the queue boundary — operations here, deferred commands at the gateway", () => {
  // `approval_requests` holds two populations. A row with `command_name` set is
  // a command `acceptCommand` deferred, and releasing one has to *dispatch* the
  // stored payload. This service does not dispatch: it flips a status and
  // writes an audit line. So a deferred write-off actioned here would read
  // APPROVED for a command that never ran, and the gateway would then refuse it
  // as no longer PENDING — the write-off silently killed.
  //
  // These assert the SQL rather than a returned row on purpose. The filter is
  // the whole control, it lives in six statements, and a mocked pg cannot tell
  // us whether a predicate is present by what it hands back.
  const sqlOf = (mock: { mock: { calls: unknown[][] } }, call: number, arg: number): string =>
    String(mock.mock.calls[call]?.[arg] ?? "");

  it("scopes the lock that gates approve and reject", async () => {
    wire(pendingRow());
    await approveRequest(
      { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "MANAGER" },
      TENANT,
    );
    expect(sqlOf(queryWithClientMock, 0, 1)).toContain("command_name IS NULL");
  });

  it("scopes the list pms-ui renders", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await listPendingApprovals({ tenantId: TENANT, limit: 20, offset: 0 });
    expect(sqlOf(queryMock, 0, 0)).toContain("command_name IS NULL");
  });

  it("scopes the single-row read", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await getApprovalRequest(APPROVAL, TENANT);
    expect(sqlOf(queryMock, 0, 0)).toContain("command_name IS NULL");
  });

  it("scopes the cancel, and the lookup that explains a failed one", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(
      cancelApprovalRequest({ approval_id: APPROVAL, cancelled_by: REQUESTER }, TENANT),
    ).rejects.toMatchObject({ code: "APPROVAL_CANCEL_FAILED" });
    expect(sqlOf(queryMock, 0, 0)).toContain("command_name IS NULL");
    expect(sqlOf(queryMock, 1, 0)).toContain("command_name IS NULL");
  });

  it("reports a deferred command as not found rather than actioning it", async () => {
    // The filter turns the gateway's row into no row at all, which lands on the
    // path a missing approval already takes. A caller who pastes a deferred
    // approval id into billing's route is told it is not here, not told it is
    // approved.
    wire(undefined);
    await expect(
      approveRequest(
        { approval_id: APPROVAL, actioned_by: APPROVER, actioned_by_role: "OWNER" },
        TENANT,
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" });
  });
});

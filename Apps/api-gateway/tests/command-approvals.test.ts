/**
 * Releasing a deferred command.
 *
 * The rules of a four-eyes decision are proved in the schema package; the
 * wiring proved here is the part that was missing entirely — that approving
 * *dispatches the stored payload*, that two approvers cannot both release the
 * same request, and that a dispatch which fails does not leave a request
 * reading APPROVED for a command that never ran.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/logger.js", () => ({
  gatewayLogger: { child: () => logger },
}));

const acceptCommand = vi.fn();
vi.mock("../src/command-center/command-dispatch-service.js", () => ({
  acceptCommand: (...args: unknown[]) => acceptCommand(...args),
}));

const sql = {
  claimCommandApproval: vi.fn(),
  findCommandApproval: vi.fn(),
  listPendingCommandApprovals: vi.fn(),
  recordApprovalDispatch: vi.fn(),
  rejectCommandApproval: vi.fn(),
  releaseCommandApproval: vi.fn(),
};
vi.mock("../src/command-center/sql/command-approvals.js", () => sql);

const { approveCommandRequest, rejectCommandRequest } = await import(
  "../src/command-center/command-approval-service.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const APPROVAL = "33333333-3333-3333-3333-333333333333";
const COMMAND_ID = "44444444-4444-4444-4444-444444444444";

const row = (overrides: Record<string, unknown> = {}) => ({
  approval_id: APPROVAL,
  tenant_id: TENANT,
  property_id: null,
  command_name: "ar.city_ledger.write_off",
  request_id: "idem-key-0001",
  operation_type: "ar.city_ledger.write_off",
  entity_type: "command",
  entity_id: "22222222-2222-2222-2222-222222222222",
  operation_payload: { account_id: "22222222-2222-2222-2222-222222222222", amount: 4200 },
  description: "unrecoverable after two years",
  requested_by: "clerk",
  requested_by_name: null,
  requested_by_role: "MANAGER",
  requested_at: "2026-08-30T12:00:00.000Z",
  status: "PENDING",
  required_role: "OWNER",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  actioned_by: null,
  actioned_by_name: null,
  actioned_at: null,
  action_reason: null,
  dispatched_command_id: null,
  created_at: "2026-08-30T12:00:00.000Z",
  updated_at: null,
  ...overrides,
});

const owner = { id: "gm", name: null, role: "OWNER" };
const membership = { tenantId: TENANT, role: "OWNER" } as never;

const approve = (actor = owner) =>
  approveCommandRequest({
    tenantId: TENANT,
    approvalId: APPROVAL,
    actor,
    membership,
    reason: "reviewed the ledger",
  });

beforeEach(() => {
  vi.clearAllMocks();
  sql.findCommandApproval.mockResolvedValue(row());
  sql.claimCommandApproval.mockResolvedValue(row({ status: "APPROVED", actioned_by: "gm" }));
  sql.recordApprovalDispatch.mockResolvedValue(
    row({ status: "APPROVED", actioned_by: "gm", dispatched_command_id: COMMAND_ID }),
  );
  sql.rejectCommandApproval.mockResolvedValue(row({ status: "REJECTED", actioned_by: "gm" }));
  acceptCommand.mockResolvedValue({ status: "accepted", commandId: COMMAND_ID });
});

describe("approveCommandRequest", () => {
  it("dispatches the stored payload — approving causes the operation", async () => {
    const result = await approve();

    expect(acceptCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "ar.city_ledger.write_off",
        tenantId: TENANT,
        payload: { account_id: "22222222-2222-2222-2222-222222222222", amount: 4200 },
        // Derived from the approval, so a retried approval replays the command
        // that already exists instead of writing the balance off twice.
        requestId: `approval-${APPROVAL}`,
        initiatedBy: { userId: "clerk", role: "MANAGER" },
        approvalGrant: expect.objectContaining({ approvalId: APPROVAL, approverId: "gm" }),
      }),
    );
    expect(result.commandId).toBe(COMMAND_ID);
    expect(sql.recordApprovalDispatch).toHaveBeenCalledWith(TENANT, APPROVAL, COMMAND_ID);
  });

  it("refuses the requester approving their own request", async () => {
    await expect(approve({ id: "clerk", name: null, role: "OWNER" })).rejects.toMatchObject({
      statusCode: 403,
      code: "SELF_APPROVAL_FORBIDDEN",
    });
    expect(sql.claimCommandApproval).not.toHaveBeenCalled();
    expect(acceptCommand).not.toHaveBeenCalled();
  });

  it("refuses an approver below the request's required_role", async () => {
    await expect(approve({ id: "duty-manager", name: null, role: "MANAGER" })).rejects.toMatchObject(
      { statusCode: 403, code: "APPROVER_ROLE_INSUFFICIENT" },
    );
    expect(acceptCommand).not.toHaveBeenCalled();
  });

  it("refuses an expired request", async () => {
    sql.findCommandApproval.mockResolvedValue(
      row({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    );

    await expect(approve()).rejects.toMatchObject({
      statusCode: 409,
      code: "APPROVAL_EXPIRED",
    });
    expect(acceptCommand).not.toHaveBeenCalled();
  });

  it("lets only one of two simultaneous approvers through", async () => {
    // The claim is a conditional UPDATE, so the loser matches no row.
    sql.claimCommandApproval.mockResolvedValue(null);

    await expect(approve()).rejects.toMatchObject({
      statusCode: 409,
      code: "APPROVAL_NOT_PENDING",
    });
    expect(acceptCommand).not.toHaveBeenCalled();
  });

  it("returns the request to PENDING when the dispatch fails", async () => {
    acceptCommand.mockRejectedValue(new Error("broker unreachable"));

    await expect(approve()).rejects.toThrow("broker unreachable");

    // Otherwise the row reads APPROVED for a write-off that never happened,
    // which is the worst of the three states to be left in.
    expect(sql.releaseCommandApproval).toHaveBeenCalledWith(TENANT, APPROVAL);
    expect(sql.recordApprovalDispatch).not.toHaveBeenCalled();
  });

  it("404s on a request that is not there", async () => {
    sql.findCommandApproval.mockResolvedValue(null);

    await expect(approve()).rejects.toMatchObject({
      statusCode: 404,
      code: "APPROVAL_NOT_FOUND",
    });
  });
});

describe("rejectCommandRequest", () => {
  it("records the refusal and dispatches nothing", async () => {
    const rejected = await rejectCommandRequest({
      tenantId: TENANT,
      approvalId: APPROVAL,
      actor: owner,
      reason: "the debt is disputed, not uncollectable",
    });

    expect(rejected.status).toBe("REJECTED");
    expect(acceptCommand).not.toHaveBeenCalled();
  });

  it("does not require the approver's role — declining is not an escalation", async () => {
    const rejected = await rejectCommandRequest({
      tenantId: TENANT,
      approvalId: APPROVAL,
      actor: { id: "duty-manager", name: null, role: "MANAGER" },
      reason: "ask the controller first",
    });

    expect(rejected.status).toBe("REJECTED");
  });

  it("still refuses a self-rejection", async () => {
    await expect(
      rejectCommandRequest({
        tenantId: TENANT,
        approvalId: APPROVAL,
        actor: { id: "clerk", name: null, role: "MANAGER" },
        reason: "changed my mind",
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
    expect(sql.rejectCommandApproval).not.toHaveBeenCalled();
  });
});

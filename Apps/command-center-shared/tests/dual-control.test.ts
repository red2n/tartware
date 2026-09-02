/**
 * Dual control at the accept path.
 *
 * The declaration of *which* commands are deferred is proved in the schema
 * package. What matters here is the wiring: that a deferred command never
 * reaches the outbox, that the approval path's dispatch does, and that a
 * missing approval queue refuses rather than falls through — the failure mode
 * the control exists to prevent.
 */

import type { CommandApprovalTicket, CommandResolution } from "@tartware/schemas";
import { describe, expect, it, vi } from "vitest";

import {
  CommandDispatchError,
  createCommandDispatchService,
} from "../src/services/command-dispatch.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const AR_ACCOUNT = "22222222-2222-2222-2222-222222222222";

const resolved: CommandResolution = {
  status: "RESOLVED",
  route: {
    id: "route-1",
    command_name: "ar.city_ledger.write_off",
    environment: "test",
    tenant_id: null,
    service_id: "billing-service",
    topic: "commands.billing",
    weight: 100,
    status: "active",
    metadata: {},
    source: "template",
  },
  feature: null,
};

const ticket = (overrides: Partial<CommandApprovalTicket> = {}): CommandApprovalTicket => ({
  approvalId: "33333333-3333-3333-3333-333333333333",
  status: "PENDING",
  requiredRole: "OWNER",
  requestedBy: "controller",
  requestedAt: "2026-08-30T12:00:00.000Z",
  expiresAt: "2026-08-31T12:00:00.000Z",
  dispatchedCommandId: null,
  ...overrides,
});

const build = (options: { approval?: CommandApprovalTicket | null } = {}) => {
  const enqueueOutboxRecord = vi.fn(async () => {});
  const insertCommandDispatch = vi.fn(async () => true);
  const findCommandDispatchByRequest = vi.fn(async () => null);
  const requireCommandApproval = vi.fn(async () => options.approval ?? ticket());

  const service = createCommandDispatchService({
    resolveCommandForTenant: () => resolved,
    enqueueOutboxRecord,
    insertCommandDispatch,
    findCommandDispatchByRequest,
    ...(options.approval === null ? {} : { requireCommandApproval }),
  });

  return {
    ...service,
    enqueueOutboxRecord,
    insertCommandDispatch,
    requireCommandApproval,
  };
};

const submit = (
  service: ReturnType<typeof build>,
  overrides: Record<string, unknown> = {},
) =>
  service.acceptCommand({
    commandName: "ar.city_ledger.write_off",
    tenantId: TENANT,
    payload: { account_id: AR_ACCOUNT, reason: "unrecoverable after two years" },
    requestId: "idem-key-0001",
    initiatedBy: { userId: "controller", role: "ADMIN" },
    membership: {},
    ...overrides,
  });

describe("acceptCommand — a command under dual control", () => {
  it("becomes an approval request instead of an outbox record", async () => {
    const service = build();

    const result = await submit(service);

    expect(result.status).toBe("pending_approval");
    expect(service.enqueueOutboxRecord).not.toHaveBeenCalled();
    expect(service.insertCommandDispatch).not.toHaveBeenCalled();
    expect(service.requireCommandApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "ar.city_ledger.write_off",
        tenantId: TENANT,
        requestId: "idem-key-0001",
        approverRole: "OWNER",
      }),
    );
  });

  it("reports the request its idempotency key already raised, in whatever state", async () => {
    const service = build({ approval: ticket({ status: "REJECTED" }) });

    const result = await submit(service);

    expect(result).toMatchObject({
      status: "pending_approval",
      approval: { status: "REJECTED" },
    });
    expect(service.enqueueOutboxRecord).not.toHaveBeenCalled();
  });

  it("refuses outright when there is no queue to raise it in", async () => {
    const service = build({ approval: null });

    await expect(submit(service)).rejects.toMatchObject({
      statusCode: 503,
      code: "COMMAND_APPROVAL_UNAVAILABLE",
    });
    expect(service.enqueueOutboxRecord).not.toHaveBeenCalled();
  });

  it("dispatches once an approval releases it, and says who released it", async () => {
    const service = build();

    const result = await submit(service, {
      requestId: "approval-33333333-3333-3333-3333-333333333333",
      approvalGrant: {
        approvalId: "33333333-3333-3333-3333-333333333333",
        approverId: "gm",
        approverRole: "OWNER",
        approvedAt: "2026-08-30T13:00:00.000Z",
      },
    });

    expect(result.status).toBe("accepted");
    expect(service.enqueueOutboxRecord).toHaveBeenCalledTimes(1);
    expect(service.requireCommandApproval).not.toHaveBeenCalled();

    const [record] = service.enqueueOutboxRecord.mock.calls[0] as [
      { payload: { metadata: Record<string, unknown> } },
    ];
    // The requester stays the actor; the approver rides alongside. An override
    // record that cannot tell the two apart is the A03 defect again.
    expect(record.payload.metadata.initiatedBy).toEqual({
      userId: "controller",
      role: "ADMIN",
    });
    expect(record.payload.metadata.approval).toMatchObject({
      approverId: "gm",
      approverRole: "OWNER",
    });
  });

  it("leaves a command that is not under dual control alone", async () => {
    const service = build();

    // A void is reversible front-office work with its own floor — deferring it
    // too is what would turn the queue into a rubber stamp.
    const result = await submit(service, { commandName: "billing.charge.void" });

    expect(result.status).toBe("accepted");
    expect(service.requireCommandApproval).not.toHaveBeenCalled();
    expect(service.enqueueOutboxRecord).toHaveBeenCalledTimes(1);
  });
});

describe("CommandDispatchError", () => {
  it("carries the status the route should answer with", () => {
    const error = new CommandDispatchError(503, "COMMAND_APPROVAL_UNAVAILABLE", "nope");
    expect(error.statusCode).toBe(503);
  });
});

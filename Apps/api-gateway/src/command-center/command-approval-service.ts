import { type CommandApprovalRow, CommandDispatchError } from "@tartware/command-center-shared";
import { evaluateApprovalAction } from "@tartware/schemas";

import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

import { acceptCommand } from "./command-dispatch-service.js";
import {
  claimCommandApproval,
  findCommandApproval,
  listPendingCommandApprovals,
  recordApprovalDispatch,
  rejectCommandApproval,
  releaseCommandApproval,
} from "./sql/command-approvals.js";

const logger = gatewayLogger.child({ module: "command-approvals" });

/**
 * The second half of dual control: releasing a deferred command *runs* it.
 *
 * The queue has always been able to record a decision. What it could not do
 * was cause anything — approving flipped a status and wrote an audit line
 * while the stored payload sat there, so the approval and the operation were
 * unrelated events and nothing connected the two. Here the stored payload is
 * the thing that dispatches, from the row, on the approver's authority.
 */

/** The person acting on the request, always derived from the token. */
type ApprovalActor = {
  id: string;
  name: string | null;
  role: string | undefined;
};

const refusal = (status: number, code: string, message: string): CommandDispatchError =>
  new CommandDispatchError(status, code, message);

/**
 * HTTP status per refusal.
 *
 * A four-eyes or role refusal is 403 — the caller is not entitled to make this
 * decision. Expiry and a non-pending row are 409 — nothing is wrong with the
 * caller, the request is simply no longer actionable.
 */
const REFUSAL_STATUS: Record<string, number> = {
  SELF_APPROVAL_FORBIDDEN: 403,
  APPROVER_ROLE_INSUFFICIENT: 403,
  APPROVAL_NOT_PENDING: 409,
  APPROVAL_EXPIRED: 409,
};

const loadActionable = async (
  tenantId: string,
  approvalId: string,
  actor: ApprovalActor,
  action: "APPROVE" | "REJECT",
): Promise<CommandApprovalRow> => {
  const row = await findCommandApproval(tenantId, approvalId);
  if (!row) {
    throw refusal(404, "APPROVAL_NOT_FOUND", "Approval request not found.");
  }

  const decision = evaluateApprovalAction({
    action,
    status: row.status,
    expiresAt: row.expires_at,
    requestedBy: row.requested_by,
    requiredRole: row.required_role,
    actorId: actor.id,
    actorRole: actor.role,
  });
  if (!decision.ok) {
    logger.warn(
      {
        approvalId,
        tenantId,
        commandName: row.command_name,
        action,
        code: decision.code,
        actorRole: actor.role,
        requiredRole: row.required_role,
      },
      "approval decision refused",
    );
    throw refusal(REFUSAL_STATUS[decision.code] ?? 409, decision.code, decision.message);
  }

  return row;
};

/**
 * Approve a deferred command and dispatch it.
 *
 * The claim and the dispatch are two transactions, because `acceptCommand`
 * owns its own and cannot be nested inside this one. The order is chosen so
 * that neither failure leaves a lie on the row: the claim happens first, so
 * two approvers cannot both release the same request, and a dispatch that then
 * fails releases the claim rather than leaving a request marked APPROVED that
 * never ran.
 *
 * The dispatch's idempotency key is derived from the approval id, so a retried
 * approval — the response lost, the operator pressing it again — replays the
 * command that already exists instead of writing off the balance twice.
 */
export const approveCommandRequest = async (input: {
  tenantId: string;
  approvalId: string;
  actor: ApprovalActor;
  membership: TenantMembership;
  reason?: string;
  correlationId?: string;
}): Promise<{ approval: CommandApprovalRow; commandId: string }> => {
  await loadActionable(input.tenantId, input.approvalId, input.actor, "APPROVE");

  const claimed = await claimCommandApproval({
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    actionedBy: input.actor.id,
    actionedByName: input.actor.name,
    reason: input.reason ?? null,
  });
  if (!claimed) {
    // Someone else won the race between the read above and this update, or the
    // request expired in between.
    throw refusal(
      409,
      "APPROVAL_NOT_PENDING",
      "Approval is no longer pending — it was actioned or expired.",
    );
  }

  let acceptance: Awaited<ReturnType<typeof acceptCommand>>;
  try {
    acceptance = await acceptCommand({
      commandName: claimed.command_name,
      tenantId: input.tenantId,
      payload: claimed.operation_payload,
      correlationId: input.correlationId,
      requestId: `approval-${input.approvalId}`,
      // The operator who asked is the actor of record; the approver authorised
      // it. Collapsing the two would lose which is which on the one record
      // that has to say — see `role_at_approval` and A03.
      initiatedBy: claimed.requested_by_role
        ? { userId: claimed.requested_by, role: claimed.requested_by_role }
        : null,
      // The approver's own entitlement is re-checked at dispatch, so a
      // membership explicitly denied this command cannot approve it into
      // existence either. Deny beats everything, including here.
      membership: input.membership,
      approvalGrant: {
        approvalId: input.approvalId,
        approverId: input.actor.id,
        approverRole: input.actor.role ?? null,
        approvedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    await releaseCommandApproval(input.tenantId, input.approvalId);
    logger.error(
      { approvalId: input.approvalId, tenantId: input.tenantId, err: error },
      "approved command failed to dispatch; approval returned to PENDING",
    );
    throw error;
  }

  if (acceptance.status === "pending_approval") {
    // Unreachable while the grant satisfies the gate, and worth failing
    // loudly rather than reporting a dispatch that did not happen.
    await releaseCommandApproval(input.tenantId, input.approvalId);
    throw refusal(
      500,
      "APPROVAL_DISPATCH_DEFERRED",
      "Approved command was deferred again instead of dispatching.",
    );
  }

  const updated = await recordApprovalDispatch(
    input.tenantId,
    input.approvalId,
    acceptance.commandId,
  );

  logger.info(
    {
      approvalId: input.approvalId,
      tenantId: input.tenantId,
      commandName: claimed.command_name,
      commandId: acceptance.commandId,
      requestedBy: claimed.requested_by,
      approvedBy: input.actor.id,
    },
    "deferred command released by a second approver",
  );

  return { approval: updated ?? claimed, commandId: acceptance.commandId };
};

/** Reject a deferred command. The payload is kept; nothing dispatches. */
export const rejectCommandRequest = async (input: {
  tenantId: string;
  approvalId: string;
  actor: ApprovalActor;
  reason: string;
}): Promise<CommandApprovalRow> => {
  await loadActionable(input.tenantId, input.approvalId, input.actor, "REJECT");

  const rejected = await rejectCommandApproval({
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    actionedBy: input.actor.id,
    actionedByName: input.actor.name,
    reason: input.reason,
  });
  if (!rejected) {
    throw refusal(
      409,
      "APPROVAL_NOT_PENDING",
      "Approval is no longer pending — it was actioned or expired.",
    );
  }

  logger.info(
    {
      approvalId: input.approvalId,
      tenantId: input.tenantId,
      commandName: rejected.command_name,
      rejectedBy: input.actor.id,
    },
    "deferred command rejected",
  );

  return rejected;
};

export { findCommandApproval, listPendingCommandApprovals };

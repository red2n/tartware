/**
 * DEV DOC
 * Module: services/billing-commands/write-off-gate.ts
 * Purpose: The one implementation of what a write-off has to state and who has
 *          to be entitled to state it.
 * Ownership: billing-service
 *
 * Three commands take money off the books permanently — `ar.city_ledger.write_off`,
 * `billing.ar.write_off` and `billing.suspense.write_off` — and until now only
 * one of them was controlled. A07 hardened the city-ledger one and stopped
 * there for a stated reason: the other two had UI callers, and demanding a
 * reason code from a screen that could not offer one would have broken them.
 * The picker exists now, so this closes the other two, and the way to close
 * them without three drifting copies is one gate all three enter.
 *
 * **Four things a write-off owes, in this order.**
 *
 * 1. A reason code, resolved in the WRITE_OFF category. Free text cannot be
 *    grouped, and "which of bad debt, goodwill, settled dispute and small
 *    balance was this year's £40k" is the first question asked of write-offs.
 * 2. The acting role clears the code's `approval_level`. A code seeded at GM is
 *    an owner's decision even when the command's own floor happens to agree
 *    today.
 * 3. The acting role clears the *amount* ladder — the half A07 could not do,
 *    because `resolveSettings` lived inside core-service where billing could
 *    not call it. It is shared now.
 * 4. A `flow_approvals` row, written after the ledger moves. A record, not a
 *    gate: nothing was bypassed, so `forced` stays false.
 *
 * **Whose role is checked, under dual control.** All three of these are in
 * `COMMAND_DUAL_CONTROL`, so by the time a handler runs, the command has been
 * queued as an `approval_requests` row and released by a second owner. The
 * envelope that reaches here keeps the *requester* as `initiatedBy` and carries
 * the approver alongside as `metadata.approval` — which means the ladder below
 * measures the person who decided to write the balance off, not the person who
 * countersigned. That is the right way round: the approver's own authority is
 * already gated by the row's `required_role`, and checking them here instead
 * would let a clerk raise any amount so long as an owner rubber-stamped it.
 *
 * **Why the record is written after and the gate before.** The gate is a
 * decision and the row is evidence that money moved. Writing the row at the
 * decision is what made the city-ledger transfer record its override three
 * times when the write behind it failed and the consumer retried — one
 * operator decision, three rows claiming a balance had moved. The gate here
 * only authorises; the caller records once its own write has committed.
 */

import {
  assertOverrideAuthority,
  resolveReasonCode,
} from "@tartware/command-consumer-utils/command-utils";
import { resolvePolicy } from "@tartware/command-consumer-utils/settings-utils";
import {
  actorClearsThreshold,
  DEFAULT_WRITE_OFF_APPROVAL_POLICY,
  type ReasonCodeRow,
  requiredRoleForWriteOff,
  WRITE_OFF_APPROVAL_SETTING,
  WriteOffApprovalPolicySchema,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveActorRole,
} from "./common.js";

/** What each of the three write-offs hands the gate. */
export type WriteOffGateInput = {
  context: CommandContext;
  propertyId: string;
  /** Named in every refusal, so a failed caller knows which write-off refused. */
  commandName: string;
  /** The flow this command belongs to in `FLOW_REGISTRY`. */
  flowName: string;
  entityType: string;
  entityId: string;
  /** What is leaving the books — the number the amount ladder is measured against. */
  amount: number;
  reasonCode: string;
  /** The operator's own sentence. It survives the code rather than being replaced by it. */
  narrative: string;
  currency?: string | undefined;
};

/**
 * Authorise a write-off, or refuse it.
 *
 * Returns the resolved reason code so the caller can stamp it on the ledger row
 * and hand it back to {@link recordWriteOff}. Writes nothing.
 */
export const clearWriteOffGate = async (input: WriteOffGateInput): Promise<ReasonCodeRow> => {
  const reason = await resolveReasonCode<ReasonCodeRow>(
    (sql, params) => query<ReasonCodeRow>(sql, params),
    {
      tenantId: input.context.tenantId,
      propertyId: input.propertyId,
      reasonCode: input.reasonCode,
      category: "WRITE_OFF",
    },
  );

  const actorRole = resolveActorRole(input.context.initiatedBy);

  assertOverrideAuthority(reason, actorRole, {
    commandName: input.commandName,
    gateName: "write_off",
  });

  const policy = await resolvePolicy(
    (sql, params) => query<{ code: string; value: unknown }>(sql, params),
    {
      tenantId: input.context.tenantId,
      code: WRITE_OFF_APPROVAL_SETTING,
      parse: (raw) => WriteOffApprovalPolicySchema.parse(raw),
      fallback: DEFAULT_WRITE_OFF_APPROVAL_POLICY,
    },
  );

  const requiredRole = requiredRoleForWriteOff(policy, input.amount);
  if (!actorClearsThreshold(actorRole, requiredRole)) {
    throw new BillingCommandError(
      "WRITE_OFF_EXCEEDS_AUTHORITY",
      `Writing off ${input.amount} needs ${requiredRole}; this command was initiated by ` +
        `${actorRole ?? "an unidentified actor"}. The reason code authorises forgiving a ` +
        `balance — it does not authorise this size of one.`,
    );
  }

  return reason;
};

/**
 * Record a write-off that has already happened.
 *
 * Fail-open on the write itself, like every other bypass writer in the product:
 * the money has left the books, and failing here would report a write-off that
 * did occur as one that did not.
 */
export const recordWriteOff = async (
  input: WriteOffGateInput,
  reason: ReasonCodeRow,
): Promise<void> => {
  try {
    const { recordFlowApproval } = await import("../../repositories/flow-approval-repository.js");
    await recordFlowApproval({
      tenant_id: input.context.tenantId,
      property_id: input.propertyId,
      flow_name: input.flowName,
      gate_name: "write_off",
      entity_type: input.entityType,
      entity_id: input.entityId,
      approved_by: resolveActorId(input.context.initiatedBy),
      role_at_approval: resolveActorRole(input.context.initiatedBy),
      forced: false,
      reason_code: reason.reason_code,
      reason_notes:
        `${reason.reason_name}: ${input.amount}${input.currency ? ` ${input.currency}` : ""} ` +
        `written off — ${input.narrative}`,
      correlation_id: input.context.correlationId ?? null,
    });
  } catch (approvalErr) {
    appLogger.warn(
      { approvalErr, commandName: input.commandName, entityId: input.entityId },
      "write-off recorded in the ledger but its flow_approvals row could not be written",
    );
  }
};

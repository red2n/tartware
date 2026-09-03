/**
 * DEV DOC
 * Module: services/billing-commands/credit-limit-gate.ts
 * Purpose: The one way past CREDIT_LIMIT_EXCEEDED — resolved, authorised and
 *          recorded — so the block can be lifted once instead of edited away.
 * Ownership: billing-service
 *
 * `CREDIT_LIMIT_EXCEEDED` is thrown from two different checks: a guest's
 * `credit_limits` block threshold on payment authorize and capture, and an AR
 * account's `available_credit` on a city-ledger transfer. Neither had a way
 * through it (audit finding A05). A front office whose corporate guest is a
 * dollar over on the night of departure had one option — raise the limit —
 * which does not record that anything was overridden, it rewrites the control
 * for everyone who looks afterwards.
 *
 * The three conditions are checked in this order, and the order is the point:
 *
 * 1. The operator asked for the override explicitly. Without
 *    `credit_limit_override` the refusal is exactly what it always was.
 * 2. The reason code resolves, in the CREDIT_LIMIT category. A code from
 *    another category would file a credit decision under a room move, and the
 *    column exists so that "why was this overridden" can be answered by
 *    grouping.
 * 3. The *acting* role clears the code's `approval_level`. This is the half a
 *    `force` flag never had: until A05 an override was logged and never
 *    authorized, so a clerk naming a GM-level code was recorded as though a GM
 *    had decided it.
 *
 * **Authorising and recording are two calls, in that order, with the operation
 * between them.** The first draft did both at the gate, reasoning that the
 * decision was taken there whether or not the transfer completed. Driving it on
 * real data showed what that costs: the city-ledger transfer failed after the
 * gate cleared, the consumer retried, and one operator decision produced three
 * `flow_approvals` rows for a transfer that never happened. An override record
 * is read as evidence that money moved on someone's authority, so recording one
 * per attempt is worse than recording none — and the retry ladder makes it
 * three, not one.
 */

import {
  recordSupervisorOverride,
  resolveOpenCashierSession,
} from "@tartware/command-consumer-utils/cashier";
import {
  assertOverrideAuthority,
  resolveReasonCode,
} from "@tartware/command-consumer-utils/command-utils";
import type { ReasonCodeRow } from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveActorRole,
} from "./common.js";

/**
 * The three payload fields `CREDIT_LIMIT_OVERRIDE_FIELDS` puts on a command,
 * lifted off it by the caller so this stays free of any one command's shape.
 */
export type CreditLimitOverrideRequest = {
  requested?: boolean | undefined;
  reasonCode?: string | undefined;
  notes?: string | undefined;
};

/**
 * What a payment handler hands `enforceCreditLimit`: everything the gate needs
 * except the entity and the numbers, which the limit check itself supplies.
 */
export type CreditLimitGateContext = Omit<
  CreditLimitGateInput,
  "detail" | "entityType" | "entityId"
> & { override: CreditLimitOverrideRequest };

export type CreditLimitGateInput = {
  context: CommandContext;
  propertyId: string;
  /** Named in both the refusal and the authority error, so a failed caller knows what refused. */
  commandName: string;
  /** The flow this command belongs to in `FLOW_REGISTRY`, written to `flow_approvals.flow_name`. */
  flowName: string;
  entityType: string;
  entityId: string;
  /** What the block found — the numbers, so the refusal is actionable. */
  detail: string;
  /**
   * The amount the block was over, for `cashier_sessions.supervisor_overrides`
   * — whose documented shape is `[{reason, amount, timestamp, supervisor_id}]`.
   * Optional: `detail` already carries the numbers in prose, and a caller that
   * has no single figure to name (a utilisation percentage rather than a
   * tender) should say nothing rather than invent one.
   */
  amount?: number | undefined;
};

/**
 * Let a balance past its credit limit, or refuse it.
 *
 * Throws `BillingCommandError` in every refusing case; returns the resolved
 * reason code when the override stands. Nothing is written here — the caller
 * passes what this returns to {@link recordCreditLimitOverride} once the
 * operation it authorised has actually happened.
 */
export const clearCreditLimitGate = async (
  input: CreditLimitGateInput,
  override: CreditLimitOverrideRequest,
): Promise<ReasonCodeRow> => {
  if (!override.requested) {
    throw new BillingCommandError(
      "CREDIT_LIMIT_EXCEEDED",
      `${input.detail} To proceed, set credit_limit_override with a ` +
        `credit_limit_override_reason_code from the CREDIT_LIMIT reason codes — ` +
        `the override is recorded, and the code's approval level is checked ` +
        `against your role.`,
    );
  }

  // `?? ""` only satisfies the optional type: the command schema refuses a
  // credit_limit_override with no reason code before this handler sees it.
  const reason = await resolveReasonCode<ReasonCodeRow>(
    (sql, params) => query<ReasonCodeRow>(sql, params),
    {
      tenantId: input.context.tenantId,
      propertyId: input.propertyId,
      reasonCode: override.reasonCode ?? "",
      category: "CREDIT_LIMIT",
    },
  );

  // Both names below are written as literals rather than a shared constant on
  // purpose: `checkNoUndeclaredControls` scans Apps/ for `gate_name: "…"`, so a
  // constant here would be a control the §02 ratchet cannot see.
  assertOverrideAuthority(reason, resolveActorRole(input.context.initiatedBy), {
    commandName: input.commandName,
    gateName: "credit_limit_check",
    stepUp: input.context.stepUp,
  });

  appLogger.warn(
    {
      tenantId: input.context.tenantId,
      commandName: input.commandName,
      entityId: input.entityId,
      reasonCode: reason.reason_code,
      approvalLevel: reason.approval_level,
      actorRole: resolveActorRole(input.context.initiatedBy),
    },
    "credit limit gate overridden",
  );

  return reason;
};

/**
 * Record an override that has already happened.
 *
 * Separate from the gate above, and called after the write it authorised
 * commits — see that function's note. Fail-open on the write itself, like every
 * other bypass writer in the product: the money has moved, and failing here
 * would report an override that did occur as one that did not.
 */
export const recordCreditLimitOverride = async (
  input: CreditLimitGateInput,
  reason: ReasonCodeRow,
  notes?: string | undefined,
): Promise<void> => {
  try {
    const { recordFlowApproval } = await import("../../repositories/flow-approval-repository.js");
    await recordFlowApproval({
      tenant_id: input.context.tenantId,
      property_id: input.propertyId,
      flow_name: input.flowName,
      gate_name: "credit_limit_check",
      entity_type: input.entityType,
      entity_id: input.entityId,
      approved_by: resolveActorId(input.context.initiatedBy),
      role_at_approval: resolveActorRole(input.context.initiatedBy),
      stepUp: input.context.stepUp,
      forced: true,
      reason_code: reason.reason_code,
      reason_notes: notes ?? `${reason.reason_name}: ${input.detail}`,
      correlation_id: input.context.correlationId ?? null,
    });
  } catch (approvalErr) {
    appLogger.warn(
      { approvalErr, commandName: input.commandName, entityId: input.entityId },
      "Credit limit override: failed to record the decision (non-fatal)",
    );
  }

  // A09's second half. `cashier_sessions.supervisor_overrides` documents itself
  // as `[{reason, amount, timestamp, supervisor_id}]` and has had a GIN index
  // waiting for it since the table was created — and no writer, so a shift's
  // exceptions could not be reviewed beside its counted variance.
  //
  // This is the override that belongs there: it happens at a terminal, during a
  // shift, over an amount. The `flow_approvals` row above is the record of
  // record and is written unconditionally; this one is the shift's own copy, so
  // it is skipped without complaint when no drawer was open. A property that
  // takes payments over the phone has no session and should not be told
  // anything is wrong.
  try {
    const sessionId = await resolveOpenCashierSession(
      (sql, params) => query<{ session_id: string }>(sql, params),
      {
        tenantId: input.context.tenantId,
        propertyId: input.propertyId,
        actorId: resolveActorId(input.context.initiatedBy),
      },
    );
    if (sessionId) {
      await recordSupervisorOverride((sql, params) => query(sql, params), {
        tenantId: input.context.tenantId,
        sessionId,
        reason: `${reason.reason_code}: ${notes ?? reason.reason_name}`,
        amount: input.amount ?? null,
        supervisorId: resolveActorId(input.context.initiatedBy),
      });
    }
  } catch (shiftErr) {
    appLogger.warn(
      { shiftErr, commandName: input.commandName, entityId: input.entityId },
      "Credit limit override: failed to record it against the cashier shift (non-fatal)",
    );
  }
};

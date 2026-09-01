import type { CommandApprovalRow, CommandApprovalTicket, QueryExecutor } from "@tartware/schemas";

// Declared in schema/src/api/command-approvals.ts beside the dual-control map
// that decides which commands land in this table. Re-exported for the callers
// that already take it from here.
export type { CommandApprovalRow };

/**
 * The approval queue, as the command pipeline uses it.
 *
 * Same table as billing's operations queue — `approval_requests` — because a
 * second queue for the same control is how the two start disagreeing about
 * what four eyes means. The rows this writes are the ones with `command_name`
 * set: raised by `acceptCommand` when a command in `COMMAND_DUAL_CONTROL` is
 * submitted, and released by the approval routes, which dispatch the stored
 * payload rather than annotating it.
 *
 * Every statement carries `tenant_id` in its predicate. The gateway reaches
 * this table outside a request's RLS scope on the approve path, so tenancy is
 * enforced here rather than assumed from the connection.
 */

/** Columns every read of a deferred command's approval returns. */
const APPROVAL_COLUMNS = `
  approval_id, tenant_id, property_id, command_name, request_id,
  operation_type, entity_type, entity_id, operation_payload, description,
  requested_by, requested_by_name, requested_by_role, requested_at,
  status, required_role, expires_at,
  actioned_by, actioned_by_name, actioned_at, action_reason,
  dispatched_command_id, created_at, updated_at
`;

/**
 * Raise the request, or answer with the one this idempotency key already
 * raised.
 *
 * `ON CONFLICT DO NOTHING` plus a follow-up read rather than `DO UPDATE`: a
 * resubmission must not touch a row a second person may already be looking at,
 * and must never revive one that was rejected. Two concurrent submissions of
 * the same key take the same branch — one inserts, both read the same row.
 */
const INSERT_APPROVAL_SQL = `
  INSERT INTO public.approval_requests (
    tenant_id, property_id, command_name, request_id,
    operation_type, entity_type, entity_id, operation_payload, description,
    requested_by, requested_by_role, required_role, status
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $3, 'command', $5::uuid, $6::jsonb, $7,
    $8, $9, $10, 'PENDING'
  )
  ON CONFLICT (tenant_id, command_name, request_id) WHERE command_name IS NOT NULL AND request_id IS NOT NULL
  DO NOTHING
  RETURNING ${APPROVAL_COLUMNS}
`;

const FIND_BY_REQUEST_SQL = `
  SELECT ${APPROVAL_COLUMNS}
    FROM public.approval_requests
   WHERE tenant_id = $1::uuid AND command_name = $2 AND request_id = $3
   LIMIT 1
`;

const FIND_BY_ID_SQL = `
  SELECT ${APPROVAL_COLUMNS}
    FROM public.approval_requests
   WHERE tenant_id = $1::uuid AND approval_id = $2::uuid AND command_name IS NOT NULL
   LIMIT 1
`;

const LIST_PENDING_SQL = `
  SELECT ${APPROVAL_COLUMNS}
    FROM public.approval_requests
   WHERE tenant_id = $1::uuid
     AND command_name IS NOT NULL
     AND status = 'PENDING'
     AND expires_at > NOW()
     AND ($2::text IS NULL OR command_name = $2::text)
   ORDER BY expires_at ASC
   LIMIT $3 OFFSET $4
`;

/**
 * Take the request out of PENDING, or return nothing.
 *
 * One statement, so two approvers pressing the button at the same moment
 * cannot both win: the loser's UPDATE matches no row and it is told the request
 * is no longer pending. `expires_at > NOW()` is in the predicate for the same
 * reason — an expiry that passed between the read and the claim must lose.
 */
const CLAIM_SQL = `
  UPDATE public.approval_requests
     SET status = 'APPROVED',
         actioned_by = $3,
         actioned_by_name = $4,
         actioned_at = NOW(),
         action_reason = $5,
         updated_at = NOW(),
         updated_by = $3
   WHERE tenant_id = $1::uuid
     AND approval_id = $2::uuid
     AND command_name IS NOT NULL
     AND status = 'PENDING'
     AND expires_at > NOW()
  RETURNING ${APPROVAL_COLUMNS}
`;

/**
 * Put a claimed request back.
 *
 * The dispatch that follows a claim is a separate transaction — `acceptCommand`
 * owns its own — so a broker-side or database-side failure there would
 * otherwise leave a request marked APPROVED that never ran, which is the worst
 * of the three states to be in: it reads as done and the write-off never
 * happened. Releasing it returns the decision to the queue.
 */
const RELEASE_SQL = `
  UPDATE public.approval_requests
     SET status = 'PENDING',
         actioned_by = NULL,
         actioned_by_name = NULL,
         actioned_at = NULL,
         action_reason = NULL,
         updated_at = NOW()
   WHERE tenant_id = $1::uuid
     AND approval_id = $2::uuid
     AND status = 'APPROVED'
     AND dispatched_command_id IS NULL
`;

const RECORD_DISPATCH_SQL = `
  UPDATE public.approval_requests
     SET dispatched_command_id = $3::uuid,
         updated_at = NOW()
   WHERE tenant_id = $1::uuid
     AND approval_id = $2::uuid
  RETURNING ${APPROVAL_COLUMNS}
`;

const REJECT_SQL = `
  UPDATE public.approval_requests
     SET status = 'REJECTED',
         actioned_by = $3,
         actioned_by_name = $4,
         actioned_at = NOW(),
         action_reason = $5,
         updated_at = NOW(),
         updated_by = $3
   WHERE tenant_id = $1::uuid
     AND approval_id = $2::uuid
     AND command_name IS NOT NULL
     AND status = 'PENDING'
  RETURNING ${APPROVAL_COLUMNS}
`;

export type RaiseCommandApprovalInput = {
  tenantId: string;
  commandName: string;
  requestId: string;
  payload: Record<string, unknown>;
  entityId: string;
  propertyId: string | null;
  description: string | null;
  requestedBy: string;
  requestedByRole: string | null;
  requiredRole: string;
};

const asIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

/** The row as the dispatch pipeline reads it. */
export const toApprovalTicket = (row: CommandApprovalRow): CommandApprovalTicket => ({
  approvalId: row.approval_id,
  status: row.status,
  requiredRole: row.required_role,
  requestedBy: row.requested_by,
  requestedAt: asIso(row.requested_at),
  expiresAt: asIso(row.expires_at),
  dispatchedCommandId: row.dispatched_command_id,
});

export const createCommandApprovalRepository = (query: QueryExecutor) => {
  const raiseCommandApproval = async (
    input: RaiseCommandApprovalInput,
  ): Promise<CommandApprovalRow> => {
    const { rows } = await query<CommandApprovalRow>(INSERT_APPROVAL_SQL, [
      input.tenantId,
      input.propertyId,
      input.commandName,
      input.requestId,
      input.entityId,
      JSON.stringify(input.payload),
      input.description,
      input.requestedBy,
      input.requestedByRole,
      input.requiredRole,
    ]);
    const inserted = rows[0];
    if (inserted) {
      return inserted;
    }

    const existing = await query<CommandApprovalRow>(FIND_BY_REQUEST_SQL, [
      input.tenantId,
      input.commandName,
      input.requestId,
    ]);
    const row = existing.rows[0];
    if (!row) {
      // The insert conflicted and the conflicting row cannot be read, which
      // means it belongs to another tenant's key or was deleted between the
      // two statements. Neither is a state to guess a dispatch from.
      throw new Error(`approval request for ${input.commandName} could not be raised or read back`);
    }
    return row;
  };

  const findCommandApproval = async (
    tenantId: string,
    approvalId: string,
  ): Promise<CommandApprovalRow | null> => {
    const { rows } = await query<CommandApprovalRow>(FIND_BY_ID_SQL, [tenantId, approvalId]);
    return rows[0] ?? null;
  };

  const listPendingCommandApprovals = async (input: {
    tenantId: string;
    commandName?: string;
    limit: number;
    offset: number;
  }): Promise<CommandApprovalRow[]> => {
    const { rows } = await query<CommandApprovalRow>(LIST_PENDING_SQL, [
      input.tenantId,
      input.commandName ?? null,
      input.limit,
      input.offset,
    ]);
    return rows;
  };

  const claimCommandApproval = async (input: {
    tenantId: string;
    approvalId: string;
    actionedBy: string;
    actionedByName: string | null;
    reason: string | null;
  }): Promise<CommandApprovalRow | null> => {
    const { rows } = await query<CommandApprovalRow>(CLAIM_SQL, [
      input.tenantId,
      input.approvalId,
      input.actionedBy,
      input.actionedByName,
      input.reason,
    ]);
    return rows[0] ?? null;
  };

  const releaseCommandApproval = async (tenantId: string, approvalId: string): Promise<void> => {
    await query(RELEASE_SQL, [tenantId, approvalId]);
  };

  const recordApprovalDispatch = async (
    tenantId: string,
    approvalId: string,
    commandId: string,
  ): Promise<CommandApprovalRow | null> => {
    const { rows } = await query<CommandApprovalRow>(RECORD_DISPATCH_SQL, [
      tenantId,
      approvalId,
      commandId,
    ]);
    return rows[0] ?? null;
  };

  const rejectCommandApproval = async (input: {
    tenantId: string;
    approvalId: string;
    actionedBy: string;
    actionedByName: string | null;
    reason: string;
  }): Promise<CommandApprovalRow | null> => {
    const { rows } = await query<CommandApprovalRow>(REJECT_SQL, [
      input.tenantId,
      input.approvalId,
      input.actionedBy,
      input.actionedByName,
      input.reason,
    ]);
    return rows[0] ?? null;
  };

  return {
    raiseCommandApproval,
    findCommandApproval,
    listPendingCommandApprovals,
    claimCommandApproval,
    releaseCommandApproval,
    recordApprovalDispatch,
    rejectCommandApproval,
  };
};

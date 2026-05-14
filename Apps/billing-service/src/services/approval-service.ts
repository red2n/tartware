import {
  type ApprovalRequestRow,
  type BillingApprovalApproveCommand,
  BillingApprovalApproveCommandSchema,
  BillingApprovalCancelCommandSchema,
  type BillingApprovalRejectCommand,
  BillingApprovalRejectCommandSchema,
  BillingApprovalRequestCommandSchema,
} from "@tartware/schemas";

import { auditAsync } from "../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

import { BillingCommandError } from "./billing-commands/common.js";

// ─── Create Approval Request ─────────────────────────────────────────────────

/**
 * Create a pending approval request for a high-risk operation.
 * Returns the new approval_id. The operation itself is NOT executed here —
 * the caller should return a 202 Accepted with the approval_id to the client.
 */
export const createApprovalRequest = async (
  payload: unknown,
  tenantId: string,
): Promise<string> => {
  const command = BillingApprovalRequestCommandSchema.parse(payload);

  const { rows } = await query<{ approval_id: string }>(
    `INSERT INTO public.approval_requests (
       tenant_id, property_id, operation_type, entity_type, entity_id,
       operation_payload, description, required_role,
       requested_by, requested_by_name, status
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5::uuid,
       $6::jsonb, $7, $8,
       $9, $10, 'PENDING'
     )
     RETURNING approval_id`,
    [
      tenantId,
      command.property_id ?? null,
      command.operation_type,
      command.entity_type,
      command.entity_id,
      JSON.stringify(command.operation_payload),
      command.description ?? null,
      command.required_role,
      command.requested_by,
      command.requested_by_name ?? null,
    ],
  );

  const approvalId = rows[0]?.approval_id;
  if (!approvalId) {
    throw new BillingCommandError("APPROVAL_CREATE_FAILED", "Failed to create approval request.");
  }

  appLogger.info(
    {
      approvalId,
      operationType: command.operation_type,
      entityId: command.entity_id,
      requestedBy: command.requested_by,
    },
    "Approval request created",
  );

  auditAsync({
    tenantId,
    propertyId: command.property_id,
    userId: command.requested_by,
    action: "APPROVAL_REQUESTED",
    entityType: "approval_request",
    entityId: approvalId,
    severity: "WARNING",
    description: `Approval requested for ${command.operation_type} on ${command.entity_type}:${command.entity_id}`,
    newValues: {
      operation_type: command.operation_type,
      entity_id: command.entity_id,
      required_role: command.required_role,
    },
  });

  return approvalId;
};

// ─── Approve ─────────────────────────────────────────────────────────────────

/**
 * Approve a pending approval request.
 * Enforces the four-eyes principle: actioned_by must differ from requested_by.
 * Returns the approval row so the caller can execute the deferred operation.
 */
export const approveRequest = async (
  payload: unknown,
  tenantId: string,
): Promise<ApprovalRequestRow> => {
  const command = BillingApprovalApproveCommandSchema.parse(payload);
  return _resolveRequest(command, tenantId, "APPROVED");
};

// ─── Reject ───────────────────────────────────────────────────────────────────

/**
 * Reject a pending approval request.
 * Reason is required for rejections.
 */
export const rejectRequest = async (
  payload: unknown,
  tenantId: string,
): Promise<ApprovalRequestRow> => {
  const command = BillingApprovalRejectCommandSchema.parse(payload);
  return _resolveRequest(command, tenantId, "REJECTED");
};

// ─── Internal: resolve (approve or reject) ────────────────────────────────────

const _resolveRequest = async (
  command: BillingApprovalApproveCommand | BillingApprovalRejectCommand,
  tenantId: string,
  newStatus: "APPROVED" | "REJECTED",
): Promise<ApprovalRequestRow> => {
  return withTransaction(async (client) => {
    // Lock the row to prevent concurrent approvals
    const { rows } = await queryWithClient<ApprovalRequestRow>(
      client,
      `SELECT
         approval_id, tenant_id, property_id, operation_type, entity_type, entity_id,
         operation_payload, description, required_role,
         requested_by, requested_by_name, status,
         actioned_by, actioned_by_name, actioned_at, action_reason,
         expires_at, created_at, updated_at, updated_by
       FROM public.approval_requests
       WHERE approval_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.approval_id, tenantId],
    );

    const request = rows[0];
    if (!request) {
      throw new BillingCommandError("APPROVAL_NOT_FOUND", "Approval request not found.");
    }

    if (request.status !== "PENDING") {
      throw new BillingCommandError(
        "APPROVAL_NOT_PENDING",
        `Approval is ${request.status} — only PENDING requests can be actioned.`,
      );
    }

    // Check expiry
    if (new Date(request.expires_at) < new Date()) {
      await queryWithClient(
        client,
        `UPDATE public.approval_requests SET status = 'EXPIRED', updated_at = NOW() WHERE approval_id = $1::uuid`,
        [command.approval_id],
      );
      throw new BillingCommandError(
        "APPROVAL_EXPIRED",
        "Approval request has expired. Please submit a new request.",
      );
    }

    // ★ Four-Eyes Principle: approver must NOT be the same user as the requester
    if (request.requested_by === command.actioned_by) {
      throw new BillingCommandError(
        "SELF_APPROVAL_FORBIDDEN",
        "The approver must be a different user than the requester (four-eyes principle).",
      );
    }

    // Persist the decision
    await queryWithClient(
      client,
      `UPDATE public.approval_requests
       SET status       = $3,
           actioned_by  = $4,
           actioned_by_name = $5,
           actioned_at  = NOW(),
           action_reason = $6,
           updated_at   = NOW(),
           updated_by   = $4
       WHERE approval_id = $1::uuid AND tenant_id = $2::uuid`,
      [
        command.approval_id,
        tenantId,
        newStatus,
        command.actioned_by,
        command.actioned_by_name ?? null,
        command.reason ?? null,
      ],
    );

    appLogger.info(
      {
        approvalId: command.approval_id,
        newStatus,
        actionedBy: command.actioned_by,
        operationType: request.operation_type,
      },
      `Approval request ${newStatus.toLowerCase()}`,
    );

    auditAsync({
      tenantId,
      userId: command.actioned_by,
      action: newStatus === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      entityType: "approval_request",
      entityId: command.approval_id,
      severity: newStatus === "APPROVED" ? "WARNING" : "INFO",
      description: `${request.operation_type} approval ${newStatus.toLowerCase()} by ${command.actioned_by}`,
      newValues: {
        operation_type: request.operation_type,
        entity_id: request.entity_id,
        actioned_by: command.actioned_by,
        reason: command.reason,
      },
    });

    return { ...request, status: newStatus };
  });
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Cancel a PENDING approval request (withdrawn by the original requester).
 */
export const cancelApprovalRequest = async (
  payload: unknown,
  tenantId: string,
): Promise<string> => {
  const command = BillingApprovalCancelCommandSchema.parse(payload);

  const { rows } = await query<{ approval_id: string; status: string; requested_by: string }>(
    `UPDATE public.approval_requests
     SET status     = 'CANCELLED',
         action_reason = $3,
         actioned_by = $4,
         actioned_at = NOW(),
         updated_at  = NOW()
     WHERE approval_id = $1::uuid AND tenant_id = $2::uuid AND status = 'PENDING'
     RETURNING approval_id, status, requested_by`,
    [command.approval_id, tenantId, command.reason ?? null, command.cancelled_by],
  );

  if (!rows[0]?.approval_id) {
    throw new BillingCommandError(
      "APPROVAL_CANCEL_FAILED",
      "Approval not found or is not in PENDING state.",
    );
  }

  return command.approval_id;
};

// ─── List Pending ─────────────────────────────────────────────────────────────

/**
 * List pending approval requests for a tenant, optionally filtered by property.
 * Returns results ordered by expires_at ascending (most urgent first).
 */
export const listPendingApprovals = async (input: {
  tenantId: string;
  propertyId?: string;
  operationType?: string;
  limit: number;
  offset: number;
}): Promise<ApprovalRequestRow[]> => {
  const { rows } = await query<ApprovalRequestRow>(
    `SELECT
       approval_id, tenant_id, property_id, operation_type, entity_type, entity_id,
       operation_payload, description, required_role,
       requested_by, requested_by_name, status,
       actioned_by, actioned_by_name, actioned_at, action_reason,
       expires_at, created_at, updated_at, updated_by
     FROM public.approval_requests
     WHERE tenant_id = $1::uuid
       AND status = 'PENDING'
       AND expires_at > NOW()
       AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND ($3::text IS NULL OR operation_type = $3)
     ORDER BY expires_at ASC
     LIMIT $4 OFFSET $5`,
    [
      input.tenantId,
      input.propertyId ?? null,
      input.operationType ?? null,
      input.limit,
      input.offset,
    ],
  );

  return rows;
};

/**
 * Get a single approval request by ID.
 */
export const getApprovalRequest = async (
  approvalId: string,
  tenantId: string,
): Promise<ApprovalRequestRow | null> => {
  const { rows } = await query<ApprovalRequestRow>(
    `SELECT
       approval_id, tenant_id, property_id, operation_type, entity_type, entity_id,
       operation_payload, description, required_role,
       requested_by, requested_by_name, status,
       actioned_by, actioned_by_name, actioned_at, action_reason,
       expires_at, created_at, updated_at, updated_by
     FROM public.approval_requests
     WHERE approval_id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [approvalId, tenantId],
  );
  return rows[0] ?? null;
};

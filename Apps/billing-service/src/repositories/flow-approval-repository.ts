/**
 * DEV DOC
 * Module: flow-approval-repository.ts
 * Purpose: Repository for recording and querying gate bypass approvals
 *          across all 12 PMS flows. Uses the flow_approvals table.
 * Ownership: billing-service (primary writer during night audit gate bypasses)
 *
 * The flow_approvals table is append-only — no UPDATE or DELETE.
 */

import type { CreateFlowApproval, FlowApprovalRow } from "@tartware/schemas";

import { auditAsync } from "../lib/audit-logger.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "flow-approval-repository" });

// ─── SQL ─────────────────────────────────────────────────────────────────────

const INSERT_FLOW_APPROVAL_SQL = `
  INSERT INTO public.flow_approvals (
    tenant_id, property_id, flow_name, gate_name,
    entity_type, entity_id, approved_by, role_at_approval,
    reason_code, reason_notes, approved_at, expires_at, correlation_id
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $5, $6::uuid, $7::uuid, $8,
    $9, $10, COALESCE($11::timestamptz, NOW()), $12::timestamptz, $13::uuid
  )
  RETURNING id
`;

const LIST_FLOW_APPROVALS_SQL = `
  SELECT id, tenant_id, property_id, flow_name, gate_name,
         entity_type, entity_id, approved_by, role_at_approval,
         reason_code, reason_notes, approved_at, expires_at,
         created_at, correlation_id
  FROM public.flow_approvals
  WHERE tenant_id = $1::uuid
  ORDER BY approved_at DESC
  LIMIT $2 OFFSET $3
`;

const COUNT_FLOW_APPROVALS_SQL = `
  SELECT COUNT(*)::int AS total
  FROM public.flow_approvals
  WHERE tenant_id = $1::uuid
`;

const GET_APPROVALS_BY_ENTITY_SQL = `
  SELECT id, tenant_id, property_id, flow_name, gate_name,
         entity_type, entity_id, approved_by, role_at_approval,
         reason_code, reason_notes, approved_at, expires_at,
         created_at, correlation_id
  FROM public.flow_approvals
  WHERE tenant_id = $1::uuid
    AND entity_type = $2
    AND entity_id = $3::uuid
  ORDER BY approved_at DESC
`;

const GET_ACTIVE_APPROVAL_SQL = `
  SELECT id, flow_name, gate_name, approved_by, reason_code,
         approved_at, expires_at
  FROM public.flow_approvals
  WHERE tenant_id = $1::uuid
    AND flow_name = $2
    AND gate_name = $3
    AND entity_type = $4
    AND entity_id = $5::uuid
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY approved_at DESC
  LIMIT 1
`;

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * Record a gate bypass approval. Append-only — no updates.
 * @returns The generated approval record ID.
 */
export async function recordFlowApproval(input: CreateFlowApproval): Promise<string> {
  const result = await query<{ id: string }>(INSERT_FLOW_APPROVAL_SQL, [
    input.tenant_id,
    input.property_id ?? null,
    input.flow_name,
    input.gate_name,
    input.entity_type,
    input.entity_id,
    input.approved_by,
    input.role_at_approval,
    input.reason_code,
    input.reason_notes ?? null,
    input.approved_at ?? null,
    input.expires_at ?? null,
    input.correlation_id ?? null,
  ]);

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Failed to insert flow approval — no ID returned");

  logger.info(
    {
      approvalId: id,
      flowName: input.flow_name,
      gateName: input.gate_name,
      entityType: input.entity_type,
      entityId: input.entity_id,
      approvedBy: input.approved_by,
      reasonCode: input.reason_code,
    },
    "Flow gate bypass recorded",
  );

  // Audit trail — SECURITY category for gate bypasses
  auditAsync({
    tenantId: input.tenant_id,
    propertyId: input.property_id ?? null,
    userId: input.approved_by,
    action: "GATE_BYPASS",
    entityType: input.entity_type,
    entityId: input.entity_id,
    category: "SECURITY",
    severity: "WARNING",
    description: `Flow gate bypass: ${input.flow_name}/${input.gate_name}. Reason: ${input.reason_code}`,
    metadata: {
      flow_name: input.flow_name,
      gate_name: input.gate_name,
      reason_notes: input.reason_notes ?? null,
      correlation_id: input.correlation_id ?? null,
    },
  });

  return id;
}

/**
 * List all flow approvals for a tenant with pagination.
 */
/** @public Query all flow approvals for a tenant with pagination. */
export async function listFlowApprovals(
  tenantId: string,
  limit = 50,
  offset = 0,
): Promise<{ rows: FlowApprovalRow[]; total: number }> {
  const [dataResult, countResult] = await Promise.all([
    query<FlowApprovalRow>(LIST_FLOW_APPROVALS_SQL, [tenantId, limit, offset]),
    query<{ total: number }>(COUNT_FLOW_APPROVALS_SQL, [tenantId]),
  ]);

  return {
    rows: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
  };
}

/**
 * Get all approvals for a specific entity (e.g., a reservation, folio, room).
 */
/** @public Get all approvals for a specific entity (e.g., a reservation, folio, room). */
export async function getApprovalsByEntity(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<FlowApprovalRow[]> {
  const result = await query<FlowApprovalRow>(GET_APPROVALS_BY_ENTITY_SQL, [
    tenantId,
    entityType,
    entityId,
  ]);
  return result.rows;
}

/**
 * Check if an active (non-expired) approval exists for a specific gate bypass.
 * Returns the approval row if active, null otherwise.
 */
/** @public Check if an active (non-expired) approval exists for a specific gate bypass. */
export async function getActiveApproval(
  tenantId: string,
  flowName: string,
  gateName: string,
  entityType: string,
  entityId: string,
): Promise<FlowApprovalRow | null> {
  const result = await query<FlowApprovalRow>(GET_ACTIVE_APPROVAL_SQL, [
    tenantId,
    flowName,
    gateName,
    entityType,
    entityId,
  ]);
  return result.rows[0] ?? null;
}

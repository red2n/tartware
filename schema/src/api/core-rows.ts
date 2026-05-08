/**
 * DEV DOC
 * Module: api/core-rows.ts
 * Purpose: Raw PostgreSQL row shapes for core-service / common system table results.
 * Ownership: Schema package
 */

// =====================================================
// FLOW APPROVAL ROW
// =====================================================

/** Raw row shape from flow_approvals table (universal gate bypass audit). */
export type FlowApprovalRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  flow_name: string;
  gate_name: string;
  entity_type: string;
  entity_id: string;
  approved_by: string;
  role_at_approval: string;
  reason_code: string;
  reason_notes: string | null;
  approved_at: string | Date;
  expires_at: string | Date | null;
  created_at: string | Date;
  correlation_id: string | null;
};

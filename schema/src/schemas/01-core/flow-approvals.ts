import { z } from "zod";

/**
 * Flow Approvals — Universal gate bypass audit record.
 * Immutable append-only log across all 12 PMS flows.
 * @table flow_approvals
 * @category 01-core
 */

export const FlowApprovalSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().nullable().optional(),
  flow_name: z.string().max(80),
  gate_name: z.string().max(100),
  entity_type: z.string().max(60),
  entity_id: z.string().uuid(),
  approved_by: z.string().uuid(),
  role_at_approval: z.string().max(60),
  reason_code: z.string().max(60),
  reason_notes: z.string().nullable().optional(),
  approved_at: z.string().datetime().or(z.date()),
  expires_at: z.string().datetime().or(z.date()).nullable().optional(),
  created_at: z.string().datetime().or(z.date()).optional(),
  correlation_id: z.string().uuid().nullable().optional(),
});

export type FlowApproval = z.infer<typeof FlowApprovalSchema>;

export const CreateFlowApprovalSchema = FlowApprovalSchema.omit({
  id: true,
  created_at: true,
}).extend({
  approved_at: z.string().datetime().or(z.date()).optional(),
});

export type CreateFlowApproval = z.infer<typeof CreateFlowApprovalSchema>;

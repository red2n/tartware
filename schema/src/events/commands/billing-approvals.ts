import { z } from "zod";

import { TenantRoleEnum } from "../../shared/enums.js";

// ─── Approval Request Commands ────────────────────────────────────────────────

/** Operations that can require a dual-control approval before execution */
export const ApprovalOperationTypeEnum = z.enum([
	"INVOICE_VOID",
	"WRITEOFF",
	"FISCAL_REOPEN",
	"FOLIO_REOPEN",
	"CHARGEBACK_RESPONSE",
	"COMP_LARGE",
	"MANUAL_DATE_ROLL",
]);
export type ApprovalOperationType = z.infer<typeof ApprovalOperationTypeEnum>;

/** Approval request status */
export const ApprovalStatusEnum = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
	"EXPIRED",
	"CANCELLED",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

/**
 * Command: Request approval for a high-risk billing operation.
 * Creates an PENDING approval_requests row; the operation is NOT executed yet.
 */
export const BillingApprovalRequestCommandSchema = z.object({
	tenant_id: z.string().uuid(),
	property_id: z.string().uuid().optional(),
	operation_type: ApprovalOperationTypeEnum,
	entity_type: z.string().min(1).max(60),
	entity_id: z.string().uuid(),
	operation_payload: z.record(z.unknown()).default({}),
	description: z.string().max(500).optional(),
	// Who may approve this. Constrained to the role enum because the stored
	// value is later compared against the approver's role: a free-form string
	// that matches no known role would score nothing and admit everyone.
	required_role: TenantRoleEnum.default("MANAGER"),
	requested_by: z.string().min(1).max(100),
	requested_by_name: z.string().max(200).optional(),
});

export type BillingApprovalRequestCommand = z.infer<
	typeof BillingApprovalRequestCommandSchema
>;

/**
 * Command: Approve a pending billing approval request.
 * Executes the deferred operation if requester ≠ approver.
 */
export const BillingApprovalApproveCommandSchema = z.object({
	approval_id: z.string().uuid(),
	/**
	 * The approver. Set by the route from the authenticated token, never from
	 * the request body — four-eyes compares this against `requested_by`, so a
	 * caller-supplied value lets one person play both parts.
	 */
	actioned_by: z.string().min(1).max(100),
	/** The approver's role at the moment of approval, checked against `required_role`. */
	actioned_by_role: TenantRoleEnum.optional(),
	actioned_by_name: z.string().max(200).optional(),
	reason: z.string().max(500).optional(),
});

export type BillingApprovalApproveCommand = z.infer<
	typeof BillingApprovalApproveCommandSchema
>;

/**
 * Command: Reject a pending billing approval request.
 */
export const BillingApprovalRejectCommandSchema = z.object({
	approval_id: z.string().uuid(),
	actioned_by: z.string().min(1).max(100),
	actioned_by_name: z.string().max(200).optional(),
	reason: z.string().min(1).max(500),
});

export type BillingApprovalRejectCommand = z.infer<
	typeof BillingApprovalRejectCommandSchema
>;

/**
 * Command: Cancel a pending approval request (withdrawn by the original requester).
 */
export const BillingApprovalCancelCommandSchema = z.object({
	approval_id: z.string().uuid(),
	cancelled_by: z.string().min(1).max(100),
	reason: z.string().max(500).optional(),
});

export type BillingApprovalCancelCommand = z.infer<
	typeof BillingApprovalCancelCommandSchema
>;

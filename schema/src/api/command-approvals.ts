/**
 * DEV DOC
 * Module: api/command-approvals.ts
 * Purpose: Which commands may not be run by one person alone, and the rules a
 *          second person's decision on one has to satisfy.
 * Ownership: Schema package (single source of truth)
 *
 * `approval_requests` has shipped since July 2025 with the four-eyes rationale
 * in its DDL header and a complete service layer behind it — create, approve,
 * reject, cancel, row locking, expiry. Nothing entered it. Every high-risk
 * command went straight down the same accept path as a room-status update, and
 * approving a request flipped a status without executing anything, so approval
 * and execution were unrelated events.
 *
 * The two halves of that are fixed in two places. This file declares *which*
 * commands are deferred and *who* may release them; `command-dispatch.ts` in
 * `@tartware/command-center-shared` performs the deferral inside `acceptCommand`,
 * the same choke point A02's per-command floor is enforced at. Putting it there
 * rather than in a handler is what makes it non-optional: there is no second
 * route into the command pipeline for a requester to use instead.
 */

import { z } from "zod";

import {
	type TenantRole,
	TENANT_ROLE_PRIORITY,
	tenantRoleAtLeast,
} from "../shared/enums.js";

import { IsoTimestampSchema } from "./command-center.js";

/**
 * Commands that one person may request and a different person must release,
 * mapped to the minimum role that release takes.
 *
 * These are the five that **undo a completed accounting control** — the same
 * five A02 put at the OWNER floor, for the same stated reason: a closed period
 * reopened, a business date moved without the audit that justifies it, or a
 * balance written off has left the books, and there is no higher authority to
 * appeal to afterwards. So the authority is asked for beforehand, and from
 * someone else.
 *
 * The list is short on purpose. A queue that fills with routine work gets
 * rubber-stamped, and a rubber stamp is a worse control than none because it
 * looks like one. A charge void, a folio reopen and a comp are all reversible
 * inside the front office and already carry their own floor; the control they
 * need is a threshold and a reason code with an approval level — A06 and A08 —
 * not a second signature on every one. Extending this map is a one-line change
 * when that work lands.
 *
 * The role is the *approver's* floor, at or above the command's own floor in
 * `COMMAND_MIN_ROLE`: a second signature from someone who could not have run
 * the command themselves is not a control, and a test asserts it cannot be
 * declared that way. It also means a property needs two people at that level —
 * which is the point, and worth saying out loud, because a hotel with one
 * OWNER login cannot write off a balance until it makes a second one.
 */
export const COMMAND_DUAL_CONTROL: ReadonlyMap<string, TenantRole> = new Map<
	string,
	TenantRole
>([
	// Money written off the books. Nothing recovers it, and the reason lives
	// only in the record the write-off leaves behind.
	["ar.city_ledger.write_off", "OWNER"],
	["billing.ar.write_off", "OWNER"],
	["billing.suspense.write_off", "OWNER"],

	// A closed accounting control undone: the period was signed off, or the
	// business date moved without the night audit that justifies it.
	["billing.fiscal_period.reopen", "OWNER"],
	["billing.date_roll.manual", "OWNER"],
]);

/** The approver floor for `commandName`, or `undefined` if it is not deferred. */
export const commandApproverRole = (
	commandName: string,
): TenantRole | undefined => COMMAND_DUAL_CONTROL.get(commandName);

/** Whether this command may not be run by its requester alone. */
export const requiresDualControl = (commandName: string): boolean =>
	COMMAND_DUAL_CONTROL.has(commandName);

/**
 * The lowest role that can release any deferred command at all.
 *
 * Computed for the same reason as `COMMAND_AUTHORITY_FLOOR`: the approval
 * routes need a route-level membership gate, and a hardcoded copy would stop
 * matching the day a command is deferred below it. The row's own
 * `required_role` is what actually decides — this only keeps a VIEWER off the
 * endpoint.
 */
export const COMMAND_APPROVER_FLOOR: TenantRole = [
	...COMMAND_DUAL_CONTROL.values(),
].reduce(
	(lowest, role) =>
		TENANT_ROLE_PRIORITY[role] < TENANT_ROLE_PRIORITY[lowest] ? role : lowest,
	"OWNER" as TenantRole,
);

/**
 * What the second person is trying to do with a pending request.
 *
 * The states a request can be in are `ApprovalStatusEnum` in
 * `events/commands/billing-approvals.ts` — the same five the DDL's CHECK
 * constraint names, and not restated here.
 */
export type ApprovalActionKind = "APPROVE" | "REJECT";

/** Why a decision on an approval request was refused. */
export type ApprovalRefusalCode =
	| "APPROVAL_NOT_PENDING"
	| "APPROVAL_EXPIRED"
	| "SELF_APPROVAL_FORBIDDEN"
	| "APPROVER_ROLE_INSUFFICIENT";

export type ApprovalDecision =
	| { ok: true }
	| { ok: false; code: ApprovalRefusalCode; message: string };

/**
 * The rules a decision on an approval request has to satisfy, in one place.
 *
 * Two callers enforce this — billing's `approval-service` for the operations
 * queue and the gateway for deferred commands — and a second copy of a
 * four-eyes check is exactly the kind of drift that ends with one of them
 * missing a rule. It is pure so both can run it inside their own transaction,
 * against a row they have already locked.
 *
 * Order is the policy:
 *
 * 1. **Only a PENDING request can be actioned.** An approved request that is
 *    actioned twice would dispatch its operation twice.
 * 2. **An expired request is dead**, even for an approver who holds every
 *    right. The payload was reviewed against a state that has since moved.
 * 3. **The approver is not the requester.** This is the whole control; it is
 *    trustworthy only because both identities now come from tokens rather than
 *    the request body (A01).
 * 4. **The approver clears `required_role`** — but only to approve. Declining
 *    needs no more authority than seeing the request, and a rejection that
 *    needs an OWNER is a request that sits in the queue until it expires.
 */
export const evaluateApprovalAction = (input: {
	action: ApprovalActionKind;
	status: string;
	expiresAt: string | Date;
	requestedBy: string;
	requiredRole: string;
	actorId: string;
	actorRole: string | null | undefined;
	now?: Date;
}): ApprovalDecision => {
	if (input.status !== "PENDING") {
		return {
			ok: false,
			code: "APPROVAL_NOT_PENDING",
			message: `Approval is ${input.status} — only PENDING requests can be actioned.`,
		};
	}

	const expiresAt =
		input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
	if (expiresAt.getTime() <= (input.now ?? new Date()).getTime()) {
		return {
			ok: false,
			code: "APPROVAL_EXPIRED",
			message: "Approval request has expired. Please submit a new request.",
		};
	}

	if (input.requestedBy === input.actorId) {
		return {
			ok: false,
			code: "SELF_APPROVAL_FORBIDDEN",
			message:
				"The approver must be a different user than the requester (four-eyes principle).",
		};
	}

	if (
		input.action === "APPROVE" &&
		!tenantRoleAtLeast(input.actorRole, input.requiredRole)
	) {
		return {
			ok: false,
			code: "APPROVER_ROLE_INSUFFICIENT",
			message: `This request requires ${input.requiredRole} to approve; the approver holds ${input.actorRole ?? "no recognised role"}.`,
		};
	}

	return { ok: true };
};

/**
 * A deferred command's approval request, as the API returns it.
 *
 * `operation_payload` is included deliberately: an approver who cannot see
 * what they are releasing is a rubber stamp, and the payload is the only
 * complete statement of what will run. It is the snapshot taken at request
 * time, not a live read — what is approved is exactly what was asked for.
 */
export const CommandApprovalViewSchema = z.object({
	approval_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string().nullable(),
	command_name: z.string(),
	request_id: z.string().nullable(),
	entity_type: z.string(),
	entity_id: z.string(),
	operation_payload: z.record(z.unknown()),
	description: z.string().nullable(),
	status: z.string(),
	required_role: z.string(),
	requested_by: z.string(),
	requested_by_name: z.string().nullable(),
	requested_by_role: z.string().nullable(),
	requested_at: IsoTimestampSchema,
	expires_at: IsoTimestampSchema,
	actioned_by: z.string().nullable(),
	actioned_by_name: z.string().nullable(),
	actioned_at: IsoTimestampSchema.nullable(),
	action_reason: z.string().nullable(),
	dispatched_command_id: z.string().nullable(),
});
export type CommandApprovalView = z.infer<typeof CommandApprovalViewSchema>;

/** The body a second person sends when releasing or refusing a request. */
export const CommandApprovalActionRequestSchema = z.object({
	/** Free text kept on the row; mandatory on a rejection, optional on an approval. */
	reason: z.string().max(500).optional(),
});
export type CommandApprovalActionRequest = z.infer<
	typeof CommandApprovalActionRequestSchema
>;

/** What the approve route answers with: the row, and the command it became. */
export const CommandApprovalDecisionSchema = z.object({
	approval: CommandApprovalViewSchema,
	command_id: z.string().nullable(),
});
export type CommandApprovalDecision = z.infer<
	typeof CommandApprovalDecisionSchema
>;

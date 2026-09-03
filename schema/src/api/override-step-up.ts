/**
 * DEV DOC
 * Module: api/override-step-up.ts
 * Purpose: Let a supervisor authorise one override at the terminal, in place,
 *          without handing their session to the operator standing there.
 * Ownership: Schema package (single source of truth)
 *
 * The override audit closed eleven findings and left one sentence standing:
 * authority is **checked, never re-proven**. Twelve override points ask whether
 * the logged-in operator clears the reason code's `approval_level` and refuse
 * otherwise — but the thing they measure is the session that happens to be
 * open, not a credential entered at the moment of the decision. OPERA's
 * override is an interruption: the operator lacks the right, a supervisor
 * enters *their own* credentials at that terminal, the action proceeds and is
 * recorded against the supervisor.
 *
 * That difference matters in exactly one situation and it is the common one —
 * a clerk at the desk with a guest in front of them who needs a manager's
 * authority for the next thirty seconds. Before this the answer was a queued
 * approval or a manager logging the clerk out.
 *
 * **What this is not.** It is not the dual-control queue and does not replace
 * it. The five commands in `COMMAND_DUAL_CONTROL` — the three write-offs,
 * `fiscal_period.reopen`, `date_roll.manual` — still require a second actor
 * asynchronously, and {@link stepUpEligibilityRefusal} refuses a grant for
 * them at all. The reasoning is in `command-approvals.ts`: nothing recovers a
 * write-off, so the authority is asked for beforehand and away from a pressured
 * counter. A credential typed at a desk is a second person but it is not
 * deliberation, and a control that can be satisfied in thirty seconds at the
 * point of maximum pressure is the one that gets rubber-stamped.
 *
 * **Why a grant rather than a token.** The authority checks run at *apply*
 * time, in the consumer, against the role on the command envelope — deliberately
 * not at the gateway, because the gateway does not know which reason code a
 * payload names. So the supervisor's decision has to travel with the command.
 * It rides as `metadata.stepUp`, beside `metadata.approval`, and is minted in
 * exactly one place for the same reason the approval grant is: a value a caller
 * could supply is a value a caller could forge, and this one waives an
 * authority check.
 */

import { z } from "zod";

import { type TenantRole, tenantRoleAtLeast } from "../shared/enums.js";

import { COMMAND_DUAL_CONTROL } from "./command-approvals.js";
import { COMMAND_MIN_ROLE } from "./command-permissions.js";

/**
 * How long a grant stays spendable.
 *
 * Short on purpose. The supervisor is standing at the terminal; the window only
 * has to cover reading the confirmation and pressing the button. A long window
 * turns "a manager authorised this" into "a manager was somewhere on the
 * property this afternoon", which is the claim the audit trail must not make.
 */
export const STEP_UP_TTL_SECONDS = 300;

/** Why a step-up grant was refused, at mint time or at spend time. */
export type StepUpRefusalCode =
	| "STEP_UP_COMMAND_NOT_ELIGIBLE"
	| "STEP_UP_GRANT_NOT_FOUND"
	| "STEP_UP_GRANT_CONSUMED"
	| "STEP_UP_GRANT_EXPIRED"
	| "STEP_UP_GRANT_COMMAND_MISMATCH"
	| "STEP_UP_GRANT_ENTITY_MISMATCH"
	| "STEP_UP_GRANT_TENANT_MISMATCH"
	| "STEP_UP_SUPERVISOR_IS_OPERATOR"
	| "STEP_UP_ROLE_INSUFFICIENT";

/**
 * The supervisor's decision, as it travels on the command envelope.
 *
 * Never settable from a request body — the gateway mints this from a grant row
 * it has just claimed, exactly as `CommandApprovalGrant` is minted from an
 * approval row. A caller who could supply it could waive the authority check
 * this exists to satisfy.
 */
export type OverrideStepUpGrant = {
	grantId: string;
	/** The supervisor who stood at the terminal, and whose authority is recorded. */
	supervisorId: string;
	supervisorRole: TenantRole;
	/** The record it was authorised against, when the command names one. */
	entityId: string | null;
	grantedAt: string;
};

/**
 * A grant row as the mint and spend paths need to see it.
 *
 * `consumed_at` and `consumed_command_id` are the single-use record: a grant is
 * claimed by a conditional UPDATE, so two commands racing for the same grant
 * cannot both win, and the row afterwards says which command spent it.
 */
export type OverrideStepUpGrantRow = {
	grant_id: string;
	tenant_id: string;
	property_id: string | null;
	command_name: string;
	entity_id: string | null;
	supervisor_id: string;
	supervisor_role: string;
	/** The operator who asked for the step-up — the actor of record on the command. */
	requested_by: string;
	created_at: string;
	expires_at: string;
	consumed_at: string | null;
	consumed_command_id: string | null;
};

/**
 * Whether a command may be authorised by a supervisor at the terminal.
 *
 * Two refusals, and they are different in kind:
 *
 * - **A dual-control command is never eligible.** See the note at the top of
 *   this file. This is the decision that keeps step-up from quietly becoming a
 *   way around A04, and it is enforced at mint time so no grant for one can
 *   exist to be spent.
 * - **An unknown command is never eligible**, on the same rule A02 used: a
 *   command with no declared floor is refused outright rather than defaulted,
 *   because a new command that is silently step-uppable is how the single-role
 *   model happened the first time.
 */
export const isStepUpEligibleCommand = (commandName: string): boolean =>
	COMMAND_MIN_ROLE.has(commandName) && !COMMAND_DUAL_CONTROL.has(commandName);

/** The refusal for an ineligible command, or `null` when it may be stepped up. */
export const stepUpEligibilityRefusal = (
	commandName: string,
): { code: StepUpRefusalCode; message: string } | null => {
	if (COMMAND_DUAL_CONTROL.has(commandName)) {
		return {
			code: "STEP_UP_COMMAND_NOT_ELIGIBLE",
			message:
				`${commandName} requires a second approver through the approval queue and ` +
				`cannot be authorised at the terminal. Submit it and have a second ` +
				`${COMMAND_DUAL_CONTROL.get(commandName)} release it.`,
		};
	}
	if (!COMMAND_MIN_ROLE.has(commandName)) {
		return {
			code: "STEP_UP_COMMAND_NOT_ELIGIBLE",
			message: `${commandName} is not a declared command.`,
		};
	}
	return null;
};

export type StepUpDecision =
	| { ok: true }
	| { ok: false; code: StepUpRefusalCode; message: string };

/**
 * The rules a grant has to satisfy to be spent, in one place.
 *
 * Pure, so the gateway can run it inside the transaction that locks the row and
 * the UI can run it to explain a refusal before one is attempted — the same
 * arrangement `evaluateApprovalAction` has, and for the same reason: a second
 * copy of a control's rules is how two ends of it come to disagree.
 *
 * Order is the policy:
 *
 * 1. **Unconsumed.** Single use is most of the containment; a grant that could
 *    be replayed is a supervisor's authority left lying on the counter.
 * 2. **Unexpired**, even for a supervisor who holds every right. The decision
 *    was made against a state that has since moved on.
 * 3. **The command matches.** A grant is authority for one operation, not for
 *    the next thirty seconds of whatever the operator types.
 * 4. **The entity matches**, when the grant names one. Authorising a room move
 *    for one booking must not move a different guest.
 * 5. **The tenant matches**, which cannot happen through the API and is checked
 *    anyway because the cost of being wrong is a cross-tenant override.
 */
export const evaluateStepUpGrant = (input: {
	grant: Pick<
		OverrideStepUpGrantRow,
		"tenant_id" | "command_name" | "entity_id" | "expires_at" | "consumed_at"
	>;
	tenantId: string;
	commandName: string;
	entityId: string | null | undefined;
	now?: Date;
}): StepUpDecision => {
	if (input.grant.consumed_at !== null) {
		return {
			ok: false,
			code: "STEP_UP_GRANT_CONSUMED",
			message: "This authorisation has already been used. Ask for a new one.",
		};
	}

	const expiresAt = new Date(input.grant.expires_at);
	if (expiresAt.getTime() <= (input.now ?? new Date()).getTime()) {
		return {
			ok: false,
			code: "STEP_UP_GRANT_EXPIRED",
			message: "This authorisation has expired. Ask for a new one.",
		};
	}

	if (input.grant.tenant_id !== input.tenantId) {
		return {
			ok: false,
			code: "STEP_UP_GRANT_TENANT_MISMATCH",
			message: "This authorisation belongs to another tenant.",
		};
	}

	if (input.grant.command_name !== input.commandName) {
		return {
			ok: false,
			code: "STEP_UP_GRANT_COMMAND_MISMATCH",
			message:
				`This authorisation was given for ${input.grant.command_name}, ` +
				`not ${input.commandName}.`,
		};
	}

	// A grant with no entity authorises the command generally — the few commands
	// that name no single record. One that names an entity is spendable only on
	// that record, including when the command arrives naming none.
	if (
		input.grant.entity_id !== null &&
		input.grant.entity_id !== input.entityId
	) {
		return {
			ok: false,
			code: "STEP_UP_GRANT_ENTITY_MISMATCH",
			message:
				"This authorisation was given for a different record. A supervisor " +
				"authorises one operation on one record, not the command in general.",
		};
	}

	return { ok: true };
};

/**
 * The authority an override is measured against, once step-up is considered.
 *
 * The operator's own role still wins when it is enough: gating a manager's
 * routine call behind a password prompt would be theatre, and A02's floor has
 * already decided who may run the command at all. A grant only ever *raises*
 * the authority, and the identity it raises it to is the one the override
 * record must name — "recorded against the supervisor" is the half of OPERA's
 * model that makes the trail worth keeping.
 */
export type OverrideAuthority = {
	/** The role the override is authorised under. */
	role: string | null | undefined;
	/** Who it is recorded against — the supervisor when one stepped up. */
	actorId: string | null | undefined;
	/** True when a supervisor's credential, not the open session, cleared it. */
	viaStepUp: boolean;
	grantId: string | null;
};

/**
 * Resolve the authority for an override: the operator's, raised by a grant.
 *
 * Deliberately total rather than throwing — the caller is an authority check
 * that has its own refusal to raise, with the reason code and gate name in
 * hand. This only answers "whose authority, and how much".
 */
export const resolveOverrideAuthority = (
	actor: { id?: string | null; role?: string | null },
	stepUp?: OverrideStepUpGrant | null,
): OverrideAuthority => {
	if (!stepUp) {
		return {
			role: actor.role,
			actorId: actor.id,
			viaStepUp: false,
			grantId: null,
		};
	}
	// The higher of the two, so a grant can never *lower* the authority an
	// operator already holds — a supervisor stepping up for a clerk must not
	// hand a manager less than they walked in with.
	const useGrant = !tenantRoleAtLeast(actor.role, stepUp.supervisorRole);
	return useGrant
		? {
				role: stepUp.supervisorRole,
				actorId: stepUp.supervisorId,
				viaStepUp: true,
				grantId: stepUp.grantId,
			}
		: {
				role: actor.role,
				actorId: actor.id,
				viaStepUp: false,
				grantId: stepUp.grantId,
			};
};

/**
 * What an operator sends to ask a supervisor to authorise one override.
 *
 * The credentials are the *supervisor's*. The operator is identified by the
 * bearer token the request already carries, and is never named in the body —
 * A01's rule, which found four-eyes comparing two caller-supplied strings.
 */
export const StepUpRequestSchema = z.object({
	/** The supervisor's own login, entered at the terminal. */
	username: z.string().min(1).max(200),
	password: z.string().min(1).max(400),
	/** Present when the supervisor has MFA enabled, exactly as at login. */
	mfa_code: z.string().min(1).max(20).optional(),
	/** The one command this authorises. */
	command_name: z.string().min(1).max(120),
	/** The one record, when the command names one. */
	entity_id: z.string().uuid().nullish(),
	/** Where the terminal is, when the caller knows. */
	property_id: z.string().uuid().nullish(),
});
export type StepUpRequest = z.infer<typeof StepUpRequestSchema>;

/**
 * What comes back: a grant id to attach to the command, and who gave it.
 *
 * Deliberately not a token and deliberately not a session. The operator gets a
 * reference to a row that authorises one command on one record, once, for five
 * minutes — not the supervisor's identity to keep using.
 */
export const StepUpGrantResponseSchema = z.object({
	grant_id: z.string().uuid(),
	command_name: z.string(),
	entity_id: z.string().uuid().nullable(),
	/** Shown back to the operator so the screen can say whose authority it carries. */
	supervisor_name: z.string(),
	supervisor_role: z.string(),
	expires_at: z.string(),
});
export type StepUpGrantResponse = z.infer<typeof StepUpGrantResponseSchema>;

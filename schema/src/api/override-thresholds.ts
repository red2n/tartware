/**
 * DEV DOC
 * Module: api/override-thresholds.ts
 * Purpose: Turn the settings catalogue's approval thresholds into a demand the
 *          code can enforce, so an override is authorized by *amount* and not
 *          only by command.
 * Ownership: Schema package (single source of truth)
 *
 * A02 gave every command a permission floor and A05–A07 gave the overrides a
 * reason code whose `approval_level` the acting role must clear. Both authorize
 * the *act*. Neither has ever looked at the number: discounting a room by 5% and
 * writing 90% off it are the same command, cleared by the same role, recorded
 * the same way.
 *
 * The policy for this has been written down and unread since before the audit.
 * `WORKFLOW.RATES.APPROVALS` in the settings catalogue declares
 * `discountApprovalThresholds` — 10% needs a revenue manager, 20% needs a
 * general manager — alongside `compNightsLimit` and
 * `refundPolicy.requireApprovalAbove`. Nothing read any of it.
 *
 * Two things had to be true before anything could:
 *
 * 1. **A domain service has to be able to ask.** `resolveSettings` lived inside
 *    core-service, so billing and reservations had no way to read a tenant's
 *    policy. It is now shared — see `settings-utils` in
 *    `@tartware/command-consumer-utils`.
 * 2. **The roles have to be translatable.** `REVENUE_MANAGER` and
 *    `GENERAL_MANAGER` are not members of `TenantRoleEnum`, exactly as
 *    `approval_level`'s SUPERVISOR and DIRECTOR are not. This file carries that
 *    translation, on the same rule as `override-authority.ts`: where the
 *    product has no equivalent tier, the demand rounds **up** to the next real
 *    one, never down to "anyone".
 *
 * **The default is load-bearing, not a safety net.** `settings_definitions` is
 * seeded per tenant by core-service's catalogue installer, and that installer
 * writes every row under the demo tenant — so for every real property the
 * lookup finds nothing. If an absent policy meant "no threshold", this control
 * would be off everywhere it matters and on only in the sample data, which is
 * the same shape of defect that had all seventeen override reason codes
 * invisible outside the demo tenant. So the shipped defaults below are what
 * applies until a tenant states otherwise, and the catalogue imports them
 * rather than restating them.
 */

import { z } from "zod";

import { type TenantRole, tenantRoleAtLeast } from "../shared/enums.js";

/** Settings code carrying the rate and discount approval policy. */
export const RATE_APPROVAL_SETTING = "WORKFLOW.RATES.APPROVALS";

/** Settings code carrying the write-off approval policy. */
export const WRITE_OFF_APPROVAL_SETTING =
	"WORKFLOW.FINANCE.WRITE_OFF_APPROVALS";

/**
 * The approver vocabulary the settings catalogue is written in.
 *
 * A hotel org chart, not a membership ladder — which is why it needs a
 * translation rather than a comparison. Kept open as a plain string in the
 * parsed policy so an unrecognised value is caught by
 * {@link approverRoleMinRole} with a stated refusal, instead of failing to
 * parse and silently taking the default.
 */
export const APPROVER_ROLE_MIN_ROLE: Readonly<Record<string, TenantRole>> = {
	SUPERVISOR: "MANAGER",
	MANAGER: "MANAGER",
	REVENUE_MANAGER: "MANAGER",
	FRONT_OFFICE_MANAGER: "MANAGER",
	DIRECTOR: "ADMIN",
	FINANCE_DIRECTOR: "ADMIN",
	CONTROLLER: "ADMIN",
	GENERAL_MANAGER: "OWNER",
	GM: "OWNER",
	OWNER: "OWNER",
	// The membership roles themselves are accepted, so a tenant that writes its
	// policy in the product's own vocabulary is not punished for it.
	ADMIN: "ADMIN",
	STAFF: "STAFF",
};

/**
 * The membership role an approver named in a policy corresponds to.
 *
 * Throws on a name no mapping covers. Returning "no demand" for a value nobody
 * understands would make a typo in a JSON settings blob the easiest way past
 * every threshold in the product, and a settings value is edited by hand far
 * more often than a reason code is.
 */
export const approverRoleMinRole = (approverRole: string): TenantRole => {
	const mapped = APPROVER_ROLE_MIN_ROLE[approverRole.trim().toUpperCase()];
	if (!mapped) {
		throw new Error(
			`Unknown approver role "${approverRole}" in an approval threshold — expected one of ` +
				`${Object.keys(APPROVER_ROLE_MIN_ROLE).join(", ")}`,
		);
	}
	return mapped;
};

/** One rung of a threshold ladder: at or above `percent`, `approverRole` is required. */
export const DiscountThresholdSchema = z.object({
	percent: z.coerce.number().min(0).max(100),
	approverRole: z.string().min(2).max(60),
});

/** One rung of an amount ladder: at or above `amount`, `approverRole` is required. */
export const AmountThresholdSchema = z.object({
	amount: z.coerce.number().nonnegative(),
	approverRole: z.string().min(2).max(60),
});

/**
 * `WORKFLOW.RATES.APPROVALS`, as stored.
 *
 * Every field is optional with a default because this is a JSON blob a human
 * edits in a settings screen: a policy that sets only `compNightsLimit` must
 * still parse, and must not silently blank the discount ladder.
 */
export const RateApprovalPolicySchema = z.object({
	discountApprovalThresholds: z.array(DiscountThresholdSchema).default([]),
	compNightsLimit: z.coerce.number().int().nonnegative().optional(),
	refundPolicy: z
		.object({
			requireApprovalAbove: z.coerce.number().nonnegative().optional(),
			autoFlagReasons: z.array(z.string()).optional(),
		})
		.optional(),
});

export type RateApprovalPolicy = z.infer<typeof RateApprovalPolicySchema>;

/** `WORKFLOW.FINANCE.WRITE_OFF_APPROVALS`, as stored. */
export const WriteOffApprovalPolicySchema = z.object({
	amountApprovalThresholds: z.array(AmountThresholdSchema).default([]),
});

export type WriteOffApprovalPolicy = z.infer<
	typeof WriteOffApprovalPolicySchema
>;

/**
 * What the product enforces until a tenant says otherwise.
 *
 * These exact numbers have been in the catalogue since it was written; the only
 * change is that something reads them. The catalogue imports this constant, so
 * the screen and the handler cannot drift.
 */
export const DEFAULT_RATE_APPROVAL_POLICY: RateApprovalPolicy = {
	discountApprovalThresholds: [
		{ percent: 10, approverRole: "REVENUE_MANAGER" },
		{ percent: 20, approverRole: "GENERAL_MANAGER" },
	],
	compNightsLimit: 2,
	refundPolicy: {
		requireApprovalAbove: 500,
		autoFlagReasons: ["FRAUD", "VIP"],
	},
};

/**
 * What the product enforces on a write-off until a tenant says otherwise.
 *
 * New, unlike the rate ladder — there was no written policy to read, and A07
 * left "amount threshold outstanding" precisely because of that. The rungs
 * mirror the seeded WRITE_OFF reason codes, which already grade themselves
 * MANAGER for a small balance and GM for insolvency: a ladder that disagreed
 * with the codes an operator picks from would be a second opinion, not a
 * control.
 */
export const DEFAULT_WRITE_OFF_APPROVAL_POLICY: WriteOffApprovalPolicy = {
	amountApprovalThresholds: [
		{ amount: 0, approverRole: "MANAGER" },
		{ amount: 1_000, approverRole: "FINANCE_DIRECTOR" },
		{ amount: 10_000, approverRole: "GENERAL_MANAGER" },
	],
};

/**
 * The highest rung `value` reaches, or `null` when it clears none.
 *
 * Highest rather than first: the ladders are small and hand-edited, so assuming
 * they arrive sorted is an invitation for a 20% rung listed above a 10% one to
 * quietly demote every large discount.
 */
const highestRung = <T extends { approverRole: string }>(
	rungs: readonly T[],
	reaches: (rung: T) => boolean,
): TenantRole | null => {
	let required: TenantRole | null = null;
	for (const rung of rungs) {
		if (!reaches(rung)) continue;
		const role = approverRoleMinRole(rung.approverRole);
		if (required === null || tenantRoleAtLeast(role, required)) {
			required = role;
		}
	}
	return required;
};

/**
 * The role a discount of `percentOff` demands, or `null` for none.
 *
 * A rung applies at or above its percent: a policy whose lowest rung is 10%
 * means "10% is already a manager's decision", which is how an operator reads
 * it. Zero and negative movements (a rate going up) demand nothing — this
 * ladder is about money leaving.
 */
export const requiredRoleForDiscount = (
	policy: RateApprovalPolicy,
	percentOff: number,
): TenantRole | null => {
	if (!Number.isFinite(percentOff) || percentOff <= 0) return null;
	return highestRung(
		policy.discountApprovalThresholds,
		(rung) => percentOff >= rung.percent,
	);
};

/** The role a write-off of `amount` demands, or `null` for none. */
export const requiredRoleForWriteOff = (
	policy: WriteOffApprovalPolicy,
	amount: number,
): TenantRole | null => {
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return highestRung(
		policy.amountApprovalThresholds,
		(rung) => amount >= rung.amount,
	);
};

/**
 * How far below the original a new amount sits, as a percentage.
 *
 * Returns 0 rather than a negative when the rate goes up, and 0 when the
 * original is missing or zero — a booking with no prior amount has no discount
 * to measure, and inventing one would refuse overrides at random.
 */
export const discountPercent = (
	originalAmount: number | null | undefined,
	newAmount: number | null | undefined,
): number => {
	if (
		typeof originalAmount !== "number" ||
		typeof newAmount !== "number" ||
		!Number.isFinite(originalAmount) ||
		!Number.isFinite(newAmount) ||
		originalAmount <= 0
	) {
		return 0;
	}
	const off = ((originalAmount - newAmount) / originalAmount) * 100;
	return off > 0 ? off : 0;
};

/**
 * Whether `actorRole` clears a threshold that demands `requiredRole`.
 *
 * `null` means the threshold demanded nothing. An unrecognised actor role
 * scores nothing in `tenantRoleAtLeast`, which is deliberate: the role on a
 * command envelope can be `SYSTEM_ACTOR_ROLE` for a scheduler or a replay, and
 * that actor must not clear a ladder no human was asked about.
 */
export const actorClearsThreshold = (
	actorRole: string | null | undefined,
	requiredRole: TenantRole | null,
): boolean =>
	requiredRole === null || tenantRoleAtLeast(actorRole ?? "", requiredRole);

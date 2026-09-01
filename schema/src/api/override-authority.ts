/**
 * DEV DOC
 * Module: api/override-authority.ts
 * Purpose: Turn `reason_codes.approval_level` into an authority the code can
 *          check, so an override is authorized rather than merely logged.
 * Ownership: Schema package (single source of truth)
 *
 * `reason_codes` has carried an `approval_level` column — NONE / SUPERVISOR /
 * MANAGER / DIRECTOR / GM, with a CHECK constraint and a comment saying
 * "minimum role to approve" — since the table was created. Nothing read it.
 * Every override in the product therefore ran on the authority of whoever
 * happened to be holding the terminal: `force: true` on a payload was the
 * whole mechanism, and the reason code chosen alongside it could demand a GM
 * without any consequence.
 *
 * The awkward part, and the reason this file exists rather than a one-line
 * comparison at each call site: **these are two different vocabularies**. The
 * product's membership ladder is `TenantRoleEnum` — OWNER, ADMIN, MANAGER,
 * STAFF, VIEWER — and it has no SUPERVISOR and no DIRECTOR. Reference data
 * written against a hotel org chart cannot be compared to a membership row
 * without an explicit, stated translation, and inventing one per call site is
 * how two call sites end up disagreeing about whether a DIRECTOR outranks an
 * ADMIN.
 *
 * So the translation lives here, once, and it is deliberately lossy in the one
 * direction that is safe: where the product has no equivalent tier the level
 * rounds **up** to the next real one. A code marked SUPERVISOR is enforced as
 * MANAGER — the lowest membership above the shift floor — rather than being
 * quietly dropped to "anyone".
 */

import { type TenantRole, tenantRoleAtLeast } from "../shared/enums.js";

/**
 * The values `reason_codes.approval_level` may hold, matching the CHECK
 * constraint in `scripts/tables/09-reference-data/08_reason_codes.sql`.
 */
export const APPROVAL_LEVELS = [
	"NONE",
	"SUPERVISOR",
	"MANAGER",
	"DIRECTOR",
	"GM",
] as const;

export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/**
 * What each configured approval level costs in membership terms.
 *
 * `null` means the level asks for nothing beyond the command's own floor in
 * `COMMAND_MIN_ROLE` — it is not a licence, it is the absence of an extra
 * demand.
 *
 * SUPERVISOR and MANAGER both land on MANAGER because the product has one
 * tier there; DIRECTOR lands on ADMIN and GM on OWNER, which is the same
 * pairing A02 used when it put the five irreversible commands at OWNER. If a
 * property genuinely needs a supervisor distinct from a manager, the fix is a
 * new membership role, not a second mapping.
 */
export const APPROVAL_LEVEL_MIN_ROLE: Readonly<
	Record<ApprovalLevel, TenantRole | null>
> = {
	NONE: null,
	SUPERVISOR: "MANAGER",
	MANAGER: "MANAGER",
	DIRECTOR: "ADMIN",
	GM: "OWNER",
};

/**
 * Whether `level` is a value this model knows how to enforce.
 *
 * Worth checking rather than assuming: the column is `VARCHAR(20)` and its
 * CHECK constraint is the only thing keeping it honest, so a value can arrive
 * here that no mapping covers.
 */
export const isApprovalLevel = (
	level: string | null | undefined,
): level is ApprovalLevel =>
	typeof level === "string" &&
	(APPROVAL_LEVELS as readonly string[]).includes(level.toUpperCase());

/**
 * The membership role an override under this reason code requires, or `null`
 * when it requires nothing extra.
 *
 * Throws on an unrecognised level rather than returning `null`. Returning
 * "nothing extra" for a value nobody understands would make a corrupted or
 * hand-edited reason code the easiest way past every override control in the
 * product, and this is the one place that decision is made.
 */
export const approvalLevelMinRole = (
	level: string | null | undefined,
): TenantRole | null => {
	// An unset column is the table default, and the default is NONE.
	if (level === null || level === undefined || level === "") return null;
	const normalised = level.toUpperCase();
	if (!isApprovalLevel(normalised)) {
		throw new Error(
			`Unknown reason code approval_level "${level}" — expected one of ${APPROVAL_LEVELS.join(", ")}`,
		);
	}
	return APPROVAL_LEVEL_MIN_ROLE[normalised];
};

/**
 * Whether an actor holding `actorRole` may override under a reason code
 * configured at `level`.
 *
 * Fails closed on both halves. An unrecognised level throws out of
 * `approvalLevelMinRole`; an unrecognised role scores nothing in
 * `tenantRoleAtLeast`, which matters because the role travelling on a command
 * envelope can legitimately be `SYSTEM_ACTOR_ROLE` — a scheduler or a replay,
 * which is exactly the actor that must never be able to clear a blacklist.
 */
export const actorClearsApprovalLevel = (
	actorRole: string | null | undefined,
	level: string | null | undefined,
): boolean => {
	const required = approvalLevelMinRole(level);
	if (required === null) return true;
	return tenantRoleAtLeast(actorRole, required);
};

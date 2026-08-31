/**
 * DEV DOC
 * Module: events/commands/credit-limit-override.ts
 * Purpose: The payload fields a command carries to take a balance past a
 *          configured credit limit, declared once for the three commands that
 *          can hit that block.
 * Ownership: Schema package (single source of truth)
 *
 * `CREDIT_LIMIT_EXCEEDED` is thrown from two different checks — a guest's
 * `credit_limits` block threshold on payment authorize and capture, and an AR
 * account's `available_credit` on a city-ledger transfer — and neither had any
 * way through it (audit finding A05). A front office whose corporate guest is a
 * dollar over on the night of departure had one option: raise the limit, which
 * silently rewrites the control instead of recording that it was overridden
 * once, by whom, and why.
 *
 * The fields live here rather than being typed out three times because they are
 * the *same* decision in three places, and three copies is how one of them ends
 * up spelling the reason code optional.
 */

import { z } from "zod";

/**
 * Spread into a command's `z.object({ … })` to give it a credit-limit override.
 *
 * Nothing here is a bare `force`. The reason code is resolved against the
 * CREDIT_LIMIT category and its `approval_level` is checked against the role on
 * the command envelope before the block is lifted — see `assertOverrideAuthority`
 * in `@tartware/command-consumer-utils/command-utils`.
 */
export const CREDIT_LIMIT_OVERRIDE_FIELDS = {
	credit_limit_override: z.boolean().optional(),
	credit_limit_override_reason_code: z.string().min(2).max(50).optional(),
	credit_limit_override_notes: z.string().max(500).optional(),
} as const;

/** The shape the refinement below reads. */
export type CreditLimitOverrideFields = {
	credit_limit_override?: boolean | undefined;
	credit_limit_override_reason_code?: string | undefined;
	credit_limit_override_notes?: string | undefined;
};

/**
 * An override with no stated reason is refused at validation, before the
 * command is ever accepted — the same rule night audit's `skip_preconditions`
 * follows.
 */
export const hasCreditLimitOverrideReason = (
	value: CreditLimitOverrideFields,
): boolean =>
	value.credit_limit_override !== true ||
	Boolean(value.credit_limit_override_reason_code);

/** The message and path every command's refinement reports. */
export const CREDIT_LIMIT_OVERRIDE_REFINEMENT = {
	message:
		"credit_limit_override_reason_code is required when credit_limit_override is true — an override with no stated reason is the control this gate exists to provide",
	path: ["credit_limit_override_reason_code"],
} as const;

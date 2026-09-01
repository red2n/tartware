/**
 * Sentinel UUID used when no authenticated actor is available
 * (e.g. system-initiated commands from scheduler jobs). Defined once in
 * `@tartware/config` — the lowest layer that needs it — and re-exported here so
 * command handlers have a single import for actor resolution.
 *
 * It matches the seeded `system.actor` row in `users`, so it satisfies the
 * foreign keys on the `created_by` / `updated_by` audit columns.
 */
export { SYSTEM_ACTOR_ID } from "@tartware/config";

import { SYSTEM_ACTOR_ID } from "@tartware/config";
import {
  actorClearsApprovalLevel,
  approvalLevelMinRole,
  type ReasonCodeRow,
  TenantRoleEnum,
} from "@tartware/schemas";

/**
 * Role recorded when a command carries no authenticated membership — a
 * scheduler job, a replay, an internal dispatch. The role counterpart to
 * `SYSTEM_ACTOR_ID`, and deliberately not a member of `TenantRoleEnum`: it
 * names the absence of a human authority rather than impersonating one.
 */
export const SYSTEM_ACTOR_ROLE = "SYSTEM";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return `value` if it is a valid UUID string, otherwise `null`.
 */
export const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

/**
 * Resolve the actor UUID from a command's `initiatedBy` context,
 * falling back to `SYSTEM_ACTOR_ID` when none is provided.
 */
export const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  asUuid(initiatedBy?.userId) ?? SYSTEM_ACTOR_ID;

/**
 * The role held by the actor when the command was accepted.
 *
 * The counterpart to {@link resolveActorId}, and the reason it exists: the
 * gateway stamps `initiatedBy = { userId, role }` from the caller's membership
 * and the envelope carries both to the consumer, but every handler read only
 * `.userId`. The role was dropped on arrival, so every `flow_approvals` row
 * written on the command path recorded a hardcoded literal — `"FORCE_OVERRIDE"`,
 * `"GM_OVERRIDE"` — in a column whose own comment calls it a snapshot of the
 * approver's role. An override trail that cannot say who had the authority is
 * not a trail.
 *
 * Falls back to {@link SYSTEM_ACTOR_ROLE} for a scheduler or replay with no
 * membership behind it, and for anything that is not a recognised role — the
 * same shape as `asUuid` guarding the actor id.
 */
export const resolveActorRole = (initiatedBy?: { role?: string } | null): string =>
  TenantRoleEnum.safeParse(initiatedBy?.role).data ?? SYSTEM_ACTOR_ROLE;

/**
 * Domain error for command handler failures.
 * Carries a machine-readable `code` alongside the human message.
 *
 * Every service's command error should extend this rather than `Error`: the
 * consumer's retry predicate reads `retryable` off it, so an error that does
 * not carry the field is treated as an unknown failure and retried.
 */
/**
 * Marks an object as a CommandError without relying on `instanceof`.
 *
 * `instanceof` compares class identity, and a monorepo can hold two identities
 * of one class at once: services run from source through tsx while resolving
 * their siblings through the package `exports` map to `dist`, so a subpath the
 * tsconfig wildcard happens to miss returns a *second* copy of this module. That
 * is not hypothetical — `/lifecycle`, `/idempotency` and `/batch` all missed it,
 * because their file names differ from their export names, and the consequence
 * was silent: `isRetryableByDefault` stopped recognising these errors and
 * retried every deterministic rejection through the full backoff ladder,
 * stalling the partition behind it. Findings 02 and 03 were void at runtime
 * while every unit test — which imports one copy — passed.
 *
 * A brand is checked by value, so it survives the split. The paths are fixed
 * too, but a control this repo relies on should not depend on getting module
 * resolution right forever.
 */
export const COMMAND_ERROR_BRAND = "tartware.CommandError";

export class CommandError extends Error {
  readonly code: string;

  /**
   * When true the command consumer retries this error rather than routing
   * immediately to the DLQ. Set it only for transient failures (e.g. an
   * unexpected DB write failure) that may succeed on a later attempt.
   *
   * Business-logic rejections — wrong status, missing FK, failed validation —
   * must leave it false. Commands are consumed in partition order, so a
   * retried error stalls every command queued behind it for the length of the
   * backoff ladder, and still lands in the DLQ at the end of it.
   */
  readonly retryable: boolean;

  /** See {@link COMMAND_ERROR_BRAND}. Read by `isCommandError`, never by name. */
  readonly [Symbol.toStringTag] = COMMAND_ERROR_BRAND;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    // Report the concrete subclass name so a DLQ entry says which service and
    // which error type produced it, not just "CommandError".
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

/**
 * Whether `error` is a CommandError, whichever copy of this module made it.
 *
 * Structural on purpose — see {@link COMMAND_ERROR_BRAND}. It asks for the
 * brand plus the two fields the retry policy actually reads, so a plain object
 * that happens to carry a `code` is not mistaken for one.
 */
export const isCommandError = (error: unknown): error is CommandError =>
  error instanceof Error &&
  (error as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] === COMMAND_ERROR_BRAND &&
  typeof (error as { code?: unknown }).code === "string" &&
  typeof (error as { retryable?: unknown }).retryable === "boolean";

// ─── Reason codes ────────────────────────────────────────────────────────────

/** The all-zero tenant the product's own reference codes are seeded under. */
const SYSTEM_REASON_TENANT = "00000000-0000-0000-0000-000000000000";

const RESOLVE_REASON_CODE_SQL = `
  SELECT reason_id, reason_code, reason_name, reason_category,
         requires_approval, approval_level, has_financial_impact
    FROM public.reason_codes
   WHERE tenant_id IN ($1::uuid, $4::uuid)
     AND UPPER(reason_code) = UPPER($2)
     AND COALESCE(is_active, true) = true
     AND COALESCE(is_deleted, false) = false
     AND (property_id IS NULL OR property_id = $3::uuid)
   ORDER BY (tenant_id = $1::uuid) DESC, property_id NULLS LAST
   LIMIT 1
`;

/**
 * Resolve a reason code against `reason_codes`, or refuse.
 *
 * Lives here rather than in one service because it is the entry point for a
 * control, not a helper: an override whose reason is free text cannot be
 * grouped, cannot carry `requires_approval`, and cannot be checked against
 * `approval_level`. Reservations had this and billing did not, which is why
 * night audit's `skip_preconditions` recorded the hardcoded literal
 * `"SKIP_PRECONDITIONS"` — a reason code that did not have to exist.
 *
 * Resolution is a three-level hierarchy, most specific first: a property's own
 * code, then the tenant's, then the system defaults seeded under the all-zero
 * tenant. That last level is the one that matters — every reference code the
 * product ships is seeded there, and a resolver that looked only at the
 * caller's tenant could not see any of them.
 *
 * `queryFn` is injected the same way `recordFlowApproval` takes it, so this
 * stays free of any one service's pool.
 */
export const resolveReasonCode = async <TRow extends ReasonCodeRow>(
  queryFn: (sql: string, params: unknown[]) => Promise<{ rows: TRow[] }>,
  input: {
    tenantId: string;
    propertyId: string | null;
    reasonCode: string;
    /** The category the code must belong to, e.g. "REVERSAL". */
    category: string;
  },
): Promise<TRow> => {
  const result = await queryFn(RESOLVE_REASON_CODE_SQL, [
    input.tenantId,
    input.reasonCode,
    input.propertyId,
    SYSTEM_REASON_TENANT,
  ]);

  const row = result.rows[0];
  if (!row) {
    throw new CommandError(
      "REASON_CODE_NOT_FOUND",
      `Reason code "${input.reasonCode}" is not configured for this tenant. ` +
        `This command requires a reason code from the reason_codes reference table.`,
    );
  }

  // A code exists but belongs to a different kind of event — skipping a night
  // audit's preconditions with a "room move" reason produces an audit trail
  // that reads as a lie.
  if (row.reason_category && row.reason_category.toUpperCase() !== input.category) {
    throw new CommandError(
      "REASON_CODE_WRONG_CATEGORY",
      `Reason code "${input.reasonCode}" is category ${row.reason_category}, not ${input.category}`,
    );
  }

  return row;
};

/**
 * Refuse an override the acting operator does not have the authority to make.
 *
 * This is the half of an override control that the product has never had. A03
 * made the override *record* honest — the row now carries the role the operator
 * actually held instead of a literal like `"GM_OVERRIDE"` — but nothing ever
 * compared that role against anything before letting the override through. The
 * reason code's own `approval_level` is the demand, sitting unread in reference
 * data; this is where it is finally met or refused.
 *
 * Two things it deliberately does not do:
 *
 * - It does **not** consult `requires_approval`. That flag says a code needs a
 *   sign-off; `approval_level` says whose. A code can carry the first without
 *   the second (the default is NONE), and treating a bare `requires_approval`
 *   as "manager" here would invent a demand the configuration did not make.
 * - It does **not** run at the gateway. The floor A02 enforces in
 *   `acceptCommand` is per command and knows nothing about which reason code a
 *   payload names, and resolving one there would put a reference-data read on
 *   the accept path for every command that has an override field. So this
 *   refuses at apply time, like the reason-code resolution it follows — the
 *   caller sees a 202 and a failed command, which is the same shape night
 *   audit's bypass refusal already has.
 *
 * Not retryable: a clerk's role will not change on the retry ladder, and
 * burning 1s/5s/30s on a decision that cannot come out differently is finding
 * 02 all over again.
 */
export const assertOverrideAuthority = (
  reason: ReasonCodeRow,
  actorRole: string | null | undefined,
  context: { commandName: string; gateName: string },
): void => {
  let required: string | null;
  try {
    required = approvalLevelMinRole(reason.approval_level);
  } catch {
    // A level nobody can interpret is not a licence. The column is a VARCHAR
    // behind a CHECK constraint, and a CHECK is one migration away from gone.
    throw new CommandError(
      "OVERRIDE_AUTHORITY_UNKNOWN",
      `Reason code "${reason.reason_code}" carries approval_level ` +
        `"${reason.approval_level}", which is not a level this product can ` +
        `enforce. Refusing the override rather than guessing at it.`,
    );
  }

  if (actorClearsApprovalLevel(actorRole, reason.approval_level)) return;

  throw new CommandError(
    "OVERRIDE_AUTHORITY_INSUFFICIENT",
    `Overriding ${context.gateName} under reason code "${reason.reason_code}" ` +
      `requires ${required}; this command was initiated by ${actorRole ?? "an unidentified actor"}. ` +
      `${context.commandName} refuses rather than recording an override nobody was entitled to make.`,
  );
};

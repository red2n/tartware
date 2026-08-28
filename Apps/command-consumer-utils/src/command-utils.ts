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
import { TenantRoleEnum } from "@tartware/schemas";

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

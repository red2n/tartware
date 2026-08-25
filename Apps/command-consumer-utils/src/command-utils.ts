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
 * Domain error for command handler failures.
 * Carries a machine-readable `code` alongside the human message.
 */
export class CommandError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CommandError";
    this.code = code;
  }
}

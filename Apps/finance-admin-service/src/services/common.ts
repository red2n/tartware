import type { CommandContext } from "@tartware/schemas";

export type { CommandContext };

export class BillingCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const APP_ACTOR = "COMMAND_CENTER";
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

export const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? APP_ACTOR;

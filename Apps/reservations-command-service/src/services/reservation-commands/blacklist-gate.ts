/**
 * DEV DOC
 * Module: services/reservation-commands/blacklist-gate.ts
 * Purpose: The one way past `GUEST_BLACKLISTED` — asked for, resolved,
 *          authorised and recorded.
 * Ownership: reservations-command-service
 *
 * Let a booking past the blacklist, or refuse it (A05).
 *
 * The gate itself is older than this function and did the right thing: a
 * blacklisted guest could not be booked. What it did not have was a way
 * through. Its own message told the operator that "a GM override with
 * documented reason is required to proceed", and no such override existed
 * anywhere in the repo — no flag, no route, no record. In practice the way past
 * it was to clear `guests.is_blacklisted`, which does not document a decision,
 * it erases the listing for everyone who looks afterwards.
 *
 * Three things have to hold before the booking is taken, and they are checked
 * in this order on purpose:
 *
 * 1. The operator asked for the override explicitly. Without
 *    `blacklist_override` the refusal is what it always was.
 * 2. The reason code resolves, in the BLACKLIST category. An override filed
 *    under a room-move reason produces a trail that reads as a lie, which is
 *    the rule every other override in the product follows.
 * 3. The *acting* role clears the code's `approval_level`. This is the part a
 *    `force` flag never had: an override was logged and never authorized. A
 *    code seeded at GM is enforced as OWNER, and a clerk who names it is
 *    refused rather than recorded.
 *
 * **Why this is a file and not ten lines inside `core.ts`.** It was those ten
 * lines, and being module-private is why it shipped with no test of any kind
 * while its sibling — billing's `credit-limit-gate.ts`, the same control on the
 * same three conditions — shipped with fourteen. The two gates are now the same
 * shape in the same place in their services, which is the point: a control
 * nobody can call directly is a control nobody exercises directly.
 *
 * **Where the record is written, and why it differs from credit limit.** Here
 * the row goes in at the gate, before the create proceeds; there it goes in
 * after the write commits. The difference is what each row means. A
 * `credit_limit_check` row asserts that money moved past a limit, so one per
 * retry attempt would be three records of a transfer that happened once. A
 * `blacklist_check` row asserts that an operator decided to take a listed
 * guest's booking — which is true the moment they decide it, whether or not the
 * room turns out to be available. Being wrong in that direction leaves a record
 * of a decision genuinely taken; being wrong in the other loses it.
 */

import {
  assertOverrideAuthority,
  SYSTEM_ACTOR_ROLE,
} from "@tartware/command-consumer-utils/command-utils";

import { reservationsLogger } from "../../logger.js";
import type { ReservationCreateCommand } from "../../schemas/reservation-command.js";
import { recordFlowApproval } from "../../utils/audit.js";

import { ReservationCommandError, resolveReasonCode } from "./common.js";

/**
 * Who is asking, as every reservation command already carries it.
 *
 * Not exported: the same three fields are written inline at a dozen call sites
 * across this service, and lifting one copy out here would leave twelve. That
 * consolidation belongs in `schema/`, as one shape every command option bag
 * derives from, and it is not this change.
 */
type BlacklistGateOptions = {
  correlationId?: string | undefined;
  actorId?: string | undefined;
  actorRole?: string | undefined;
};

/**
 * Clear the blacklist gate for this create, or throw.
 *
 * Called only once the guest has been read and found listed — the caller owns
 * that check, because it reads the listing's own reason and severity for the
 * refusal message.
 *
 * Throws `ReservationCommandError` in every refusing case:
 * `GUEST_BLACKLISTED` when no override was asked for, and whatever
 * `resolveReasonCode` / `assertOverrideAuthority` raise otherwise. None of them
 * is retryable — a clerk's role does not change on the retry ladder.
 */
export const clearBlacklistGate = async (
  tenantId: string,
  command: ReservationCreateCommand,
  reservationId: string,
  options: BlacklistGateOptions,
): Promise<void> => {
  if (!command.blacklist_override) {
    throw new ReservationCommandError(
      "GUEST_BLACKLISTED",
      `Guest ${command.guest_id} is blacklisted. Reservation creation blocked. ` +
        "To proceed, set blacklist_override with a blacklist_override_reason_code " +
        "from the BLACKLIST reason codes — the override is recorded, and the code's " +
        "approval level is checked against your role.",
    );
  }

  // `?? ""` only satisfies the optional type: the command schema refuses a
  // blacklist_override with no reason code before this handler sees it.
  const reason = await resolveReasonCode(
    tenantId,
    command.property_id,
    command.blacklist_override_reason_code ?? "",
    "BLACKLIST",
  );

  assertOverrideAuthority(reason, options.actorRole, {
    commandName: "reservation.create",
    gateName: "blacklist_check",
  });

  await recordFlowApproval({
    tenantId,
    propertyId: command.property_id,
    flowName: "reservation",
    gateName: "blacklist_check",
    entityType: "reservation",
    entityId: reservationId,
    approvedBy: options.actorId ?? null,
    roleAtApproval: options.actorRole ?? SYSTEM_ACTOR_ROLE,
    forced: true,
    reasonCode: reason.reason_code,
    reasonNotes:
      command.blacklist_override_notes ??
      `${reason.reason_name}: booking taken for blacklisted guest ${command.guest_id}`,
    correlationId: options.correlationId ?? null,
  });

  reservationsLogger.warn(
    {
      tenantId,
      guestId: command.guest_id,
      reservationId,
      reasonCode: reason.reason_code,
      approvalLevel: reason.approval_level,
      actorRole: options.actorRole,
    },
    "blacklist gate overridden",
  );
};

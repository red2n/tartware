import {
  assertOverrideAuthority,
  SYSTEM_ACTOR_ROLE,
} from "@tartware/command-consumer-utils/command-utils";

import { fetchReservationStaySnapshot } from "../../repositories/reservation-repository.js";
import type {
  ReservationDepositAddCommand,
  ReservationDepositReleaseCommand,
  ReservationRateOverrideCommand,
} from "../../schemas/reservation-command.js";
import { recordFlowApproval } from "../../utils/audit.js";

import {
  APP_ACTOR,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  enqueueReservationUpdate,
  ReservationCommandError,
  type ReservationUpdatePayload,
  resolveReasonCode,
} from "./common.js";

/**
 * Override the reservation rate code and amount (A06).
 *
 * What this used to be: whatever the caller sent, written straight onto the
 * booking, with an optional sentence of free text landing in `internal_notes`.
 * No reason code, no authority check, no record — while `reason_codes` had
 * carried six RATE_OVERRIDE entries since the table was created, each naming
 * the `approval_level` its decision takes, and nothing resolved one.
 *
 * It now follows the same three steps as the blacklist and credit-limit gates,
 * in the same order: the code resolves in its own category, the acting role
 * clears the level that code demands, and the decision lands in
 * `flow_approvals` before the rate moves.
 *
 * The control is a **record**, not a gate: unlike a blacklist there is nothing
 * here to refuse in the ordinary case — overriding a rate is a legitimate daily
 * act — so every override writes a row and `forced` stays false. What is
 * refused is an override nobody was entitled to make.
 */
export const overrideRate = async (
  tenantId: string,
  command: ReservationRateOverrideCommand,
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  // The reservation's property, so a property-scoped reason code resolves the
  // way it does everywhere else. A booking that is not there cannot be
  // repriced, and saying so here beats a silent no-op update.
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const reason = await resolveReasonCode(
    tenantId,
    snapshot.propertyId,
    command.reason_code,
    "RATE_OVERRIDE",
  );

  assertOverrideAuthority(reason, options.actorRole, {
    commandName: "reservation.rate_override",
    gateName: "rate_override",
  });

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    rate_code: command.rate_code?.toUpperCase(),
    total_amount: command.total_amount,
    currency: command.currency?.toUpperCase(),
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.rate_override",
    updatePayload,
    options,
  );

  // Written after the command is enqueued, unlike the blacklist gate: there the
  // row records a refusal that was overridden, so it belongs at the decision.
  // Here it records an override that happened, and an override that failed to
  // enqueue did not happen.
  await recordFlowApproval({
    tenantId,
    propertyId: snapshot.propertyId,
    flowName: "in_house",
    gateName: "rate_override",
    entityType: "reservation",
    entityId: command.reservation_id,
    approvedBy: options.actorId ?? null,
    roleAtApproval: options.actorRole ?? SYSTEM_ACTOR_ROLE,
    forced: false,
    reasonCode: reason.reason_code,
    reasonNotes:
      command.reason ??
      `${reason.reason_name}: rate overridden to ${command.total_amount ?? command.rate_code ?? "a new rate"}`,
    correlationId: options.correlationId ?? null,
  });

  return result;
};

/**
 * Add a reservation deposit entry.
 */
export const addDeposit = async (
  tenantId: string,
  command: ReservationDepositAddCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.notes,
    metadata: {
      deposit_event: {
        type: "add",
        amount: command.amount,
        currency: command.currency ?? DEFAULT_CURRENCY,
        method: command.method,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.add_deposit", updatePayload, options);
};

/**
 * Release a reservation deposit entry.
 */
export const releaseDeposit = async (
  tenantId: string,
  command: ReservationDepositReleaseCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.reason,
    metadata: {
      deposit_event: {
        type: "release",
        amount: command.amount,
        deposit_id: command.deposit_id,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.release_deposit", updatePayload, options);
};

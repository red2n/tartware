import {
  assertOverrideAuthority,
  CommandError,
  SYSTEM_ACTOR_ROLE,
} from "@tartware/command-consumer-utils/command-utils";
import { resolvePolicy } from "@tartware/command-consumer-utils/settings-utils";
import {
  actorClearsThreshold,
  DEFAULT_RATE_APPROVAL_POLICY,
  discountPercent,
  RATE_APPROVAL_SETTING,
  RateApprovalPolicySchema,
  requiredRoleForDiscount,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
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
  type ReservationCommandOptions,
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
/**
 * Refuse a discount larger than the acting role is entitled to give.
 *
 * The reason code above authorizes the *act* of overriding a rate. This
 * authorizes the *size* of it, which nothing in the product has ever done: a 5%
 * courtesy and a 90% giveaway were the same command, cleared by the same role
 * and recorded identically. A06 named the policy that should have governed it —
 * `discountApprovalThresholds` in the settings catalogue, 10% for a revenue
 * manager and 20% for a general manager — and observed that nothing read it.
 *
 * Three things are worth knowing about how this reads it:
 *
 * - **The percentage is measured against the booking's current total**, taken
 *   from the snapshot this handler already loads. A booking with no prior
 *   amount yields 0% rather than a fabricated discount, so an override on a
 *   quote with no price is not refused at random.
 * - **A rate going up demands nothing.** The ladder is about money leaving.
 * - **An absent policy means the product's default, not "no rule".** The
 *   catalogue installer writes its definitions under the demo tenant, so a real
 *   property finds no row — and a threshold that only applied to sample data
 *   would be worse than none, because it would read as enforced.
 *
 * `rate_code`-only overrides are not measured: switching a booking to another
 * rate plan re-prices it downstream, and guessing at the resulting amount here
 * would refuse legitimate plan changes on a number this command never saw.
 */
const assertDiscountWithinAuthority = async (
  tenantId: string,
  originalAmount: number | null,
  command: ReservationRateOverrideCommand,
  actorRole: string | undefined,
): Promise<void> => {
  if (typeof command.total_amount !== "number") return;

  const percentOff = discountPercent(originalAmount, command.total_amount);
  if (percentOff <= 0) return;

  const policy = await resolvePolicy(
    (sql, params) => query<{ code: string; value: unknown }>(sql, params),
    {
      tenantId,
      code: RATE_APPROVAL_SETTING,
      parse: (raw) => RateApprovalPolicySchema.parse(raw),
      fallback: DEFAULT_RATE_APPROVAL_POLICY,
    },
  );

  const requiredRole = requiredRoleForDiscount(policy, percentOff);
  if (actorClearsThreshold(actorRole, requiredRole)) return;

  throw new CommandError(
    "DISCOUNT_EXCEEDS_AUTHORITY",
    `A ${percentOff.toFixed(1)}% discount needs ${requiredRole}; this override was ` +
      `initiated by ${actorRole ?? "an unidentified actor"}. The reason code authorises ` +
      `overriding the rate — it does not authorise this size of one.`,
  );
};

export const overrideRate = async (
  tenantId: string,
  command: ReservationRateOverrideCommand,
  options: ReservationCommandOptions = {},
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
    stepUp: options.stepUp,
  });

  await assertDiscountWithinAuthority(tenantId, snapshot.totalAmount, command, options.actorRole);

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
    stepUp: options.stepUp,
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

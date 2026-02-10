import type {
  ReservationDepositAddCommand,
  ReservationDepositReleaseCommand,
  ReservationRateOverrideCommand,
} from "../../schemas/reservation-command.js";
import {
  APP_ACTOR,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  type ReservationUpdatePayload,
  enqueueReservationUpdate,
} from "./common.js";

/**
 * Override the reservation rate code and amount.
 */
export const overrideRate = async (
  tenantId: string,
  command: ReservationRateOverrideCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    rate_code: command.rate_code?.toUpperCase(),
    total_amount: command.total_amount,
    currency: command.currency?.toUpperCase(),
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.rate_override", updatePayload, options);
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

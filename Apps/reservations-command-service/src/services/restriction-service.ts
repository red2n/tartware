import { describeRefusals, evaluateRestrictions, type RestrictionRefusal } from "@tartware/schemas";
import type { PoolClient } from "pg";
import { reservationsLogger } from "../logger.js";
import { loadStayRestrictions } from "../repositories/restriction-repository.js";
import { ReservationCommandError } from "./reservation-commands/common.js";

/**
 * The one gate every booking path goes through before it may hold inventory.
 *
 * `rate_calendar` and `rate_restrictions` have carried CTA, CTD, min/max LOS,
 * advance windows and `rooms_to_sell` since they were created; nothing read
 * them at booking time, so every restriction in the product was decorative.
 *
 * The arithmetic lives in `evaluateRestrictions` in `@tartware/schemas` — a
 * pure function with no database — so the create path, the modify path and the
 * availability search all reach the same verdict. This module is the thin
 * layer that loads the rules and turns a refusal into a command error.
 */

/** A refusal carries its structured reasons so a UI can render them. */
class RestrictionRefusedError extends ReservationCommandError {
  readonly refusals: RestrictionRefusal[];

  constructor(refusals: RestrictionRefusal[]) {
    // The first refusal's code is the headline — a caller that branches on one
    // value gets the most specific thing wrong with the request, and the full
    // list is on `refusals` for anything that wants to show all of them.
    super(
      refusals[0]?.code ?? "RESTRICTION_REFUSED",
      describeRefusals(refusals) || "This stay cannot be sold.",
    );
    this.refusals = refusals;
  }

  override toJSON() {
    return { ...super.toJSON(), refusals: this.refusals };
  }
}

type RestrictionCheck = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  rateId?: string | null;
  channelCode?: string | null;
  arrival: Date;
  departure: Date;
  /**
   * The property's business date. Advance windows measure from it rather than
   * from wall-clock now, so a booking taken before the date has rolled is
   * still counted as today's.
   */
  bookingDate: Date;
  /** Rooms wanted — a three-room booking consumes three against a sell limit. */
  roomsRequested?: number;
};

/**
 * Refuse a stay that violates a booking restriction.
 *
 * Call this *before* taking an availability lock: a refusal that has already
 * taken a lock leaks inventory until the TTL expires.
 *
 * @throws {RestrictionRefusedError} with a typed code per refusal
 */
export const assertStaySellable = async (
  check: RestrictionCheck,
  client?: PoolClient,
): Promise<void> => {
  const { rules, inventory } = await loadStayRestrictions(
    {
      tenantId: check.tenantId,
      propertyId: check.propertyId,
      roomTypeId: check.roomTypeId,
      rateId: check.rateId,
      channelCode: check.channelCode,
      arrival: check.arrival,
      departure: check.departure,
    },
    client,
  );

  const verdict = evaluateRestrictions(
    {
      arrival: check.arrival,
      departure: check.departure,
      booking_date: check.bookingDate,
      rooms_requested: check.roomsRequested ?? 1,
    },
    rules,
    inventory,
  );

  if (verdict.allowed) {
    return;
  }

  reservationsLogger.info(
    {
      propertyId: check.propertyId,
      roomTypeId: check.roomTypeId,
      rateId: check.rateId ?? null,
      channelCode: check.channelCode ?? null,
      refusals: verdict.refusals,
    },
    "Stay refused by booking restrictions",
  );

  throw new RestrictionRefusedError(verdict.refusals);
};

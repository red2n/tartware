/**
 * DEV DOC
 * Module: engines/split.ts
 * Purpose: Rate splitting formulas from CORE.md §5.
 * Ownership: calculation-service
 *
 * Handles shared reservation splits, per-guest sharing, and component decomposition.
 * All splits use integer division with remainder assigned to the primary reservation.
 */

import type {
  SplitByGuestInput,
  SplitByGuestOutput,
  SplitByReservationInput,
  SplitByReservationOutput,
  SplitComponentInput,
  SplitComponentOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Splits a total evenly across reservations, giving remainder to primary.
 * CORE.md §5.1: secondary = floor(total / count); primary = total - secondary × (count - 1).
 */
export function splitByReservation(input: SplitByReservationInput): SplitByReservationOutput {
  const total = new Decimal(input.total);
  const count = input.reservation_count;
  const secondary = total.div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const primaryShare = total.minus(secondary.times(count - 1));
  const remainder = primaryShare.minus(secondary);

  return {
    primary_share: primaryShare.toDecimalPlaces(2).toNumber(),
    secondary_share: secondary.toDecimalPlaces(2).toNumber(),
    remainder: remainder.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Splits a total by guest count with remainder to the primary payer.
 * CORE.md §5.2: myShare = floor(total / overallCount) × myGuests for secondary;
 * primary gets the remainder.
 */
export function splitByGuest(input: SplitByGuestInput): SplitByGuestOutput {
  const total = new Decimal(input.total);
  const perGuest = total.div(input.overall_guest_count).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (input.is_primary) {
    const othersTotal = perGuest.times(input.overall_guest_count - input.my_guests);
    const myShare = total.minus(othersTotal);
    return {
      my_share: myShare.toDecimalPlaces(2).toNumber(),
      remainder: myShare.minus(perGuest.times(input.my_guests)).toDecimalPlaces(2).toNumber(),
    };
  }

  const myShare = perGuest.times(input.my_guests);
  return {
    my_share: myShare.toDecimalPlaces(2).toNumber(),
    remainder: new Decimal(0).toNumber(),
  };
}

/**
 * Splits a component rate by divisor with remainder to primary.
 * CORE.md §5.3: share = floor(componentRate / divisor); primary gets remainder.
 */
export function splitComponent(input: SplitComponentInput): SplitComponentOutput {
  const rate = new Decimal(input.component_rate);
  const baseShare = rate.div(input.divisor).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (input.is_primary) {
    const othersTotal = baseShare.times(input.divisor - 1);
    const share = rate.minus(othersTotal);
    return {
      share: share.toDecimalPlaces(2).toNumber(),
      remainder: share.minus(baseShare).toDecimalPlaces(2).toNumber(),
    };
  }

  return {
    share: baseShare.toDecimalPlaces(2).toNumber(),
    remainder: new Decimal(0).toNumber(),
  };
}

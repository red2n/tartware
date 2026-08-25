/**
 * DEV DOC
 * Module: engines/deposit.ts
 * Purpose: Deposit calculation formulas from CORE.md §8.
 * Ownership: calculation-service
 *
 * Handles entire-stay deposits, per-guest deposits, and deposit cap enforcement.
 */

import type {
  DepositCapInput,
  DepositCapOutput,
  DepositEntireStayInput,
  DepositEntireStayOutput,
  DepositPerGuestInput,
  DepositPerGuestOutput,
} from "@tartware/schemas";
import { getCurrencyExponent } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates deposit as a percentage of total reservation charge.
 * CORE.md §8.1: deposit = totalCharge × percentage / 100.
 */
export function calculateDepositEntireStay(input: DepositEntireStayInput): DepositEntireStayOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const deposit = new Decimal(input.total_reservation_charge)
    .times(input.percentage_of_stay)
    .div(100);
  return {
    deposit_amount: deposit.toDecimalPlaces(dp).toNumber(),
  };
}

/**
 * Calculates per-guest deposit amount.
 * CORE.md §8.2: deposit = (adultRate × numAdults) + (childRate × numChildren).
 */
export function calculateDepositPerGuest(input: DepositPerGuestInput): DepositPerGuestOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const adultTotal = new Decimal(input.per_adult_rate).times(input.num_adults);
  const childTotal = new Decimal(input.per_child_rate).times(input.num_children);
  return {
    deposit_amount: adultTotal.plus(childTotal).toDecimalPlaces(dp).toNumber(),
  };
}

/**
 * Enforces deposit cap so cumulative deposits don't exceed reservation total.
 * CORE.md §8.3: If cumulative + due > total, cap the collectible amount.
 */
export function calculateDepositCap(input: DepositCapInput): DepositCapOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const ceiling = new Decimal(input.total_reservation_charge);
  const cumulative = new Decimal(input.cumulative_schedule_total);
  const due = new Decimal(input.due_amount);
  const wouldBeTotal = cumulative.plus(due);

  if (wouldBeTotal.lte(ceiling)) {
    return {
      collectible: due.toDecimalPlaces(dp).toNumber(),
      excess: new Decimal(0).toNumber(),
      capped: false,
    };
  }

  const collectible = Decimal.max(ceiling.minus(cumulative), 0);
  return {
    collectible: collectible.toDecimalPlaces(dp).toNumber(),
    excess: due.minus(collectible).toDecimalPlaces(dp).toNumber(),
    capped: true,
  };
}

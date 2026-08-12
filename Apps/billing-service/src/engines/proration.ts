/**
 * DEV DOC
 * Module: engines/proration.ts
 * Purpose: Daily rate proration, LOS-tiered pricing, and derived rate formulas.
 * Ownership: calculation-service
 *
 * Industry standard daily proration for partial days (early check-in / late checkout),
 * length-of-stay tiered pricing, and derived rate (parent - discount%) calculations.
 */

import type {
  DerivedRateInput,
  DerivedRateOutput,
  LosTieredInput,
  LosTieredOutput,
  ProrationInput,
  ProrationOutput,
} from "@tartware/schemas";
import { getCurrencyExponent } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Prorates a daily rate based on hours occupied.
 * fraction = hours / 24; prorated = dailyRate × fraction.
 */
export function prorateDaily(input: ProrationInput): ProrationOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const fraction = new Decimal(input.hours).div(24);
  const rounding = input.rounding === "HALF_EVEN" ? Decimal.ROUND_HALF_EVEN : Decimal.ROUND_HALF_UP;
  const prorated = new Decimal(input.daily_rate).times(fraction).toDecimalPlaces(dp, rounding);
  return {
    prorated_amount: prorated.toNumber(),
    fraction: fraction.toDecimalPlaces(6).toNumber(),
  };
}

/**
 * Calculates total stay cost using LOS-tiered pricing.
 * Each tier defines a range of nights and the rate for those nights.
 * Industry standard: Day 1-2: $X, Day 3+: $Y pattern.
 */
export function calculateLosTiered(input: LosTieredInput): LosTieredOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const amounts: number[] = [];
  for (let night = 1; night <= input.nights; night++) {
    const tier = input.tiers.find(
      (t) => night >= t.from_night && (t.to_night === undefined || night <= t.to_night),
    );
    const lastTier = input.tiers[input.tiers.length - 1];
    const rate = tier ? new Decimal(tier.rate) : new Decimal(lastTier?.rate ?? 0);
    amounts.push(rate.toDecimalPlaces(dp).toNumber());
  }
  const total = amounts.reduce((sum, a) => sum.plus(a), new Decimal(0));
  const avg = total.div(input.nights).toDecimalPlaces(dp).toNumber();
  return {
    nightly_amounts: amounts,
    total: total.toDecimalPlaces(dp).toNumber(),
    average_nightly: avg,
  };
}

/**
 * Calculates a derived rate from a parent rate minus a percentage discount.
 * Industry standard: Member rate = BAR - 10%.
 */
export function calculateDerivedRate(input: DerivedRateInput): DerivedRateOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const discount = new Decimal(input.parent_rate).times(input.discount_percent).div(100);
  const derived = new Decimal(input.parent_rate).minus(discount);
  return {
    derived_rate: derived.toDecimalPlaces(dp).toNumber(),
    discount_amount: discount.toDecimalPlaces(dp).toNumber(),
  };
}

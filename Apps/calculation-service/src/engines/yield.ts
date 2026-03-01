/**
 * DEV DOC
 * Module: engines/yield.ts
 * Purpose: Yield management rate adjustment from CORE.md §17.
 * Ownership: calculation-service
 */

import type { YieldRateInput, YieldRateOutput } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Applies yield modifiers to an actual rate.
 * CORE.md §17.1: Modifiers applied sequentially:
 * - PERCENT: rate × (1 + value/100)
 * - FLAT_RATE: rate = value (absolute override)
 * - DECREASE_BY: rate - value
 * Result is clamped to min_rate floor.
 */
export function calculateYieldRate(input: YieldRateInput): YieldRateOutput {
  let rate = new Decimal(input.actual_rate);

  for (const mod of input.modifiers) {
    switch (mod.type) {
      case "PERCENT":
        rate = rate.times(new Decimal(1).plus(new Decimal(mod.value).div(100)));
        break;
      case "FLAT_RATE":
        rate = new Decimal(mod.value);
        break;
      case "DECREASE_BY":
        rate = rate.minus(mod.value);
        break;
    }
  }

  const minRate = new Decimal(input.min_rate);
  const clamped = rate.lt(minRate);
  const finalRate = Decimal.max(rate, minRate);

  return {
    yielded_rate: finalRate.toDecimalPlaces(2).toNumber(),
    clamped_to_min: clamped,
  };
}

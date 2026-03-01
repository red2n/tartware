/**
 * DEV DOC
 * Module: engines/cancellation.ts
 * Purpose: Cancellation fee formulas from CORE.md §10.
 * Ownership: calculation-service
 */

import type { CancellationFeeInput, CancellationFeeOutput } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates cancellation fee based on policy type.
 * CORE.md §10.1:
 * - percentage: fee = sum(nightlyRates) × (percentage/100) × (overridePercentage/100)
 * - nights: fee = sum of first N nightly rates
 * - flat: fee = sum of all nightly rates (full stay penalty)
 */
export function calculateCancellationFee(input: CancellationFeeInput): CancellationFeeOutput {
  const rates = input.nightly_rates;
  const overridePct =
    input.override_percentage !== undefined
      ? new Decimal(input.override_percentage).div(100)
      : new Decimal(1);

  switch (input.policy_type) {
    case "percentage": {
      const total = rates.reduce((sum, r) => sum.plus(r), new Decimal(0));
      const pct = new Decimal(input.percentage ?? 100).div(100);
      const fee = total.times(pct).times(overridePct);
      return {
        fee: fee.toDecimalPlaces(2).toNumber(),
        applicable_nights: rates.length,
      };
    }
    case "nights": {
      const nights = Math.min(input.nights ?? 1, rates.length);
      const fee = rates
        .slice(0, nights)
        .reduce((sum, r) => sum.plus(r), new Decimal(0))
        .times(overridePct);
      return {
        fee: fee.toDecimalPlaces(2).toNumber(),
        applicable_nights: nights,
      };
    }
    case "flat": {
      const fee = rates.reduce((sum, r) => sum.plus(r), new Decimal(0)).times(overridePct);
      return {
        fee: fee.toDecimalPlaces(2).toNumber(),
        applicable_nights: rates.length,
      };
    }
  }
}

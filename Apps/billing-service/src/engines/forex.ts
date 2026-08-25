/**
 * DEV DOC
 * Module: engines/forex.ts
 * Purpose: Foreign exchange conversion from CORE.md §12.
 * Ownership: calculation-service
 */

import type { ForexConvertInput, ForexConvertOutput } from "@tartware/schemas";
import { getCurrencyExponent } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Converts an amount between currencies with optional surcharge.
 * CORE.md §12.1:
 * - FLAT surcharge: effectiveRate = rate + surcharge
 * - PERCENTAGE surcharge: effectiveRate = rate × (1 + surcharge/100)
 * - converted = amount × effectiveRate
 */
export function convertCurrency(input: ForexConvertInput): ForexConvertOutput {
  const baseRate = new Decimal(input.conversion_rate);
  const surcharge = new Decimal(input.surcharge_amount);
  let effectiveRate: Decimal;
  let surchargeApplied: Decimal;

  switch (input.surcharge_type) {
    case "FLAT":
      effectiveRate = baseRate.plus(surcharge);
      surchargeApplied = surcharge;
      break;
    case "PERCENTAGE":
      surchargeApplied = baseRate.times(surcharge.div(100));
      effectiveRate = baseRate.plus(surchargeApplied);
      break;
  }

  const converted = new Decimal(input.amount).times(effectiveRate);

  // The result is money in `to_currency`, so it rounds to that currency's ISO
  // 4217 exponent — 0 places for JPY, 3 for KWD — not a fixed 2.
  const toExponent = getCurrencyExponent(input.to_currency);

  return {
    converted_amount: converted.toDecimalPlaces(toExponent).toNumber(),
    effective_rate: effectiveRate.toDecimalPlaces(6).toNumber(),
    surcharge_applied: surchargeApplied.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * DEV DOC
 * Module: engines/commission.ts
 * Purpose: Commission formulas from CORE.md §11.
 * Ownership: calculation-service
 */

import type {
  CommissionAmountInput,
  CommissionAmountOutput,
  CommissionBackCalcInput,
  CommissionBackCalcOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates commission amount from rate plan total and percentage.
 * CORE.md §11.1: commission = ratePlanTotal × commissionPercent / 100.
 */
export function calculateCommissionAmount(input: CommissionAmountInput): CommissionAmountOutput {
  const commission = new Decimal(input.rate_plan_total).times(input.commission_percent).div(100);
  return {
    commission_amount: commission.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Back-calculates commission percentage from known amounts.
 * CORE.md §11.2: percent = (commissionAmount / roomRate) × 100.
 */
export function calculateCommissionBackCalc(
  input: CommissionBackCalcInput,
): CommissionBackCalcOutput {
  const percent = new Decimal(input.commission_amount).div(input.room_rate).times(100);
  return {
    commission_percent: percent.toDecimalPlaces(4).toNumber(),
  };
}

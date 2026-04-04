/**
 * DEV DOC
 * Module: engines/comp.ts
 * Purpose: Comp offer discounts (CORE.md §2.11-2.13) and comp accounting (CORE.md §14).
 * Ownership: calculation-service
 *
 * Handles comp offer percentage/amount discounts, comp per-day balance tracking,
 * and comp balance recalculation when authorized amounts change.
 */

import type {
  CompBalanceInput,
  CompBalanceOutput,
  CompOfferInput,
  CompOfferOutput,
  CompRecalcInput,
  CompRecalcOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Applies a comp offer discount (CORE.md §2.11-2.13).
 * PERCENTAGE: discountAmount = (discount / 100) × applicableRate
 * AMOUNT: discountAmount = min(discountValue, applicableRate)
 * compRate = max(applicableRate - discountAmount, 0)
 */
export function calculateCompOffer(input: CompOfferInput): CompOfferOutput {
  const rate = new Decimal(input.applicable_rate);
  let discount: Decimal;

  if (input.discount_type === "PERCENTAGE") {
    discount = rate.times(input.discount_value).div(100);
  } else {
    discount = Decimal.min(new Decimal(input.discount_value), rate);
  }

  const compRate = Decimal.max(rate.minus(discount), 0);
  return {
    comp_rate: compRate.toDecimalPlaces(2).toNumber(),
    discount_amount: discount.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Updates comp per-day balance after a comp amount is consumed (CORE.md §14.1).
 * newBalance = currentBalance - compAmount.
 */
export function updateCompBalance(input: CompBalanceInput): CompBalanceOutput {
  const newBalance = new Decimal(input.current_balance).minus(input.comp_amount);
  return {
    new_balance: Decimal.max(newBalance, 0).toDecimalPlaces(2).toNumber(),
    fully_consumed: newBalance.lte(0),
  };
}

/**
 * Recalculates comp balance when authorized amount changes (CORE.md §14.2).
 * redeemed = oldAmountPerStay - oldBalance
 * newBalance = max(newAmountPerStay - redeemed, 0)
 */
export function recalculateCompBalance(input: CompRecalcInput): CompRecalcOutput {
  const redeemed = new Decimal(input.old_amount_per_stay).minus(input.old_balance);
  const newBalance = Decimal.max(new Decimal(input.new_amount_per_stay).minus(redeemed), 0);
  return {
    redeemed: redeemed.toDecimalPlaces(2).toNumber(),
    new_balance: newBalance.toDecimalPlaces(2).toNumber(),
  };
}

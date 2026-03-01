/**
 * DEV DOC
 * Module: engines/allowance.ts
 * Purpose: Allowance & package formulas from CORE.md §9 and industry standards.
 * Ownership: calculation-service
 *
 * Tracks allowance consumption, breakage (unused allowance), enhancement item totals,
 * and package revenue allocation across departments (USALI).
 */

import type {
  AllowanceTrackInput,
  AllowanceTrackOutput,
  EnhancementItemInput,
  EnhancementItemOutput,
  PackageAllocationInput,
  PackageAllocationOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Tracks sequential charges against a fixed allowance (CORE.md §9.1).
 * remaining = totalAllowance - sum(min(charge, remaining))
 * breakage = unused portion of allowance.
 */
export function trackAllowance(input: AllowanceTrackInput): AllowanceTrackOutput {
  let remaining = new Decimal(input.total_allowance);
  const chargeDetails: { covered: number; excess: number }[] = [];

  for (const charge of input.charges) {
    const chargeAmt = new Decimal(charge);
    if (chargeAmt.lte(remaining)) {
      chargeDetails.push({ covered: chargeAmt.toNumber(), excess: 0 });
      remaining = remaining.minus(chargeAmt);
    } else {
      chargeDetails.push({
        covered: remaining.toNumber(),
        excess: chargeAmt.minus(remaining).toDecimalPlaces(2).toNumber(),
      });
      remaining = new Decimal(0);
    }
  }

  const spent = new Decimal(input.total_allowance).minus(remaining);
  return {
    remaining: remaining.toDecimalPlaces(2).toNumber(),
    spent: spent.toDecimalPlaces(2).toNumber(),
    breakage: remaining.toDecimalPlaces(2).toNumber(),
    charges: chargeDetails,
  };
}

/**
 * Calculates enhancement item totals (CORE.md §9.3).
 * perDateTotal = defaultPrice × quantity; grandTotal = perDateTotal × numberOfDates.
 */
export function calculateEnhancementItem(input: EnhancementItemInput): EnhancementItemOutput {
  const perDate = new Decimal(input.default_price).times(input.quantity);
  const grand = perDate.times(input.number_of_dates);
  return {
    per_date_total: perDate.toDecimalPlaces(2).toNumber(),
    grand_total: grand.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Allocates a package rate across its component departments (Industry standard / USALI).
 * Each component gets its share as a percentage of the total component value.
 */
export function allocatePackageRevenue(input: PackageAllocationInput): PackageAllocationOutput {
  const componentTotal = input.components.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

  const allocations = input.components.map((comp) => {
    const pct = componentTotal.isZero()
      ? new Decimal(0)
      : new Decimal(comp.amount).div(componentTotal).times(100);
    const allocated = componentTotal.isZero()
      ? new Decimal(0)
      : new Decimal(input.package_rate).times(comp.amount).div(componentTotal);
    return {
      name: comp.name,
      amount: allocated.toDecimalPlaces(2).toNumber(),
      percentage: pct.toDecimalPlaces(2).toNumber(),
    };
  });

  return {
    allocations,
    total: input.package_rate,
  };
}

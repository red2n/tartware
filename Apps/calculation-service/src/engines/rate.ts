/**
 * DEV DOC
 * Module: engines/rate.ts
 * Purpose: Rate and pricing formulas from CORE.md §2.
 * Ownership: calculation-service
 *
 * Handles rate overrides, occupancy-based pricing, package rate decomposition, and quotes.
 */

import type {
  OccupancyRateInput,
  OccupancyRateOutput,
  PackageRateInput,
  PackageRateOutput,
  QuoteInput,
  QuoteOutput,
  RateOverrideInput,
  RateOverrideOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Applies a rate override based on adjustment type.
 * CORE.md §2.1: UNIT → use amount; ADJUST_UNIT → base + amount; ADJUST_PERCENT → base × (1 + pct/100).
 */
export function calculateRateOverride(input: RateOverrideInput): RateOverrideOutput {
  const base = new Decimal(input.base_price);
  const amount = new Decimal(input.amount);
  let rate: Decimal;
  let formula: string;

  switch (input.adjustment_type) {
    case "UNIT":
      rate = amount;
      formula = `override = ${amount}`;
      break;
    case "ADJUST_UNIT":
      rate = base.plus(amount);
      formula = `${base} + ${amount} = ${rate}`;
      break;
    case "ADJUST_PERCENT":
      rate = base.times(new Decimal(1).plus(amount.div(100)));
      formula = `${base} × (1 + ${amount}/100) = ${rate.toDecimalPlaces(2)}`;
      break;
  }

  return {
    rate: Decimal.max(rate, 0).toDecimalPlaces(2).toNumber(),
    formula,
  };
}

/**
 * Calculates total rate including occupancy surcharges.
 * CORE.md §2.2: Adds extra adult/child charges beyond included counts,
 * plus age-category surcharges.
 */
export function calculateOccupancyRate(input: OccupancyRateInput): OccupancyRateOutput {
  const base = new Decimal(input.pre_occupancy_rate);
  const extraAdults = Math.max(input.adults - input.adults_included, 0);
  const extraChildren = Math.max(input.children - input.children_included, 0);

  const adultSurcharge = new Decimal(input.extra_adult_charge).times(extraAdults);
  const childSurcharge = new Decimal(input.extra_child_charge).times(extraChildren);

  let ageSurcharge = new Decimal(0);
  const breakdown: Record<string, number> = {
    base_rate: base.toNumber(),
    extra_adults: extraAdults,
    adult_surcharge: adultSurcharge.toDecimalPlaces(2).toNumber(),
    extra_children: extraChildren,
    child_surcharge: childSurcharge.toDecimalPlaces(2).toNumber(),
  };

  if (input.age_categories) {
    for (const [i, cat] of input.age_categories.entries()) {
      const extra = Math.max(cat.count - cat.included, 0);
      const catCharge = new Decimal(cat.charge).times(extra);
      ageSurcharge = ageSurcharge.plus(catCharge);
      breakdown[`age_category_${i}_surcharge`] = catCharge.toDecimalPlaces(2).toNumber();
    }
  }

  const totalSurcharge = adultSurcharge.plus(childSurcharge).plus(ageSurcharge);
  const totalRate = base.plus(totalSurcharge);

  return {
    total_rate: totalRate.toDecimalPlaces(2).toNumber(),
    occupancy_surcharge: totalSurcharge.toDecimalPlaces(2).toNumber(),
    breakdown,
  };
}

/**
 * Decomposes a package rate into room and component totals.
 * CORE.md §2.3: room_rate = base - sum(inclusive); total = room_rate + sum(exclusive).
 */
export function calculatePackageRate(input: PackageRateInput): PackageRateOutput {
  const base = new Decimal(input.base_rate);
  const inclusiveTotal = input.inclusive_components.reduce(
    (sum, c) => sum.plus(c.amount),
    new Decimal(0),
  );
  const exclusiveTotal = input.exclusive_components.reduce(
    (sum, c) => sum.plus(c.amount),
    new Decimal(0),
  );

  const roomRate = Decimal.max(base.minus(inclusiveTotal), 0);
  const totalRate = roomRate.plus(exclusiveTotal);

  return {
    room_rate: roomRate.toDecimalPlaces(2).toNumber(),
    total_rate: totalRate.toDecimalPlaces(2).toNumber(),
    inclusive_total: inclusiveTotal.toDecimalPlaces(2).toNumber(),
    exclusive_total: exclusiveTotal.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Generates a reservation price quote.
 * CORE.md §2.4: Aggregates nightly rates, components, taxes, discounts, and routed amounts.
 */
export function calculateQuote(input: QuoteInput): QuoteOutput {
  const roomChargeTotal = input.nightly_rates.reduce((sum, r) => sum.plus(r), new Decimal(0));
  const componentTotal = input.components.reduce((sum, c) => sum.plus(c), new Decimal(0));
  const recurringTotal = input.recurring_charges.reduce((sum, r) => sum.plus(r), new Decimal(0));

  const subtotal = roomChargeTotal.plus(componentTotal).plus(recurringTotal);
  const taxTotal = subtotal.times(new Decimal(input.tax_rate).div(100));
  const discount = new Decimal(input.offer_discount);
  const routed = new Decimal(input.routed_amount);
  const grandTotal = subtotal.plus(taxTotal).minus(discount).minus(routed);

  return {
    room_charge_total: roomChargeTotal.toDecimalPlaces(2).toNumber(),
    component_total: componentTotal.toDecimalPlaces(2).toNumber(),
    recurring_total: recurringTotal.toDecimalPlaces(2).toNumber(),
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    tax_total: taxTotal.toDecimalPlaces(2).toNumber(),
    offer_discount: discount.toDecimalPlaces(2).toNumber(),
    routed_amount: routed.toDecimalPlaces(2).toNumber(),
    quote_grand_total: Decimal.max(grandTotal, 0).toDecimalPlaces(2).toNumber(),
  };
}

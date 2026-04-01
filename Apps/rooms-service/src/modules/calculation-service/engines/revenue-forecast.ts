/**
 * DEV DOC
 * Module: engines/revenue-forecast.ts
 * Purpose: Revenue management calculations from industry standards and CORE.md §2.20.
 * Ownership: calculation-service
 *
 * Overbooking level calculation, group revenue forecast, displacement analysis,
 * no-show charge calculation, and extra guest charge (CORE.md §2.6).
 */

import type {
  DisplacementInput,
  DisplacementOutput,
  ExtraGuestChargeInput,
  ExtraGuestChargeOutput,
  GroupForecastInput,
  GroupForecastOutput,
  NoShowChargeInput,
  NoShowChargeOutput,
  OverbookingInput,
  OverbookingOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates safe overbooking level (Industry standard).
 * overbookLevel = floor((noShowPct + cancelPct) / 100 × totalRooms × safetyFactor).
 */
export function calculateOverbookingLevel(input: OverbookingInput): OverbookingOutput {
  const combinedPct = new Decimal(input.no_show_percent).plus(input.cancellation_percent).div(100);
  const overbook = combinedPct.times(input.total_rooms).times(input.safety_factor);
  const level = overbook.floor().toNumber();
  return {
    overbook_level: level,
    effective_capacity: input.total_rooms + level,
  };
}

/**
 * Forecasts group revenue: actual vs blocked (CORE.md §2.20).
 * forecastRevenue = basePrice × blockedRooms; actualRevenue = basePrice × pickedUpRooms.
 */
export function calculateGroupForecast(input: GroupForecastInput): GroupForecastOutput {
  const forecast = new Decimal(input.base_price).times(input.blocked_rooms);
  const actual = new Decimal(input.base_price).times(input.picked_up_rooms);
  const pickupPct =
    input.blocked_rooms === 0
      ? 0
      : new Decimal(input.picked_up_rooms)
          .div(input.blocked_rooms)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();
  return {
    forecast_revenue: forecast.toDecimalPlaces(2).toNumber(),
    actual_revenue: actual.toDecimalPlaces(2).toNumber(),
    pickup_percentage: pickupPct,
    revenue_variance: actual.minus(forecast).toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Displacement analysis: should we accept a group block or preserve transient inventory?
 * (Industry standard revenue management decision)
 * groupContribution = groupRate × groupRooms + ancillary × groupRooms
 * displacedTransient = transientADR × displacedRooms + ancillary × displacedRooms
 * displacedRooms = groupRooms × (expectedTransientOccupancy / 100)
 */
export function analyzeDisplacement(input: DisplacementInput): DisplacementOutput {
  const groupRevRoom = new Decimal(input.group_rate).times(input.group_rooms);
  const groupAncillary = new Decimal(input.group_ancillary_per_room).times(input.group_rooms);
  const groupTotal = groupRevRoom.plus(groupAncillary);

  const displacedRooms = new Decimal(input.group_rooms)
    .times(input.expected_transient_occupancy_pct)
    .div(100);
  const transientRevRoom = new Decimal(input.transient_adr).times(displacedRooms);
  const transientAncillary = new Decimal(input.transient_ancillary_per_room).times(displacedRooms);
  const displacedTotal = transientRevRoom.plus(transientAncillary);

  const netValue = groupTotal.minus(displacedTotal);
  return {
    group_total_contribution: groupTotal.toDecimalPlaces(2).toNumber(),
    displaced_transient_contribution: displacedTotal.toDecimalPlaces(2).toNumber(),
    net_value: netValue.toDecimalPlaces(2).toNumber(),
    accept_group: netValue.gte(0),
  };
}

/**
 * Calculates no-show charge (Industry standard: 1 night + tax).
 * charge = firstNightRate; tax = charge × taxRate / 100; total = charge + tax + cancellationFee.
 */
export function calculateNoShowCharge(input: NoShowChargeInput): NoShowChargeOutput {
  const charge = new Decimal(input.first_night_rate);
  const tax = charge.times(input.tax_rate).div(100);
  const total = charge.plus(tax).plus(input.cancellation_fee);
  return {
    charge: charge.toDecimalPlaces(2).toNumber(),
    tax: tax.toDecimalPlaces(2).toNumber(),
    total: total.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Calculates extra guest surcharges (CORE.md §2.6).
 * extraAdultTotal = max(adults - adultsIncluded, 0) × extraAdultCharge
 * extraChildTotal = max(children - childrenIncluded, 0) × extraChildCharge
 * totalRate = baseRate + extraAdultTotal + extraChildTotal
 */
export function calculateExtraGuestCharge(input: ExtraGuestChargeInput): ExtraGuestChargeOutput {
  const extraAdults = Math.max(input.adults - input.adults_included, 0);
  const extraChildren = Math.max(input.children - input.children_included, 0);
  const extraAdultTotal = new Decimal(input.extra_adult_charge).times(extraAdults);
  const extraChildTotal = new Decimal(input.extra_child_charge).times(extraChildren);
  const surcharge = extraAdultTotal.plus(extraChildTotal);
  const totalRate = new Decimal(input.base_rate).plus(surcharge);
  return {
    extra_adult_total: extraAdultTotal.toDecimalPlaces(2).toNumber(),
    extra_child_total: extraChildTotal.toDecimalPlaces(2).toNumber(),
    total_surcharge: surcharge.toDecimalPlaces(2).toNumber(),
    total_rate: totalRate.toDecimalPlaces(2).toNumber(),
  };
}

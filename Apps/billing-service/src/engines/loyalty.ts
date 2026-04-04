/**
 * DEV DOC
 * Module: engines/loyalty.ts
 * Purpose: Casino/CMS point conversions (CORE.md §13) and general loyalty math.
 * Ownership: calculation-service
 *
 * Handles bidirectional points ↔ money conversions and redemption authorization tracking.
 */

import type {
  MoneyToPointsInput,
  MoneyToPointsOutput,
  PointsRedemptionInput,
  PointsRedemptionOutput,
  PointsToMoneyInput,
  PointsToMoneyOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Converts points to monetary value (CORE.md §13.1, §13.3).
 * monetaryValue = conversionRate × pointBalance.
 */
export function pointsToMoney(input: PointsToMoneyInput): PointsToMoneyOutput {
  const value = new Decimal(input.conversion_rate).times(input.point_balance);
  return {
    monetary_value: value.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Converts monetary amount to points (CORE.md §13.2, §13.4).
 * points = floor(amount / conversionRate).
 */
export function moneyToPoints(input: MoneyToPointsInput): MoneyToPointsOutput {
  const points = new Decimal(input.amount).div(input.conversion_rate).floor();
  return {
    points: points.toNumber(),
  };
}

/**
 * Tracks redemption against per-stay authorization (CORE.md §13.5).
 * approvedAmount = min(redemptionAmount, authorizedPerStay - redeemedSoFar).
 */
export function processRedemption(input: PointsRedemptionInput): PointsRedemptionOutput {
  const available = new Decimal(input.authorized_per_stay).minus(input.redeemed_so_far);
  const approved = Decimal.min(new Decimal(input.redemption_amount), Decimal.max(available, 0));
  const remaining = Decimal.max(available.minus(approved), 0);
  return {
    approved_amount: approved.toDecimalPlaces(2).toNumber(),
    remaining_authorized: remaining.toDecimalPlaces(2).toNumber(),
    over_limit: new Decimal(input.redemption_amount).gt(available),
  };
}

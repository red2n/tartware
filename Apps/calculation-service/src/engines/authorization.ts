/**
 * DEV DOC
 * Module: engines/authorization.ts
 * Purpose: Credit card authorization formulas from CORE.md §7.
 * Ownership: calculation-service
 */

import type {
  AuthRtdcInput,
  AuthRtdcOutput,
  AuthTdacInput,
  AuthTdacOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates Total Deposit Authorization at Checkin (TDAC).
 * CORE.md §7.1: auth = estimatedTotal × (1 + buffer/100) - postedPayments.
 */
export function calculateAuthTdac(input: AuthTdacInput): AuthTdacOutput {
  const estimated = new Decimal(input.estimated_total);
  const buffer = new Decimal(input.percentage_buffer).div(100);
  const withBuffer = estimated.times(new Decimal(1).plus(buffer));
  const auth = withBuffer.minus(input.posted_payment);

  return {
    authorization_amount: Decimal.max(auth, 0).toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Calculates Room-Tax-Deposit Credit (RTDC) authorization.
 * CORE.md §7.2: Supports percentage-based and per-person variants.
 */
export function calculateAuthRtdc(input: AuthRtdcInput): AuthRtdcOutput {
  if (input.type === "percentage") {
    const postedTotal = new Decimal(input.posted_room_charges).plus(input.posted_room_taxes);
    const futureTotal = new Decimal(input.future_room_charge_total);
    const total = postedTotal.plus(futureTotal);
    const auth = total.times(new Decimal(input.value).div(100));
    return {
      authorization_amount: Decimal.max(auth, 0).toDecimalPlaces(2).toNumber(),
    };
  }

  // per_person
  const auth = new Decimal(input.value)
    .times(input.number_of_persons)
    .times(input.maximum_days_to_authorize);
  return {
    authorization_amount: Decimal.max(auth, 0).toDecimalPlaces(2).toNumber(),
  };
}

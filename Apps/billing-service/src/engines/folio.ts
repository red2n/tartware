/**
 * DEV DOC
 * Module: engines/folio.ts
 * Purpose: Folio balance and AR formulas from CORE.md §3.
 * Ownership: calculation-service
 *
 * Handles folio balance, credit remaining, AR breakdown, and estimated checkout.
 */

import type {
  ArBreakdownInput,
  ArBreakdownOutput,
  CreditRemainingInput,
  CreditRemainingOutput,
  EstimatedCheckoutInput,
  EstimatedCheckoutOutput,
  FolioBalanceInput,
  FolioBalanceOutput,
} from "@tartware/schemas";
import { getCurrencyExponent } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates folio balance from line items.
 * CORE.md §3.1: balance = sum of (amount × quantity), considering reverse-tax adjustments.
 */
export function calculateFolioBalance(input: FolioBalanceInput): FolioBalanceOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  let balance = new Decimal(0);

  for (const item of input.line_items) {
    const lineTotal = new Decimal(item.amount).times(item.quantity);
    if (item.is_reverse_tax && item.reverse_tax_total !== undefined) {
      balance = balance.plus(lineTotal.minus(item.reverse_tax_total));
    } else {
      balance = balance.plus(lineTotal);
    }
  }

  return {
    balance: balance.toDecimalPlaces(dp).toNumber(),
    line_count: input.line_items.length,
  };
}

/**
 * Calculates remaining credit on an account.
 * CORE.md §3.2: remaining = creditLimit - accountBalance.
 */
export function calculateCreditRemaining(input: CreditRemainingInput): CreditRemainingOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const creditLimit = new Decimal(input.credit_limit);
  const balance = new Decimal(input.account_balance);
  const remaining = creditLimit.minus(balance);
  const utilization = creditLimit.isZero()
    ? 0
    : balance.div(creditLimit).times(100).toDecimalPlaces(dp).toNumber();

  return {
    remaining_credit: remaining.toDecimalPlaces(dp).toNumber(),
    utilization_percent: utilization,
  };
}

/**
 * Computes AR account breakdown and available credit.
 * CORE.md §3.3: Separates invoiced, uninvoiced, and credit balances.
 */
export function calculateArBreakdown(input: ArBreakdownInput): ArBreakdownOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const invoiceTotal = input.aging_buckets.reduce((sum, b) => sum.plus(b), new Decimal(0));
  const uninvoicedTotal = new Decimal(input.account_balance_total).minus(invoiceTotal);
  const balance = new Decimal(input.account_balance_total).minus(input.deposit_balance);
  const creditLimitBalance = new Decimal(input.credit_limit).minus(balance);
  const availableCredit = Decimal.max(creditLimitBalance, 0);

  return {
    invoice_total: invoiceTotal.toDecimalPlaces(dp).toNumber(),
    uninvoiced_total: uninvoicedTotal.toDecimalPlaces(dp).toNumber(),
    balance: balance.toDecimalPlaces(dp).toNumber(),
    credit_limit_balance: creditLimitBalance.toDecimalPlaces(dp).toNumber(),
    available_credit: availableCredit.toDecimalPlaces(dp).toNumber(),
  };
}

/**
 * Estimates guest checkout total.
 * CORE.md §18: Combines posted + future charges/taxes - payments.
 */
export function calculateEstimatedCheckout(input: EstimatedCheckoutInput): EstimatedCheckoutOutput {
  // Monetary results round to the currency's ISO 4217 exponent.
  const dp = getCurrencyExponent(input.currency);
  const estimatedCharges = new Decimal(input.posted_charges).plus(input.future_charges);
  const estimatedTaxes = new Decimal(input.posted_taxes).plus(input.future_taxes);
  const estimatedTotal = estimatedCharges.plus(estimatedTaxes);
  const avgNightlyRate = estimatedCharges.div(input.stay_length);
  const estimatedAtCheckout = estimatedTotal.plus(input.posted_payments);

  return {
    estimated_charges: estimatedCharges.toDecimalPlaces(dp).toNumber(),
    estimated_taxes: estimatedTaxes.toDecimalPlaces(dp).toNumber(),
    estimated_total: estimatedTotal.toDecimalPlaces(dp).toNumber(),
    avg_nightly_rate: avgNightlyRate.toDecimalPlaces(dp).toNumber(),
    estimated_at_checkout: estimatedAtCheckout.toDecimalPlaces(dp).toNumber(),
  };
}

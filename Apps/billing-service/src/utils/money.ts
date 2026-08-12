/**
 * Safe money arithmetic using integer minor units, to avoid floating-point
 * precision errors (0.1 + 0.2 !== 0.3).
 *
 * Every function takes an optional ISO 4217 currency code. The scale is derived
 * from that currency's exponent via `@tartware/schemas`, so JPY works in whole
 * yen and KWD in thousandths — omitting the code falls back to 2 decimals, which
 * is correct for the majority of currencies and preserves the behaviour of
 * callers that predate multi-currency support.
 *
 * Pass the currency wherever one is known. Rounding a KWD balance at 2 decimal
 * places discards a real, spendable unit on every read.
 */

import { getCurrencyExponent, roundToCurrency } from "@tartware/schemas";

/** Optional ISO 4217 code; `undefined` means "assume the 2-decimal default". */
type CurrencyCode = string | null | undefined;

const minorUnitMultiplier = (currency: CurrencyCode): number => 10 ** getCurrencyExponent(currency);

/**
 * Convert a major-unit amount to whole minor units (cents, fils, yen).
 * Handles floating-point edge cases.
 */
export const toCents = (dollars: number, currency?: CurrencyCode): number => {
  return Math.round(dollars * minorUnitMultiplier(currency));
};

/**
 * Convert whole minor units back to major units.
 */
export const toDollars = (cents: number, currency?: CurrencyCode): number => {
  return cents / minorUnitMultiplier(currency);
};

/**
 * Safely add two monetary amounts, returning the result in major units.
 */
export const addMoney = (a: number, b: number, currency?: CurrencyCode): number => {
  return toDollars(toCents(a, currency) + toCents(b, currency), currency);
};

/**
 * Safely subtract two monetary amounts, returning the result in major units.
 */
export const subtractMoney = (a: number, b: number, currency?: CurrencyCode): number => {
  return toDollars(toCents(a, currency) - toCents(b, currency), currency);
};

/**
 * Round a monetary amount to its currency's smallest tenderable unit.
 */
export const roundMoney = (amount: number, currency?: CurrencyCode): number => {
  return roundToCurrency(amount, currency);
};

/**
 * Compare two monetary amounts for equality, handling floating-point issues.
 */
export const moneyEquals = (a: number, b: number, currency?: CurrencyCode): boolean => {
  return toCents(a, currency) === toCents(b, currency);
};

/**
 * Check if amount a is greater than or equal to amount b.
 */
export const moneyGte = (a: number, b: number, currency?: CurrencyCode): boolean => {
  return toCents(a, currency) >= toCents(b, currency);
};

/**
 * Check if amount a is greater than amount b.
 */
export const moneyGt = (a: number, b: number, currency?: CurrencyCode): boolean => {
  return toCents(a, currency) > toCents(b, currency);
};

/**
 * Safely convert a database numeric/decimal value to a number for calculations.
 * Handles null/undefined and the string representations PostgreSQL returns for
 * NUMERIC columns.
 */
export const parseDbMoney = (value: unknown, currency?: CurrencyCode): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return roundMoney(value, currency);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? roundMoney(parsed, currency) : null;
  }
  return null;
};

/**
 * Safely convert a database numeric/decimal value to a number, defaulting to 0.
 */
export const parseDbMoneyOrZero = (value: unknown, currency?: CurrencyCode): number =>
  parseDbMoney(value, currency) ?? 0;

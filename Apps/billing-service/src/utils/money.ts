/**
 * Safe money arithmetic utilities using integer cents to avoid floating-point precision errors.
 * All monetary values should be converted to cents for calculations, then back to dollars for storage/display.
 */

const ROUNDING_PRECISION = 2;
const CENTS_MULTIPLIER = 10 ** ROUNDING_PRECISION;

/**
 * Convert a dollar amount to integer cents.
 * Handles floating-point edge cases like 0.1 + 0.2 !== 0.3
 */
export const toCents = (dollars: number): number => {
  return Math.round(dollars * CENTS_MULTIPLIER);
};

/**
 * Convert integer cents back to dollars.
 */
export const toDollars = (cents: number): number => {
  return cents / CENTS_MULTIPLIER;
};

/**
 * Safely add two monetary amounts (in dollars), returning result in dollars.
 */
export const addMoney = (a: number, b: number): number => {
  return toDollars(toCents(a) + toCents(b));
};

/**
 * Safely subtract two monetary amounts (in dollars), returning result in dollars.
 */
export const subtractMoney = (a: number, b: number): number => {
  return toDollars(toCents(a) - toCents(b));
};

/**
 * Round a monetary amount to 2 decimal places.
 */
export const roundMoney = (amount: number): number => {
  return Math.round(amount * CENTS_MULTIPLIER) / CENTS_MULTIPLIER;
};

/**
 * Compare two monetary amounts for equality, handling floating-point issues.
 */
export const moneyEquals = (a: number, b: number): boolean => {
  return toCents(a) === toCents(b);
};

/**
 * Check if amount a is greater than or equal to amount b.
 */
export const moneyGte = (a: number, b: number): boolean => {
  return toCents(a) >= toCents(b);
};

/**
 * Check if amount a is greater than amount b.
 */
export const moneyGt = (a: number, b: number): boolean => {
  return toCents(a) > toCents(b);
};

/**
 * Safely convert a database numeric/decimal value to a number for calculations.
 * Handles null/undefined and string representations from PostgreSQL.
 */
export const parseDbMoney = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return roundMoney(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? roundMoney(parsed) : null;
  }
  return null;
};

/**
 * Safely convert a database numeric/decimal value to a number, defaulting to 0.
 */
export const parseDbMoneyOrZero = (value: unknown): number => parseDbMoney(value) ?? 0;

const ROUNDING_PRECISION = 2;
const CENTS_MULTIPLIER = 10 ** ROUNDING_PRECISION;

export const toCents = (dollars: number): number => {
  return Math.round(dollars * CENTS_MULTIPLIER);
};

export const toDollars = (cents: number): number => {
  return cents / CENTS_MULTIPLIER;
};

export const addMoney = (a: number, b: number): number => {
  return toDollars(toCents(a) + toCents(b));
};

export const subtractMoney = (a: number, b: number): number => {
  return toDollars(toCents(a) - toCents(b));
};

export const roundMoney = (amount: number): number => {
  return Math.round(amount * CENTS_MULTIPLIER) / CENTS_MULTIPLIER;
};

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

export const parseDbMoneyOrZero = (value: unknown): number => parseDbMoney(value) ?? 0;

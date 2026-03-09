/**
 * Shared row-mapping utilities for converting PostgreSQL row values
 * into clean API response shapes.
 */

/** Convert a Date or ISO string to an ISO-8601 timestamp string. */
export const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
};

/** Convert a Date or ISO string to a YYYY-MM-DD date string. */
export const toDateString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

/** Safely coerce an unknown value to a finite number, with fallback. */
export const toNumber = (value: unknown, fallback = 0): number => {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

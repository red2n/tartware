/**
 * Format a database enum value into a display-friendly { value, display } pair.
 *
 * - Null / non-string input returns the `fallback` as both value and display.
 * - Otherwise normalises to lowercase, title-cases each underscore-delimited word.
 *
 * @example formatEnumDisplay("PAYMENT_PENDING", "Unknown")
 *   // => { value: "payment_pending", display: "Payment Pending" }
 */
export const formatEnumDisplay = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
    const formatted = fallback.toLowerCase();
    return { value: formatted, display: fallback };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { value: normalized, display };
};

/**
 * Format a database enum value to a title-cased display string.
 * Returns "Unknown" for null / non-string input.
 *
 * @example formatDisplayLabel("REQUEST_PENDING") // => "Request Pending"
 */
export const formatDisplayLabel = (value: string | null | undefined): string => {
  if (!value || typeof value !== "string") return "Unknown";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

/**
 * Coerce a PostgreSQL timestamp column (returned as `string | Date | null`)
 * to an ISO-8601 string, or `undefined` when the value is absent.
 */
export const toIsoString = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

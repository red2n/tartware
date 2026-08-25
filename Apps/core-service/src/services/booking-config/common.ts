export const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

export const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isNaN(num) ? null : num;
};

export const formatDisplayLabel = (value: string | null): string => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

/**
 * A reference-data code that is already taken.
 *
 * The booking-config tables carry UNIQUE constraints on their human-facing codes
 * — `source_code`, `segment_code`, `promo_code` — and typing one that already
 * exists is the single most likely operator mistake in these screens. Without
 * this the driver's `23505` reaches the client as a 500 with a Postgres error
 * string, which reads as "the system is broken" rather than "pick another code".
 *
 * Mirrors `MeetingRoomCodeConflictError` in `booking-config/event.ts`, which is
 * where this pattern was first applied.
 */
export class ReferenceCodeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceCodeConflictError";
  }
}

const UNIQUE_VIOLATION = "23505";

/**
 * True when `error` is a unique violation on `constraint`.
 *
 * The constraint is matched by name because these tables carry several unique
 * indexes; catching any 23505 would report a code clash for an unrelated one.
 * The names are not derived from the column (`uk_booking_sources_code`,
 * `uq_promotional_codes_tenant_code`), so they are checked against the database
 * rather than guessed.
 */
export const isUniqueViolationOn = (error: unknown, constraint: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  (error as { constraint?: string }).constraint === constraint;

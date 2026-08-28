import {
  calendarRowsToRules,
  type NightInventory,
  type RateCalendarRowLike,
  type RestrictionRowLike,
  type RestrictionRule,
  restrictionRowsToRules,
} from "@tartware/schemas";
import type { PoolClient } from "pg";

import { query } from "../lib/db.js";

/**
 * Loads the booking restrictions and sellable inventory covering one stay.
 *
 * Two tables hold this between them and both have always been written and
 * never read at booking time:
 *
 * - `rate_calendar` carries CTA/CTD/LOS/advance columns and the sellable
 *   ceiling on the (room type × rate × date) row.
 * - `rate_restrictions` carries the same controls as scoped rows, so a rule can
 *   target the whole property, a room type, a rate, or one channel.
 *
 * Both are normalised into the `RestrictionRule` shape `evaluateRestrictions`
 * consumes, so the evaluator never learns where a rule came from — only how
 * specific it is.
 */

type StayWindow = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  /** Resolved rate plan, when the caller has one. */
  rateId?: string | null;
  /** Booking channel, for channel-scoped rules. */
  channelCode?: string | null;
  /** First night of the stay. */
  arrival: Date;
  /** Departure date — included in the window because CTD applies to it. */
  departure: Date;
};

type StayRestrictionContext = {
  rules: RestrictionRule[];
  inventory: NightInventory[];
};

const runQuery = async <T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<T[]> => {
  const result = client ? await client.query<T>(sql, params) : await query<T>(sql, params);
  return result.rows;
};

/**
 * Scoped rules for the window.
 *
 * A row whose targeting column is NULL applies to everything, so the filters
 * are `IS NULL OR =` rather than plain equality — that is how a property-wide
 * stop-sell reaches a booking for a specific room type and rate.
 */
const SCOPED_RULES_SQL = `
  SELECT scope,
         restriction_type,
         restriction_date,
         restriction_value,
         source
  FROM public.rate_restrictions
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND restriction_date >= $3::date
    AND restriction_date <= $4::date
    AND is_active = TRUE
    AND COALESCE(is_deleted, FALSE) = FALSE
    AND (room_type_id IS NULL OR room_type_id = $5::uuid)
    AND (rate_plan_id IS NULL OR $6::uuid IS NULL OR rate_plan_id = $6::uuid)
    AND (channel_code IS NULL OR $7::text IS NULL OR channel_code = $7::text)
`;

/**
 * The rate calendar's own columns, plus the sellable ceiling.
 *
 * Inventory is aggregated per date rather than per rate plan: `rooms_sold` is a
 * property of the room type on that night, not of the rate it was sold at, and
 * the tightest published ceiling is the one that binds. The restriction columns
 * beside it are rate-specific, so they are only read when the caller resolved a
 * rate — otherwise one rate plan's CTA would block a booking on another.
 */
const CALENDAR_SQL = `
  SELECT stay_date,
         MIN(status) AS status,
         BOOL_OR(closed_to_arrival) AS closed_to_arrival,
         BOOL_OR(closed_to_departure) AS closed_to_departure,
         MAX(min_length_of_stay) AS min_length_of_stay,
         MIN(max_length_of_stay) AS max_length_of_stay,
         MAX(min_advance_days) AS min_advance_days,
         MIN(max_advance_days) AS max_advance_days,
         MIN(rooms_to_sell) AS rooms_to_sell,
         MAX(rooms_sold) AS rooms_sold
  FROM public.rate_calendar
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND room_type_id = $3::uuid
    AND ($4::uuid IS NULL OR rate_id = $4::uuid)
    AND stay_date >= $5::date
    AND stay_date <= $6::date
    AND COALESCE(is_deleted, FALSE) = FALSE
  GROUP BY stay_date
`;

export const loadStayRestrictions = async (
  window: StayWindow,
  client?: PoolClient,
): Promise<StayRestrictionContext> => {
  const rateId = window.rateId ?? null;

  const [scopedRows, calendarRows] = await Promise.all([
    runQuery<RestrictionRowLike & Record<string, unknown>>(
      SCOPED_RULES_SQL,
      [
        window.tenantId,
        window.propertyId,
        window.arrival,
        window.departure,
        window.roomTypeId,
        rateId,
        window.channelCode ?? null,
      ],
      client,
    ),
    runQuery<RateCalendarRowLike & Record<string, unknown>>(
      CALENDAR_SQL,
      [
        window.tenantId,
        window.propertyId,
        window.roomTypeId,
        rateId,
        window.arrival,
        window.departure,
      ],
      client,
    ),
  ]);

  // Both halves normalise through the shared mappers, so the booking path and
  // the availability search cannot drift on what a row means.
  const { rules: calendarRules, inventory } = calendarRowsToRules(calendarRows, rateId !== null);
  const rules: RestrictionRule[] = [...restrictionRowsToRules(scopedRows), ...calendarRules];

  return { rules, inventory };
};

/**
 * The property's current business date.
 *
 * Advance-purchase windows are measured from this, not from wall-clock now: a
 * booking taken at 01:00 on a property whose night audit has not run is still
 * "today" as far as the restriction is concerned, and using `new Date()` would
 * silently shift every advance window by a day for late-night bookings.
 *
 * Falls back to today when the property has no business date row, which is the
 * same thing the rest of the service does.
 */
export const resolveBusinessDate = async (
  tenantId: string,
  propertyId: string,
  client?: PoolClient,
): Promise<Date> => {
  const rows = await runQuery<{ business_date: Date }>(
    `SELECT business_date
       FROM public.business_dates
      WHERE tenant_id = $1::uuid AND property_id = $2::uuid
      LIMIT 1`,
    [tenantId, propertyId],
    client,
  );
  return rows[0]?.business_date ?? new Date();
};

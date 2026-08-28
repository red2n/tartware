import {
  calendarRowsToRules,
  type NightInventory,
  type RateCalendarRowLike,
  type RestrictionRowLike,
  type RestrictionRule,
  restrictionRowsToRules,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

/**
 * Booking restrictions for an availability search.
 *
 * The booking path asks about one room type at a time; a search asks about all
 * of them at once, so the queries are shaped differently — but both normalise
 * through the same mappers in `@tartware/schemas` and both feed the same
 * `evaluateRestrictions`. A stay the search offers is a stay `createReservation`
 * will accept, which is the only property that matters here.
 */

type SearchWindow = {
  tenantId: string;
  propertyId: string;
  /** First night of the stay. */
  arrival: Date;
  /** Departure date — in the window because CTD applies to it. */
  departure: Date;
};

/** Rules for every room type at once, keyed by room type on the way out. */
const SEARCH_RULES_SQL = `
  SELECT room_type_id,
         scope,
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
`;

/**
 * Calendar controls and inventory per room type per night.
 *
 * Aggregated across rate plans: a search has not picked a rate yet, so the
 * tightest published ceiling and the strictest control are what a room type
 * can honestly be offered under.
 */
const SEARCH_CALENDAR_SQL = `
  SELECT room_type_id,
         stay_date,
         MIN(status) AS status,
         BOOL_AND(closed_to_arrival) AS closed_to_arrival,
         BOOL_AND(closed_to_departure) AS closed_to_departure,
         MIN(min_length_of_stay) AS min_length_of_stay,
         MAX(max_length_of_stay) AS max_length_of_stay,
         MIN(min_advance_days) AS min_advance_days,
         MAX(max_advance_days) AS max_advance_days,
         MAX(rooms_to_sell) AS rooms_to_sell,
         MAX(rooms_sold) AS rooms_sold
  FROM public.rate_calendar
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND stay_date >= $3::date
    AND stay_date <= $4::date
    AND COALESCE(is_deleted, FALSE) = FALSE
  GROUP BY room_type_id, stay_date
`;

export type RoomTypeRestrictions = {
  rules: RestrictionRule[];
  inventory: NightInventory[];
};

/**
 * Rules and inventory per room type for the window.
 *
 * Room types with no rules and no calendar rows are absent from the map, which
 * the caller reads as "unrestricted" — the same thing an empty rule list would
 * mean, without a row per room type the property has never published.
 */
export const loadSearchRestrictions = async (
  window: SearchWindow,
): Promise<Map<string, RoomTypeRestrictions>> => {
  const params = [window.tenantId, window.propertyId, window.arrival, window.departure];

  const [ruleResult, calendarResult] = await Promise.all([
    query<RestrictionRowLike & { room_type_id: string | null }>(SEARCH_RULES_SQL, params),
    query<RateCalendarRowLike & { room_type_id: string }>(SEARCH_CALENDAR_SQL, params),
  ]);
  const ruleRows = ruleResult.rows;
  const calendarRows = calendarResult.rows;

  const byRoomType = new Map<string, RoomTypeRestrictions>();
  const entry = (roomTypeId: string): RoomTypeRestrictions => {
    const existing = byRoomType.get(roomTypeId);
    if (existing) return existing;
    const created: RoomTypeRestrictions = { rules: [], inventory: [] };
    byRoomType.set(roomTypeId, created);
    return created;
  };

  // A rule with a NULL room_type_id is property-wide, so it has to reach every
  // room type the search is considering — including ones with no rules of
  // their own. Collected separately and merged in once the set is known.
  const propertyWide: RestrictionRowLike[] = [];
  for (const row of ruleRows) {
    if (row.room_type_id === null) {
      propertyWide.push(row);
      continue;
    }
    entry(row.room_type_id).rules.push(...restrictionRowsToRules([row]));
  }

  for (const row of calendarRows) {
    // No rate resolved during a search, so the rate-scoped controls on the
    // calendar row are not applied — only the inventory it publishes.
    const { inventory } = calendarRowsToRules([row], false);
    entry(row.room_type_id).inventory.push(...inventory);
  }

  if (propertyWide.length > 0) {
    const shared = restrictionRowsToRules(propertyWide);
    for (const value of byRoomType.values()) {
      value.rules.push(...shared);
    }
  }

  return byRoomType;
};

/** Property-wide rules alone, for room types the calendar has never published. */
export const loadPropertyWideRestrictions = async (
  window: SearchWindow,
): Promise<RestrictionRule[]> => {
  const result = await query<RestrictionRowLike & { room_type_id: string | null }>(
    `${SEARCH_RULES_SQL} AND room_type_id IS NULL`,
    [window.tenantId, window.propertyId, window.arrival, window.departure],
  );
  return restrictionRowsToRules(result.rows);
};

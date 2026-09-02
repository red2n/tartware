/**
 * SQL queries for updating demand calendar metrics from reservation events.
 *
 * These run when the revenue service consumes events from the
 * `reservations.events` Kafka topic, keeping on-the-books (OTB)
 * metrics in demand_calendar up to date in near-real-time.
 */

/**
 * Increment rooms_reserved across every night of a new reservation's stay.
 * Also updates booking_pace to 'ahead' if rooms_reserved increased.
 * Uses UPSERT: creates the calendar row if it does not yet exist.
 * rooms_available defaults to 0 on insert — the periodic inventory sync
 * job overwrites it with the property's actual sellable room count.
 */
export const DEMAND_CALENDAR_INCREMENT_OTB_SQL = `
  INSERT INTO public.demand_calendar (
    tenant_id, property_id, calendar_date, day_of_week,
    demand_level, rooms_available, rooms_reserved, updated_at
  )
  SELECT
    $1::uuid, $2::uuid, stay_date,
    trim(to_char(stay_date, 'Day')),
    'moderate', 0, 1, CURRENT_TIMESTAMP
  FROM UNNEST($3::date[]) AS stay_date
  ON CONFLICT (tenant_id, property_id, calendar_date)
  DO UPDATE SET
    rooms_reserved = COALESCE(demand_calendar.rooms_reserved, 0) + 1,
    updated_at = CURRENT_TIMESTAMP
`;

/**
 * Decrement rooms_reserved across every night of a cancelled stay.
 * Ensures rooms_reserved does not go below zero.
 */
export const DEMAND_CALENDAR_DECREMENT_OTB_SQL = `
  UPDATE public.demand_calendar
  SET
    rooms_reserved = GREATEST(COALESCE(rooms_reserved, 0) - 1, 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE property_id = $2::uuid
    AND calendar_date = ANY($3::date[])
    AND tenant_id = $1::uuid
`;

/**
 * Update demand calendar with actual occupancy after checkout, across every
 * night of the stay: rooms_occupied up, rooms_reserved down.
 */
export const DEMAND_CALENDAR_CHECKOUT_SQL = `
  UPDATE public.demand_calendar
  SET
    rooms_occupied = COALESCE(rooms_occupied, 0) + 1,
    rooms_reserved = GREATEST(COALESCE(rooms_reserved, 0) - 1, 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE property_id = $2::uuid
    AND calendar_date = ANY($3::date[])
    AND tenant_id = $1::uuid
`;

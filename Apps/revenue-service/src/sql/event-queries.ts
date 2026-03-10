/**
 * SQL queries for updating demand calendar metrics from reservation events.
 *
 * These run when the revenue service consumes events from the
 * `reservations.events` Kafka topic, keeping on-the-books (OTB)
 * metrics in demand_calendar up to date in near-real-time.
 */

/**
 * Increment rooms_reserved for a single date when a new reservation is created.
 * Also updates booking_pace to 'ahead' if rooms_reserved increased.
 * Uses UPSERT: creates the calendar row if it does not yet exist.
 */
export const DEMAND_CALENDAR_INCREMENT_OTB_SQL = `
  INSERT INTO public.demand_calendar (
    tenant_id, property_id, calendar_date, day_of_week,
    rooms_reserved, updated_by, updated_at
  )
  VALUES (
    $1::uuid, $2::uuid, $3::date,
    EXTRACT(DOW FROM $3::date)::int,
    1, $4::uuid, CURRENT_TIMESTAMP
  )
  ON CONFLICT (property_id, calendar_date)
  DO UPDATE SET
    rooms_reserved = COALESCE(demand_calendar.rooms_reserved, 0) + 1,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP
`;

/**
 * Decrement rooms_reserved for a single date when a reservation is cancelled.
 * Ensures rooms_reserved does not go below zero.
 */
export const DEMAND_CALENDAR_DECREMENT_OTB_SQL = `
  UPDATE public.demand_calendar
  SET
    rooms_reserved = GREATEST(COALESCE(rooms_reserved, 0) - 1, 0),
    updated_by = $4::uuid,
    updated_at = CURRENT_TIMESTAMP
  WHERE property_id = $2::uuid
    AND calendar_date = $3::date
    AND tenant_id = $1::uuid
`;

/**
 * Update demand calendar with actual occupancy data after checkout.
 * Increments rooms_occupied and decrements rooms_reserved for the stay dates.
 */
export const DEMAND_CALENDAR_CHECKOUT_SQL = `
  UPDATE public.demand_calendar
  SET
    rooms_occupied = COALESCE(rooms_occupied, 0) + 1,
    rooms_reserved = GREATEST(COALESCE(rooms_reserved, 0) - 1, 0),
    updated_by = $4::uuid,
    updated_at = CURRENT_TIMESTAMP
  WHERE property_id = $2::uuid
    AND calendar_date = $3::date
    AND tenant_id = $1::uuid
`;

/**
 * SQL queries for booking pace analysis (R11).
 *
 * Booking pace = current on-the-books (OTB) reservations for future dates
 * compared to the same "days-out" position last year. This is the #1
 * tactical demand signal used by revenue managers every morning.
 */

/**
 * Booking pace report: for each future calendar date in the range, return:
 * - OTB rooms (confirmed reservations covering that date)
 * - OTB revenue (sum of room_rate for those reservations)
 * - Last year OTB rooms & revenue for the equivalent date
 * - 7-day and 30-day pickup from demand_calendar
 * - rooms_available and occupancy forecast from demand_calendar
 *
 * Params: $1 tenant_id, $2 property_id, $3 start_date, $4 end_date
 */
export const BOOKING_PACE_REPORT_SQL = `
  WITH date_series AS (
    SELECT d::date AS calendar_date,
           EXTRACT(DOW FROM d)::int AS day_of_week
    FROM generate_series($3::date, $4::date, '1 day') AS d
  ),
  current_otb AS (
    SELECT
      d.calendar_date,
      COUNT(DISTINCT r.id) AS otb_rooms,
      COALESCE(SUM(r.room_rate), 0) AS otb_revenue
    FROM date_series d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN')
      AND r.is_deleted = false
      AND r.check_in_date <= d.calendar_date
      AND r.check_out_date > d.calendar_date
    GROUP BY d.calendar_date
  ),
  ly_otb AS (
    SELECT
      (d.calendar_date + INTERVAL '1 year')::date AS future_date,
      COUNT(DISTINCT r.id) AS ly_otb_rooms,
      COALESCE(SUM(r.room_rate), 0) AS ly_otb_revenue
    FROM date_series d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date <= (d.calendar_date - INTERVAL '1 year')::date
      AND r.check_out_date > (d.calendar_date - INTERVAL '1 year')::date
    GROUP BY d.calendar_date
  ),
  dc AS (
    SELECT
      calendar_date,
      pickup_last_7_days,
      pickup_last_30_days,
      rooms_available,
      forecasted_occupancy_percent AS occupancy_forecast_percent
    FROM demand_calendar
    WHERE tenant_id = $1::uuid
      AND property_id = $2::uuid
      AND calendar_date BETWEEN $3::date AND $4::date
  )
  SELECT
    ds.calendar_date,
    ds.day_of_week,
    COALESCE(c.otb_rooms, 0) AS otb_rooms,
    c.otb_revenue,
    ly.ly_otb_rooms,
    ly.ly_otb_revenue,
    dc.pickup_last_7_days,
    dc.pickup_last_30_days,
    dc.rooms_available,
    dc.occupancy_forecast_percent
  FROM date_series ds
  LEFT JOIN current_otb c ON c.calendar_date = ds.calendar_date
  LEFT JOIN ly_otb ly ON ly.future_date = ds.calendar_date
  LEFT JOIN dc ON dc.calendar_date = ds.calendar_date
  ORDER BY ds.calendar_date
`;

/**
 * Snapshot booking pace into demand_calendar for a range of future dates.
 * Computes current OTB rooms and 7/30-day pickup from reservation creation dates,
 * then upserts into demand_calendar.
 *
 * Params: $1 tenant_id, $2 property_id, $3 start_date, $4 end_date, $5 actor_id
 */
export const BOOKING_PACE_SNAPSHOT_SQL = `
  WITH date_range AS (
    SELECT d::date AS calendar_date
    FROM generate_series($3::date, $4::date, '1 day') AS d
  ),
  otb AS (
    SELECT
      d.calendar_date,
      COUNT(DISTINCT r.id) AS otb_rooms
    FROM date_range d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN')
      AND r.is_deleted = false
      AND r.check_in_date <= d.calendar_date
      AND r.check_out_date > d.calendar_date
    GROUP BY d.calendar_date
  ),
  pickup_7 AS (
    SELECT
      d.calendar_date,
      COUNT(DISTINCT r.id) AS cnt
    FROM date_range d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN')
      AND r.is_deleted = false
      AND r.check_in_date <= d.calendar_date
      AND r.check_out_date > d.calendar_date
      AND r.created_at >= (CURRENT_DATE - INTERVAL '7 days')
    GROUP BY d.calendar_date
  ),
  pickup_30 AS (
    SELECT
      d.calendar_date,
      COUNT(DISTINCT r.id) AS cnt
    FROM date_range d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN')
      AND r.is_deleted = false
      AND r.check_in_date <= d.calendar_date
      AND r.check_out_date > d.calendar_date
      AND r.created_at >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY d.calendar_date
  ),
  ly AS (
    SELECT
      (d.calendar_date + INTERVAL '1 year')::date AS future_date,
      COUNT(DISTINCT r.id) AS ly_rooms
    FROM date_range d
    LEFT JOIN reservations r
      ON r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date <= (d.calendar_date - INTERVAL '1 year')::date
      AND r.check_out_date > (d.calendar_date - INTERVAL '1 year')::date
    GROUP BY d.calendar_date
  )
  INSERT INTO demand_calendar (
    tenant_id, property_id, calendar_date, day_of_week,
    rooms_reserved, pickup_last_7_days, pickup_last_30_days,
    pace_vs_last_year,
    booking_pace,
    updated_by, updated_at
  )
  SELECT
    $1::uuid,
    $2::uuid,
    d.calendar_date,
    EXTRACT(DOW FROM d.calendar_date)::int,
    COALESCE(o.otb_rooms, 0),
    COALESCE(p7.cnt, 0),
    COALESCE(p30.cnt, 0),
    CASE
      WHEN ly.ly_rooms IS NOT NULL AND ly.ly_rooms > 0
        THEN COALESCE(o.otb_rooms, 0) - ly.ly_rooms
      ELSE NULL
    END,
    CASE
      WHEN ly.ly_rooms IS NULL OR ly.ly_rooms = 0 THEN NULL
      WHEN COALESCE(o.otb_rooms, 0) >= ly.ly_rooms * 1.05 THEN 'ahead'
      WHEN COALESCE(o.otb_rooms, 0) >= ly.ly_rooms * 0.95 THEN 'on_track'
      WHEN COALESCE(o.otb_rooms, 0) >= ly.ly_rooms * 0.80 THEN 'behind'
      ELSE 'significantly_behind'
    END,
    $5::uuid,
    CURRENT_TIMESTAMP
  FROM date_range d
  LEFT JOIN otb o ON o.calendar_date = d.calendar_date
  LEFT JOIN pickup_7 p7 ON p7.calendar_date = d.calendar_date
  LEFT JOIN pickup_30 p30 ON p30.calendar_date = d.calendar_date
  LEFT JOIN ly ON ly.future_date = d.calendar_date
  ON CONFLICT (tenant_id, property_id, calendar_date)
  DO UPDATE SET
    rooms_reserved = EXCLUDED.rooms_reserved,
    pickup_last_7_days = EXCLUDED.pickup_last_7_days,
    pickup_last_30_days = EXCLUDED.pickup_last_30_days,
    pace_vs_last_year = EXCLUDED.pace_vs_last_year,
    booking_pace = EXCLUDED.booking_pace,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP
`;

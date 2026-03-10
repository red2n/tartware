/**
 * Segment Performance Analytics SQL (R17).
 *
 * Breaks down reservations by reservation_type (market segment) with
 * revenue, ADR, room nights, and optional last-year comparison.
 */
export const SEGMENT_ANALYSIS_SQL = `
  WITH current_period AS (
    SELECT
      COALESCE(r.reservation_type, 'TRANSIENT') AS segment,
      COUNT(DISTINCT r.id)                       AS rooms_sold,
      SUM(EXTRACT(DAY FROM (r.check_out_date::timestamp - r.check_in_date::timestamp)))::int AS room_nights,
      COALESCE(SUM(r.total_amount), 0)           AS revenue,
      CASE WHEN COUNT(r.id) > 0
           THEN ROUND(AVG(r.room_rate)::numeric, 2) ELSE 0 END AS adr
    FROM reservations r
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= $3::date
      AND r.check_out_date <= $4::date
    GROUP BY COALESCE(r.reservation_type, 'TRANSIENT')
  ),
  last_year AS (
    SELECT
      COALESCE(r.reservation_type, 'TRANSIENT') AS segment,
      COUNT(DISTINCT r.id)                       AS ly_rooms_sold,
      COALESCE(SUM(r.total_amount), 0)           AS ly_revenue,
      CASE WHEN COUNT(r.id) > 0
           THEN ROUND(AVG(r.room_rate)::numeric, 2) ELSE 0 END AS ly_adr
    FROM reservations r
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= ($3::date - INTERVAL '1 year')
      AND r.check_out_date <= ($4::date - INTERVAL '1 year')
    GROUP BY COALESCE(r.reservation_type, 'TRANSIENT')
  ),
  totals AS (
    SELECT
      COALESCE(SUM(revenue), 0) AS total_revenue,
      COALESCE(SUM(rooms_sold), 0) AS total_rooms
    FROM current_period
  )
  SELECT
    cp.segment,
    cp.rooms_sold,
    cp.room_nights,
    cp.revenue,
    cp.adr,
    CASE WHEN t.total_revenue > 0
         THEN ROUND((cp.revenue / t.total_revenue * 100)::numeric, 2)
         ELSE 0 END AS pct_of_total_revenue,
    CASE WHEN t.total_rooms > 0
         THEN ROUND((cp.rooms_sold::numeric / t.total_rooms * 100)::numeric, 2)
         ELSE 0 END AS pct_of_total_rooms,
    ly.ly_rooms_sold,
    ly.ly_revenue,
    ly.ly_adr
  FROM current_period cp
  CROSS JOIN totals t
  LEFT JOIN last_year ly ON ly.segment = cp.segment
  ORDER BY cp.revenue DESC
`;

/**
 * Segment Performance Analytics SQL (R17).
 *
 * Breaks down reservations by reservation_type (market segment) with
 * revenue, ADR, room nights, and optional last-year comparison.
 *
 * Counted over `reservation_nights`, so the period covers the nights that fall
 * inside it rather than only the stays wholly contained by it — a stay
 * straddling the month end now contributes its nights to each month instead of
 * to neither. Revenue is the sum of those nights' rates, which is what makes
 * ADR (revenue ÷ room-nights) come out right for a split-rate stay.
 */
export const SEGMENT_ANALYSIS_SQL = `
  WITH current_period AS (
    SELECT
      COALESCE(r.reservation_type, 'TRANSIENT') AS segment,
      COUNT(DISTINCT n.reservation_room_id)      AS rooms_sold,
      COUNT(n.reservation_night_id)::int         AS room_nights,
      COALESCE(SUM(n.rate_amount) FILTER (WHERE NOT n.is_complimentary), 0) AS revenue,
      CASE WHEN COUNT(n.reservation_night_id) FILTER (WHERE NOT n.is_complimentary) > 0
           THEN ROUND(
             (SUM(n.rate_amount) FILTER (WHERE NOT n.is_complimentary)
              / COUNT(n.reservation_night_id) FILTER (WHERE NOT n.is_complimentary))::numeric,
             2)
           ELSE 0 END AS adr
    FROM reservation_nights n
    JOIN reservations r
      ON r.id = n.reservation_id AND r.tenant_id = n.tenant_id
    WHERE n.tenant_id = $1::uuid
      AND n.property_id = $2::uuid
      AND n.stay_date >= $3::date
      AND n.stay_date < $4::date
      AND COALESCE(n.is_deleted, false) = false
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
    GROUP BY COALESCE(r.reservation_type, 'TRANSIENT')
  ),
  last_year AS (
    SELECT
      COALESCE(r.reservation_type, 'TRANSIENT') AS segment,
      COUNT(DISTINCT n.reservation_room_id)      AS ly_rooms_sold,
      COALESCE(SUM(n.rate_amount) FILTER (WHERE NOT n.is_complimentary), 0) AS ly_revenue,
      CASE WHEN COUNT(n.reservation_night_id) FILTER (WHERE NOT n.is_complimentary) > 0
           THEN ROUND(
             (SUM(n.rate_amount) FILTER (WHERE NOT n.is_complimentary)
              / COUNT(n.reservation_night_id) FILTER (WHERE NOT n.is_complimentary))::numeric,
             2)
           ELSE 0 END AS ly_adr
    FROM reservation_nights n
    JOIN reservations r
      ON r.id = n.reservation_id AND r.tenant_id = n.tenant_id
    WHERE n.tenant_id = $1::uuid
      AND n.property_id = $2::uuid
      AND n.stay_date >= ($3::date - INTERVAL '1 year')
      AND n.stay_date < ($4::date - INTERVAL '1 year')
      AND COALESCE(n.is_deleted, false) = false
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
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

/**
 * Channel Profitability SQL (R18).
 *
 * Breaks down reservations by source (distribution channel) with
 * gross revenue, room nights, and booking count. Commission is
 * applied in the service layer using industry-standard rates.
 */
export const CHANNEL_PROFITABILITY_SQL = `
  SELECT
    COALESCE(r.source, 'DIRECT')   AS channel,
    COUNT(DISTINCT r.id)            AS booking_count,
    SUM(EXTRACT(DAY FROM (r.check_out_date::timestamp - r.check_in_date::timestamp)))::int AS room_nights,
    COALESCE(SUM(r.total_amount), 0) AS gross_revenue
  FROM reservations r
  WHERE r.tenant_id = $1::uuid
    AND r.property_id = $2::uuid
    AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    AND r.is_deleted = false
    AND r.check_in_date >= $3::date
    AND r.check_out_date <= $4::date
  GROUP BY COALESCE(r.source, 'DIRECT')
  ORDER BY gross_revenue DESC
`;

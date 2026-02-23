/**
 * Displacement Analysis SQL — compares group block revenue vs transient
 * revenue that would have been earned in the displaced room-nights.
 *
 * The query aggregates group reservations and calculates displacement
 * by comparing group ADR against the property's average transient ADR
 * for the same period.
 */
export const DISPLACEMENT_ANALYSIS_SQL = `
  WITH group_blocks AS (
    SELECT
      r.property_id,
      r.group_id,
      g.group_name,
      COUNT(DISTINCT r.id) AS group_rooms_booked,
      SUM(r.room_rate) AS group_total_revenue,
      AVG(r.room_rate) AS group_adr,
      MIN(r.check_in_date) AS block_start,
      MAX(r.check_out_date) AS block_end,
      SUM(EXTRACT(DAY FROM (r.check_out_date::timestamp - r.check_in_date::timestamp))) AS group_room_nights
    FROM reservations r
    INNER JOIN groups g ON g.id = r.group_id AND g.tenant_id = r.tenant_id
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NOT NULL
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= $3::date
      AND r.check_out_date <= $4::date
    GROUP BY r.property_id, r.group_id, g.group_name
  ),
  transient_avg AS (
    SELECT
      AVG(r.room_rate) AS avg_transient_adr,
      COUNT(DISTINCT r.id) AS transient_count
    FROM reservations r
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NULL
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= $3::date
      AND r.check_out_date <= $4::date
  )
  SELECT
    gb.group_id,
    gb.group_name,
    gb.group_rooms_booked,
    gb.group_room_nights,
    gb.group_total_revenue,
    gb.group_adr,
    gb.block_start,
    gb.block_end,
    ta.avg_transient_adr,
    (gb.group_room_nights * ta.avg_transient_adr) AS displaced_transient_revenue,
    gb.group_total_revenue - (gb.group_room_nights * ta.avg_transient_adr) AS net_displacement_value,
    CASE
      WHEN ta.avg_transient_adr > 0
      THEN ROUND(((gb.group_adr - ta.avg_transient_adr) / ta.avg_transient_adr * 100)::numeric, 2)
      ELSE 0
    END AS adr_differential_pct
  FROM group_blocks gb
  CROSS JOIN transient_avg ta
  ORDER BY gb.group_total_revenue DESC
  LIMIT $5 OFFSET $6
`;

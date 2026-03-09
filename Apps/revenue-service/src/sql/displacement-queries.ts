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

/**
 * Enhanced Group Displacement Evaluation SQL (R19).
 *
 * Goes beyond basic displacement by including:
 * - Displaced demand estimation (denied/turned-away transient bookings during block dates)
 * - Ancillary revenue comparison (group F&B/charges vs average transient charges)
 * - Occupancy context (how full was the hotel — displacement only matters near sellout)
 * - Net displacement value = group total contribution - displaced room + ancillary value
 */
export const GROUP_EVALUATE_SQL = `
  WITH group_block AS (
    SELECT
      r.group_id,
      g.group_name,
      COUNT(DISTINCT r.id)          AS group_rooms_booked,
      SUM(r.room_rate)              AS group_room_revenue,
      AVG(r.room_rate)              AS group_adr,
      MIN(r.check_in_date)          AS block_start,
      MAX(r.check_out_date)         AS block_end,
      SUM(EXTRACT(DAY FROM (r.check_out_date::timestamp - r.check_in_date::timestamp)))
                                    AS group_room_nights
    FROM reservations r
    INNER JOIN groups g ON g.id = r.group_id AND g.tenant_id = r.tenant_id
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id = $3::uuid
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
    GROUP BY r.group_id, g.group_name
  ),
  block_dates AS (
    SELECT block_start, block_end FROM group_block
  ),
  transient_baseline AS (
    SELECT
      AVG(r.room_rate)              AS avg_transient_adr,
      COUNT(DISTINCT r.id)          AS transient_bookings
    FROM reservations r, block_dates bd
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NULL
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= bd.block_start
      AND r.check_out_date <= bd.block_end
  ),
  denied_demand AS (
    SELECT COUNT(*) AS denied_bookings
    FROM reservations r, block_dates bd
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NULL
      AND r.status IN ('CANCELLED', 'NO_SHOW')
      AND r.is_deleted = false
      AND r.check_in_date >= bd.block_start
      AND r.check_out_date <= bd.block_end
      AND r.cancellation_reason ILIKE '%sold%out%'
  ),
  group_ancillary AS (
    SELECT COALESCE(SUM(cp.total_amount), 0) AS group_ancillary_revenue
    FROM charge_postings cp
    INNER JOIN reservations r ON cp.reservation_id = r.id AND cp.tenant_id = r.tenant_id
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id = $3::uuid
      AND cp.charge_category != 'ROOM'
      AND COALESCE(cp.is_deleted, false) = false
  ),
  transient_ancillary AS (
    SELECT
      CASE WHEN COUNT(DISTINCT r.id) > 0
           THEN ROUND((SUM(cp.total_amount) / COUNT(DISTINCT r.id))::numeric, 2)
           ELSE 0 END                AS avg_transient_ancillary_per_booking
    FROM charge_postings cp
    INNER JOIN reservations r ON cp.reservation_id = r.id AND cp.tenant_id = r.tenant_id
    , block_dates bd
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NULL
      AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= bd.block_start
      AND r.check_out_date <= bd.block_end
      AND cp.charge_category != 'ROOM'
      AND COALESCE(cp.is_deleted, false) = false
  ),
  occupancy_context AS (
    SELECT
      COUNT(rm.id)                  AS total_rooms,
      COUNT(res.id)                 AS occupied_rooms
    FROM rooms rm
    LEFT JOIN reservations res
      ON res.tenant_id = rm.tenant_id
      AND res.property_id = rm.property_id
      AND res.room_id = rm.id
      AND res.status = 'CHECKED_IN'
      AND res.is_deleted = false
    , block_dates bd
    WHERE rm.tenant_id = $1::uuid
      AND rm.property_id = $2::uuid
      AND COALESCE(rm.is_deleted, false) = false
      AND rm.status NOT IN ('OUT_OF_ORDER')
  )
  SELECT
    gb.group_id,
    gb.group_name,
    gb.group_rooms_booked,
    gb.group_room_nights,
    gb.group_room_revenue,
    gb.group_adr,
    gb.block_start,
    gb.block_end,
    tb.avg_transient_adr,
    tb.transient_bookings,
    dd.denied_bookings          AS estimated_denied_demand,
    ga.group_ancillary_revenue,
    ta.avg_transient_ancillary_per_booking,
    oc.total_rooms,
    oc.occupied_rooms,
    CASE WHEN oc.total_rooms > 0
         THEN ROUND((oc.occupied_rooms::numeric / oc.total_rooms * 100), 2)
         ELSE 0 END             AS occupancy_pct,
    -- Displaced room revenue
    (gb.group_room_nights * tb.avg_transient_adr) AS displaced_room_revenue,
    -- Displaced ancillary revenue
    (gb.group_room_nights * ta.avg_transient_ancillary_per_booking) AS displaced_ancillary_revenue,
    -- Group total contribution (rooms + ancillary)
    (gb.group_room_revenue + ga.group_ancillary_revenue) AS group_total_contribution,
    -- Net displacement = group contribution - displaced (room + ancillary)
    (gb.group_room_revenue + ga.group_ancillary_revenue)
      - (gb.group_room_nights * tb.avg_transient_adr)
      - (gb.group_room_nights * ta.avg_transient_ancillary_per_booking)
      AS net_displacement_value
  FROM group_block gb
  CROSS JOIN transient_baseline tb
  CROSS JOIN denied_demand dd
  CROSS JOIN group_ancillary ga
  CROSS JOIN transient_ancillary ta
  CROSS JOIN occupancy_context oc
`;

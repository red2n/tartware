export const RESERVATION_STATUS_SUMMARY_SQL = `
  SELECT
    r.status,
    COUNT(*) AS count
  FROM public.reservations r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND (
      $3::date IS NULL
      OR r.check_in_date >= $3::date
    )
    AND (
      $4::date IS NULL
      OR r.check_out_date <= $4::date
    )
  GROUP BY r.status
`;

export const REVENUE_SUMMARY_SQL = `
  SELECT
    COALESCE(SUM(CASE WHEN p.processed_at::date = CURRENT_DATE THEN p.amount END), 0) AS revenue_today,
    COALESCE(SUM(CASE WHEN date_trunc('month', p.processed_at) = date_trunc('month', CURRENT_DATE) THEN p.amount END), 0) AS revenue_month,
    COALESCE(SUM(CASE WHEN date_trunc('year', p.processed_at) = date_trunc('year', CURRENT_DATE) THEN p.amount END), 0) AS revenue_year
  FROM public.payments p
  WHERE COALESCE(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND p.status = 'COMPLETED'
    AND p.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR p.property_id = $2::uuid)
`;

export const RESERVATION_SOURCE_SUMMARY_SQL = `
  SELECT
    r.source,
    COUNT(*) AS reservations,
    COALESCE(SUM(r.total_amount), 0) AS total_amount
  FROM public.reservations r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND (
      $3::date IS NULL
      OR r.check_in_date >= $3::date
    )
    AND (
      $4::date IS NULL
      OR r.check_out_date <= $4::date
    )
  GROUP BY r.source
  ORDER BY total_amount DESC
  LIMIT 5
`;

// ─── S24: Occupancy Report ───────────────────────────────────────────────────

/**
 * Returns per-date occupancy rows.
 * Params: $1 = tenant_id, $2 = property_id (nullable), $3 = start_date, $4 = end_date
 */
export const OCCUPANCY_REPORT_SQL = `
  WITH date_range AS (
    SELECT generate_series($3::date, $4::date, '1 day'::interval)::date AS d
  ),
  total_rooms AS (
    SELECT COUNT(*) AS cnt
    FROM public.rooms
    WHERE COALESCE(is_deleted, false) = false
      AND deleted_at IS NULL
      AND tenant_id = $1::uuid
      AND ($2::uuid IS NULL OR property_id = $2::uuid)
  ),
  sold AS (
    SELECT dr.d AS stay_date, COUNT(DISTINCT r.id) AS rooms_sold
    FROM date_range dr
    JOIN public.reservations r
      ON r.check_in_date <= dr.d
     AND r.check_out_date > dr.d
     AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
     AND COALESCE(r.is_deleted, false) = false
     AND r.deleted_at IS NULL
     AND r.tenant_id = $1::uuid
     AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    GROUP BY dr.d
  )
  SELECT
    dr.d::text AS date,
    tr.cnt::int AS total_rooms,
    COALESCE(s.rooms_sold, 0)::int AS rooms_sold,
    GREATEST(tr.cnt - COALESCE(s.rooms_sold, 0), 0)::int AS rooms_available,
    CASE WHEN tr.cnt > 0
      THEN ROUND((COALESCE(s.rooms_sold, 0)::numeric / tr.cnt) * 100, 2)
      ELSE 0
    END AS occupancy_pct
  FROM date_range dr
  CROSS JOIN total_rooms tr
  LEFT JOIN sold s ON s.stay_date = dr.d
  ORDER BY dr.d
`;

// ─── S24: Revenue KPI Report ────────────────────────────────────────────────

/**
 * Returns ADR, RevPAR, TRevPAR for a date range.
 * Params: $1 = tenant_id, $2 = property_id (nullable), $3 = start_date, $4 = end_date
 */
export const REVENUE_KPI_SQL = `
  WITH total_rooms AS (
    SELECT COUNT(*) AS cnt
    FROM public.rooms
    WHERE COALESCE(is_deleted, false) = false
      AND deleted_at IS NULL
      AND tenant_id = $1::uuid
      AND ($2::uuid IS NULL OR property_id = $2::uuid)
  ),
  period_days AS (
    SELECT ($4::date - $3::date + 1) AS days
  ),
  room_revenue AS (
    SELECT
      COALESCE(SUM(r.room_rate * ($4::date - $3::date + 1 -
        GREATEST(0, $3::date - r.check_in_date) -
        GREATEST(0, r.check_out_date - $4::date - 1)
      )), 0) AS room_rev,
      COUNT(DISTINCT r.id) AS rooms_sold
    FROM public.reservations r
    WHERE r.check_in_date <= $4::date
      AND r.check_out_date > $3::date
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND COALESCE(r.is_deleted, false) = false
      AND r.deleted_at IS NULL
      AND r.tenant_id = $1::uuid
      AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
  ),
  total_rev AS (
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM public.payments p
    WHERE p.status = 'COMPLETED'
      AND COALESCE(p.is_deleted, false) = false
      AND p.deleted_at IS NULL
      AND p.processed_at::date BETWEEN $3::date AND $4::date
      AND p.tenant_id = $1::uuid
      AND ($2::uuid IS NULL OR p.property_id = $2::uuid)
  )
  SELECT
    rr.room_rev AS total_room_revenue,
    tr_rev.total AS total_revenue,
    rr.rooms_sold::int AS rooms_sold,
    (t.cnt * pd.days)::int AS available_room_nights,
    CASE WHEN (t.cnt * pd.days) > 0
      THEN ROUND((rr.rooms_sold::numeric / (t.cnt * pd.days)) * 100, 2)
      ELSE 0
    END AS occupancy_pct,
    CASE WHEN rr.rooms_sold > 0
      THEN ROUND(rr.room_rev / rr.rooms_sold, 2)
      ELSE 0
    END AS adr,
    CASE WHEN (t.cnt * pd.days) > 0
      THEN ROUND(rr.room_rev / (t.cnt * pd.days), 2)
      ELSE 0
    END AS revpar,
    CASE WHEN (t.cnt * pd.days) > 0
      THEN ROUND(tr_rev.total / (t.cnt * pd.days), 2)
      ELSE 0
    END AS trevpar
  FROM total_rooms t
  CROSS JOIN period_days pd
  CROSS JOIN room_revenue rr
  CROSS JOIN total_rev tr_rev
`;

// ─── S24: Arrivals List ─────────────────────────────────────────────────────

/**
 * Returns reservations arriving on a given date range.
 * Params: $1 = tenant_id, $2 = property_id (nullable), $3 = start_date, $4 = end_date,
 *         $5 = limit, $6 = offset
 */
export const ARRIVALS_LIST_SQL = `
  SELECT
    r.id AS reservation_id,
    r.confirmation_number,
    r.guest_name,
    r.guest_email,
    r.guest_phone,
    r.room_number,
    COALESCE(rt.type_name, '') AS room_type,
    r.check_in_date::text,
    r.check_out_date::text,
    r.status::text,
    r.source::text,
    r.special_requests,
    r.eta::text,
    r.number_of_adults,
    r.number_of_children,
    COALESCE(g.vip_status IS NOT NULL AND g.vip_status != 'NONE', false) AS vip
  FROM public.reservations r
  LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
  LEFT JOIN public.guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.check_in_date BETWEEN $3::date AND $4::date
    AND r.status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN')
  ORDER BY r.check_in_date, r.eta NULLS LAST, r.guest_name
  LIMIT $5::int OFFSET $6::int
`;

export const ARRIVALS_COUNT_SQL = `
  SELECT COUNT(*) AS total
  FROM public.reservations r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.check_in_date BETWEEN $3::date AND $4::date
    AND r.status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN')
`;

// ─── S24: Departures List ───────────────────────────────────────────────────

/**
 * Returns reservations departing on a given date range.
 * Params: $1 = tenant_id, $2 = property_id (nullable), $3 = start_date, $4 = end_date,
 *         $5 = limit, $6 = offset
 */
export const DEPARTURES_LIST_SQL = `
  SELECT
    r.id AS reservation_id,
    r.confirmation_number,
    r.guest_name,
    r.guest_email,
    r.guest_phone,
    r.room_number,
    COALESCE(rt.type_name, '') AS room_type,
    r.check_in_date::text,
    r.check_out_date::text,
    r.status::text,
    r.source::text,
    r.special_requests,
    r.eta::text,
    r.number_of_adults,
    r.number_of_children,
    COALESCE(g.vip_status IS NOT NULL AND g.vip_status != 'NONE', false) AS vip
  FROM public.reservations r
  LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
  LEFT JOIN public.guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.check_out_date BETWEEN $3::date AND $4::date
    AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
  ORDER BY r.check_out_date, r.guest_name
  LIMIT $5::int OFFSET $6::int
`;

export const DEPARTURES_COUNT_SQL = `
  SELECT COUNT(*) AS total
  FROM public.reservations r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.check_out_date BETWEEN $3::date AND $4::date
    AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
`;

// ─── S24: In-House Guest List ───────────────────────────────────────────────

/**
 * Returns currently in-house guests (status = CHECKED_IN).
 * Params: $1 = tenant_id, $2 = property_id (nullable), $3 = limit, $4 = offset
 */
export const IN_HOUSE_LIST_SQL = `
  SELECT
    r.id AS reservation_id,
    r.confirmation_number,
    r.guest_name,
    r.guest_email,
    r.guest_phone,
    r.room_number,
    COALESCE(rt.type_name, '') AS room_type,
    r.check_in_date::text,
    r.check_out_date::text,
    r.status::text,
    r.source::text,
    r.special_requests,
    r.eta::text,
    r.number_of_adults,
    r.number_of_children,
    COALESCE(g.vip_status IS NOT NULL AND g.vip_status != 'NONE', false) AS vip
  FROM public.reservations r
  LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
  LEFT JOIN public.guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.status = 'CHECKED_IN'
  ORDER BY r.room_number NULLS LAST, r.guest_name
  LIMIT $3::int OFFSET $4::int
`;

export const IN_HOUSE_COUNT_SQL = `
  SELECT COUNT(*) AS total
  FROM public.reservations r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND r.status = 'CHECKED_IN'
`;

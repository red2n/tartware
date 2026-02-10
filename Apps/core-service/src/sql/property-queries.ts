export const PROPERTY_LIST_SQL = `
  SELECT
    p.id,
    p.tenant_id,
    p.property_name,
    p.property_code,
    p.address,
    p.phone,
    p.email,
    p.website,
    p.property_type,
    p.star_rating,
    p.total_rooms,
    p.tax_id,
    p.license_number,
    p.currency,
    p.timezone,
    p.config,
    p.integrations,
    p.is_active,
    p.metadata,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.deleted_at,
    p.version
  FROM public.properties p
  WHERE COALESCE(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND ($2::uuid IS NULL OR p.tenant_id = $2::uuid)
  ORDER BY p.created_at DESC
  LIMIT $1
  OFFSET $3
`;

export const PROPERTY_OPERATIONAL_STATS_SQL = `
  WITH selected_properties AS (
    SELECT UNNEST($1::uuid[]) AS property_id
  ),
  room_data AS (
    SELECT
      r.property_id,
      COUNT(*) AS room_count
    FROM public.rooms r
    WHERE COALESCE(r.is_deleted, false) = false
      AND r.deleted_at IS NULL
      AND r.tenant_id = $2::uuid
      AND r.property_id = ANY($1::uuid[])
    GROUP BY r.property_id
  ),
  reservation_data AS (
    SELECT
      r.property_id,
      COUNT(DISTINCT r.room_number) FILTER (
        WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
          AND r.room_number IS NOT NULL
          AND r.check_in_date <= CURRENT_DATE
          AND r.check_out_date >= CURRENT_DATE
      ) AS occupied_rooms,
      COUNT(DISTINCT r.guest_id) FILTER (
        WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
          AND r.check_in_date <= CURRENT_DATE
          AND r.check_out_date >= CURRENT_DATE
      ) AS current_guests,
      COUNT(*) FILTER (
        WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
          AND r.check_in_date = CURRENT_DATE
      ) AS todays_arrivals,
      COUNT(*) FILTER (
        WHERE r.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND r.check_out_date = CURRENT_DATE
      ) AS todays_departures
    FROM public.reservations r
    WHERE COALESCE(r.is_deleted, false) = false
      AND r.deleted_at IS NULL
      AND r.tenant_id = $2::uuid
      AND r.property_id = ANY($1::uuid[])
    GROUP BY r.property_id
  )
  SELECT
    sp.property_id,
    COALESCE(rd.room_count, 0) AS room_count,
    COALESCE(res.occupied_rooms, 0) AS occupied_rooms,
    COALESCE(res.current_guests, 0) AS current_guests,
    COALESCE(res.todays_arrivals, 0) AS todays_arrivals,
    COALESCE(res.todays_departures, 0) AS todays_departures
  FROM selected_properties sp
  LEFT JOIN room_data rd ON rd.property_id = sp.property_id
  LEFT JOIN reservation_data res ON res.property_id = sp.property_id
`;

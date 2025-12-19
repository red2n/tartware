export const GUEST_LIST_SQL = `
  SELECT
    g.id,
    g.tenant_id,
    g.first_name,
    g.last_name,
    g.middle_name,
    g.title,
    g.date_of_birth,
    g.gender,
    g.nationality,
    g.email,
    g.phone,
    g.secondary_phone,
    g.address,
    g.id_type,
    g.id_number,
    g.passport_number,
    g.passport_expiry,
    g.company_name,
    g.company_tax_id,
    g.loyalty_tier,
    g.loyalty_points,
    g.vip_status,
    g.preferences,
    g.marketing_consent,
    g.communication_preferences,
    g.total_bookings,
    g.total_nights,
    g.total_revenue,
    g.last_stay_date,
    g.is_blacklisted,
    g.blacklist_reason,
    g.notes,
    g.metadata,
    g.created_at,
    g.updated_at,
    g.created_by,
    g.updated_by,
    g.deleted_at,
    g.version
  FROM public.guests g
  WHERE COALESCE(g.is_deleted, false) = false
    AND g.deleted_at IS NULL
    AND ($2::uuid IS NULL OR g.tenant_id = $2::uuid)
    AND (
      $3::uuid IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.reservations r
        WHERE r.tenant_id = g.tenant_id
          AND r.guest_id = g.id
          AND r.property_id = $3::uuid
          AND COALESCE(r.is_deleted, false) = false
          AND r.deleted_at IS NULL
      )
    )
    AND ($4::text IS NULL OR g.email ILIKE $4)
    AND ($5::text IS NULL OR g.phone ILIKE $5)
    AND ($6::text IS NULL OR g.loyalty_tier = $6)
    AND ($7::boolean IS NULL OR g.vip_status = $7)
    AND ($8::boolean IS NULL OR g.is_blacklisted = $8)
  ORDER BY g.created_at DESC
  LIMIT $1
`;

export const GUEST_RESERVATION_STATS_SQL = `
  WITH target_reservations AS (
    SELECT
      r.guest_id,
      r.room_type_id,
      rt.type_name AS room_type_name,
      r.check_in_date,
      r.check_out_date,
      r.status,
      r.total_amount
    FROM public.reservations r
    LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
    WHERE r.tenant_id = $1::uuid
      AND r.guest_id = ANY($2::uuid[])
      AND ($3::uuid IS NULL OR r.property_id = $3::uuid)
      AND COALESCE(r.is_deleted, false) = false
      AND r.deleted_at IS NULL
  ),
  base_stats AS (
    SELECT
      tr.guest_id,
      COUNT(*) FILTER (
        WHERE tr.status IN ('CONFIRMED', 'CHECKED_IN')
          AND tr.check_in_date >= CURRENT_DATE
      ) AS upcoming_reservations,
      COUNT(*) FILTER (
        WHERE tr.status = 'CHECKED_OUT'
          AND tr.check_out_date < CURRENT_DATE
      ) AS past_reservations,
      COUNT(*) FILTER (WHERE tr.status = 'CANCELLED') AS cancelled_reservations,
      AVG(GREATEST(1, (tr.check_out_date::date - tr.check_in_date::date))) FILTER (
        WHERE tr.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND tr.check_out_date IS NOT NULL
      ) AS average_stay_length,
      SUM(COALESCE(tr.total_amount, 0)) FILTER (
        WHERE tr.status NOT IN ('CANCELLED')
      ) AS lifetime_value
    FROM target_reservations tr
    GROUP BY tr.guest_id
  )
  SELECT
    bs.guest_id,
    bs.upcoming_reservations,
    bs.past_reservations,
    bs.cancelled_reservations,
    bs.average_stay_length,
    bs.lifetime_value,
    pref.preferred_room_types
  FROM base_stats bs
  LEFT JOIN LATERAL (
    SELECT ARRAY(
      SELECT room_type_name
      FROM (
        SELECT
          tr2.room_type_name,
          COUNT(*) AS stay_count
        FROM target_reservations tr2
        WHERE tr2.guest_id = bs.guest_id
          AND tr2.room_type_name IS NOT NULL
        GROUP BY tr2.room_type_name
        ORDER BY stay_count DESC, tr2.room_type_name
        LIMIT 3
      ) ranked
    ) AS preferred_room_types
  ) pref ON TRUE
`;

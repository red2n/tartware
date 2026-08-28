export const RESERVATION_GRID_SQL = `
  SELECT
    r.id,
    rt.type_name AS room_type_name,
    r.confirmation_number,
    r.check_in_date,
    r.check_out_date,
    r.room_number,
    r.total_amount,
    r.currency,
    r.status,
    r.source,
    r.reservation_type,
    r.guest_name,
    r.guest_email,
    CASE
      WHEN r.check_in_date IS NOT NULL
        AND r.check_out_date IS NOT NULL
      THEN GREATEST(1, (r.check_out_date::date - r.check_in_date::date))
      ELSE 1
    END AS nights
  FROM public.reservations r
  LEFT JOIN public.properties p
    ON r.property_id = p.id
  LEFT JOIN public.room_types rt
    ON r.room_type_id = rt.id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $2::uuid
    AND ($3::uuid IS NULL OR r.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR r.status = UPPER($4::text)::reservation_status
    )
    AND (
      $5::text IS NULL
      OR r.guest_name ILIKE $5
      OR r.guest_email ILIKE $5
      OR r.confirmation_number ILIKE $5
      OR r.room_number ILIKE $5
      OR rt.type_name ILIKE $5
    )
    AND ($7::uuid IS NULL OR r.guest_id = $7::uuid)
  ORDER BY r.check_in_date DESC, r.created_at DESC
  LIMIT $1
  OFFSET $6
`;

export const RESERVATION_LIST_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    p.property_name,
    r.guest_id,
    r.room_type_id,
    rt.type_name AS room_type_name,
    r.confirmation_number,
    r.check_in_date,
    r.check_out_date,
    r.booking_date,
    r.actual_check_in,
    r.actual_check_out,
    r.room_number,
    r.total_amount,
    r.paid_amount,
    r.balance_due,
    r.currency,
    r.status,
    r.source,
    r.reservation_type,
    r.guest_name,
    r.guest_email,
    r.guest_phone,
    r.special_requests,
    r.internal_notes,
    r.created_at,
    r.updated_at,
    r.version,
    CASE
      WHEN r.check_in_date IS NOT NULL
        AND r.check_out_date IS NOT NULL
      THEN GREATEST(1, (r.check_out_date::date - r.check_in_date::date))
      ELSE 1
    END AS nights
  FROM public.reservations r
  LEFT JOIN public.properties p
    ON r.property_id = p.id
  LEFT JOIN public.room_types rt
    ON r.room_type_id = rt.id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $2::uuid
    AND ($3::uuid IS NULL OR r.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR r.status = UPPER($4::text)::reservation_status
    )
    AND (
      $5::text IS NULL
      OR r.guest_name ILIKE $5
      OR r.guest_email ILIKE $5
      OR r.confirmation_number ILIKE $5
      OR r.room_number ILIKE $5
      OR rt.type_name ILIKE $5
    )
    AND ($7::uuid IS NULL OR r.guest_id = $7::uuid)
  ORDER BY r.check_in_date DESC, r.created_at DESC
  LIMIT $1
  OFFSET $6
`;

/**
 * Rooms held by one reservation, each with its nights and named occupants.
 *
 * Returned as a single row per room with the nights and occupants already
 * aggregated into JSON, so a three-room booking costs one round trip rather
 * than one per room. Ordered by `room_sequence` — "Room 1 of 3" — and each
 * room's nights by date.
 *
 * Params: $1 reservation_id, $2 tenant_id
 */
export const RESERVATION_ROOMS_SQL = `
  SELECT
    rr.reservation_room_id,
    rr.room_sequence,
    rr.room_type_id,
    rt.type_name AS room_type_name,
    rr.room_id,
    rr.room_number,
    rr.status,
    rr.adults,
    rr.children,
    rr.infants,
    rr.do_not_move,
    COALESCE(n.first_night, r.check_in_date)::text AS check_in_date,
    COALESCE(n.last_night + 1, r.check_out_date)::text AS check_out_date,
    COALESCE(n.total_amount, 0) AS total_amount,
    COALESCE(n.nights, '[]'::jsonb) AS nights,
    COALESCE(o.occupants, '[]'::jsonb) AS occupants
  FROM public.reservation_rooms rr
  JOIN public.reservations r
    ON r.id = rr.reservation_id AND r.tenant_id = rr.tenant_id
  LEFT JOIN public.room_types rt ON rt.id = rr.room_type_id
  LEFT JOIN LATERAL (
    SELECT
      MIN(rn.stay_date) AS first_night,
      MAX(rn.stay_date) AS last_night,
      SUM(rn.rate_amount) FILTER (WHERE NOT rn.is_complimentary) AS total_amount,
      -- jsonb_strip_nulls, because jsonb_build_object emits an explicit null
      -- for an absent rate_code and the response schema treats those fields as
      -- optional, not nullable — an unstripped null fails validation.
      jsonb_strip_nulls(jsonb_agg(
        jsonb_build_object(
          'stay_date', rn.stay_date::text,
          'rate_amount', rn.rate_amount,
          'currency', rn.currency,
          'rate_code', rn.rate_code,
          'is_complimentary', rn.is_complimentary
        ) ORDER BY rn.stay_date
      )) AS nights
    FROM public.reservation_nights rn
    WHERE rn.reservation_room_id = rr.reservation_room_id
      AND COALESCE(rn.is_deleted, false) = false
  ) n ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_strip_nulls(jsonb_agg(
      jsonb_build_object(
        'occupant_id', ro.occupant_id,
        'guest_id', ro.guest_id,
        'full_name', ro.full_name,
        'occupant_type', ro.occupant_type,
        'is_primary', ro.is_primary
      ) ORDER BY ro.is_primary DESC, ro.full_name
    )) AS occupants
    FROM public.reservation_occupants ro
    WHERE ro.reservation_room_id = rr.reservation_room_id
      AND COALESCE(ro.is_deleted, false) = false
  ) o ON TRUE
  WHERE rr.reservation_id = $1::uuid
    AND rr.tenant_id = $2::uuid
    AND COALESCE(rr.is_deleted, false) = false
  ORDER BY rr.room_sequence
`;

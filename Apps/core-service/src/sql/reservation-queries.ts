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
    r.number_of_adults,
    r.number_of_children,
    r.total_amount,
    r.paid_amount,
    r.balance_due,
    r.currency,
    r.status,
    r.source,
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
    AND ($2::uuid IS NULL OR r.tenant_id = $2::uuid)
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
    )
  ORDER BY r.check_in_date DESC, r.created_at DESC
  LIMIT $1
`;

export const RESERVATION_PROJECTION_LIST_SQL = `
  SELECT
    id,
    tenant_id,
    property_id,
    property_name,
    guest_id,
    room_type_id,
    room_type_name,
    confirmation_number,
    check_in_date,
    check_out_date,
    booking_date,
    actual_check_in,
    actual_check_out,
    room_number,
    number_of_adults,
    number_of_children,
    total_amount,
    paid_amount,
    balance_due,
    currency,
    status,
    status_display,
    source,
    guest_name,
    guest_email,
    guest_phone,
    notes,
    created_at,
    updated_at,
    version,
    nights
  FROM reservations_projection
  WHERE ($2::uuid IS NULL OR tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR status = UPPER($4::text)
    )
    AND (
      $5::text IS NULL
      OR guest_name ILIKE $5
      OR guest_email ILIKE $5
      OR confirmation_number ILIKE $5
    )
  ORDER BY check_in_date DESC, created_at DESC
  LIMIT $1
`;

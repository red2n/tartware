export const BILLING_PAYMENT_LIST_SQL = `
  SELECT
    p.id,
    p.tenant_id,
    p.property_id,
    prop.property_name,
    p.reservation_id,
    p.guest_id,
    p.payment_reference,
    p.external_transaction_id,
    p.transaction_type,
    p.payment_method,
    p.amount,
    p.currency,
    p.status,
    p.gateway_name,
    p.gateway_reference,
    p.processed_at,
    p.created_at,
    p.updated_at,
    p.version,
    r.confirmation_number,
    r.guest_name AS reservation_guest_name,
    r.guest_email AS reservation_guest_email,
    g.first_name AS guest_first_name,
    g.last_name AS guest_last_name
  FROM public.payments p
  LEFT JOIN public.reservations r
    ON p.reservation_id = r.id
  LEFT JOIN public.guests g
    ON p.guest_id = g.id
  LEFT JOIN public.properties prop
    ON p.property_id = prop.id
  WHERE COALESCE(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND ($2::uuid IS NULL OR p.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR p.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR p.status = UPPER($4::text)::payment_status
    )
    AND (
      $5::text IS NULL
      OR p.transaction_type = UPPER($5::text)::transaction_type
    )
    AND (
      $6::text IS NULL
      OR p.payment_method = UPPER($6::text)::payment_method
    )
  ORDER BY p.processed_at DESC NULLS LAST, p.created_at DESC
  LIMIT $1
`;

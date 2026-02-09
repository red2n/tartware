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

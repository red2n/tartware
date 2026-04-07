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
  OFFSET $7
`;

export const FOLIO_LIST_SQL = `
  SELECT
    f.folio_id AS id,
    f.tenant_id,
    f.property_id,
    prop.property_name,
    f.folio_number,
    f.folio_type,
    f.folio_status,
    f.reservation_id,
    r.confirmation_number,
    f.guest_id,
    COALESCE(f.guest_name, g.first_name || ' ' || g.last_name) AS guest_name,
    f.company_name,
    f.balance,
    f.total_charges,
    f.total_payments,
    f.total_credits,
    f.currency_code AS currency,
    f.opened_at,
    f.closed_at,
    f.created_at,
    f.updated_at
  FROM public.folios f
  LEFT JOIN public.reservations r ON f.reservation_id = r.id
  LEFT JOIN public.guests g ON f.guest_id = g.id
  LEFT JOIN public.properties prop ON f.property_id = prop.id
  WHERE COALESCE(f.is_deleted, false) = false
    AND f.deleted_at IS NULL
    AND ($2::uuid IS NULL OR f.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR f.property_id = $3::uuid)
    AND ($4::text IS NULL OR f.folio_status = UPPER($4::text))
    AND ($5::text IS NULL OR f.folio_type = UPPER($5::text))
    AND ($6::uuid IS NULL OR f.reservation_id = $6::uuid)
    AND ($7::uuid IS NULL OR f.guest_id = $7::uuid)
  ORDER BY f.opened_at DESC, f.created_at DESC
  LIMIT $1
  OFFSET $8
`;

export const FOLIO_BY_ID_SQL = `
  SELECT
    f.folio_id AS id,
    f.tenant_id,
    f.property_id,
    prop.property_name,
    f.folio_number,
    f.folio_type,
    f.folio_status,
    f.reservation_id,
    r.confirmation_number,
    f.guest_id,
    COALESCE(f.guest_name, g.first_name || ' ' || g.last_name) AS guest_name,
    f.company_name,
    f.company_reference,
    f.balance,
    f.total_charges,
    f.total_payments,
    f.total_credits,
    f.currency_code AS currency,
    f.billing_address_line1,
    f.billing_address_line2,
    f.billing_city,
    f.billing_state,
    f.billing_postal_code,
    f.billing_country,
    f.tax_exempt,
    f.tax_id,
    f.settled_at,
    f.settlement_method,
    f.notes,
    f.reference_number,
    f.opened_at,
    f.closed_at,
    f.created_at,
    f.updated_at
  FROM public.folios f
  LEFT JOIN public.reservations r ON f.reservation_id = r.id
  LEFT JOIN public.guests g ON f.guest_id = g.id
  LEFT JOIN public.properties prop ON f.property_id = prop.id
  WHERE f.folio_id = $1::uuid
    AND f.tenant_id = $2::uuid
    AND COALESCE(f.is_deleted, false) = false
    AND f.deleted_at IS NULL
`;

export const CHARGE_POSTING_LIST_SQL = `
  SELECT
    c.posting_id AS id,
    c.tenant_id,
    c.property_id,
    c.folio_id,
    f.folio_number,
    c.reservation_id,
    c.guest_id,
    COALESCE(g.first_name || ' ' || g.last_name, f.guest_name) AS guest_name,
    c.posting_date,
    c.business_date,
    c.transaction_type,
    c.posting_type,
    c.charge_code,
    c.charge_description,
    c.charge_category,
    c.quantity,
    c.unit_price,
    c.subtotal,
    c.tax_amount,
    c.service_charge,
    c.discount_amount,
    c.total_amount,
    c.currency_code AS currency,
    c.payment_method,
    c.source_system,
    c.outlet,
    c.is_voided,
    c.voided_at,
    c.void_reason,
    c.posting_date AS created_at,
    c.version
  FROM public.charge_postings c
  LEFT JOIN public.folios f ON c.folio_id = f.folio_id
  LEFT JOIN public.guests g ON c.guest_id = g.id
  WHERE COALESCE(c.is_deleted, false) = false
    AND c.deleted_at IS NULL
    AND ($2::uuid IS NULL OR c.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR c.property_id = $3::uuid)
    AND ($4::uuid IS NULL OR c.folio_id = $4::uuid)
    AND ($5::text IS NULL OR c.transaction_type = UPPER($5::text))
    AND ($6::text IS NULL OR c.charge_code = $6::text)
    AND ($7::boolean IS NULL OR c.is_voided = $7::boolean)
    AND ($9::uuid IS NULL OR c.reservation_id = $9::uuid)
  ORDER BY c.posting_date DESC, c.posting_time DESC
  LIMIT $1
  OFFSET $8
`;

export const CASHIER_SESSION_LIST_SQL = `
  SELECT
    session_id,
    tenant_id,
    property_id,
    session_number,
    session_name,
    cashier_id,
    cashier_name,
    terminal_id,
    location,
    session_status,
    opened_at,
    closed_at,
    session_duration_minutes,
    business_date,
    shift_type,
    opening_float_declared,
    closing_cash_declared,
    closing_cash_counted,
    total_transactions,
    total_revenue,
    total_refunds,
    net_revenue,
    cash_variance,
    has_variance,
    created_at,
    updated_at
  FROM cashier_sessions
  WHERE tenant_id = $2::uuid
    AND ($3::uuid IS NULL OR property_id = $3::uuid)
    AND ($4::text IS NULL OR session_status = $4::text)
  ORDER BY opened_at DESC
  LIMIT $1
  OFFSET $5
`;

export const CASHIER_SESSION_BY_ID_SQL = `
  SELECT
    session_id,
    tenant_id,
    property_id,
    session_number,
    session_name,
    cashier_id,
    cashier_name,
    terminal_id,
    terminal_name,
    till_id,
    register_id,
    location,
    session_status,
    opened_at,
    closed_at,
    session_duration_minutes,
    business_date,
    shift_type,
    opening_float_declared,
    opening_float_counted,
    opening_float_variance,
    base_currency,
    total_transactions,
    cash_transactions,
    card_transactions,
    other_transactions,
    refund_transactions,
    void_transactions,
    total_cash_received,
    total_card_received,
    total_revenue,
    total_refunds,
    total_voids,
    net_revenue,
    closing_cash_declared,
    closing_cash_counted,
    expected_cash_balance,
    cash_variance,
    cash_variance_percent,
    total_variance,
    variance_reason,
    has_variance,
    has_material_variance,
    created_at,
    updated_at
  FROM cashier_sessions
  WHERE session_id = $1::uuid
    AND tenant_id = $2::uuid
`;

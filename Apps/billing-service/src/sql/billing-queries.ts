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

export const INVOICE_LIST_SQL = `
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    prop.property_name,
    i.reservation_id,
    r.confirmation_number,
    i.guest_id,
    COALESCE(g.first_name || ' ' || g.last_name, r.guest_name) AS guest_name,
    i.invoice_number,
    i.invoice_type,
    i.invoice_date,
    i.due_date,
    i.subtotal,
    i.tax_amount,
    i.discount_amount,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    i.currency,
    i.status,
    i.sent_at,
    i.pdf_url,
    i.created_at,
    i.updated_at,
    i.version
  FROM public.invoices i
  LEFT JOIN public.reservations r ON i.reservation_id = r.id
  LEFT JOIN public.guests g ON i.guest_id = g.id
  LEFT JOIN public.properties prop ON i.property_id = prop.id
  WHERE COALESCE(i.is_deleted, false) = false
    AND i.deleted_at IS NULL
    AND ($2::uuid IS NULL OR i.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR i.property_id = $3::uuid)
    AND ($4::text IS NULL OR i.status = UPPER($4::text)::invoice_status)
    AND ($5::uuid IS NULL OR i.reservation_id = $5::uuid)
    AND ($6::uuid IS NULL OR i.guest_id = $6::uuid)
  ORDER BY i.invoice_date DESC, i.created_at DESC
  LIMIT $1
  OFFSET $7
`;

export const INVOICE_BY_ID_SQL = `
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    prop.property_name,
    i.reservation_id,
    r.confirmation_number,
    i.guest_id,
    COALESCE(g.first_name || ' ' || g.last_name, r.guest_name) AS guest_name,
    i.invoice_number,
    i.invoice_type,
    i.invoice_date,
    i.due_date,
    i.billing_from,
    i.billing_to,
    i.subtotal,
    i.tax_amount,
    i.discount_amount,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    i.currency,
    i.tax_breakdown,
    i.status,
    i.payment_terms,
    i.payment_instructions,
    i.billing_address,
    i.notes,
    i.footer_text,
    i.pdf_url,
    i.pdf_generated_at,
    i.sent_at,
    i.sent_to,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.created_by,
    i.version
  FROM public.invoices i
  LEFT JOIN public.reservations r ON i.reservation_id = r.id
  LEFT JOIN public.guests g ON i.guest_id = g.id
  LEFT JOIN public.properties prop ON i.property_id = prop.id
  WHERE i.id = $1::uuid
    AND i.tenant_id = $2::uuid
    AND COALESCE(i.is_deleted, false) = false
    AND i.deleted_at IS NULL
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
  ORDER BY c.posting_date DESC, c.posting_time DESC
  LIMIT $1
  OFFSET $8
`;

// =====================================================
// CASHIER SESSION QUERIES
// =====================================================

export const CASHIER_SESSION_LIST_SQL = `
  SELECT
    cs.session_id,
    cs.tenant_id,
    cs.property_id,
    p.property_name,
    cs.session_number,
    cs.session_name,
    cs.cashier_id,
    cs.cashier_name,
    cs.terminal_id,
    cs.terminal_name,
    cs.location,
    cs.session_status,
    cs.opened_at,
    cs.closed_at,
    cs.business_date,
    cs.shift_type,
    cs.opening_float_declared,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.expected_cash_balance,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.has_variance,
    cs.reconciled,
    cs.approved,
    cs.created_at
  FROM public.cashier_sessions cs
  LEFT JOIN public.properties p ON cs.property_id = p.id
  WHERE COALESCE(cs.is_deleted, false) = false
    AND cs.deleted_at IS NULL
    AND ($2::uuid IS NULL OR cs.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR cs.property_id = $3::uuid)
    AND ($4::text IS NULL OR cs.session_status = LOWER($4::text))
    AND ($5::text IS NULL OR cs.shift_type = LOWER($5::text))
    AND ($6::date IS NULL OR cs.business_date = $6::date)
  ORDER BY cs.opened_at DESC
  LIMIT $1
  OFFSET $7
`;

export const CASHIER_SESSION_BY_ID_SQL = `
  SELECT
    cs.session_id,
    cs.tenant_id,
    cs.property_id,
    p.property_name,
    cs.session_number,
    cs.session_name,
    cs.cashier_id,
    cs.cashier_name,
    cs.terminal_id,
    cs.terminal_name,
    cs.location,
    cs.session_status,
    cs.opened_at,
    cs.closed_at,
    cs.business_date,
    cs.shift_type,
    cs.opening_float_declared,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.expected_cash_balance,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.has_variance,
    cs.reconciled,
    cs.approved,
    cs.created_at
  FROM public.cashier_sessions cs
  LEFT JOIN public.properties p ON cs.property_id = p.id
  WHERE cs.session_id = $1::uuid
    AND cs.tenant_id = $2::uuid
    AND COALESCE(cs.is_deleted, false) = false
    AND cs.deleted_at IS NULL
`;

// =====================================================
// TAX CONFIGURATION QUERIES
// =====================================================

export const TAX_CONFIGURATION_LIST_SQL = `
  SELECT
    t.tax_config_id,
    t.tenant_id,
    t.property_id,
    p.property_name,
    t.tax_code,
    t.tax_name,
    t.tax_description,
    t.tax_type,
    t.tax_category,
    t.country_code,
    t.state_province,
    t.city,
    t.jurisdiction_name,
    t.jurisdiction_level,
    t.tax_authority_name,
    t.tax_registration_number,
    t.tax_rate,
    t.is_percentage,
    t.fixed_amount,
    t.effective_from,
    t.effective_to,
    t.is_active,
    t.calculation_method,
    t.calculation_base,
    t.is_compound_tax,
    t.rounding_method,
    t.rounding_precision,
    t.applies_to,
    t.rate_type,
    t.display_on_invoice,
    t.display_separately,
    t.display_name,
    t.display_order,
    t.allows_exemptions,
    t.exemption_types,
    t.tax_gl_account,
    t.remittance_frequency,
    t.times_applied,
    t.total_tax_collected,
    t.last_applied_at,
    t.created_at,
    t.updated_at
  FROM public.tax_configurations t
  LEFT JOIN public.properties p ON t.property_id = p.id
  WHERE COALESCE(t.is_deleted, false) = false
    AND ($2::uuid IS NULL OR t.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR t.property_id = $3::uuid)
    AND ($4::text IS NULL OR t.tax_type = LOWER($4::text))
    AND ($5::boolean IS NULL OR t.is_active = $5::boolean)
    AND ($6::text IS NULL OR t.country_code = UPPER($6::text))
    AND ($7::text IS NULL OR t.jurisdiction_level = LOWER($7::text))
  ORDER BY COALESCE(t.display_order, 999) ASC, t.tax_name ASC
  LIMIT $1
  OFFSET $8
`;

export const TAX_CONFIGURATION_BY_ID_SQL = `
  SELECT
    t.tax_config_id,
    t.tenant_id,
    t.property_id,
    p.property_name,
    t.tax_code,
    t.tax_name,
    t.tax_description,
    t.tax_type,
    t.tax_category,
    t.country_code,
    t.state_province,
    t.city,
    t.jurisdiction_name,
    t.jurisdiction_level,
    t.tax_authority_name,
    t.tax_authority_id,
    t.tax_registration_number,
    t.tax_account_number,
    t.tax_rate,
    t.is_percentage,
    t.fixed_amount,
    t.effective_from,
    t.effective_to,
    t.is_active,
    t.calculation_method,
    t.calculation_base,
    t.is_compound_tax,
    t.compound_on_tax_codes,
    t.compound_order,
    t.rounding_method,
    t.rounding_precision,
    t.applies_to,
    t.excluded_items,
    t.rate_type,
    t.is_tiered,
    t.tier_ranges,
    t.per_person_rate,
    t.per_night_rate,
    t.max_nights,
    t.max_persons,
    t.minimum_taxable_amount,
    t.maximum_taxable_amount,
    t.minimum_tax_amount,
    t.maximum_tax_amount,
    t.allows_exemptions,
    t.exemption_types,
    t.exemption_certificate_required,
    t.applies_to_guest_types,
    t.excluded_guest_types,
    t.applies_to_rate_codes,
    t.excluded_rate_codes,
    t.applies_to_room_types,
    t.excluded_room_types,
    t.has_seasonal_rates,
    t.seasonal_rates,
    t.tax_report_category,
    t.tax_gl_account,
    t.revenue_account,
    t.liability_account,
    t.remittance_frequency,
    t.remittance_due_day,
    t.last_remittance_date,
    t.next_remittance_date,
    t.filing_required,
    t.filing_frequency,
    t.display_on_invoice,
    t.display_on_folio,
    t.display_separately,
    t.display_name,
    t.display_order,
    t.show_in_online_booking,
    t.include_in_total_price,
    t.times_applied,
    t.total_tax_collected,
    t.last_applied_at,
    t.notes,
    t.internal_notes,
    t.metadata,
    t.created_at,
    t.created_by,
    t.updated_at,
    t.updated_by
  FROM public.tax_configurations t
  LEFT JOIN public.properties p ON t.property_id = p.id
  WHERE t.tax_config_id = $1
    AND t.tenant_id = $2
    AND COALESCE(t.is_deleted, false) = false
`;

// =====================================================
// ACCOUNTS RECEIVABLE QUERIES
// =====================================================

export const AR_LIST_SQL = `
  SELECT
    ar.ar_id,
    ar.tenant_id,
    ar.property_id,
    p.property_name,
    ar.ar_number,
    ar.ar_reference,
    ar.account_type,
    ar.account_name,
    ar.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    ar.company_id,
    ar.source_type,
    ar.source_reference,
    ar.reservation_id,
    ar.invoice_id,
    ar.folio_id,
    ar.transaction_date,
    ar.due_date,
    ar.original_amount,
    ar.outstanding_balance,
    ar.paid_amount,
    ar.currency,
    ar.ar_status,
    ar.aging_bucket,
    ar.aging_days,
    ar.is_overdue,
    ar.payment_terms,
    ar.payment_count,
    ar.last_payment_date,
    ar.priority,
    ar.created_at
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  LEFT JOIN public.guests g ON ar.guest_id = g.id
  WHERE ar.tenant_id = $2
    AND ($3::UUID IS NULL OR ar.property_id = $3)
    AND ($4::VARCHAR IS NULL OR ar.ar_status = $4)
    AND ($5::VARCHAR IS NULL OR ar.account_type = $5)
    AND ($6::VARCHAR IS NULL OR ar.aging_bucket = $6)
    AND COALESCE(ar.is_deleted, false) = false
  ORDER BY ar.created_at DESC
  LIMIT $1
  OFFSET $7
`;

export const AR_BY_ID_SQL = `
  SELECT
    ar.ar_id,
    ar.tenant_id,
    ar.property_id,
    p.property_name,
    ar.ar_number,
    ar.ar_reference,
    ar.account_type,
    ar.account_name,
    ar.account_id,
    ar.account_code,
    ar.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    ar.company_id,
    ar.contact_name,
    ar.contact_email,
    ar.contact_phone,
    ar.billing_address,
    ar.source_type,
    ar.source_reference,
    ar.reservation_id,
    ar.invoice_id,
    ar.folio_id,
    ar.transaction_date,
    ar.due_date,
    ar.original_amount,
    ar.outstanding_balance,
    ar.paid_amount,
    ar.currency,
    ar.ar_status,
    ar.aging_bucket,
    ar.aging_days,
    ar.days_overdue,
    ar.is_overdue,
    ar.payment_terms,
    ar.payment_terms_days,
    ar.early_payment_discount_percent,
    ar.early_payment_discount_days,
    ar.discount_deadline,
    ar.late_fee_applicable,
    ar.late_fees_charged,
    ar.interest_applicable,
    ar.interest_accrued,
    ar.payment_count,
    ar.last_payment_date,
    ar.last_payment_amount,
    ar.payments,
    ar.in_collection,
    ar.collection_notes,
    ar.disputed,
    ar.dispute_reason,
    ar.dispute_amount,
    ar.written_off,
    ar.write_off_amount,
    ar.write_off_reason,
    ar.write_off_date,
    ar.is_bad_debt,
    ar.has_payment_plan,
    ar.installment_count,
    ar.next_installment_due_date,
    ar.priority,
    ar.notes,
    ar.internal_notes,
    ar.tags,
    ar.created_at,
    ar.updated_at
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  LEFT JOIN public.guests g ON ar.guest_id = g.id
  WHERE ar.ar_id = $1
    AND ar.tenant_id = $2
    AND COALESCE(ar.is_deleted, false) = false
`;

export const AR_AGING_SUMMARY_SQL = `
  SELECT
    ar.property_id,
    p.property_name,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = 'current' THEN ar.outstanding_balance END), 0) AS current_amount,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '1_30_days' THEN ar.outstanding_balance END), 0) AS days_1_30,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '31_60_days' THEN ar.outstanding_balance END), 0) AS days_31_60,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '61_90_days' THEN ar.outstanding_balance END), 0) AS days_61_90,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '91_120_days' THEN ar.outstanding_balance END), 0) AS days_91_120,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = 'over_120_days' THEN ar.outstanding_balance END), 0) AS over_120,
    COALESCE(SUM(ar.outstanding_balance), 0) AS total_outstanding,
    COUNT(*) AS total_accounts,
    COALESCE(MIN(ar.currency), 'USD') AS currency
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  WHERE ar.tenant_id = $1
    AND ($2::UUID IS NULL OR ar.property_id = $2)
    AND ar.ar_status IN ('open', 'partial', 'overdue')
    AND COALESCE(ar.is_deleted, false) = false
  GROUP BY ar.property_id, p.property_name
`;

// =====================================================
// SHIFT HANDOVER / SUMMARY QUERIES
// =====================================================

/**
 * Aggregate transaction totals for a single cashier session.
 * $1 = session_id, $2 = tenant_id
 */
export const SHIFT_SUMMARY_SQL = `
  SELECT
    cs.session_id,
    cs.session_number,
    cs.cashier_name,
    cs.terminal_id,
    cs.shift_type,
    cs.session_status,
    cs.business_date,
    cs.opened_at,
    cs.closed_at,
    cs.opening_float_declared,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.has_variance,
    cs.reconciled,
    cs.metadata,
    COALESCE(
      (SELECT COUNT(*) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'CHARGE'
         AND cp.voided = false), 0
    )::int AS charge_count,
    COALESCE(
      (SELECT SUM(cp.total_amount) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'CHARGE'
         AND cp.voided = false), 0
    ) AS charge_total,
    COALESCE(
      (SELECT COUNT(*) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'PAYMENT'
         AND cp.voided = false), 0
    )::int AS payment_count,
    COALESCE(
      (SELECT SUM(ABS(cp.total_amount)) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'PAYMENT'
         AND cp.voided = false), 0
    ) AS payment_total
  FROM cashier_sessions cs
  WHERE cs.session_id = $1::uuid
    AND cs.tenant_id = $2::uuid
    AND COALESCE(cs.is_deleted, false) = false
`;

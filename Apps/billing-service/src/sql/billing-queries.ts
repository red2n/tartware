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
    c.created_at,
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

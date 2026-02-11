// =====================================================
// COMPANY QUERIES
// =====================================================

export const COMPANY_LIST_SQL = `
  SELECT
    c.company_id,
    c.tenant_id,
    c.company_name,
    c.legal_name,
    c.company_code,
    c.company_type,
    c.primary_contact_name,
    c.primary_contact_email,
    c.primary_contact_phone,
    c.billing_contact_name,
    c.billing_contact_email,
    c.city,
    c.state_province,
    c.country,
    c.credit_limit,
    c.current_balance,
    c.payment_terms,
    c.payment_terms_type,
    c.credit_status,
    c.commission_rate,
    c.commission_type,
    c.preferred_rate_code,
    c.discount_percentage,
    c.tax_id,
    c.tax_exempt,
    c.contract_number,
    c.contract_start_date,
    c.contract_end_date,
    c.contract_status,
    c.iata_number,
    c.arc_number,
    c.total_bookings,
    c.total_revenue,
    c.average_booking_value,
    c.last_booking_date,
    c.is_active,
    c.is_vip,
    c.is_blacklisted,
    c.requires_approval,
    c.created_at,
    c.updated_at
  FROM public.companies c
  WHERE COALESCE(c.is_deleted, false) = false
    AND ($2::uuid IS NULL OR c.tenant_id = $2::uuid)
    AND ($3::text IS NULL OR c.company_type = LOWER($3::text))
    AND ($4::boolean IS NULL OR c.is_active = $4::boolean)
    AND ($5::text IS NULL OR c.credit_status = LOWER($5::text))
    AND ($6::boolean IS NULL OR c.is_blacklisted = $6::boolean)
  ORDER BY c.company_name ASC
  LIMIT $1
  OFFSET $7
`;

export const COMPANY_BY_ID_SQL = `
  SELECT
    c.company_id,
    c.tenant_id,
    c.company_name,
    c.legal_name,
    c.company_code,
    c.company_type,
    c.primary_contact_name,
    c.primary_contact_title,
    c.primary_contact_email,
    c.primary_contact_phone,
    c.billing_contact_name,
    c.billing_contact_email,
    c.billing_contact_phone,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state_province,
    c.postal_code,
    c.country,
    c.credit_limit,
    c.current_balance,
    c.payment_terms,
    c.payment_terms_type,
    c.credit_status,
    c.commission_rate,
    c.commission_type,
    c.preferred_rate_code,
    c.discount_percentage,
    c.tax_id,
    c.tax_exempt,
    c.tax_exempt_certificate_number,
    c.tax_exempt_expiry_date,
    c.contract_number,
    c.contract_start_date,
    c.contract_end_date,
    c.contract_status,
    c.auto_renew,
    c.website_url,
    c.iata_number,
    c.arc_number,
    c.clia_number,
    c.total_bookings,
    c.total_revenue,
    c.average_booking_value,
    c.last_booking_date,
    c.customer_lifetime_value,
    c.preferred_communication_method,
    c.reporting_frequency,
    c.notes,
    c.internal_notes,
    c.is_active,
    c.is_vip,
    c.is_blacklisted,
    c.blacklist_reason,
    c.requires_approval,
    c.created_at,
    c.created_by,
    c.updated_at,
    c.updated_by,
    c.version
  FROM public.companies c
  WHERE c.company_id = $1
    AND c.tenant_id = $2
    AND COALESCE(c.is_deleted, false) = false
`;
